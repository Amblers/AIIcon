import { describe, expect, it } from 'vitest';
import { guardSvg, SvgGuardError } from '../src/services/svg-guard';

const linePalette = { primary: '#2563EB', background: null, supporting: [] };
const bgPalette = { primary: '#FFFFFF', background: '#0F172A', supporting: [] };

function lineSvg(body = '<path d="M96 256H416M256 96V416" fill="none" stroke="#2563EB" stroke-width="30" stroke-linecap="round"/>') {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${body}</svg>`;
}

function roundedSvg(rx = 96) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect x="0" y="0" width="512" height="512" rx="${rx}" fill="#0F172A"/><path d="M170 256H342M256 170V342" fill="#FFFFFF"/></svg>`;
}

describe('SVG guard', () => {
  it('accepts a valid line icon and normalizes its root', () => {
    const result = guardSvg(lineSvg(), linePalette, '线形图标', {
      templateId: 'line',
      primaryColor: '#2563EB',
      backgroundColor: null,
      roundedRadiusPx: 0,
    });
    expect(result.svg).toContain('viewBox="0 0 512 512"');
    expect(result.svg).toContain('width="512"');
    expect(result.palette.primary).toBe('#2563EB');
    expect(result.palette.background).toBeNull();
  });

  it('accepts a rounded background icon and derives the background palette', () => {
    const result = guardSvg(roundedSvg(), bgPalette, '白色图标', {
      templateId: 'rounded-bg',
      primaryColor: '#FFFFFF',
      backgroundColor: '#0F172A',
      roundedRadiusPx: 96,
    });
    expect(result.palette.background).toBe('#0F172A');
    expect(result.palette.primary).toBe('#FFFFFF');
  });

  it('rejects scripts, event handlers and external references', () => {
    const cases = [
      lineSvg('<script>alert(1)</script><path d="M0 0" fill="none" stroke="#2563EB"/>'),
      lineSvg('<path d="M0 0" fill="none" stroke="#2563EB" onload="alert(1)"/>'),
      lineSvg('<image href="https://example.com/a.png"/>'),
      lineSvg('<foreignObject><div xmlns="http://www.w3.org/1999/xhtml">x</div></foreignObject>'),
    ];
    for (const svg of cases) {
      expect(
        () =>
          guardSvg(svg, linePalette, '', {
            templateId: 'line',
            primaryColor: '#2563EB',
            backgroundColor: null,
            roundedRadiusPx: 0,
          }),
        svg,
      ).toThrow(SvgGuardError);
    }
  });

  it('rejects doctypes and entity declarations', () => {
    expect(() =>
      guardSvg(
        '<!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg viewBox="0 0 512 512"><path d="M0 0" fill="none" stroke="#2563EB"/></svg>',
        linePalette,
        '',
        {
          templateId: 'line',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
  });

  it('accepts controlled tonal layering in the solid template', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M96 96H416V416H96Z" fill="#2563EB"/><path d="M160 160H352V352H160Z" fill="#60A5FA"/></svg>`;
    const result = guardSvg(
      svg,
      { primary: '#2563EB', background: null, supporting: ['#60A5FA'] },
      '分层图标',
      {
        templateId: 'solid',
        primaryColor: '#2563EB',
        backgroundColor: null,
        roundedRadiusPx: 0,
      },
    );
    expect(result.palette.supporting).toEqual(['#60A5FA']);
  });

  it('rejects unrelated hues in the solid template', () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><path d="M96 96H416V416H96Z" fill="#2563EB"/><path d="M160 160H352V352H160Z" fill="#EF4444"/></svg>`;
    expect(() =>
      guardSvg(
        svg,
        { primary: '#2563EB', background: null, supporting: ['#EF4444'] },
        '',
        {
          templateId: 'solid',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
  });

  it('rejects a filled shape in the line template', () => {
    expect(() =>
      guardSvg(
        lineSvg('<path d="M96 96H416V416H96Z" fill="#2563EB" stroke="none"/>'),
        linePalette,
        '',
        {
          templateId: 'line',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
  });

  it('rejects an incorrect rounded radius', () => {
    expect(() =>
      guardSvg(roundedSvg(30), bgPalette, '', {
        templateId: 'rounded-bg',
        primaryColor: '#FFFFFF',
        backgroundColor: '#0F172A',
        roundedRadiusPx: 96,
      }),
    ).toThrow(/圆角/);
  });

  it('rejects a transparent template with a full-canvas background', () => {
    expect(() =>
      guardSvg(
        lineSvg('<rect x="0" y="0" width="512" height="512" fill="#2563EB"/><path d="M96 256H416" fill="none" stroke="#FFFFFF"/>'),
        linePalette,
        '',
        {
          templateId: 'line',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
  });

  it('rejects a background icon without its background layer', () => {
    expect(() =>
      guardSvg(
        lineSvg('<path d="M170 256H342M256 170V342" fill="#FFFFFF"/>'),
        bgPalette,
        '',
        {
          templateId: 'square-bg',
          primaryColor: '#FFFFFF',
          backgroundColor: '#0F172A',
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(/背景/);
  });

  it('rejects disallowed attributes and text content', () => {
    expect(() =>
      guardSvg(
        lineSvg('<path d="M0 0" fill="none" stroke="#2563EB" style="stroke:red"/>'),
        linePalette,
        '',
        {
          templateId: 'line',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
    expect(() =>
      guardSvg(
        lineSvg('<path d="M0 0" fill="none" stroke="#2563EB">text</path>'),
        linePalette,
        '',
        {
          templateId: 'line',
          primaryColor: '#2563EB',
          backgroundColor: null,
          roundedRadiusPx: 0,
        },
      ),
    ).toThrow(SvgGuardError);
  });
});
