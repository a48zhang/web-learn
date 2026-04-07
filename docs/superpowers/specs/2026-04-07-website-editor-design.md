# 网站编辑器设计文档

> 创建时间：2026-04-07
> 目标：将"专题空间"的知识型和网站型统一为网站型，提供仿VSCode的编辑器界面，使用WebContainer支撑实时预览。

---

## 1. 设计目标

1. **统一专题模型**：取消知识型/网站型双版本，所有专题都是网站形式
2. **Agent驱动**：用户通过对话描述需求，Agent主动协作生成网站代码
3. **即时预览**：WebContainer在浏览器中运行，代码修改即时可见
4. **VSCode体验**：仿VSCode三栏可调整面板布局

---

## 2. 整体架构

### 2.1 前端主导架构

前端完全负责代码编辑、预览、Agent交互；后端仅提供两个服务：
- **LLM API 代理**：转发前端请求到LLM
- **会话持久化**：保存文件快照和对话历史

```
┌─────────────────────────────────────────────────────────────┐
│  顶部操作栏: [保存] [刷新预览] [发布到网站] [分享链接]        │
├──────────────┬──────────────────────┬───────────────────────┤
│              │                      │                       │
│  文件树      │   Agent 对话区       │   应用预览 (iframe)    │
│  (18%)       │   (28%)              │   (自适应)             │
│  (可拖拽调整)│   (可拖拽调整)        │   (可拖拽调整)          │
│              │                      │                       │
│  📁          │   💬 Agent 对话      │   ┌───────────────┐   │
│  index.html  │   [用户输入]          │   │  网站预览      │   │
│  src/        │   [上传文件]          │   │  (WebContainer  │   │
│  public/     │   [发送]              │   │   后台运行)     │   │
│              │                      │   └───────────────┘   │
└──────────────┴──────────────────────┴───────────────────────┘
```

### 2.2 数据流

```
1. 用户在 Agent 对话区输入内容/上传文件/描述需求
        ↓
2. Agent 先询问网站风格偏好（简约、商务、活泼等）
        ↓
3. 前端调用后端 LLM API，发送用户请求 + 当前文件上下文
        ↓
4. LLM 返回代码修改指令（生成/修改/删除文件）
        ↓
5. 前端通过 WebContainer FS API 写入文件
        ↓
6. WebContainer 自动热更新，预览区刷新
        ↓
7. 文件变更通过 WebSocket 同步到后端保存
```

---

## 3. 界面布局设计

### 3.1 三栏可调整面板布局

- **左侧面板（文件系统树）**：宽度可调（18%默认），最小15%
- **中间面板（Agent对话区）**：宽度可调（28%默认），最小20%
- **右侧面板（应用预览）**：自适应剩余宽度，iframe嵌入WebContainer的dev server输出
- **面板分割线**：支持拖拽调整宽度，参考VSCode风格
- **面板可折叠**：每个面板都可收起，其他面板自适应扩展

### 3.2 左侧：文件系统树

- 显示当前专题的所有文件（Agent生成的网站文件）
- 支持展开/折叠目录
- 支持文件操作：重命名、删除、新建文件/目录
- **双击文件**：在右侧预览区上方打开代码编辑器（Monaco Editor）
- 支持拖拽排序（移动文件位置）
- 文件图标按类型区分（HTML、CSS、JS、图片等）

### 3.3 中间：Agent对话区

- **对话式交互**：用户输入文本、上传文件（Markdown、Word、PDF等）
- **主动协作模式**：Agent先询问偏好（风格、布局、颜色等），再生成代码
- **文件上下文**：对话时自动带上当前打开文件的代码作为上下文
- **代码块渲染**：Agent返回的代码以语法高亮形式展示
- **快速操作按钮**：常见操作快捷执行（"生成导航栏"、"添加图片"等）
- **多轮对话**：支持连续对话修改，Agent理解上下文
- **输入模式**：纯文本输入 + 附件上传按钮（支持多种格式）

### 3.4 右侧：应用预览

- **默认状态**：应用预览（iframe嵌入），WebContainer在后台运行
- **文件双击时**：在文件树所在区域打开代码编辑器（Monaco Editor），与文件树切换显示
- **热更新**：文件修改后，WebContainer自动热重载，预览区实时更新
- **响应式预览**：支持切换设备尺寸（桌面、平板、手机）
- **刷新按钮**：手动刷新预览
- **代码编辑器与文件树**：双击文件时文件树区域切换为Monaco编辑器，点击返回/关闭按钮回到文件树视图

### 3.5 顶部操作栏

| 按钮 | 功能 |
|------|------|
| 保存 | 将当前文件状态同步到后端 |
| 刷新预览 | 重新加载WebContainer预览 |
| 发布到网站 | 将网站发布到外部/CDN |
| 分享链接 | 生成预览分享链接 |

---

## 4. 技术选型

### 4.1 前端核心

| 组件 | 技术 | 理由 |
|------|------|------|
| WebContainer | `@webcontainer/api` (StackBlitz) | 完整Node.js环境，支持React/Vue/Svelte |
| 代码编辑器 | Monaco Editor | VSCode同款，语法高亮、智能补全 |
| 文件树 | `react-complex-tree` | 支持拖拽、多选、虚拟化渲染 |
| 可调整面板 | `react-resizable-panels` | 支持拖拽调整、折叠、记忆布局 |
| 对话UI | 自定义组件 + `react-markdown` | 灵活控制消息样式和代码块 |
| Markdown渲染 | `react-markdown` + `remark-gfm` | 支持GFM表格、代码高亮 |

### 4.2 后端服务（新增/修改）

| 服务 | 说明 |
|------|------|
| LLM API代理 | 接收前端OpenAI SDK标准请求，转发到实际LLM提供商（OpenAI/Claude等），返回兼容响应 |
| 会话保存 | 保存文件快照和对话历史到数据库 |
| 发布服务 | 将WebContainer中的文件打包发布到外部CDN |

### 4.3 WebContainer启动流程

```
1. 前端初始化 WebContainer.boot()
        ↓
2. 写入基础文件（package.json、index.html、入口文件等）
        ↓
3. 安装依赖：npm install（首次）
        ↓
4. 启动开发服务器：npm run dev
        ↓
5. 获取预览URL（WebContainer内部地址）
        ↓
6. 将预览URL嵌入 iframe 显示
        ↓
7. 文件修改时通过 fs.writeFile 更新，WebContainer自动热重载
```

---

## 5. Agent系统设计

### 5.1 Agent工作流

```
用户输入需求
    ↓
Agent 分析意图
    ↓
Agent 询问偏好（风格、布局、颜色）
    ↓
用户回答偏好
    ↓
Agent 生成网站代码
    ↓
通过 WebContainer FS API 写入文件
    ↓
WebContainer 自动热更新
    ↓
用户预览效果，提出修改意见
    ↓
Agent 修改代码
```

### 5.2 Agent Prompt结构

```
你是一名专业的前端开发者，负责帮助用户将他们的想法转化为网站。

当前上下文：
- 专题标题：{topic_title}
- 已存在的文件：{file_list}
- 当前打开的文件：{current_file}（如有）

你的职责：
1. 理解用户的需求，如果需求不够具体，先询问用户的偏好
   - 风格偏好（简约、商务、活泼、学术等）
   - 布局偏好（单栏、双栏、带导航、带侧边栏等）
   - 颜色偏好（浅色调、深色调、品牌色等）
2. 根据用户的偏好生成完整的网站代码
3. 使用标准的前端技术栈（HTML/CSS/JS、React、Vue等）
4. 每次只返回需要创建/修改的文件列表，让前端执行文件操作

返回格式（JSON）：
{
  "message": "给用户的自然语言回复",
  "files": [
    {
      "path": "src/index.html",
      "action": "create",
      "content": "<!DOCTYPE html>..."
    }
  ]
}

可用操作：create（新建）、update（修改）、delete（删除）
```

### 5.3 LLM API接口

遵循OpenAI Chat Completions API标准格式，后端作为代理转发：

```
POST /api/llm/chat/completions
Request:
{
  "model": "gpt-4o",
  "messages": [
    { "role": "system", "content": "你是一名专业的前端开发者..." },
    { "role": "user", "content": "帮我做一个课程网站，风格简约" },
    { "role": "assistant", "content": "好的，请问您偏好什么颜色？" },
    { "role": "user", "content": "蓝色系" }
  ],
  "response_format": { "type": "json_object" },
  "stream": true
}

Response (streaming):
{
  "id": "chatcmpl-xxx",
  "choices": [{
    "delta": { "content": "{\"message\":\"...\",\"files\":[...]}" },
    "finish_reason": null
  }]
}
```

前端使用OpenAI SDK (`openai` npm包) 直接调用，后端代理转发到实际的LLM提供商（OpenAI/Claude等），兼容`@anthropic-ai/sdk`或OpenAI任一SDK的标准接口。

---

## 6. 数据模型变更

### 6.1 Topic 模型简化

**变更前：**
- `type`: 'knowledge' | 'website'
- `website_url`: string（网站型特有）
- 知识型和网站型有不同的创建流程和展示方式

**变更后：**
- 移除 `type` 字段（或固定为 'website'）
- 移除 `website_url` 字段（由WebContainer动态生成）
- 统一创建流程：创建专题 → 进入编辑器 → Agent辅助生成网站

### 6.2 新增/修改的字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `files_snapshot` | JSON | 当前文件快照（用于保存和恢复） |
| `chat_history` | JSON | 对话历史记录 |
| `published_url` | string | 发布后的外部URL（可选） |
| `share_link` | string | 分享链接（可选） |

---

## 7. 现有代码影响

### 7.1 需要删除/合并的页面

| 文件 | 操作 |
|------|------|
| `frontend/src/pages/TopicCreatePage.tsx` | 修改 - 简化创建流程 |
| `frontend/src/pages/WebsiteEditorPage.tsx` | 重写 - 改为新的编辑器界面 |
| `frontend/src/pages/WebsiteTopicPage.tsx` | 删除 - 预览已合并到编辑器 |
| 知识型相关页面 | 删除 |

### 7.2 需要修改的后端

| 文件 | 操作 |
|------|------|
| `services/topic-space/src/controllers/topicController.ts` | 修改 - 移除type区分，添加保存API |
| `services/topic-space/src/models/Topic.ts` | 修改 - 移除type字段，添加新字段 |
| 新增 LLM 代理控制器 | 新建 |

### 7.3 需要新建的前端组件

| 组件 | 说明 |
|------|------|
| `EditorLayout` | 三栏布局容器（含可调整面板） |
| `FileTree` | 文件系统树组件 |
| `AgentChat` | Agent对话区组件 |
| `PreviewPanel` | WebContainer预览组件 |
| `CodeEditor` | Monaco编辑器组件 |
| `TopBar` | 顶部操作栏 |

---

## 8. 错误处理

### 8.1 WebContainer初始化失败

- 显示错误提示："WebContainer初始化失败，请检查浏览器兼容性"
- 提供重试按钮
- 提示不支持的浏览器（Safari等）

### 8.2 LLM API调用失败

- 显示错误提示："AI服务暂时不可用，请稍后重试"
- 保留用户输入的消息，允许重试
- 对话历史不丢失

### 8.3 保存失败

- 显示错误提示："保存失败，请检查网络连接"
- 文件仍保留在WebContainer中，不丢失
- 自动重试机制

---

## 9. 测试策略

### 9.1 单元测试

- Agent消息格式解析
- 文件操作指令解析
- LLM API请求/响应格式化

### 9.2 集成测试

- WebContainer初始化与文件写入
- Agent对话到文件生成的完整流程
- 面板拖拽调整功能

### 9.3 端到端测试

- 创建专题 → 输入需求 → Agent生成网站 → 预览验证
- 编辑文件 → 保存 → 重新加载验证

---

## 10. 实现优先级

| 优先级 | 内容 | 理由 |
|--------|------|------|
| **P0** | WebContainer集成 + 基础编辑器布局 | 核心基础设施 |
| **P0** | Agent对话到文件生成的完整链路 | 核心功能 |
| **P1** | 文件树 + Monaco编辑器 | 文件编辑能力 |
| **P1** | LLM API后端服务 | Agent后端支持 |
| **P2** | 可调整面板 + 拖拽调整 | 用户体验 |
| **P2** | 保存、发布、分享功能 | 完整性 |
| **P3** | 响应式预览切换 | 增强功能 |
| **P3** | 文件上传解析 | 增强功能 |
