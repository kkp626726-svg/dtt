<div align="center">

# Tuning In · 知音

### 让 AI 音乐家陪你把“听不懂”变成“听得见”

一款面向古典乐新听众的多智能体音乐陪听产品。播放到哪里，问题就发生在哪里。

<p>
  <a href="https://YOUR_GITHUB_USERNAME.github.io/YOUR_REPOSITORY/"><strong>在线体验</strong></a>
  ·
  <a href="#本地运行"><strong>本地运行</strong></a>
  ·
  <a href="#它是怎样工作的"><strong>了解架构</strong></a>
</p>

> 仓库发布后，将上面的 `YOUR_GITHUB_USERNAME/YOUR_REPOSITORY` 替换为实际 GitHub 用户名和仓库名。Pages 工作流已经配置好。

</div>

![Tuning In 首页](readme-assets/home.png)

## 为什么做知音

第一次听古典乐时，人们通常不是没有感受，而是不知道该把注意力放在哪里。

传统乐评容易过于专业，普通 AI 回答又常常脱离正在播放的声音。知音把问题、播放时间和曲目节点放进同一段对话，让解释落到耳朵当下真正能验证的变化上。

- 旋律刚刚发生了什么变化
- 为什么同一个短句一直回来
- 这一段应该先听旋律还是低音
- 伴奏怎样托住旋律并推动情绪
- 三位音乐家会怎样理解同一个瞬间

## 核心体验

| 能力 | 体验 |
| --- | --- |
| 时间感知问答 | 结合当前播放时间，定位正在发生的音乐节点 |
| 多 Agent 陪听 | 莫扎特、巴赫、贝多芬从不同创作视角回答 |
| 自动路由 | 主 Agent 根据问题选择最适合的陪听者 |
| 三人共听 | 让三位陪听者围绕同一段音乐继续讨论 |
| 证据可追溯 | 展示回答使用的人物知识、作品事实与声音线索 |
| 新手友好表达 | 少用术语，回答后能立刻回到音乐里验证 |

## 产品界面

### 选择陪听者

![选择 AI 音乐陪听者](readme-assets/companions.png)

第一版知识库 Agent 包含莫扎特、巴赫与贝多芬，其他音乐家以视觉角色预览的方式呈现。

### 边听边问

![音乐共听剧场](readme-assets/listening-room.png)

播放进度、音乐节点、提问和三位陪听者的回答都集中在同一个共听空间中。

## 三位陪听者

| 陪听者 | 优先关注 | 回答气质 |
| --- | --- | --- |
| 莫扎特视角 | 旋律、乐句、问答与转身 | 轻巧、敏捷，像在排练现场提醒一句 |
| 巴赫视角 | 声部、低音、层次与结构 | 准确、务实，先理清每一层声音的工作 |
| 贝多芬视角 | 动机、重复、阻力与推进 | 直接、有力，追问材料为何再次出现 |

这些角色是受音乐家创作实践启发的产品化聆听视角，不冒充历史人物本人，也不会虚构他们听过后世作品。

## 它是怎样工作的

```mermaid
flowchart LR
    A[用户问题] --> B[主 Agent 识别意图]
    B --> C[读取曲目与播放时间]
    C --> D[检索人物及曲目知识]
    D --> E[选择音乐家子 Agent]
    E --> F[结合当前节点生成回答]
    F --> G[返回回答、依据与聆听提示]
```

当前知识库包含人物史实、人物聆听方法、作品事实、整曲路线和时间节点。后端综合向量相似度、问题类型、播放时间与词面特征进行重排。

## 在线体验

仓库已提供 GitHub Pages 自动部署工作流：`.github/workflows/deploy-pages.yml`。

推送到 `main` 或 `master` 后，GitHub Actions 会发布 `tuning-in-demo-minimal/知音-web-deploy`。部署完成后，仓库右侧的 **Deployments** 区域会出现可直接打开的 `github-pages` 地址。

GitHub Pages 运行的是静态演示模式：

- 可以浏览四幕产品页面和主要交互
- 可以选择陪听者并输入问题
- 问答使用内置示例，不需要暴露 API Key
- 媒体文件因公开转载授权未确认，不包含在公开仓库中

本地只想查看静态问答效果时，也可以打开 `http://127.0.0.1:4317/listening-room.html?demo=1`。

如需真实模型回答，请按下面的方式在本地运行后端。

## 本地运行

### 环境要求

- Node.js 22+
- npm
- AIHubMix API Key
- 可访问 AIHubMix 接口的网络环境

### 1. 进入项目

```bash
cd tuning-in-demo-minimal
```

也可以下载根目录的 `tuning-in-demo.zip` 后解压。

### 2. 配置环境变量

```bash
cp .env.example .env.local
```

编辑 `.env.local`：

```dotenv
AIHUBMIX_API_KEY=你的_API_Key
AIHUBMIX_BASE_URL=https://aihubmix.com/v1
ADMIN_TOKEN=你自己设置的管理员口令
```

### 3. 安装并启动

```bash
npm install
npm start
```

打开以下地址：

- 产品首页：`http://127.0.0.1:4317/`
- 共听空间：`http://127.0.0.1:4317/listening-room.html`
- 健康检查：`http://127.0.0.1:4317/api/health`

健康检查返回 `ok: true`，说明后端和知识向量已经加载。

## 项目结构

```text
.
├── .github/workflows/            # GitHub Pages 自动部署
├── readme-assets/                # README 产品截图
├── tuning-in-demo-minimal/
│   ├── 知音-web-deploy/          # 四幕产品网页与前端交互
│   ├── server/                   # Node.js API、对话编排与检索
│   ├── prompts/                  # 主 Agent、子 Agent 与运行协议
│   ├── knowledge/                # 人物、作品与音乐节点知识
│   ├── data/embeddings/          # 已生成的知识向量缓存
│   ├── music-analysis-skill/     # 曲目分析数据与运行逻辑
│   └── config/models.json        # 模型与检索配置
└── tuning-in-demo.zip            # 可下载运行包
```

## 模型分工

| 环节 | 默认配置 |
| --- | --- |
| 主 Agent 路由 | `gemini-3.5-flash-lite` |
| 音乐家子 Agent | `gpt-5.6-luna` |
| 回答兜底 | `deepseek-v4-flash-0731` |
| Embedding | `BAAI/bge-large-zh-v1.5` |
| Rerank | 播放时间、知识范围与词面特征联合重排 |

模型名称可在 `tuning-in-demo-minimal/config/models.json` 中替换，实际可用模型以 AIHubMix 账户为准。

## 演示曲目

- River Flows In You
- Sonnet
- City of Stars

每首曲目都准备了作品信息、整曲聆听路线、时间节点、可听见的声音变化和回答边界。

## 媒体与版权

公开仓库不包含演奏视频、音乐音轨和人物试听音频。请只使用自己拥有权利或获得公开授权的媒体文件，并放入：

```text
tuning-in-demo-minimal/知音-web-deploy/assets/video/library/
tuning-in-demo-minimal/知音-web-deploy/assets/audio/library/
tuning-in-demo-minimal/知音-web-deploy/assets/audio/portraits/
```

默认媒体文件名可在 `tuning-in-demo-minimal/知音-web-deploy/assets/js/listening-room.js` 中修改。

## 数据与隐私

公开内容不包含 API Key、真实管理员口令、本地数据库、用户聊天记录、服务日志或临时上传文件。请勿提交 `.env.local`、SQLite 数据库或真实用户数据。

## 当前限制

- 模型不会直接听见音频，目前依据人工审核的曲目节点回答
- 知识库主要覆盖三位音乐家和三首演示曲目
- 新增曲目需要补充作品信息、聆听路线、节点证据与回答边界
- GitHub Pages 仅提供静态交互预览，完整问答需要本地后端
- 项目仍处于产品验证阶段，尚未完成生产环境部署和大规模用户测试

## Roadmap

- [ ] 接入用户上传曲目的音乐分析 Skill
- [ ] 扩充作品知识与真实用户测试问题
- [ ] 继续拉开三位陪听者的观察角度和语言差异
- [ ] 完成召回率、回答质量与对话自然度评测
- [ ] 将本地知识与对话服务迁移到可公开访问的云端

---

如果这个项目对你有启发，欢迎 Star、Fork，或提交 Issue 分享你最想让哪位音乐家陪你听哪首作品。
