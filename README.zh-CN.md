# [![Mattermost logo](https://user-images.githubusercontent.com/7205829/137170381-fe86eef0-bccc-4fdd-8e92-b258884ebdd7.png)](https://mattermost.com)

[Mattermost](https://mattermost.com) 是一个开源核心、自托管的协作平台，提供聊天、工作流自动化、语音通话、屏幕共享和 AI 集成功能。本仓库是 Mattermost 平台核心开发的主要源码库；使用 Go 和 React 编写，作为单一 Linux 二进制文件运行，依赖 PostgreSQL。每个月 16 日会以 MIT 许可证发布新的编译版本。

[在本地部署 Mattermost](https://mattermost.com/deploy/?utm_source=github-mattermost-server-readme)，或[在云端免费试用](https://mattermost.com/sign-up/?utm_source=github-mattermost-server-readme)。

<img width="1006" alt="mattermost 用户界面" src="https://user-images.githubusercontent.com/7205829/136107976-7a894c9e-290a-490d-8501-e5fdbfc3785a.png">

了解 Mattermost 的更多使用场景：

- [DevSecOps](https://mattermost.com/solutions/use-cases/devops/?utm_source=github-mattermost-server-readme)
- [事件响应](https://mattermost.com/solutions/use-cases/incident-resolution/?utm_source=github-mattermost-server-readme)
- [IT 服务台](https://mattermost.com/solutions/use-cases/it-service-desk/?utm_source=github-mattermost-server-readme)

其他有用资源：

- [下载并安装 Mattermost](https://docs.mattermost.com/guides/deployment.html) - 安装、设置并配置你自己的 Mattermost 实例。
- [产品文档](https://docs.mattermost.com/) - 了解如何运行 Mattermost 实例并充分利用所有功能。
- [开发者文档](https://developers.mattermost.com/) - 为 Mattermost 贡献代码，或通过 API、Webhook、斜杠命令、Apps 和插件构建集成。

目录
=================

- [安装 Mattermost](#安装-mattermost)
- [原生移动端和桌面端应用](#原生移动端和桌面端应用)
- [获取安全公告](#获取安全公告)
- [参与贡献](#参与贡献)
- [了解更多](#了解更多)
- [许可证](#许可证)
- [获取最新资讯](#获取最新资讯)
- [贡献指南](#贡献指南)

## 安装 Mattermost

- [下载并安装 Mattermost 自托管版](https://docs.mattermost.com/guides/deployment.html) - 通过 Docker、Ubuntu 或 tar 几分钟内部署 Mattermost 自托管实例。
- [在云端开始使用](https://mattermost.com/sign-up/?utm_source=github-mattermost-server-readme) 即刻试用 Mattermost。
- [开发者机器设置](https://developers.mattermost.com/contribute/server/developer-setup) - 如果你想为 Mattermost 编写代码，请参考此指南。


其他安装指南：

- [在 Docker 上部署 Mattermost](https://docs.mattermost.com/install/install-docker.html)
- [Mattermost Omnibus](https://docs.mattermost.com/install/installing-mattermost-omnibus.html)
- [通过 Tar 安装 Mattermost](https://docs.mattermost.com/install/install-tar.html)
- [Ubuntu 20.04 LTS](https://docs.mattermost.com/install/installing-ubuntu-2004-LTS.html)
- [Kubernetes](https://docs.mattermost.com/install/install-kubernetes.html)
- [Helm](https://docs.mattermost.com/install/install-kubernetes.html#installing-the-operators-via-helm)
- [Debian Buster](https://docs.mattermost.com/install/install-debian.html)
- [RHEL 8](https://docs.mattermost.com/install/install-rhel-8.html)
- [更多服务器安装指南](https://docs.mattermost.com/guides/deployment.html)

## 原生移动端和桌面端应用

除了 Web 界面外，你还可以下载 Mattermost 的客户端应用，支持 [Android](https://mattermost.com/pl/android-app/)、[iOS](https://mattermost.com/pl/ios-app/)、[Windows PC](https://docs.mattermost.com/install/desktop-app-install.html#windows-10-windows-8-1)、[macOS](https://docs.mattermost.com/install/desktop-app-install.html#macos-10-9) 和 [Linux](https://docs.mattermost.com/install/desktop-app-install.html#linux)。

[<img src="https://user-images.githubusercontent.com/30978331/272826427-6200c98f-7319-42c3-86d4-0b33ae99e01a.png" alt="在 Google Play 获取 Mattermost" height="50px"/>](https://mattermost.com/pl/android-app/)  [<img src="https://developer.apple.com/assets/elements/badges/download-on-the-app-store.svg" alt="在 App Store 获取 Mattermost" height="50px"/>](https://itunes.apple.com/us/app/mattermost/id1257222717?mt=8)  [![在 Windows PC 获取 Mattermost](https://user-images.githubusercontent.com/33878967/33095357-39cab8d2-ceb8-11e7-89a6-67dccc571ca3.png)](https://docs.mattermost.com/install/desktop.html#windows-10-windows-8-1-windows-7)  [![在 Mac OSX 获取 Mattermost](https://user-images.githubusercontent.com/33878967/33095355-39a36f2a-ceb8-11e7-9b33-73d4f6d5d6c1.png)](https://docs.mattermost.com/install/desktop.html#macos-10-9)  [![在 Linux 获取 Mattermost](https://user-images.githubusercontent.com/33878967/33095354-3990e256-ceb8-11e7-965d-b00a16e578de.png)](https://docs.mattermost.com/install/desktop.html#linux)

## 获取安全公告

接收关键安全更新通知。在线攻击者的手段日益复杂。如果你正在部署 Mattermost，强烈建议订阅 Mattermost 安全公告邮件列表，以获取关键安全版本的更新信息。

[在此订阅](https://mattermost.com/security-updates/#sign-up)

## 参与贡献

- [为 Mattermost 做贡献](https://handbook.mattermost.com/contributors/contributors/ways-to-contribute)
- [查找"需要帮助"项目](https://github.com/mattermost/mattermost-server/issues?page=1&q=is%3Aissue+is%3Aopen+%22Help+Wanted%22&utf8=%E2%9C%93)
- [在 Mattermost 服务器上加入开发者讨论](https://community.mattermost.com/signup_user_complete/?id=f1924a8db44ff3bb41c96424cdc20676)
- [获取 Mattermost 帮助](https://docs.mattermost.com/guides/get-help.html)

## 了解更多

- [API 选项 - Webhook、斜杠命令、驱动和 Web 服务](https://api.mattermost.com/)
- [查看谁在使用 Mattermost](https://mattermost.com/customers/)
- [浏览超过 700 个 Mattermost 集成](https://mattermost.com/marketplace/)

## 许可证

请参阅 [LICENSE 文件](LICENSE.txt) 了解许可权利和限制。

## 获取最新资讯

- **X** - 在 [X（原 Twitter）上关注 Mattermost](https://twitter.com/mattermost)。
- **博客** - 从 [Mattermost 博客](https://mattermost.com/blog/)获取最新动态。
- **Facebook** - 在 [Facebook 上关注 Mattermost](https://www.facebook.com/MattermostHQ)。
- **LinkedIn** - 在 [LinkedIn 上关注 Mattermost](https://www.linkedin.com/company/mattermost/)。
- **邮件** - 订阅我们的[新闻通讯](https://mattermost.us11.list-manage.com/subscribe?u=6cdba22349ae374e188e7ab8e&id=2add1c8034)（每月 1-2 封）。
- **Mattermost** - 加入 [Mattermost 社区服务器](https://community.mattermost.com)上的 ~contributors 频道。
- **IRC** - 加入 [Freenode](https://freenode.net/) 上的 #matterbridge 频道（感谢 [matterircd](https://github.com/42wim/matterircd)）。
- **YouTube** - 订阅 [Mattermost](https://www.youtube.com/@MattermostHQ)。

## 贡献指南

[![Small Image](https://img.shields.io/badge/Contribute%20with-Gitpod-908a85?logo=gitpod)](https://gitpod.io/#https://github.com/mattermost/mattermost)

请参阅 [CONTRIBUTING.md](./CONTRIBUTING.md)。
[加入 Mattermost 贡献者服务器](https://community.mattermost.com/signup_user_complete/?id=codoy5s743rq5mk18i7u5ksz7e) 参与关于贡献、开发等方面的社区讨论。
