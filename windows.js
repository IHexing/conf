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

// 社区规则直接订阅；本地只维护自定义代理和自定义直连
const cdnBase = "https://fastly.jsdelivr.net/gh/IHexing/conf@main/windows-rules";
const loyalCdn = "https://fastly.jsdelivr.net/gh/Loyalsoldier/clash-rules@release";

const ruleProviders = {
    "reject": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "yaml",
        "url": `${loyalCdn}/reject.txt`,
        "path": "./ruleset/community/reject.yaml"
    },
    "direct": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "format": "yaml",
        "url": `${loyalCdn}/direct.txt`,
        "path": "./ruleset/community/direct.yaml"
    },
    "ai": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": "https://fastly.jsdelivr.net/gh/VPSDance/ai-proxy-rules@main/rules/clash/global.yaml",
        "path": "./ruleset/community/ai-global.yaml"
    },
    "custom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": `${cdnBase}/custom.yaml`,
        "path": "./ruleset/private/custom.yaml"
    },
    "directCustom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "format": "yaml",
        "url": `${cdnBase}/direct-custom.yaml`,
        "path": "./ruleset/private/direct-custom.yaml"
    }
};

// 个人覆盖先于社区规则；同一层级中自定义直连优先
const rules = [
    // 局域网与 VPS 运维保留原策略
    "GEOIP,private,直连,no-resolve",
    "DST-PORT,37561,远程运维",
    "DST-PORT,21389,远程运维",

    // STUN 保留现有住宅出口策略
    "DOMAIN-KEYWORD,stun,AI",
    "DST-PORT,3478,AI",
    "DST-PORT,5349,AI",
    "DST-PORT,19302,AI",

    "RULE-SET,directCustom,直连",
    "RULE-SET,custom,AI",
    "RULE-SET,ai,AI",

    "RULE-SET,reject,REJECT",
    "GEOSITE,category-ads-all,REJECT",

    // Apple 等普通服务交给社区国内列表判断
    "RULE-SET,direct,直连",
    "GEOSITE,cn,直连",
    "GEOIP,CN,直连,no-resolve",

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

    // 未配置住宅节点时阻断该组，不自动退回直连；全局手动选择仍可用
    const aiProxyList = generatedChainProxies.length > 0
        ? generatedChainProxies.map(p => p.name)
        : ["REJECT"];

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
