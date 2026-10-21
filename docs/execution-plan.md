# AIicon 执行计划

| 项目 | 内容 |
| --- | --- |
| 目标版本 | MVP v0.1 |
| 计划版本 | v1.0 |
| 编写日期 | 2026-10-20 |
| 关联需求 | [产品需求文档](./requirements.md) |
| 估算前提 | 1 名全栈开发，已有本机 Node 环境，无需等待外部设计/法务 |
| 预计工期 | 22 个工作日 + 2 天缓冲，约 5 周（任务级保守估算合计约 21.75 人天） |
| 交付形态 | 本地 Web 应用：Vue 3 前端 + 同源 Node BFF，单命令启动 |

---

## 1. 交付目标

在 MVP 中交付一个可完整跑通的本地工具：

1. 配置并安全保存 DeepSeek API Key 与模型，支持连接测试。
2. 提供 7 套模板与对应 Skill，支持微调关键词。
3. 支持主色、背景色、圆角设置；颜色可留空由 AI 规划。
4. 支持 1～20 个任务的单枚/批量生成，有确认、进度、取消、失败重试。
5. 结果可预览、查看 SVG、重掷、单枚导出、批量导出 SVG/PNG。
6. 对 AI SVG 做严格安全校验，保证前端不执行脚本、不加载外链。
7. 具备草稿恢复、错误提示、文件名校验等基础体验。
8. 具备单元测试、集成测试、核心 E2E 和运行文档。

**不属于交付目标**：登录、云同步、公网部署、多模型供应商、管理后台、图标编辑器。参见 PRD 第 13 节。

---

## 2. 技术基线

### 2.1 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 前端框架 | Vue 3 + TypeScript + Vite | Composition API + `<script setup>` |
| 状态 | Pinia | 草稿、配置、生成队列、结果 |
| 路由 | 不引入 Vue Router | MVP 为单页工作台，设置使用 Dialog |
| UI 组件 | Element Plus + 自定义 CSS Token | 快速获得可靠表单、弹窗、提示；视觉层自定义，避免默认感 |
| 样式 | 原生 CSS / CSS Variables | 避免 Tailwind 与组件库样式冲突；桌面优先 |
| 图标/动效 | 自绘少量 UI 图标 + CSS | 不引入大体积图标包 |
| HTTP | 浏览器 `fetch` + 同源 `/api` | 无 Axios，减少依赖 |
| 导出 | JSZip + Canvas 2D | SVG 序列化、PNG 栅格化、批量 ZIP |
| 前端安全 | DOMPurify（二次防护） | AI SVG 服务端已清洗，前端再防护；仅 `<img>` 渲染 |
| 后端 | Node.js 22 + Fastify + TypeScript | 同源托管、配置、DeepSeek 代理、SVG 校验 |
| 参数校验 | Zod | 前后端共享 Schema |
| SVG 解析 | `@xmldom/xmldom` + 严格白名单 | 服务端不依赖浏览器 DOM |
| 密钥加密 | Node `crypto`（AES-256-GCM） | 本地文件保险箱，环境变量优先 |
| 测试 | Vitest + Vue Test Utils + Playwright | 单元、组件、端到端 |
| 工具 | pnpm workspace、ESLint、Prettier、tsx | 统一脚本与类型检查 |

> 若实现时某个库版本与 Node/浏览器不兼容，优先保持架构与验收标准不变，替换为同等能力的维护中库。

### 2.2 技术决策

| 决策 | 内容 |
| --- | --- |
| 单仓多包 | `apps/web`、`apps/server`、`packages/shared`，pnpm workspace 管理 |
| 同源部署 | 开发时 Vite 代理 `/api` 到 BFF；生产时 Fastify 托管 `apps/web/dist` |
| Key 不落浏览器 | 服务端保存并仅在发请求时解密；配置接口只返回掩码 |
| 逐图标 API | `POST /api/icons/generate` 每次一枚；前端控制批量与并发 |
| 服务端不排队 | 服务端无状态；取消通过 HTTP 中断向上游传播 |
| 结果不落盘 | 仅前端内存保存；P1 再引入 IndexedDB |
| 模型不硬编码 | 默认 `deepseek-flash`，可配置或自定义；服务端统一注入 |
| 模板 Skill 共享 | 模板元数据与基础风格规则放 `shared`，UI 展示与服务端 Prompt 同源 |
| 发布方式 | 本机 `pnpm start`；默认监听 `127.0.0.1:8787` |

---

## 3. 系统架构

### 3.1 架构图

```mermaid
flowchart LR
    subgraph Browser["浏览器 / Vue 3 SPA"]
        UI["工作台 UI<br/>模板 / 颜色 / 任务 / 结果"]
        Store["Pinia<br/>草稿 / 配置 / 队列"]
        Queue["批量调度器<br/>并发 3 / 取消 / 重试"]
        Preview["安全预览<br/>Blob URL → img"]
        Export["导出引擎<br/>SVG / Canvas PNG / JSZip"]
    end

    subgraph Node["本地 Node BFF / Fastify"]
        Config["配置与密钥保险箱"]
        API["/api 路由 + Zod"]
        DeepSeek["DeepSeek Client"]
        Prompt["Prompt Builder<br/>模板 Skill"]
        Guard["SVG Guard<br/>白名单 / 规范化 / 修复"]
        Static["静态文件托管"]
    end

    DS["DeepSeek API"]

    UI --> Store
    Store --> Queue
    Queue -->|"POST /api/icons/generate"| API
    UI -->|"GET/PUT /api/config"| API
    API --> Config
    API --> Prompt
    Prompt --> DeepSeek
    DeepSeek -->|"HTTPS /chat/completions"| DS
    DeepSeek --> Guard
    Guard --> API
    UI --> Preview
    UI --> Export
    Static --> UI
```

### 3.2 单枚生成时序

```mermaid
sequenceDiagram
    participant U as 用户
    participant W as Vue 工作台
    participant Q as 队列
    participant B as Fastify BFF
    participant D as DeepSeek
    participant G as SVG Guard

    U->>W: 点击确认生成
    W->>W: 前置校验 + 设置快照 + 确认弹窗
    W->>Q: 入队 N 个任务
    loop 并发 3
        Q->>B: POST /api/icons/generate + 请求参数
        B->>B: 校验模型/请求/配置
        B->>D: Chat Completions (json_object)
        D-->>B: JSON/SVG 或错误
        B->>G: 解析 + 白名单 + 颜色/结构校验
        alt 校验失败，且未修复
            B->>D: 修复请求（仅 1 次）
            D-->>B: 修复后的 JSON/SVG
            B->>G: 再次校验
        end
        B-->>Q: 安全 SVG + palette + 元数据 / 结构化错误
        Q->>W: 更新任务状态与结果
    end
    W-->>U: 逐枚预览 / 失败重试 / 导出
```

### 3.3 数据流边界

- **只进不出的秘密**：Key 从 UI → BFF 后只用于上游请求；永远不会返回浏览器。
- **不可信输入**：任务内容、关键词、AI 返回内容均视为不可信；分别做长度/字符校验和 SVG 白名单校验。
- **两处快照**：本地草稿（持久化）与生成快照（内存）；生成结果绑定快照，避免表单变化污染已生成结果。
- **不存生成内容**：服务端仅处理请求，不落库、不写生成日志。

---

## 4. 仓库结构

```text
AIicon/
├─ package.json                     # workspace 脚本
├─ pnpm-workspace.yaml
├─ tsconfig.base.json
├─ .env.example
├─ README.md
├─ docs/
│  ├─ requirements.md
│  └─ execution-plan.md
├─ packages/
│  └─ shared/
│     ├─ package.json
│     └─ src/
│        ├─ templates.ts            # 7 套模板 + Skill 基础规则
│        ├─ schemas.ts              # Zod 请求/响应/配置 Schema
│        ├─ types.ts                # 共享 TS 类型
│        ├─ colors.ts               # HEX/对比度工具
│        ├─ filenames.ts            # 文件名清洗与唯一性
│        └─ errors.ts               # 错误码与用户文案
├─ apps/
│  ├─ web/
│  │  ├─ index.html
│  │  ├─ vite.config.ts             # /api 代理
│  │  └─ src/
│  │     ├─ main.ts
│  │     ├─ App.vue
│  │     ├─ api/client.ts           # 类型化 fetch + 取消
│  │     ├─ stores/
│  │     │  ├─ config.ts
│  │     │  ├─ draft.ts
│  │     │  └─ generation.ts
│  │     ├─ composables/
│  │     │  ├─ useGenerationQueue.ts
│  │     │  ├─ useDraftPersistence.ts
│  │     │  ├─ useSvgPreview.ts
│  │     │  └─ useExport.ts
│  │     ├─ components/
│  │     │  ├─ layout/AppHeader.vue
│  │     │  ├─ settings/SettingsDialog.vue
│  │     │  ├─ workspace/TemplatePicker.vue
│  │     │  ├─ workspace/SkillKeywordEditor.vue
│  │     │  ├─ workspace/ColorField.vue
│  │     │  ├─ workspace/RadiusField.vue
│  │     │  ├─ workspace/TaskList.vue
│  │     │  ├─ workspace/TaskRow.vue
│  │     │  ├─ workspace/GenerateBar.vue
│  │     │  ├─ workspace/ConfirmGenerateDialog.vue
│  │     │  ├─ results/ResultBoard.vue
│  │     │  ├─ results/ResultCard.vue
│  │     │  ├─ results/ResultDetailDialog.vue
│  │     │  └─ export/ExportBar.vue
│  │     ├─ styles/tokens.css
│  │     └─ utils/download.ts
│  └─ server/
│     ├─ src/
│     │  ├─ index.ts                # Fastify 启动、静态托管、安全头
│     │  ├─ routes/
│     │  │  ├─ health.ts
│     │  │  ├─ config.ts
│     │  │  └─ generate.ts
│     │  ├─ services/
│     │  │  ├─ config-vault.ts      # 加密保存/读取
│     │  │  ├─ deepseek.ts          # 上游调用、超时、错误映射
│     │  │  ├─ prompt-builder.ts
│     │  │  ├─ svg-guard.ts
│     │  │  ├─ generation-service.ts
│     │  │  └─ logger.ts            # 脱敏日志
│     │  ├─ env.ts
│     │  └─ errors.ts
│     └─ test/
│        ├─ svg-guard.test.ts
│        ├─ prompt-builder.test.ts
│        ├─ config-vault.test.ts
│        ├─ generate-route.test.ts
│        └─ fixtures/
└─ e2e/
   ├─ fixtures/fake-deepseek.ts
   └─ specs/*.spec.ts
```

---

## 5. 模块实施设计

### 5.1 共享模板与 Skill

**文件**：`packages/shared/src/templates.ts`

每个模板导出：

```ts
export const TEMPLATE_SKILLS: Record<TemplateId, TemplateSkill> = {
  line: {
    id: 'line',
    version: '1.0.0',
    name: '线性',
    description: '仅描边、统一线宽的透明背景图标',
    coreRules: [
      '仅使用描边，fill 必须为 none',
      '线宽 28-36，全图一致',
      'stroke-linecap 与 stroke-linejoin 为 round',
      '图形位于 64-448 安全区'
    ],
    negativeRules: [
      '禁止填充主图形',
      '禁止背景块',
      '禁止渐变、文字、外链'
    ],
    safeArea: { x: 64, y: 64, w: 384, h: 384 },
    suggestedKeywords: ['几何', '圆角', '均匀线宽', '极简', '负空间'],
    supportsBackground: false,
    supportsRadius: false,
    maxColors: 1
  },
  // solid / mono / multicolor / circle-bg / square-bg / rounded-bg
};
```

**验收**

- 模板数恰好 7 个。
- 每套包含用户展示字段和 Prompt 规则字段。
- 服务端 Prompt 与 UI 文案引用同一份定义，不出现两处重复维护。
- 圆角模板的 `supportsRadius = true`，其他为 `false`。
- 背景模板 `supportsBackground = true`。

### 5.2 服务端配置保险箱

**文件**：`config-vault.ts`

- 配置目录：使用 `env-paths('aiicon', { suffix: '' }).config`；默认类似：
  - Windows：`%APPDATA%\AIicon`
  - macOS：`~/Library/Application Support/AIicon`
  - Linux：`~/.config/AIicon`
- 文件：
  - `config.json`：模型、Base URL、密文、IV、AuthTag。
  - `vault.key`：32 字节随机密钥，首次启动生成。
- 加密：AES-256-GCM，随机 12 字节 IV，AAD 可使用固定字符串 `aiicon:deepseek-key:v1`。
- 写入使用临时文件 + rename，避免断电破坏；文件权限尽量设为 `0o600`（Windows 权限位不完整，文档如实说明）。
- 优先级：`DEEPSEEK_API_KEY` 环境变量 > 加密文件。若环境变量存在，UI 忽略/禁用文件 Key 编辑，并显示“环境变量提供”。
- 解密失败：不崩溃，标记未配置，提示用户重新填写；不打印密文或密钥。
- 清除：删除配置中 Key 相关字段；保留模型设置。
- 启动时只加载配置元信息，不主动发上游请求。

**测试**

- 写入 → 重启读取 → 可解密；磁盘文件不含明文 Key。
- 环境变量覆盖；清除后未配置。
- 破坏密文/缺失 vault key 时的降级。

### 5.3 DeepSeek Client

**文件**：`deepseek.ts`

职责：

- 用原生 `fetch` 调用 `POST {baseUrl}/chat/completions`。
- 从配置读取 Key 和模型；不在客户端接受模型参数。
- 每次调用设置 `AbortSignal.timeout(90_000)`，并与客户端断开的 signal 合并。
- 返回结构化结果：`{ content, usage, model, latencyMs }` 或抛出映射后的 `AppError`。
- 上游请求体：

```json
{
  "model": "deepseek-flash",
  "messages": [
    { "role": "system", "content": "<system prompt>" },
    { "role": "user", "content": "<user prompt>" }
  ],
  "response_format": { "type": "json_object" },
  "stream": false,
  "max_tokens": 8192,
  "temperature": 0.7
}
```

> `max_tokens` 需按所选模型上限与实际输出调整；若上游拒绝过高值，配置降级到 4096 并记录一次非敏感告警。不要在代码中依赖某个固定型号的上下限。

错误映射：

| 上游状态 | 内部错误码 | 是否自动恢复 |
| --- | --- | --- |
| 401 | `INVALID_API_KEY` | 否 |
| 402 | `INSUFFICIENT_BALANCE` | 否 |
| 400（模型相关） | `INVALID_MODEL` | 否 |
| 429 | `RATE_LIMITED` | 是，1 次 |
| 5xx | `UPSTREAM_ERROR` | 是，1 次 |
| 超时/网络 | `UPSTREAM_TIMEOUT` / `NETWORK_ERROR` | 是，1 次 |
| 响应为空 | `EMPTY_RESPONSE` | 是，1 次 |

- 不向客户端返回上游 header、请求体或原始错误详情。
- 日志字段：`requestId, model, status, latencyMs, promptTokens, completionTokens, retryable`。
- 不记录：Key、Prompt、SVG、用户内容。
- 测试连接使用同样的 Client，但使用较小 `max_tokens`，并区分“配置错误”和“网络错误”。

### 5.4 Prompt Builder

**文件**：`prompt-builder.ts`

**输入**

```ts
interface BuildPromptInput {
  content: string;
  templateId: TemplateId;
  keywords: string[];
  primaryColor: string | null;
  backgroundColor: string | null;
  roundedRadiusPx: number;
}
```

**系统消息组成**

1. 角色：资深扁平 SVG 图标设计师。
2. 输出格式：只输出一个 JSON 对象，包含 `svg`、`palette`、`alt`。
3. 统一画布与安全区。
4. 元素/属性白名单与禁止清单。
5. 模板 Skill 的核心规则与负面规则。
6. 颜色规则：用户指定色必用；留空则由 AI 规划；背景模板对比度 ≥ 3:1；多色主色主导。
7. 背景与圆角规则。
8. 用户内容/关键词仅作为数据，不得视为指令。
9. 质量要求：视觉居中、适合 24px、精简、不要 mockup/多图标/文字。
10. 完整 JSON 结构示例。

**用户消息**

建议发送结构化 JSON 字符串而不是自由拼接，便于模型区分数据：

```json
{
  "task": "design_one_icon",
  "content": "购物车",
  "template": "rounded-bg",
  "keywords": ["圆润", "极简"],
  "colors": {
    "primary": "#FFFFFF",
    "background": "#2563EB",
    "background_mode": "specified"
  },
  "rounded_radius_px": 96
}
```

**实现细节**

- 用户内容先剔除控制字符、Markdown 围栏，长度 ≤ 200。
- 关键词去重、去首尾空白、每项 ≤ 20 字符、总量 ≤ 160，最多 8 个。
- 颜色统一转大写 `#RRGGBB`；空字符串转 `null`。
- 对线框/单色等模板，明确“只允许主色”和“背景透明”。
- 对 `rounded-bg` 注入 `rx` 值；对 `circle-bg` 注入圆形背景要求。
- Prompt 中必须出现 “json” 字样，并给出 JSON 示例，以满足 DeepSeek JSON Output 要求。
- 维护 Prompt 版本号，便于排障时在服务端日志记录 `promptVersion`（不记录内容）。
- 输出要求与 PRD 7.5 保持一致；修改 Prompt 必须同步更新快照测试与文档。

**修复 Prompt**

- 输入：原任务摘要、上一版 SVG（截断到安全长度）、校验错误列表。
- 要求：仅修复列出的问题，不改变用户已指定颜色/模板/画布。
- 仍使用同一 Skill 与 JSON 输出协议。
- 最多 1 次；修复请求本身失败也计入 2 次上限。

### 5.5 SVG Guard

**文件**：`svg-guard.ts`

目标：将不可信的模型输出转为**可安全渲染的最小 SVG**，或返回明确拒绝。

**处理步骤**

1. **前置体积限制**：SVG 字符串 ≤ 100KB；JSON 整体 ≤ 150KB。
2. **DTD/实体检查**：拒绝 `<!DOCTYPE`、`<!ENTITY`、处理指令。
3. **XML 解析**：使用 `@xmldom/xmldom` 解析，捕获 parse error；根节点必须是 `svg`（忽略命名空间前缀差异）。
4. **树遍历与白名单**：
   - 元素：`svg, g, path, rect, circle, ellipse, line, polyline, polygon`。
   - 属性白名单：
     - 根：`xmlns, viewBox, width, height`
     - 通用：`fill, stroke, stroke-width, stroke-linecap, stroke-linejoin, stroke-miterlimit, opacity, fill-opacity, stroke-opacity, fill-rule, clip-rule, transform`
     - 形状：`d, x, y, width, height, rx, ry, cx, cy, r, x1, y1, x2, y2, points`
   - 其他属性一律拒绝或移除；`id`、`class`、`href`、`xlink:*`、`on*` 一律拒绝。
   - 节点数 ≤ 300；图元（非 `g/svg`）≤ 120。
5. **值校验**：
   - 颜色仅接受 `#RGB`、`#RRGGBB`、`none`、`transparent`；统一转大写六位 HEX。
   - 数值属性为有限数字；拒绝 `NaN`、`Infinity`、`url(...)`、`expression`。
   - `stroke-width` 合理范围（1～64）；`rx` 0～256。
   - 不允许 `style`，不允许外部引用。
6. **结构校验**：
   - 强制 `viewBox="0 0 512 512"`；规范化根尺寸。
   - 背景模板：存在背景层；其覆盖区域合理（圆/满版矩形）；背景色与用户指定或 palette 一致。
   - 基础模板：不出现疑似满版背景（首层 512×512 矩形或半径 256 的圆），检测到则拒绝或标记；以 Prompt 约束为主，校验为兜底。
   - `rounded-bg`：背景矩形 `rx` 与请求值一致的检查作为质量校验项；不一致则进入修复。
7. **颜色校验**：
   - 从 SVG 实际颜色属性中提取色值，不允许出现用户指定主色/背景色之外的“近似替换”。
   - 用户指定主色：必须在 SVG 中实际出现。
   - 背景模板指定背景色：必须用于背景层。
   - 多色模板：实际颜色种类 2～3；主色占主导。
   - 基础模板：背景必须透明，不填充画布。
   - AI 自动配色：`palette` 内颜色必须能在 SVG 中找到。
   - 背景模板 AI 配色：按 WCAG 相对亮度公式计算对比度，≥ 3:1。
8. **规范化与安全化**：
   - 重新序列化（而不是回传原字符串），移除 XML 声明、注释、命名空间污染。
   - 根节点补齐 `xmlns`、`viewBox`，可补齐 `width="512" height="512"`。
   - 移除空 `g`；限制输出 ≤ 100KB。
9. **返回**：

```ts
interface GuardedIcon {
  svg: string;
  palette: { primary: string; background: string | null; supporting: string[] };
  alt: string;
  warnings: string[];
}
```

**前端二次防护**

- `DOMPurify.sanitize(svg, { USE_PROFILES: { svg: true } })`，再构造 Blob URL。
- 使用 `<img :src="objectUrl">`，不将 SVG 放进 `v-html`。
- `URL.revokeObjectURL` 在卡片卸载/重生成时清理。
- CSP 限制脚本和图片来源。
- 服务端拒绝的内容不缓存、不预览。

**测试夹具**

- 合法线框、背景圆、圆角矩形、多色图标。
- `<script>`、`onload`、`href="javascript:"`、`<image href="https://...">`、`<foreignObject>`、`<style>`、`<!ENTITY>`。
- 超长、超节点、缺少 viewBox、错误颜色、背景缺失、非 SVG 根、空响应。
- 颜色大小写与 3 位 HEX 规范化。
- 确保任何危险输入都不会原样进入输出。

### 5.6 生成路由

**`POST /api/icons/generate`**

请求 Schema（Zod）：

```ts
const GenerateRequest = z.object({
  content: z.string().trim().min(1).max(200),
  templateId: z.enum(['line','solid','mono','multicolor','circle-bg','square-bg','rounded-bg']),
  keywords: z.array(z.string().trim().min(1).max(20)).max(8).default([]),
  primaryColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  backgroundColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).nullable(),
  roundedRadiusPx: z.number().int().min(0).max(256)
});
```

服务端处理：

1. 清理请求；对 `rounded-bg` 外的 `roundedRadiusPx` 可置默认但不使用。
2. 检查模板与背景支持关系；基础模板忽略 backgroundColor。
3. 加载配置；未配置立即返回 `CONFIG_MISSING`。
4. 构造 Prompt → 调用 DeepSeek → 解析 JSON：
   - 优先直接 `JSON.parse` 模型 `message.content`；
   - 容忍意外的 Markdown 围栏：仅在 JSON 模式仍被包裹时剥离围栏；
   - 从首个 `{` 开始做括号配对并解析平衡 JSON 对象，禁止 `eval`/动态执行；
   - 空内容、无法配对、Schema 不通过均映射为可恢复错误。
5. 执行 SVG Guard；失败则发起至多 1 次修复。
6. 对所有上游/解析/校验错误做结构化映射。
7. 成功返回：

```json
{
  "requestId": "req_...",
  "svg": "<svg ...>...</svg>",
  "palette": {
    "primary": "#2563EB",
    "background": "#FFFFFF",
    "supporting": []
  },
  "alt": "白色圆角方形背景上的蓝色购物车图标",
  "templateId": "rounded-bg",
  "model": "deepseek-flash",
  "attempts": 1,
  "durationMs": 8420,
  "warnings": []
}
```

- 不返回 AI 原始响应、思考过程、完整 Prompt、usage 原始对象。
- 不将模型选择的实际颜色混入用户请求快照；结果自带 palette。

**自动恢复逻辑**

```text
attempt 1: 生成
  ├─ 成功且 Valid → 返回
  ├─ 质量不合格 → attempt 2 = 修复
  └─ 429/5xx/超时/空响应 → attempt 2 = 重新生成
attempt 2:
  ├─ 成功且 Valid → 返回
  └─ 失败 → 返回结构化错误
```

- 不可恢复错误（401/402/无效模型/内容拒绝）不进入 attempt 2。
- 总尝试次数 2，服务端日志记录 `attempts`。
- 客户端取消时，合并 signal 终止上游；路由捕获 abort 并记为 canceled，不返回 500 堆栈。

### 5.7 前端状态与队列

**Store 划分**

- `useConfigStore`
  - `config: DeepSeekConfig`
  - `loading`, `saving`, `testing`
  - actions：`load`, `save`, `clearKey`, `test`, `openSettings`
- `useDraftStore`
  - `style`: `StyleSettings`
  - `tasks`: `IconTask[]`
  - `exportOptions`
  - 自动持久化 watcher（排除结果）
  - actions：`addTask`, `removeTask`, `updateTask`, `setTemplate`, `setKeyword`, `validate`
- `useGenerationStore`
  - `phase: 'idle' | 'running' | 'done'`
  - `snapshot: RunSnapshot | null`（当前运行参数；每枚 `IconResult` 另存独立的 `styleSnapshot`）
  - `results: Record<string, IconResult>`
  - `activeControllers: Map<string, AbortController>`
  - `progress`
  - actions：`startBatch`, `cancel`, `retryFailed`, `regenerateTask`, `clearResults`

**批量队列**

- 启动时冻结表单，复制任务和样式为 `RunSnapshot`；API 设置弹窗可打开查看，但保存、清除、测试连接均禁用，避免批次中途切换模型或 Key。
- 前端并发池大小 3；不使用 `Promise.all(tasks.map(...))` 以免一次打满。
- 每个任务有独立 `AbortController`；父控制器统一取消。
- 状态转移：
  - `idle → queued → generating → succeeded`
  - 任一环节失败：`queued/generating → failed`
  - 取消：`queued → canceled`；进行中 `→ canceled`（即使后台稍后返回，也丢弃结果）
- 生成前清空被本次批次覆盖任务的旧结果，避免把旧图误当新图。
- 单枚失败不能 reject 整个队列；每个 worker 捕获后继续下一个。
- 批次结束：`phase = done`；记录成功、失败、取消计数。
- 重试失败项和单枚重掷使用**当前表单设置的新快照**；界面需在操作前提示“将使用当前设置”。已成功的其他结果保持不变。
- 每个 `IconResult` 保存自身的 `styleSnapshot`（模板、关键词、请求颜色、圆角）与 palette；结果卡、详情与导出校验都读取该快照，禁止用当前表单反推历史结果。
- 同一任务若存在 active request，禁止再次提交。
- 删除任务时级联移除其当前结果；若该结果已成功，先二次确认。生成过程中禁止删除。
- 刷新/关闭页面时，如有进行中任务，注册 `beforeunload` 确认。

**草稿持久化**

- `watch` 深度监听 `style + tasks + exportOptions`，500ms 防抖。
- 存 `localStorage` key：`aiicon:draft:v1`，带 `savedAt`。
- 仅序列化任务的 `id/content/fileName`；`status/resultId/error` 等运行时字段不写入，恢复后统一置为 `idle`。
- 读取时校验版本与 Schema；损坏则丢弃并提示，不阻塞启动。
- 不存 Key、SVG、结果、错误详情中的上游敏感信息。
- 提供“清空草稿”操作，重置默认模板/一行任务。

### 5.8 预览与详情

- `useSvgPreview(svg)`：
  1. 前端 DOMPurify 二次清洗（SVG profile）。
  2. `new Blob([svg], { type: 'image/svg+xml' })` → `URL.createObjectURL`。
  3. 卸载时 revoke。
- 卡片：懒加载 `<img loading="lazy" decoding="async">`，设置 `alt`。
- 透明棋盘底 CSS 渐变；切换浅/深检查底不修改 SVG。
- 卡片与详情中的模板、请求颜色、圆角读取该结果的 `styleSnapshot`；实际色板读取 `palette`，不要使用当前表单值反推。
- 详情弹窗展示大图、文件名、模板、调色板、耗时、模型、`attempts`。
- SVG 源码只读展示，复制按钮复制 sanitized SVG。
- 错误卡只显示错误文案/错误码和重试按钮，不展示未经校验的 SVG。
- 生成中的卡片骨架使用固定比例，避免网格跳动。

### 5.9 导出引擎

**SVG**

- 直接使用服务端已规范化的 SVG 字符串。
- `new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })` 下载。
- 文件名：`normalizeBaseName(task.fileName) + '.svg'`。

**PNG**

- 从 sanitized SVG 创建 Blob URL。
- `const img = new Image(); img.src = url; await img.decode()`。
- `canvas.width = selectedSize; canvas.height = selectedSize`。
- `ctx.clearRect(...)` 保留透明；`ctx.drawImage(img, 0, 0, size, size)`。
- `canvas.toBlob(resolve, 'image/png')`；空 Blob 视为失败。
- 背景模板由 SVG 自带背景层，不要额外填白。
- 大尺寸（1024）使用矢量重绘，不经过位图放大。
- 每张导出后 `await nextTick`/短暂让出主线程，更新进度。
- 失败项记录并继续其他项；最终汇总告知成功/失败数量。

**ZIP**

- 使用 JSZip。
- 仅成功结果；按所选格式放入根目录（单格式）或 `svg/`、`png/`（双格式）。
- 文件名先经共享 `normalizeBaseName`，再在 ZIP 内做大小写不敏感去重。
- 不将任何用户输入作为 ZIP 路径；只作为文件名。
- 生成 ZIP 名称 `aiicon-export-YYYYMMDD-HHmm.zip`。
- ZIP 完成后通过临时 `<a>` 下载并 revoke URL。
- 导出期间禁用导出按钮，显示 `正在导出 x/N`。
- 空结果或全部失败：按钮禁用。

**单枚下载**

- 详情/卡片菜单提供“下载 SVG”“下载 PNG（当前尺寸）”。
- 单枚 PNG 使用当前选择的 PNG 尺寸；用户未选择尺寸时默认 512。

### 5.10 前后端 API 契约

#### GET `/api/config`

```json
{
  "configured": true,
  "source": "file",
  "maskedKey": "sk-••••••••7f2a",
  "model": "deepseek-flash",
  "baseUrl": "https://api.deepseek.com"
}
```

#### PUT `/api/config`

```json
{
  "apiKey": "sk-...",
  "model": "deepseek-flash"
}
```

- `apiKey` 可选；不传或传空字符串均表示保留现有 Key；清除 Key 必须走 `DELETE /api/config/key`，避免误提交清空。
- 环境变量来源时忽略 `apiKey`，返回 409 或明确的只读错误。
- 响应只返回 GET 同结构，不含完整 Key。

#### DELETE `/api/config/key`

- 删除文件保存的 Key；环境变量来源返回 409。
- 响应：`{ "configured": false }`。

#### POST `/api/config/test`

```json
{ "apiKey": "sk-...", "model": "deepseek-flash" }
```

- `apiKey` 可选，缺省使用已保存 Key。
- 返回：

```json
{ "ok": true, "model": "deepseek-flash", "latencyMs": 842 }
```

- 失败仍返回 HTTP 200 + `ok:false` 或标准错误结构，按团队约定统一；前端按 `code` 展示。

#### POST `/api/icons/generate`

见 5.6。请求/响应均使用共享 Zod Schema。

#### 统一错误结构

```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key 无效，请更新后重试。",
    "retryable": false,
    "requestId": "req_01J..."
  }
}
```

- HTTP 状态码仅用于传输语义，前端以 `error.code` 为准。
- `message` 为可直接展示的中文；不包含上游原始堆栈、Key、完整 Prompt。
- `requestId` 用于本地日志排查。

#### 安全头

- `Content-Security-Policy`: 限定 self、data/blob 图片，禁止内联脚本。
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: no-referrer`
- `Permissions-Policy`: 关闭不需要的硬件能力。
- 生产环境不返回详细错误堆栈。
- 校验 `Origin` 为同源；本地开发允许 Vite 代理来源。

### 5.11 环境变量

`.env.example`：

```dotenv
# 服务端口
PORT=8787
HOST=127.0.0.1

# 可选：环境变量提供 Key 时，UI 不再接受 Key 编辑
DEEPSEEK_API_KEY=

# 可选：自定义网关；默认 https://api.deepseek.com
DEEPSEEK_BASE_URL=https://api.deepseek.com

# 可选：默认模型（也可在 UI 修改）
DEEPSEEK_MODEL=deepseek-flash

# 可选：上游与客户端超时（毫秒）
DEEPSEEK_TIMEOUT_MS=90000
```

- 不提交真实 `.env`；`.gitignore` 排除 `.env`、配置目录和输出文件。
- 优先级：
  - API Key：`DEEPSEEK_API_KEY` > 本地加密配置；环境变量存在时 UI 只读。
  - Base URL：`DEEPSEEK_BASE_URL` > 默认官方地址，不在 UI 中编辑。
  - 模型：本地保存值 > `DEEPSEEK_MODEL` > 代码默认 `deepseek-flash`；环境变量只作为初始默认，用户仍可在 UI 中修改并持久化。
- 服务启动时不打印 Key、配置路径内的密文。

---

## 6. 里程碑与排期

### 6.1 总览

```text
第 1 周（Day 1-5）
  M1 基础骨架、共享契约、工作台 UI（Day 1-4）
  M2 BFF 起步、配置保险箱（Day 5-7）
第 2 周（Day 6-10）
  M2 完成配置与测试连接（Day 6-7）
  M3 Prompt Builder、SVG Guard、单枚生成纵切（Day 8-11）
第 3 周（Day 11-15）
  M3 完成单枚真实生成（Day 11）
  M4 批量队列、进度/取消/重试（Day 12-14）
  M5 结果预览与导出（Day 15-18）
第 4 周（Day 16-20）
  M5 完成 SVG/PNG/ZIP 导出
  M6 测试、安全加固、文档（Day 19-22）
第 5 周（Day 21-24）
  M6 收尾（Day 21-22）
  验收、缺陷修复、真实 API 抽检与缓冲（Day 23-24）
```

### 6.2 里程碑表

| 里程碑 | 时间 | 交付物 | 出口条件 |
| --- | --- | --- | --- |
| M1 可点击工作台 | Day 1–4 | Vue 壳、模板选择、关键词、颜色、任务表、假数据结果 | 交互与状态完整；表单校验通过；无真实 API 依赖也可评审 |
| M2 配置与连通 | Day 5–7 | BFF、加密配置、模型设置、测试连接 | 可用真实 Key 验证；脱敏与权限符合要求 |
| M3 单枚生成纵切 | Day 8–11 | Prompt Builder、SVG Guard、生成 API、真实预览 | 一套模板可稳定生成并安全展示；7 套模板 Prompt 已完成 |
| M4 批量编排 | Day 12–14 | 并发队列、确认弹窗、进度、取消、失败重试 | 3～10 枚批量可用；取消和部分成功正确 |
| M5 预览与导出 | Day 15–18 | 结果网格、详情、SVG/PNG 单枚与 ZIP、命名校验 | 七套模板导出抽检通过；透明与尺寸正确 |
| M6 发布候选 | Day 19–22 | 测试、安全加固、README、示例配置 | 全部 P0 验收通过；无高危问题 |
| 验收/缓冲 | Day 23–24 | 缺陷修复、真实 API 抽检、版本构建 | 用户验收通过，可交付 |

### 6.3 关键路径

1. **SVG Guard 是最高风险模块**，必须先于单枚生成完成，否则后面积累大量脏数据。
2. **Prompt 与模板 Skill** 决定首轮成功率；在 Day 8 就做真实 API 小样本验证，不要等 UI 完成后才测。
3. **批量队列**依赖单枚 API 稳定；先实现“单枚可重试”，再扩展批量。
4. **PNG 导出**依赖安全预览链路；不要在未完成 SVG 校验前实现 canvas 栅格化。
5. **真实 API 测试**人工执行，不进入 CI，避免持续费用和网络不稳定。

### 6.4 估算

| 阶段 | 人天 |
| --- | --- |
| 仓库/工具链/共享契约/模板数据/布局基础 | 2.0 |
| 工作台 UI 与交互（模板、关键词、颜色、任务表、设置、草稿） | 4.75 |
| BFF 基础、配置保险箱、DeepSeek Client | 2.25 |
| Prompt Builder + 7 套模板 Skill | 1.0 |
| SVG Guard + 自动修复 | 1.5 |
| 生成路由 + 单枚真实联调 | 1.25 |
| 批量队列 + 取消/重试 + 状态 | 2.25 |
| 预览 + 详情 | 1.25 |
| SVG/PNG/ZIP 导出 | 1.75 |
| 测试、安全加固、文档、构建、验收支持 | 3.75 |
| **合计** | **21.75 人天（按 22 个工作日排期，另留 2 天缓冲）** |

> 表中为保守估算，与第 7 节任务拆解一致。若 UI 使用成熟组件库、真实 API 首轮成功率高，可压缩到 16～18 人天；不建议将 SVG 安全校验和测试压缩到 10 人天以下。2 天缓冲用于真实 API 适配、浏览器差异和缺陷修复。

---

## 7. 详细任务拆解

### 7.1 基础与共享

| ID | 任务 | 依赖 | 产出/验收 | 估算 |
| --- | --- | --- | --- | --- |
| T00 | 初始化 pnpm workspace、TS、Lint、Vitest、目录 | — | `pnpm install/dev/build` 可运行 | 0.5d |
| T01 | 定义共享类型、错误码、Zod Schema、文件名工具、颜色工具 | T00 | 单测覆盖颜色、文件名、Schema | 0.5d |
| T02 | 编写 7 套 TemplateSkill 与用户可见元数据 | T01 | 数据完整；前后端可引用 | 0.5d |
| T03 | 设计 Token、页面骨架、响应式布局 | T00 | 1440/1024 下无溢出 | 0.5d |

### 7.2 前端工作台

| ID | 任务 | 依赖 | 产出/验收 | 估算 |
| --- | --- | --- | --- | --- |
| F01 | AppHeader、全局状态/配置入口 | T03 | 未配置/已配置状态正确 | 0.25d |
| F02 | TemplatePicker + 模板说明 + 静态示例 | T02, T03 | 7 套可选，分组和选中态正确 | 0.75d |
| F03 | SkillKeywordEditor + 推荐词 + 按模板记忆 | T02 | 标签增删、上限、恢复默认、切换保留 | 0.75d |
| F04 | ColorField + RadiusField + AI 自动状态 + 对比度警告 | T01 | 取色/HEX 同步，背景按模板启停 | 0.75d |
| F05 | TaskList + TaskRow + 增删行 + 文件名后缀 + 行内校验 | T01, T03 | 0–20 行，空行规则、重名阻止 | 1.0d |
| F06 | SettingsDialog + 配置状态 + 测试连接交互 | F01, B02 | 脱敏展示、保存/清除/测试闭环 | 0.75d |
| F07 | Draft persistence + 恢复提示 + 清空 | F05 | 刷新恢复，不含 Key/结果 | 0.5d |

### 7.3 服务端与 AI

| ID | 任务 | 依赖 | 产出/验收 | 估算 |
| --- | --- | --- | --- | --- |
| B01 | Fastify 启动、静态托管、安全头、健康检查 | T00 | 生产/开发同源可访问 | 0.5d |
| B02 | 配置保险箱 + `/api/config` + 测试路由 | T01, B01 | AES 加密、掩码、环境变量优先级 | 1.0d |
| B03 | DeepSeek Client、超时、错误映射、日志脱敏 | B02 | mock 上游集成测试通过 | 0.75d |
| B04 | Prompt Builder + 修复 Prompt + Prompt 单测 | T02, B03 | 快照稳定、符合 PRD 7.5 | 1.0d |
| B05 | SVG Guard 白名单、规范化、颜色/背景校验 | T01 | 安全夹具全部通过 | 1.5d |
| B06 | Generate 路由 + 自动修复循环 + 取消传播 | B03–B05 | 单枚端到端可用；最多 2 次调用 | 0.75d |
| B07 | 真实 API 适配与 7 模板抽样 | B06 | 每模板 ≥3 枚，记录失败原因 | 0.5d |

### 7.4 批量、预览、导出

| ID | 任务 | 依赖 | 产出/验收 | 估算 |
| --- | --- | --- | --- | --- |
| G01 | 生成 Store、队列池、状态机、进度 | B06, F05 | 并发 3、状态准确、无重复请求 | 1.0d |
| G02 | 确认摘要、表单锁定、取消、离开页面提醒 | G01 | 批量确认与取消验收通过 | 0.75d |
| G03 | 失败重试、单枚重掷、结果替换规则 | G01 | 只重试目标项；不覆盖其他成功结果 | 0.5d |
| R01 | ResultBoard/Card、透明棋盘、明暗检查底 | G01 | 逐枚出现；错误/成功状态可辨 | 0.75d |
| R02 | 结果详情、源码复制、单枚下载 | R01 | 弹窗可访问；复制为净化后 SVG | 0.5d |
| E01 | SVG 下载 + 文件名清洗 | T01, R01 | 合法 SVG，命名正确 | 0.25d |
| E02 | Canvas PNG 导出 + 尺寸/透明校验 | R02 | 5 种尺寸正确，透明背景保持 | 0.5d |
| E03 | ZIP 批量导出、双格式目录、进度、去重 | E01, E02 | ZIP 可解压；只含成功项 | 0.75d |
| E04 | 导出栏、格式选择、禁用态、错误汇总 | E03 | 空结果/全部失败禁用正确 | 0.25d |

### 7.5 质量与发布

| ID | 任务 | 依赖 | 产出/验收 | 估算 |
| --- | --- | --- | --- | --- |
| Q01 | 单元测试补齐：文件名、颜色、Prompt、SVG Guard、队列 | 各模块 | 核心工具覆盖率 ≥ 80%（分支可适当豁免） | 1.0d |
| Q02 | Fastify 集成测试：配置、错误映射、超时、取消 | B02–B07 | mock 上游覆盖主要错误分支 | 0.5d |
| Q03 | Playwright E2E：配置 → 单枚 → 批量 → 导出 | G/R/E | 使用 mock 上游，稳定可重复 | 0.75d |
| Q04 | 安全审查：XSS 夹具、密钥泄露扫描、CSP、路径 | Q01–Q03 | 无高危/中危未处理项 | 0.5d |
| Q05 | README、运行说明、.env.example、已知限制 | 全部 | 新环境按文档可跑通 | 0.5d |
| Q06 | 生产构建、真实 Key 冒烟、七模板人工验收 | Q01–Q05 | 交付候选版本 | 0.5d |

---

## 8. 测试计划

### 8.1 测试层级

| 层级 | 工具 | 范围 | 是否进 CI |
| --- | --- | --- | --- |
| 单元 | Vitest | 共享工具、Prompt、SVG Guard、队列状态、颜色对比度、文件名 | 是 |
| 组件 | Vitest + Vue Test Utils | 模板/关键词交互、任务增删与校验、背景控件联动、确认弹窗 | 是 |
| 服务端集成 | Vitest + Fastify inject + 本地 mock 上游 | 配置 API、生成路由、错误映射、自动修复、取消 | 是 |
| E2E | Playwright + mock DeepSeek | 首次配置、单枚生成、批量取消、失败重试、SVG/PNG/ZIP | 是 |
| 真实 API 冒烟 | 手工 | 7 套模板、颜色、关键词、模型切换 | 否，发布前人工 |
| 视觉 QA | 人工 | 图标可辨识度、留白、对比度、线宽 | 否 |

### 8.2 必测用例

**配置**

- 保存、重载、掩码显示；完整 Key 不在 localStorage/IndexedDB/网络返回中出现。
- 环境变量优先与只读；清除文件 Key。
- 测试连接成功、401、402、模型不存在、超时。
- 配置接口非法输入、超大 body。

**模板与 Skill**

- 七套模板均能生成；基础模板无背景；三个背景模板有背景。
- 圆角 0 / 96 / 256 的边界与预览。
- 关键词增删、长度上限、按模板记忆、恢复默认。
- 模板切换时颜色控件启停正确。

**生成**

- 单枚生成成功并展示。
- 批量 3 枚，最多同时 3 个请求。
- 取消后不再有新请求；成功项可导出。
- 失败项重试只重试失败项。
- 批量确认取消不发请求。
- 未配置 Key 不发起请求。
- 服务端首次非法输出、第二次修复成功。
- 连续两次非法输出 → 失败，无未净化 SVG。
- 429/5xx/超时映射正确。
- 表单在生成期间锁定。
- 设置快照：生成后修改颜色，旧结果不变；单枚重掷用新设置。

**SVG Guard**

- 全部安全夹具。
- 颜色实际使用校验。
- 背景模板缺失背景被拒绝/修复。
- 圆角与请求不符触发修复。
- 体积、节点数、图元数限制。
- 合法 SVG 经过序列化后仍可被浏览器打开。

**文件与导出**

- 文件名非法字符、Windows 保留名、扩展名剥离、重名、连续连字符合并。
- SVG 下载打开正确，`viewBox` 正确。
- PNG 尺寸 64/128/256/512/1024 精确；无背景透明；背景完整。
- 双格式 ZIP 目录正确，文件数与成功数一致。
- 无成功项时导出按钮禁用。
- ZIP 内用户输入不能形成路径穿越。

**草稿与 UI**

- 刷新恢复模板、关键词、颜色、任务、导出选项。
- 不恢复 Key、SVG、结果。
- 1440/1280/1024 布局无横向溢出。
- 键盘可打开设置、选择模板、添加任务、确认生成。
- 预览图有 alt；弹窗焦点陷阱。

### 8.3 真实 API 验收样本

至少准备以下 10 个内容词，覆盖中文与英文、简单与抽象：

`购物车、消息、云同步、AI 写作、数据报表、安全盾牌、设置、用户中心、Search、Credit Card`

对 7 套模板，重点抽检：

- 线性：笔画是否统一、无填充。
- 面性：是否只有填充、负空间清晰。
- 单色：是否只有一种色值。
- 多色：是否 2～3 色且主色主导。
- 圆底/方底/圆角方底：背景是否满版、图标是否居中、圆角是否匹配。

### 8.4 CI 命令建议

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

- E2E 启动一个本地 mock DeepSeek 服务，通过 `DEEPSEEK_BASE_URL` 指向它。
- 测试不得读取真实 `.env`；CI 不配置真实 Key。
- 真实 API 冒烟由人工执行并记录到发布检查单。

---

## 9. 安全评审清单

发布前逐项确认：

- [ ] 浏览器 `localStorage`/`sessionStorage`/IndexedDB 中检索不到 API Key。
- [ ] `/api/config` 响应、页面源码、构建产物中无完整 Key。
- [ ] 服务端日志、错误响应、前端 console 无 Key、完整 Prompt、完整 SVG。
- [ ] 本地配置文件的 Key 为密文；vault key 文件权限尽量受限；README 说明本地安全边界。
- [ ] 所有配置/生成输入经过 Zod 校验，含长度、枚举、颜色格式、圆角范围。
- [ ] SVG 危险夹具全部被拒绝，Blob 预览不执行脚本。
- [ ] 前端无 `v-html` 渲染 AI 内容；CSP 生效。
- [ ] 生成接口限制 body 大小、SVG 大小、节点数量；服务端无文件系统路径注入。
- [ ] ZIP 文件名已清洗，不含路径分隔符和 `..`。
- [ ] 生产模式错误不返回堆栈；不暴露服务端内部路径。
- [ ] 默认绑定 `127.0.0.1`；README 明确禁止未经加固的公网部署。
- [ ] `DEEPSEEK_API_KEY` 不写入 `.env.example` 的真实值、不提交 `.env`。
- [ ] 配置测试接口不能被任意 URL 利用（Base URL 仅环境变量，不在 UI 输入）。
- [ ] 请求取消不会导致未捕获异常或进程退出。
- [ ] 依赖审计无已知高危漏洞（`pnpm audit` 结果记录）。

---

## 10. 风险登记与应对

| 风险 | 概率 | 影响 | 触发信号 | 应对 | 负责人 |
| --- | --- | --- | --- | --- | --- |
| AI 输出质量不稳定 | 高 | 高 | 首轮校验通过率 < 85% | 收紧 Skill、降低温度、修复 Prompt、人工抽检；必要时默认推荐 `deepseek-v4-pro` | 后端/产品 |
| SVG 白名单过严导致大量失败 | 中 | 中 | 修复后仍拒绝 > 10% | 根据真实失败类型放宽安全属性（仍禁止脚本/外链），补充合法夹具 | 后端 |
| 严格颜色校验误伤 | 中 | 中 | 合理渐变/近似色被判失败 | 只做扁平纯色；允许同色系明度变体但校验主色存在；修复提示精确 | 后端 |
| 模型返回空 JSON | 中 | 中 | DeepSeek JSON 模式偶发空内容 | 自动恢复 1 次；提示用户重试；错误可读 | 后端 |
| 批量限流 | 中 | 中 | 429 集中出现 | 并发 3、退避、尊重 Retry-After、部分成功 | 前端 |
| 生成慢导致误以为卡死 | 高 | 中 | 单枚 > 60s | 明确逐枚状态、耗时、取消；超时文案；避免转圈无反馈 | 前端 |
| Key 本地存储被读取 | 低 | 高 | 机器被入侵/共享账户 | 加密、掩码、只监听 localhost、日志脱敏；README 声明非强隔离 | 后端 |
| 浏览器 PNG 导出差异 | 中 | 中 | 不同浏览器尺寸/透明异常 | 固定 canvas 尺寸、清空画布、多浏览器 E2E、人工抽检 | 前端 |
| SVG 预览内存泄漏 | 中 | 低 | 多批生成后卡顿 | 全部 revoke Blob URL；限制结果数；P1 持久化时清理 | 前端 |
| 接口/模型名变化 | 中 | 中 | 400/404 增加 | 模型自定义、Base URL 环境变量、错误提示、README 更新 | 后端 |
| 用户期望“AI 画图” | 高 | 中 | 反馈图标不像插画 | 首屏说明“生成 SVG 图标”；展示静态模板示例；限制为图标风格 | 产品/UI |
| 设计 UI 过于通用 | 中 | 低 | 评审觉得像后台表单 | 定制 Token、模板缩略图、结果区视觉重心；不追求复杂装饰 | 前端 |
| 真实 API 费用不可控 | 低 | 中 | 批量多次重试 | 20 枚上限、2 次调用上限、确认摘要、取消 | 产品/前端 |

---

## 11. 完成定义（Definition of Done）

### 11.1 功能

- [ ] PRD 中全部 P0 需求实现。
- [ ] 7 套模板真实生成并完成至少 10 个内容词抽样。
- [ ] 单个/批量/取消/失败重试/部分成功均可工作。
- [ ] 主色、背景色、AI 自动选色、多色辅助色、圆角设置符合规格。
- [ ] 导出 SVG/PNG/ZIP 完整，文件名规则正确。
- [ ] 草稿恢复、错误提示、空状态、加载状态齐全。

### 11.2 质量

- [ ] `lint`、`typecheck`、单元测试、集成测试、E2E、生产构建全部通过。
- [ ] 安全评审清单全部通过，无高危未处理项。
- [ ] 1440/1280/1024 布局检查通过；键盘主流程可用。
- [ ] 无 API Key 泄露；无控制台未处理异常。
- [ ] 七套模板人工视觉抽检通过。

### 11.3 文档与交付

- [ ] README：环境要求、安装、开发、构建、启动、配置路径、密钥安全说明、已知限制。
- [ ] `.env.example` 与配置说明。
- [ ] 产品需求、执行计划、模板 Skill 说明可追溯。
- [ ] 真实 API 冒烟记录与已知问题清单。
- [ ] 版本号 `v0.1.0`，本地生产构建可启动。

---

## 12. 发布检查单

1. 在干净目录执行 `pnpm install && pnpm build`。
2. 复制 `.env.example`，不填入真实 Key，启动应用。
3. 通过 UI 保存真实 Key → 刷新 → 掩码状态正确。
4. 测试连接成功后，依次选择 7 套模板各生成 1 枚图标。
5. 测试留空主色/背景色，确认 AI 选色和色板展示。
6. 测试圆角 0 / 96 / 256 的预览与导出。
7. 批量 10 枚；中途取消；确认成功项仍可导出。
8. 模拟无效 Key 和断网，确认错误文案与重试入口。
9. 分别导出 SVG、PNG 512、双格式 ZIP，在文件管理器与浏览器中打开验证。
10. 检查透明模板 PNG 无白底、路径无 `..`、ZIP 解压正常。
11. 检查浏览器控制台、服务端日志、`localStorage` 无 Key。
12. 刷新页面恢复草稿；确认结果清空的提示符合预期。
13. 记录真实 API 样本与失败率，归档发布说明。

---

## 13. 后续路线（P1/P2）

### P1（MVP 后 1 个迭代）

- 最近一次结果 IndexedDB 持久化，刷新不丢结果。
- 每任务多方案（2～4 个）并选择保留。
- 行级颜色覆盖与批量导入（CSV/多行文本）。
- 暗色主题、模板收藏、最近使用。
- 结果持久化 + 清空本地数据。
- 完整 Prompt 预览与自定义 Skill（受服务端安全校验约束）。

### P2

- 团队/云端图标库、历史版本。
- 多模型供应商与自定义网关 UI。
- 图标雪碧图、多主题（light/dark/selected）批量导出。
- Figma 插件 / 设计系统同步。
- 账号、项目、分享、权限。
- 图标质量评分与自动风格一致性评分。

---

## 14. 立即执行顺序（编码启动清单）

1. 创建 pnpm workspace 与 `shared` 包；冻结类型、模板枚举、错误码。
2. 完成 `templates.ts` / `schemas.ts` 与单元测试；这是前后端共同契约。
3. 搭 Vue 工作台骨架与 mock 数据，先让交互跑通。
4. 实现配置保险箱和 DeepSeek Client，打通“测试连接”。
5. 实现 Prompt Builder、SVG Guard 与单枚生成纵切；这一步通过后再做 UI 美化。
6. 完成批量队列与取消；再实现预览、PNG/ZIP 导出。
7. 最后做安全加固、E2E、文档与真实 API 验收。
8. 任何 Prompt/白名单调整，都必须同步补测试与 PRD 变更记录。

---

## 15. 计划变更记录

| 版本 | 日期 | 说明 |
| --- | --- | --- |
| v1.0 | 2026-10-20 | 基于 PRD v1.0 制定，含架构、模块设计、22 个工作日 + 2 天缓冲排期、测试与发布检查单 |
