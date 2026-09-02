# Tuning In（知音）可运行演示版

这是知音多智能体音乐聆听项目的下载包。GitHub 仓库只放一个压缩包，避免网页端一次上传超过 100 个文件。

## 下载使用

1. 下载 `tuning-in-demo.zip`。
2. 解压压缩包。
3. 进入解压后的项目目录。
4. 将 `.env.example` 复制为 `.env.local`。
5. 在 `.env.local` 中填写自己的 AIHubMix API Key 和管理员口令。
6. 确保电脑已经安装 Node.js 22 或更高版本。
7. 运行：

```bash
npm install
npm start
```

8. 浏览器打开：

```text
http://127.0.0.1:4317/index.html
```

## 压缩包内容

- 四幕产品网页和前端资源
- Node.js 后端与智能问答接口
- 莫扎特、巴赫、贝多芬主子 Agent 提示词
- 人物知识库、曲目知识库和 102 条向量缓存
- 三首曲目的已审核分析数据

## 注意

- 压缩包不包含开发者的 API Key、管理员口令、本地数据库、聊天记录和运行日志。
- 演奏视频、音乐音轨和人物试听音频因公开转载授权尚未确认，不包含在 GitHub 下载包中。
- 如需完整播放体验，请自行准备有权使用的媒体文件，并放入项目中对应的 `知音-web-deploy/assets/video/library/` 和 `知音-web-deploy/assets/audio/library/` 目录。
