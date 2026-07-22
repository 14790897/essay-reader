# Essay Reader · 文章朗读

全平台文章朗读应用，支持 iOS / Android / Web。内置双引擎 TTS——系统自带语音引擎 + 火山引擎豆包 TTS。

## 功能

- **双 TTS 引擎** — 系统语音（离线可用）和豆包 TTS 随时切换
- **朗读高亮** — 当前朗读句子黄色背景高亮
- **文章管理** — 新建、编辑、删除文章，数据持久化到设备
- **断点续读** — 自动记住阅读进度
- **可调参数** — 语速 0.5x ~ 2.0x、音调、字体大小
- **多音色** — 预置 10 种豆包中文音色（清新女声、温暖男声、豆包 2.0 等）
- **全平台** — iOS、Android、Web 一套代码

## 技术栈

| 层 | 方案 |
|---|---|
| 框架 | Expo SDK 57 + React Native 0.86 |
| 语言 | TypeScript |
| TTS（系统） | `expo-speech` |
| TTS（豆包） | 火山引擎 `openspeech.bytedance.com/api/v1/tts` |
| 音频播放 | `expo-av` |
| 本地存储 | `@react-native-async-storage/async-storage` |

## 项目结构

```
├── App.tsx                          # 主布局 / 状态中枢
├── src/
│   ├── hooks/
│   │   ├── useSpeech.ts             # 系统 TTS 封装
│   │   ├── useDoubaoTTS.ts          # 豆包 TTS 封装（API + 播放）
│   │   └── useArticles.ts           # 文章 CRUD
│   ├── services/
│   │   └── doubaoTTS.ts             # 豆包 API 客户端
│   └── components/
│       ├── Reader.tsx               # 阅读区 + 句子高亮
│       ├── Player.tsx               # 播放控制栏
│       ├── Settings.tsx             # 引擎 / 音色 / 语速 / 字体 设置
│       ├── ArticleList.tsx          # 文章列表
│       └── ArticleEditor.tsx        # 文章编辑器
```

## 快速开始

```bash
# 安装依赖
npm install

# 启动 Web 版
npx expo start --web

# 启动移动端（扫码运行）
npx expo start
```

## 豆包 TTS 配置

使用豆包 TTS 前需要在[火山引擎控制台](https://console.volcengine.com/speech)获取凭证：

1. 开通豆包语音合成服务
2. 创建应用，获取 **App ID** 和 **Access Token**
3. 获取 **Cluster ID**（通常为 `volcano_tts`）

然后在 App 中：**Settings → Engine → Doubao TTS**，填入上述凭证即可使用。

## License

MIT
