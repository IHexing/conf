// 国内DNS服务器（直连解析）
const domesticNameservers = [
    "https://223.5.5.5/dns-query", // 阿里DoH
    "https://doh.pub/dns-query" // 腾讯DoH
];

// 海外安全DNS服务器（代理与外网解析，防DNS污染及STUN/WebRTC国内解析穿透）
const foreignNameservers = [
    "https://1.1.1.1/dns-query", // Cloudflare DoH
    "https://8.8.8.8/dns-query"  // Google DoH
];

// DNS配置
const dnsConfig = {
    "enable": true,
    "listen": "0.0.0.0:1053",
    "ipv6": false,
    "prefer-h3": false,
    "respect-rules": true,
    "use-system-hosts": false,
    "cache-algorithm": "arc",
    "enhanced-mode": "fake-ip",
    "fake-ip-range": "198.18.0.1/16",
    "fake-ip-filter": [
        // 本地主机/设备
        "+.lan",
        "+.local",
        // Windows网络出现小地球图标
        "+.msftconnecttest.com",
        "+.msftncsi.com",
        // QQ快速登录检测失败
        "localhost.ptlogin2.qq.com",
        "localhost.sec.qq.com",
        // 追加条目
        "+.in-addr.arpa",
        "+.ip6.arpa",
        "time.*.com",
        "time.*.gov",
        "pool.ntp.org",
        // 微信快速登录检测失败
        "localhost.work.weixin.qq.com"
    ],
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    "direct-nameserver": [...domesticNameservers], // 必须：国内直连流量专用安全解析
    "nameserver": [...foreignNameservers],        // 默认及代理规则走海外安全解析，彻底防泄露
    "proxy-server-nameserver": [...domesticNameservers], // 代理节点自身域名解析（国内直连快速解析）
    "nameserver-policy": {
        "geosite:private,cn": domesticNameservers
    }
};
// 规则集通用配置
const ruleProviderCommon = {
    "type": "http",
    "interval": 86400
};

// 规则集配置（私有定制源 CDN + 社区 Loyalsoldier 上游源）
const cdnBase = "https://fastly.jsdelivr.net/gh/IHexing/conf@main/windows-rules";
const loyalCdn = "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release";

const ruleProviders = {
    // 1. 【社区维护】全网广告与遥测拦截（每日自动更新，极大节省昂贵的住宅代理流量）
    "reject": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "text",
        "url": `${loyalCdn}/reject.txt`,
        "path": "./ruleset/community/reject.txt"
    },
    // 2. 【社区维护】国内直连白名单补充（每日自动更新，确保国内冷门网站直连不误入住宅）
    "direct": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "text",
        "url": `${loyalCdn}/direct.txt`,
        "path": "./ruleset/community/direct.txt"
    },
    // 3. 【社区维护】AI 大模型全家桶（VPSDance 每日自动更新，涵盖 100+ 全球主流 AI 服务）
    "communityAi": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": "https://fastly.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/clash/all.yaml",
        "path": "./ruleset/community/ai-all.yaml"
    },
    // 4. 【你专属维护】大模型全家桶（已针对 Claude Code 做本地进程避让）
    "ai": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": `${cdnBase}/ai.yaml`,
        "path": "./ruleset/private/ai.yaml"
    },
    // 5. 【你专属维护】个人业务、Canva、海外支付采购平台
    "custom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": `${cdnBase}/custom.yaml`,
        "path": "./ruleset/private/custom.yaml"
    },
    // 6. 【你专属维护】Apple 国内直连与国外代理
    "appleCnDirect": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "yaml",
        "url": `${cdnBase}/apple-cn-direct.yaml`,
        "path": "./ruleset/private/apple-cn-direct.yaml"
    },
    "appleComProxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "yaml",
        "url": `${cdnBase}/apple-com-proxy.yaml`,
        "path": "./ruleset/private/apple-com-proxy.yaml"
    },
    // 7. 【你专属维护】私有国内直连白名单（公司业务、私有Git、内网开发）
    "directCustom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": `${cdnBase}/direct-custom.yaml`,
        "path": "./ruleset/private/direct-custom.yaml"
    }
};

// 规则体系（优化漏斗：拦截 -> 局域网 -> 运维 -> STUN/WebRTC防泄露 -> 专属AI与业务 -> 国内放行 -> 全量断网兜底）
const rules = [
    // 1. 【去广告防追踪】社区源 + 内置库双重拦截，防隐私泄露并节省昂贵的住宅代理流量
    "RULE-SET,reject,REJECT",
    "GEOSITE,category-ads-all,REJECT",

    // 2. 【局域网放行】
    "GEOIP,private,直连,no-resolve",

    // 2.5 【VPS 专属运维通道】远程桌面 (37561) 与 SSH (21389) 直通高质专线，彻底杜绝住宅代理回环绕路
    "DST-PORT,37561,远程运维",
    "DST-PORT,21389,远程运维",

    // 3. 【WebRTC / STUN 防穿透】强制 STUN 域名与端口进住宅代理，杜绝 UDP 探测走直连泄露真实公网 IP
    "DOMAIN-KEYWORD,stun,AI",
    "DST-PORT,3478,AI",
    "DST-PORT,5349,AI",
    "DST-PORT,19302,AI",

    // 4. 【专属业务与 Apple 海外服务】必须先于国内白名单匹配，防止 Anycast 节点被 GEOIP,CN 劫持
    "RULE-SET,appleComProxy,AI",
    "RULE-SET,custom,AI",

    // 5. 【专属自定义业务与 AI 大模型】社区每日更新 + 原生 GeoSite + 私有强化三保险
    "RULE-SET,communityAi,AI",
    "GEOSITE,category-ai-chat-!cn,AI",
    "RULE-SET,ai,AI",

    // 6. 【国内直连白名单】原生 GeoSite + 社区 direct + 私有直连三保险
    "DOMAIN-SUFFIX,hanghao.cc,直连",
    "RULE-SET,appleCnDirect,直连",
    "RULE-SET,directCustom,直连",
    "GEOSITE,apple-cn,直连",
    "RULE-SET,direct,直连",
    "GEOSITE,cn,直连",
    "GEOIP,CN,直连,no-resolve",

    // 7. 【核心 Kill-Switch 防御】未被国内白名单命中的全量外网流量 100% 进住宅代理；住宅故障立即全网断死！
    "MATCH,AI"
];

// 代理组通用配置
const groupBaseOption = {
    "interval": 300,
    "timeout": 5000,
    "url": "https://www.google.com/generate_204",
    "lazy": true,
    "max-failed-times": 3,
    "hidden": false
};

// 程序入口
function main(config) {
    const proxyCount = config?.proxies?.length ?? 0;
    const proxyProviderCount =
        typeof config?.["proxy-providers"] === "object" ? Object.keys(config["proxy-providers"]).length : 0;
    if (proxyCount === 0 && proxyProviderCount === 0) {
        throw new Error("配置文件中未找到任何代理");
    }

    // 静态住宅代理配置（GitHub 提交保持留空脱敏；本地运行时填入真实 IP/域名与凭据）
    const residentialEndpoints = [
        {
            "label": "加州AT&T独享",
            "type": "ss",
            "server": "",
            "port": 22465,
            "cipher": "",
            "password": ""
        }
    ];

    const hasValidServer = residentialEndpoints.some(ep => Boolean(ep.server));
    const residentialServers = new Set(residentialEndpoints.map(ep => ep.server).filter(Boolean));

    // 清理机场所有的到期时间、剩余流量等虚假节点，防止污染所有节点与全局模式
    if (Array.isArray(config.proxies)) {
        config.proxies = config.proxies.filter(p => !(/expire|traffic|sync|到期|剩余|流量|官网|更新|通知|倍率|网址|info/i.test(String(p?.name))));
    }

    // 只对有效订阅原始节点建链，跳过已生成的住宅节点
    const isCleanSubscriptionProxy = (proxy) => {
        if (!proxy?.name) return false;
        const name = String(proxy.name);
        if (name.startsWith("静态住宅") || name.startsWith("加州AT&T")) return false;
        if ((proxy.type === "socks5" || proxy.type === "ss") && residentialServers.has(proxy.server)) return false;
        return true;
    };

    let generatedChainProxies = [];
    let cleanSubscriptionProxies = [];
    if (Array.isArray(config.proxies)) {
        cleanSubscriptionProxies = config.proxies.filter(isCleanSubscriptionProxy);
        if (hasValidServer) {
            generatedChainProxies = residentialEndpoints.flatMap(ep =>
                cleanSubscriptionProxies.map(p => ({
                    "type": ep.type || "ss",
                    "server": ep.server,
                    "port": ep.port,
                    "cipher": ep.cipher,
                    "password": ep.password,
                    "udp": true,
                    "name": `静态住宅-${ep.label} (链式-${p.name})`,
                    "dialer-proxy": p.name
                }))
            );

            // 优先将低延迟的美西节点排在最前（首选 BGP-08、BGP-07 等优质节点）
            const getProxyPriority = (name) => {
                if (/美国-BGP-08/i.test(name)) return 1;
                if (/美国-BGP-07/i.test(name)) return 2;
                if (/美国-BGP-05/i.test(name)) return 3;
                if (/美国-BGP/i.test(name)) return 4;
                if (/美国/i.test(name)) return 5;
                if (/香港|HK/i.test(name)) return 6;
                if (/日本|JP/i.test(name)) return 7;
                return 10;
            };
            generatedChainProxies.sort((a, b) => getProxyPriority(a.name) - getProxyPriority(b.name));

            // 清理旧生成的住宅节点并追加新链式节点
            config.proxies = config.proxies.filter(p => !(p?.name && (String(p.name).startsWith("静态住宅") || String(p.name).startsWith("加州AT&T"))));
            config.proxies.push(...generatedChainProxies);
        }
    }

    // 强制关闭 IPv6，彻底杜绝 AAAA 记录绕过规则造成真实 IP 泄露
    config["ipv6"] = false;
    dnsConfig["ipv6"] = false;
    config["dns"] = dnsConfig;

    // AI 代理列表：包含按延迟优选排序的链式节点（脱敏留空时回退为 DIRECT）
    const aiProxyList = generatedChainProxies.length > 0
        ? generatedChainProxies.map(p => p.name)
        : ["DIRECT"];

    // 仅保留美国优质专线节点（加州 VPS 运维专用，彻底过滤迪拜、巴西、欧洲、香港等无关高延时节点）
    const usProxies = cleanSubscriptionProxies.filter(p => {
        if (!p || typeof p.name !== "string") return false;
        const name = p.name;
        if (/家宽|住宅|倍率/i.test(name)) return false;
        return /(?:美国|United\s*States|\bUS\b|🇺🇸)/i.test(name);
    });

    // 智能排序：【优化】专线节点排最前（实测226ms），其次是 Pro-BGP、Basic-BGP
    const getOpsPriority = (name) => {
        if (/优化/i.test(name)) return 1;
        if (/Pro-美国-BGP/i.test(name)) return 2;
        if (/Basic-美国-BGP/i.test(name)) return 3;
        if (/BGP/i.test(name)) return 4;
        return 10;
    };
    usProxies.sort((a, b) => getOpsPriority(a.name) - getOpsPriority(b.name));
    const usProxyNames = usProxies.map(p => p.name);

    // 远程运维候选列表：自动优选 + 直连 + 纯美西优质专线节点
    const opsProxyList = usProxyNames.length > 0
        ? ["自动优选", "直连", ...usProxyNames]
        : (cleanSubscriptionProxies.length > 0 ? ["直连", ...cleanSubscriptionProxies.map(p => p.name)] : ["直连"]);

    // 覆盖原配置中的代理组
    const proxyGroups = [
        {
            ...groupBaseOption,
            "name": "所有节点",
            "type": "select",
            "include-all": true,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/adjust.svg"
        },
        {
            ...groupBaseOption,
            "name": "AI",
            "type": "url-test",
            "tolerance": 50,
            "proxies": aiProxyList,
            "include-all": false,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/chatgpt.svg"
        },
        {
            ...groupBaseOption,
            "name": "远程运维",
            "type": "select",
            "proxies": opsProxyList,
            "include-all": false,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/microsoft.svg"
        }
    ];

    // 若存在可用美国优质节点，提供专属“自动优选”测速组（动态自动切换至最低延迟美西专线）
    if (usProxyNames.length > 0) {
        proxyGroups.push({
            ...groupBaseOption,
            "name": "自动优选",
            "type": "url-test",
            "proxies": usProxyNames,
            "url": "https://www.google.com/generate_204",
            "interval": 300,
            "tolerance": 50,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/speed.svg"
        });
    }

    proxyGroups.push({
        ...groupBaseOption,
        "name": "直连",
        "type": "select",
        "proxies": ["DIRECT"],
        "include-all": false,
        "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/link.svg"
    });

    config["proxy-groups"] = proxyGroups;

    // 覆盖原配置中的规则
    config["rule-providers"] = ruleProviders;
    config["rules"] = rules;

    // 全局网络与性能强化
    config["tcp-concurrent"] = true;
    config["unified-delay"] = true;

    // 为所有节点（包含住宅与机场节点）设置 udp = true，保障 WebRTC 与 UDP 转发全面通畅
    if (config["proxies"]) {
        config["proxies"].forEach(proxy => {
            proxy.udp = true;
        });
    }

    return config;
}
