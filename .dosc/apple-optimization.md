# Shadowrocket 当前配置说明

更新：2026-11-22。维护与发布入口见 [README](../README.md)。

- 本地只保留 `apple-rules/custom.list` 和 `apple-rules/direct-custom.list` 两份个人覆盖规则（已补充 `uuremote.com` 直连，与桌面端对齐）。
- `proxy.hanghao.cc` 显式置于 `direct-custom.list`（含 `hanghao.cc`）之前走 `HOME`；其余仍按自定义直连、自定义代理、社区 AI、广告与国内规则顺序匹配。
- 开启 `close-if-proxy-chain-missing = true`：当 `serverA/B/C` 绑定的前置机场节点因订阅更新失效时直接拒绝该链路，防止静默退回直连中转 IP 并误占 `HOME = url-test` 优选。
- `dns-server` 仅保留 `223.5.5.5` 与 `1.12.12.12` 两条 IP 直连 DoH，避免明文 UDP 在主解析阶段抢答并保留普通 DNS 于 `fallback-dns-server`。
- 默认未匹配流量仍使用 `HOME` (`url-test`)；更新远端配置后请核对 `serverA/B/C` 是否均已绑定“代理通过”前置节点。
