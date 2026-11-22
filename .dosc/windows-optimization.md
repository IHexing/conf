# Clash Verge 当前配置说明

更新：2026-11-22。维护与发布入口见 [README](../README.md)。

- `windows-rules` 只保留 `custom.yaml` 与 `direct-custom.yaml`，均由手机端同名个人规则生成。
- 保留网易 UU 远程全进程与 `+.uuremote.com` / `+.virvm.com` 的 `fake-ip-filter` 与直连/`远程运维`（`url-test`）配置，并将 `DOMAIN,proxy.hanghao.cc,AI` + `DOMAIN-SUFFIX,hanghao.cc,直连` 纳入模板以防同步覆盖。
- `domesticNameservers` 使用 `223.5.5.5` 与 `1.12.12.12` IP 直连 DoH，并在 `nameserver-policy` 为 `+.uuremote.com`、`+.virvm.com` 显式走国内解析。
- `AI` (`url-test`, `tolerance: 50`) 的链式前置候选收敛为北美与东亚/亚太（美/日/港/台/新/韩/加，剔除家宽与欧非南美中东远途节点；空集时自动回退全量订阅），兼顾“所有节点”手动全量选择能力。
- 没有生成住宅节点时，`AI` 组仍使用 `REJECT`，不回退为直连。
