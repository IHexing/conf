# Clash Verge 当前配置说明

更新：2026-10-29。维护与发布入口见 [README](../README.md)。

- `windows-rules` 只保留 `custom.yaml` 与 `direct-custom.yaml`，均由手机端同名个人规则生成。
- 社区规则使用五个 provider：国内直连 direct、去广告 reject、海外 AI ai，以及两份个人覆盖 custom / directCustom。
- ai 直接订阅 VPSDance 的 `global.yaml`，不再叠加本地 AI 镜像或另一份 AI 分类。
- 自定义直连与代理先于社区匹配；保留原有局域网、VPS 运维、STUN、国内 CN 和广告分类补充。
- direct / reject 的内容是 YAML，使用 `format: yaml`。
- 删除 Apple 专用 provider，普通 Apple 服务按社区与个人规则分流。
- 没有生成住宅节点时，AI 组使用 REJECT；全局手动选择机场或住宅节点的能力保留。
- `sync_gist.py --prepare-only` 只生成仓库规则；正常同步前会核对远程个人规则，发布主配置后仍需客户端重新加载。

本轮只完成仓库准备与本地校验。此前现场查询的旧运行配置，不能当作本次配置已生效的证据；下一步须重新查询内核和验证真实分流。
