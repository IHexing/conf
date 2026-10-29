# 个人代理配置

当前维护入口（2026-10-29）。每个平台只保留两份个人规则，通用规则直接订阅社区。

| 文件 | 用途 | 如何维护 |
| --- | --- | --- |
| `apple.conf` | Shadowrocket 主配置 | 节点、DNS、规则顺序 |
| `windows.js` | Clash Verge 扩展脚本 | 节点、DNS、规则顺序 |
| `apple-rules/custom.list` | 自定义代理覆盖 | 手工修改这一份 |
| `apple-rules/direct-custom.list` | 自定义直连覆盖 | 手工修改这一份 |
| `windows-rules/custom.yaml` | Windows 自定义代理覆盖 | 自动生成 |
| `windows-rules/direct-custom.yaml` | Windows 自定义直连覆盖 | 自动生成 |
| `scripts/sync_gist.py` | 转换个人规则及同步主配置 | 不构建社区规则 |

同一域名同时写入两份个人规则时，直连优先。保留现有的局域网、VPS 运维与 STUN 策略；之后按个人覆盖、社区海外 AI、广告、社区国内直连、住宅代理兜底的顺序匹配。

## 社区数据

- 海外 AI：[VPSDance/ai-proxy-rules](https://github.com/VPSDance/ai-proxy-rules)，使用 `global`，不使用包含国内 AI 的 `all`。直接采用社区提供的 Shadowrocket / Clash 格式及匹配条件，包括进程规则。
- 国内直连：[Loyalsoldier/surge-rules](https://github.com/Loyalsoldier/surge-rules) / [Loyalsoldier/clash-rules](https://github.com/Loyalsoldier/clash-rules)。Windows 保留原有 CN 与广告分类作为补充。
- 去广告：手机使用 anti-AD、ACL4SSR；Windows 使用 Loyalsoldier 与内置广告分类。

不再维护本地 AI 镜像、Apple 专用清单、交易所专用清单及 AI 构建脚本。Apple 不再整体强制走住宅出口；交易所台湾专线已按本轮确认取消，均按社区及个人规则分流。需要特殊路由时，在对应个人覆盖文件中添加明确域名。

## 本地维护

先修改 `apple-rules` 中的两份个人规则，再执行：

```powershell
python scripts/sync_gist.py --prepare-only
python scripts/sync_gist.py --check
python -m unittest discover -s tests -v
python -m compileall -q scripts tests
node --check windows.js
```

`--prepare-only` 只生成两份 Windows 规则；`--check` 只检查生成结果。两者不读取本地凭据、不修改客户端、不上传配置。

## 发布与生效

1. 先审查并发布需要变更的个人规则至配置引用的 GitHub 仓库。
2. 等待 CDN 能读到相同规则后，运行 `python scripts/sync_gist.py`。脚本先核对四份远程个人规则，再读取本地凭据并同步主配置。
3. 在 Clash Verge 重新加载扩展脚本/订阅；在 Shadowrocket 更新配置与规则。文件写入或上传成功不等于运行配置已切换。
4. 在两端核对实际规则、国内直连、海外出口、全局自由选节点与 DNS 行为。

仓库中的住宅代理信息是脱敏占位值。Windows 未配置住宅节点时，住宅组使用 `REJECT`，不自动回退为直连。手机仍保留普通 DNS 备用；`no-resolve` 只减少匹配阶段的额外查询，不代表所有 DNS 流量均加密或代理。

本轮第一步完成仓库结构清理与本地校验。实际发布、Clash 重载及手机验收按后续操作分别记录，不能由本地检查代替。
