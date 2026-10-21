import http from 'node:http';

const PORT = Number(process.env.MOCK_DEEPSEEK_PORT || 9999);

function luminance(hex) {
  const value = hex.replace('#', '');
  const rgb = [0, 2, 4].map((index) => Number.parseInt(value.slice(index, index + 2), 16) / 255);
  const linear = rgb.map((channel) =>
    channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

function safeBackground(primary) {
  return contrast(primary, '#0F172A') >= 3 ? '#0F172A' : '#F7F4EC';
}

function extractTask(prompt) {
  const start = prompt.indexOf('{');
  if (start < 0) return null;
  try {
    return JSON.parse(prompt.slice(start));
  } catch {
    return null;
  }
}

function buildSvg(task) {
  const template = task.template?.id ?? 'line';
  let primary = task.primary_color === 'auto' ? '#2563EB' : task.primary_color;
  const supportsBackground = ['circle-bg', 'square-bg', 'rounded-bg'].includes(template);
  let background = supportsBackground
    ? task.background_color === 'auto'
      ? safeBackground(primary)
      : task.background_color
    : null;

  if (supportsBackground) {
    if (task.primary_color === 'auto') {
      primary = contrast('#FFFFFF', background) >= 3 ? '#FFFFFF' : '#17211B';
    } else if (task.background_color === 'auto') {
      background = safeBackground(primary);
    }
  }

  const star =
    'M256 92C274.5 183 329 237.5 420 256C329 274.5 274.5 329 256 420C237.5 329 183 274.5 92 256C183 237.5 237.5 183 256 92Z';
  const content = String(task.icon_content || '图标');
  const alt = `${content}图标`;

  if (template === 'line') {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M112 256H400M256 112V400" fill="none" stroke="${primary}" stroke-width="34" stroke-linecap="round" stroke-linejoin="round"/><circle cx="398" cy="114" r="16" fill="none" stroke="${primary}" stroke-width="24"/></svg>`,
      palette: { primary, background: null, supporting: [] },
      alt,
    };
  }

  if (template === 'solid' || template === 'mono') {
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${star}" fill="${primary}"/><circle cx="397" cy="113" r="16" fill="${primary}"/></svg>`,
      palette: { primary, background: null, supporting: [] },
      alt,
    };
  }

  if (template === 'multicolor') {
    const coral = '#EF7758';
    const gold = '#DDF06E';
    return {
      svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="${star}" fill="${primary}"/><path d="M394 86C400 116 418 134 448 140C418 146 400 164 394 194C388 164 370 146 340 140C370 134 388 116 394 86Z" fill="${coral}"/><circle cx="120" cy="392" r="25" fill="${gold}"/></svg>`,
      palette: { primary, background: null, supporting: [coral, gold] },
      alt,
    };
  }

  const radius = Number(task.rounded_radius_px);
  const rx = Number.isFinite(radius) ? Math.min(256, Math.max(0, radius)) : 96;
  const backgroundShape =
    template === 'circle-bg'
      ? `<circle cx="256" cy="256" r="256" fill="${background}"/>`
      : template === 'square-bg'
        ? `<rect x="0" y="0" width="512" height="512" fill="${background}"/>`
        : `<rect x="0" y="0" width="512" height="512" rx="${rx}" fill="${background}"/>`;

  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${backgroundShape}<g transform="translate(86 86) scale(0.67)"><path d="${star}" fill="${primary}"/><circle cx="397" cy="113" r="16" fill="${primary}"/></g></svg>`,
    palette: { primary, background, supporting: [] },
    alt,
  };
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || !req.url?.endsWith('/chat/completions')) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: { message: 'not found' } }));
    return;
  }

  let raw = '';
  req.setEncoding('utf8');
  req.on('data', (chunk) => {
    raw += chunk;
  });
  req.on('end', () => {
    let payload;
    try {
      payload = JSON.parse(raw);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'invalid json' } }));
      return;
    }

    if (!req.headers.authorization?.startsWith('Bearer ')) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: { message: 'missing key' } }));
      return;
    }

    const messages = payload.messages || [];
    const userMessage = messages.findLast?.((message) => message.role === 'user');
    const userContent = String(userMessage?.content || '');
    if (payload.max_tokens <= 8) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          model: payload.model,
          choices: [{ message: { role: 'assistant', content: 'pong' } }],
          usage: { prompt_tokens: 3, completion_tokens: 1 },
        }),
      );
      return;
    }

    const task = extractTask(userContent);
    if (!task) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          model: payload.model,
          choices: [{ message: { role: 'assistant', content: '{"unexpected":true}' } }],
        }),
      );
      return;
    }

    const result = buildSvg(task);
    const delay = Number(process.env.MOCK_DEEPSEEK_DELAY_MS || 850);
    setTimeout(() => {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          model: payload.model,
          choices: [
            {
              message: {
                role: 'assistant',
                content: JSON.stringify(result),
              },
            },
          ],
          usage: { prompt_tokens: 1200, completion_tokens: 400 },
        }),
      );
    }, delay);
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Mock DeepSeek listening on http://127.0.0.1:${PORT}`);
});
