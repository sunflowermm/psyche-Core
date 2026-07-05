# psyche-Core

XRK-AGT 心理测评 Core：MBTI 多版本、SBTI/CBTI、大五 IPIP、神农校园混测；含 Web 测评页与 Bot 对话。

## 目录

```
core/psyche-Core/
├── commonconfig/     配置 Schema
├── default/          默认配置
├── plugin/           Bot 指令
├── http/             REST API
├── www/psyche/       Web 测评页
└── lib/
    ├── data/         题库与 assets.json
    ├── engine/       计分
    └── session-store.js
```

运行时配置：`data/psyche/psyche.yaml`

## 量表

| slug | 名称 | 题数 |
|------|------|------|
| `shennong` | 神农学生大混杂 | 20 |
| `mbti-quick` | MBTI 速测 | 8 |
| `mbti-28` / `mbti-40` / `mbti` / `mbti-93` | MBTI 各版本 | 28–93 |
| `mbti-scene` / `mbti-work` | MBTI 情境 / 职场 | 28 / 16 |
| `sbti` / `sbti-scene` | SBTI 电子灵魂 | 43 / 22 |
| `cbti` / `cbti-scene` | CBTI 程序员 | 30 / 24 |
| `bigfive` / `bigfive-deep` | 大五 IPIP | 50 / 120 |

题库来源与许可见 [`lib/data/SOURCES.md`](lib/data/SOURCES.md)。

## Bot

| 指令 | 说明 |
|------|------|
| `#测评` | 列出量表 |
| `#测评 <slug>` | 开始测评（如 `mbti-93`、`shennong`、`cbti-scene`） |
| `#取消测评` | 放弃当前会话 |

## Web

挂载路径：`/psyche/` · API：`/api/psyche/*`

## 美术资源

| 路径 | 说明 |
|------|------|
| `www/psyche/assets/covers/` | 量表封面 |
| `www/psyche/assets/mbti/`、`mbti-f/` | MBTI 立绘 |
| `www/psyche/assets/ocean/`、`traits/` | 大五 / MBTI 特质 |
| `www/psyche/assets/psyche-generated/` | CBTI / SBTI / 神农结果立绘（透明 PNG） |

## 免责

结果仅供娱乐与自我探索，不构成临床心理诊断。
