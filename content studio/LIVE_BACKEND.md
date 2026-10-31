# content studio · 实时评论与知识库后端

前端依然是原生单文件 `index.html`，CSS、图标和按钮动态效果均内置。实时读取、知识资料与助手由同目录 Python 后端提供，不依赖 Vue/React。原有 Next.js 工作台保持独立。

## 启动

Python 3.10+，仅用标准库，无需 pip 安装：

```bash
cd "/workspace/Glorious/content studio"
python3 start.py
```

启动器检测或启动本机 8040 后端，确认健康检查后自动打开由同一服务提供的 HTML，页面与 API 共用地址。无图形界面的环境可运行 `python3 start.py --no-browser`。Windows 可双击 `start.bat`，macOS 可运行 `start.command`，均需要 Python 3.10+。启动器只复用识别为 content studio 的服务，不覆盖或终止其他端口进程。直接打开 HTML 仍可使用本地问题备忘；在线评论和知识库需要运行后端。应用只面向本机单用户，不是公开、多租户或带登录的托管服务。

页面新增“重新检测连接”和“一键读取公开反馈”。后者会实际添加、抓取公开 GitHub 软件产品反馈并入库；不自动启动付费采集。网络恢复后可自动重连，缺少模型密钥的生成选项明确禁用。

## 已实现的来源

| 来源 | 输入 | 状态与范围 |
| --- | --- | --- |
| GitHub 公开产品反馈 | `https://github.com/owner/repo/issues/123` | 已实测真实网络：议题正文及页面已载入的首尾回复；中间分页可能不完整；软件用户反馈，不是护肤品评价 |
| Hacker News | 英文关键词 | Algolia 最新一页最多 30 条；已实现适配，当前云环境的该域名被网络策略阻断，未声称成功 |
| SocialCrawl Reddit | 具体公开帖子的 HTTPS URL | 按指定开源仓库的真实端点及字段接入；缺服务端密钥，尚未实测真实采集 |

免费来源可启用 5 分钟后台轮询；只在 Python 进程运行时执行，非推送级实时。页面每 30 秒同步本机状态，来源每次尝试至少间隔 60 秒。首次启用的新来源可在下一次调度检查运行。成功后按来源原始 ID 更新，不重复插入；没有新回复也会更新读取时间。刷新失败保留旧数据和上次成功时间。

SocialCrawl Reddit 是单页手动请求，上游可能缓存，目录标价约 5 credits/次；全服务每天最多 4 次请求，不自动分页、不自动重试付费调用，也不启动 Apify Actor。页面添加时需确认额度消耗。此处直接采用 SocialCrawl 真实 API 合约；不是一个免密、自带全平台爬虫引擎。

## 知识与助手

- 初次连接加载 `knowledge/project.md` 项目说明。
- Markdown / TXT 进入编辑区后确认入库，按“项目说明、品牌资料、成分材料、文化策略”分类。
- 每条评论、资料及资料片段有稳定引用 ID。点击引用查看原文与可用源链接。
- 默认是可运行的本地关键词检索助手，明确标注“非模型生成”；不会把预设段落当成 AI 输出。
- 上游文本或知识资料改变，当前页面已有回答标记为需重新检索核对。
- 可选在线模型通过服务端调用 OpenAI 兼容的官方 chat completions 端点。需要 `STUDIO_MODEL_API_KEY` 和 `STUDIO_MODEL_NAME`，没有这两项时返回清晰错误，未实际调用。模型模式需用户确认，会发送问题及最多 6 条相关片段，不发送整库；费用由模型服务收取。
- 资料被当作不可信数据，不作为执行任务指令。模型引用还需人工核对，不能声称自动证明品牌事实或保证合规。

## 凭据与当前环境

`SOCIALCRAWL_API_KEY` 仅从后端环境读取；`STUDIO_MODEL_API_KEY` 与 `STUDIO_MODEL_NAME` 同理。不要将长期密钥写入 HTML、JSON、Git 或聊天。本地进程复用继承的 HTTPS 代理与 CA，保持 TLS 验证。

已保存环境草稿需求：`hn.algolia.com`、`www.socialcrawl.dev`、`api.openai.com` 及两个服务端凭据需求。草稿不等于运行时已生效，需在环境设置安全填值、保存并按界面要求发布。当前没有 SocialCrawl 或模型密钥。GitHub 公共适配器不需要这些密钥，已独立实测成功。

## 存储与安全

- 浏览器保存问题备忘与当前空间 ID；资料与评论持久保存在 `.runtime/studio.sqlite3`，已加入 Git 忽略。
- 完整导出包含本空间全部评论、知识和来源，不受屏幕搜索/分页影响；不包含环境密钥。
- 用户导入和在线读取分别标记。GitHub/HN 公开讨论不能代表海外人群，更不能推断国籍或证明产品功效。
- 本地服务限制 Host、同源 JSON 写入、上传大小、记录数和资料数量；无通用任意 URL 抓取入口；GitHub/Reddit 输入限定路径；不跟随跨域重定向。
- 不记录评论内容、请求正文或密钥到服务日志；导入前建议去标识化。HTML 通过文本节点显示用户内容与引用，HTTP/HTTPS 外部链接经过校验。
- 删除空间前需确认。已下载备份不受影响；内置项目说明会重新加载。

## 复验

```bash
python3 -m unittest discover -s backend -p 'test_*.py' -v
# 先启动 8040；需要 Python Playwright 及系统 Chromium
python3 tests/live_browser.py
```

后端测试为隔离的合约与安全测试；浏览器测试包含真实 GitHub 网络读取，主动验证被封禁 HN 的失败保留路径，因此会出现一个预期的 HTTP 502。两者的结果不可混称为所有采集器都已联网通过。实时评论是在抓取时读取，不代表评论发表于今天。

## 参考项目与 skill

- 用户指定项目：[socialcrawl/socialcrawl-apify](https://github.com/socialcrawl/socialcrawl-apify)，检查提交 `9b29e4941cb5bcbe8e2c06ec8935b56954279247`，package.json 声明 MIT；参考真实 `src/client.ts`、Reddit `post/comments` 注册项及标准响应信封。没有将整个 Actor 或其依赖打包进应用。
- 采用 [Apify 官方 apify-integration-development skill](https://github.com/apify/agent-skills/blob/f22557f15941aa6a5bc7539f0408d509d4a32ab6/skills/apify-integration-development/SKILL.md) 的服务端凭据、成本边界与真实错误处理原则；上游 `apify.com/agents.md` 当前被网络限制，使用该 skill 的离线术语说明。没有发送联系邮件或发布任何集成。
