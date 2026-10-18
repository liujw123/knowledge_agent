# 知微 · RAG + Agent 知识库助手

基于 **Vue 3 + Node.js + 多模型 Agent** 的全栈知识库助手，默认接入 DeepSeek。上传 Markdown / PDF / DOCX 等文档后，Agent 会先检索知识库，再流式生成带可点击引用的回答。

> 关于 Dify：为了做到「克隆即跑、不依赖 Docker」，本实现把原方案中的 Dify 引擎替换成了 Node.js 内置的轻量 RAG + Agent 层。BFF、SSE 流式协议、DeepSeek、Agent 工具调用、引用联动这些核心架构保持不变。检索与 Agent 层是独立的，后续可以平滑替换为 Dify 或向量数据库。

## 功能

- **知识库扩展**：页面上传任意可解析文本的文件（PDF / DOCX / HTML / Markdown / CSV / 代码文本等），自动解析、切分、建立索引，支持删除。文件默认 **24 小时后自动过期清理**。
- **多模型配置**：前端添加多个 OpenAI 兼容模型，填写 Base URL / API Key 后自动请求 `/models`，通过下拉框选择模型 ID；也可以手动输入。必须先通过连接测试才能保存和启用。
- **Agent 检索**：模型 Function Calling 决定何时调用 `search_knowledge_base` / `list_knowledge_documents`。
- **流式回答**：Node 将 DeepSeek 的流转换为统一 SSE 事件，前端通过 `fetch + ReadableStream` 消费。
- **思考过程可视化**：检索调用、命中数量、执行状态以可折叠的 Agent 执行链展示。
- **引用溯源**：模型回答中的 `[1]` 可点击，右侧抽屉定位到对应的原始文档片段。
- **会话管理**：多会话、本地持久化、停止生成、重新生成、Markdown / 代码高亮 / 一键复制。
- **响应式布局**：桌面双栏 + 移动端侧边栏抽屉。

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端 | Vue 3、Vite、Pinia、markdown-it、highlight.js、DOMPurify |
| 后端 | Node.js、Express、Multer |
| 模型 | 任意 OpenAI 兼容接口，默认 DeepSeek `deepseek-chat` |
| 检索 | 中文二元组分词 + BM25，段落感知切分 |
| 通信 | POST + SSE（`text/event-stream`） |
| 存储 | JSON 文件 + 原始文件目录（零外部依赖） |

## 目录结构

```text
knowledge_agent/
├─ frontend/                  # Vue 3 前端
│  ├─ src/
│  │  ├─ components/          # 聊天、思考链、引用抽屉、模型设置、知识库侧栏
│  │  ├─ stores/              # Pinia：会话、知识库、模型配置、Toast
│  │  ├─ utils/markdown.js    # Markdown + 引用角标 + 代码复制
│  │  ├─ api.js               # SSE 流解析
│  │  └─ App.vue
│  └─ vite.config.js          # /api 代理到 3001
├─ server/                    # Node.js BFF + RAG + Agent
│  ├─ src/
│  │  ├─ index.js             # HTTP API、SSE、静态托管
│  │  ├─ agent.js             # Agent 工具循环
│  │  ├─ model.js             # 模型配置校验 + 连通性测试
│  │  ├─ deepseek.js          # OpenAI 兼容流式客户端
│  │  ├─ rag.js               # 中文分词 + BM25
│  │  ├─ chunk.js             # 文档切分
│  │  ├─ extract.js           # PDF / DOCX / 文本解析
│  │  └─ store.js             # 文档与索引持久化
│  └─ .env.example
└─ package.json               # pnpm workspace
```

## 快速开始

要求：Node.js >= 20、pnpm。

```bash
pnpm install
pnpm dev
```

- 前端：http://localhost:5173
- 后端：http://localhost:3001

首次启动后：

1. 点击右上角「未配置模型」打开模型设置。
2. 填入 Base URL、API Key，模型 ID 下拉框会自动从 `/models` 拉取最新列表。
3. 选择模型后点击「测试连接」，成功后才能点击「保存并启用」。
4. 打开左侧「知识库」上传文档，然后开始提问。
   上传的文档默认 24 小时后过期，服务端会自动删除文档、chunk 和原始文件。

默认 DeepSeek 配置：

```text
Base URL: https://api.deepseek.com
模型 ID: deepseek-chat
API Key: sk-...
```

模型配置保存在当前浏览器的 `localStorage`（键名 `kb-model-configs-v1`），聊天时随请求发送给本机 Node 服务。这是演示阶段的简化方案，生产环境应改为服务端加密存储。

服务端 `.env` 中的 `DEEPSEEK_API_KEY` 仍然保留为兜底配置；前端保存了模型后，优先使用前端当前启用的模型。

### 生产运行

```bash
pnpm build
pnpm start
```

`pnpm build` 产物在 `frontend/dist`，Node 服务会自动托管它；访问 http://localhost:3001 即可。

### 环境变量

| 变量 | 默认值 | 说明 |
| --- | --- | --- |
| `PORT` | `3001` | 后端端口 |
| `DEEPSEEK_API_KEY` | - | 可选，服务端兜底 Key；前端模型配置优先 |
| `DEEPSEEK_BASE_URL` | `https://api.deepseek.com` | 兜底模型地址 |
| `DEEPSEEK_MODEL` | `deepseek-chat` | 模型名 |
| `DEEPSEEK_TEMPERATURE` | `0.25` | 生成温度 |
| `AGENT_MAX_ROUNDS` | `4` | 最大工具调用轮数 |
| `RAG_TOP_K` | `5` | 每次检索片段数 |
| `MAX_UPLOAD_MB` | 不限制 | 可选，单文件大小上限；不配置表示不限制 |
| `MAX_EXTRACTED_CHARS` | 不限制 | 可选，单文档参与索引的最大字符数 |
| `DOCUMENT_TTL_HOURS` | `24` | 上传文档有效期（小时） |
| `CLEANUP_INTERVAL_MINUTES` | `10` | 服务端定时清理过期文档的间隔 |
| `CORS_ORIGIN` | `*` | 允许的前端来源，多个用逗号分隔 |
| `DATA_DIR` | `server/data` | 知识库数据目录 |

## 请求链路

```text
用户提问
  │ POST /api/chat  (SSE)
  ▼
Node BFF
  ├─ 校验 / 限流 / 读取请求中的当前模型配置
  ├─ Agent 调用模型，携带 tools
  ├─ 命中 tool_calls → 本地 BM25 检索 → 结果回填 messages
  ├─ 再调用模型，逐 token 转发
  └─ 统一转换为前端事件
  ▼
Vue 3
  ├─ status      → 当前阶段
  ├─ thought     → Agent 执行链
  ├─ sources     → 引用列表
  ├─ text        → rAF 批量追加，Markdown 增量渲染
  └─ done        → 持久化会话
```

## SSE 事件协议

每个数据包都是 `data: {json}\n\n`：

```json
{ "type": "status", "phase": "thinking", "text": "正在分析并规划…" }
{ "type": "thought", "id": "call_1", "title": "检索知识库", "detail": "“部署方式” · 命中 3 个片段", "status": "done" }
{ "type": "sources", "sources": [{ "citation": 1, "documentName": "方案.md", "chunkIndex": 2, "text": "…" }] }
{ "type": "text", "delta": "根据知识库资料……" }
{ "type": "done", "sources": [], "citationCount": 1 }
{ "type": "error", "message": "生成失败" }
```

## API

| 方法 | 路径 | 说明 |
| --- | --- | --- |
| `GET` | `/api/health` | 服务、文档统计、服务端兜底模型状态 |
| `GET` | `/api/documents` | 文档列表 + 片段数 |
| `POST` | `/api/documents` | `multipart/form-data`，字段名 `file` |
| `DELETE` | `/api/documents/:id` | 删除文档并重建索引 |
| `POST` | `/api/models/list` | 根据 `{ baseUrl, apiKey }` 请求 `/models` 获取模型 ID |
| `POST` | `/api/models/test` | 测试 `{ baseUrl, model, apiKey }` 连通性 |
| `POST` | `/api/chat` | `{ query, history, model }`，返回 SSE |

## RAG 实现说明

DeepSeek 目前不提供 Embedding 接口，因此默认使用 **BM25 词法检索**，而不是伪造成“向量检索”：

1. 按空行 / 标题 / 标点切分，chunk 约 950 字，重叠 140 字，保留标题作为上下文。
2. 英文按单词索引；中文按重叠二元组分词（`知识库` → `知识` + `识库`），解决中文无空格问题。
3. 使用 BM25 打分，标题加权，返回 Top K 片段。
4. 检索结果按 `[1]`、`[2]` 编号注入 Agent 上下文，并在系统提示中约束模型不得编造引用。

如果后续需要语义召回，可以在 `server/src/rag.js` 中增加 BGE-M3 Embedding + 向量库，再将 BM25 分数与向量分数做 RRF / 加权融合；Agent、SSE、前端引用流程无需改动。

## 关键实现

### 前端

- `stores/chat.js`：流式消息、`requestAnimationFrame` 批量刷新、停止 / 重新生成、localStorage 持久化。
- `stores/models.js`：多模型配置、当前模型切换、localStorage 持久化。
- `components/ModelSettings.vue`：模型新增 / 编辑 / 删除、强制连通测试、保存并启用。
- `api.js`：`fetch + ReadableStream` 解析 SSE，不依赖只支持 GET 的 `EventSource`。
- `utils/markdown.js`：Markdown 渲染、代码高亮、引用角标插件、DOMPurify 消毒。
- `SourceDrawer.vue`：根据 `citation` 定位文档片段并高亮展示。

### 后端

- `agent.js`：最多 N 轮 tool loop；检索结果编号去重；超过轮数后强制不带工具收尾。
- `model.js`：模型配置校验、Base URL 规范化、`/models` 模型列表、OpenAI 兼容连通性测试。
- `deepseek.js`：解析 OpenAI 兼容的流式 `content` 与分片 `tool_calls`。
- `store.js`：JSON 快照 + 原子替换写盘，上传 / 删除后重建 BM25 索引；启动、定时任务、列表 / 上传 / 聊天前清理 24 小时过期文档。
- `index.js`：SSE 心跳、客户端断开时中止上游请求、统一错误处理。

## 生产化建议

这是一个可直接演示和二次开发的基础版本，上生产前建议补齐：

- **鉴权**：当前没有登录体系，请加 JWT / Session 并隔离不同用户的知识库。
- **模型 Key**：当前为演示版，API Key 存在浏览器 `localStorage` 并随聊天请求发送；生产环境应改为服务端 AES-GCM 加密存储，前端只提交一次、只拿掩码。
- **临时存储**：当前文件会按 24 小时 TTL 自动清理，适合演示；生产需要对象存储生命周期规则、备份和审计。
- **检索**：BM25 升级为 BM25 + BGE-M3 向量混合检索。
- **解析**：扫描版 PDF 需要 OCR（如 PaddleOCR / Tesseract）。
- **可观测性**：补充结构化日志、请求 ID、Langfuse / OpenTelemetry 追踪。
- **安全**：上传文件病毒扫描、文档级权限、Prompt 注入防护与内容审核。
- **部署**：Docker 化，Nginx 关闭 SSE 缓冲（`proxy_buffering off`）。

## 常见问题

**页面提示“还没有可用的模型”**

点击右上角「未配置模型」或横幅中的「配置模型」，填写 Base URL、模型 ID、API Key，先点「测试连接」，成功后才能「保存并启用」。

**模型下拉框没有自动加载**

- 确认 Base URL 是接口根地址，例如 `https://api.deepseek.com`，不是完整的 `/chat/completions`。
- 确认 API Key 有权限访问该服务的 `/models`。
- 部分兼容服务没有实现 `/models`，此时点击「手动输入」直接填写模型 ID 即可。

**测试连接成功，但聊天报错**

连接测试只验证 `chat/completions` 是否可达。Agent 还要求模型支持 Function Calling；如果使用非 DeepSeek 模型，请确认它支持 tools。可先用 `deepseek-chat` 验证完整流程。

**上传 PDF 后没有内容**

扫描版 PDF 没有文本层，需要先 OCR。加密 PDF 也无法解析。任意格式都可以上传，但服务端只能为可提取文本的文件建立索引；ZIP、图片等纯二进制文件会被拒绝。

**SSE 在 Nginx 下不流式**

确保反向代理关闭缓冲：

```nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 300s;
```
