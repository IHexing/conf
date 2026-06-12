// 国内DNS服务器
const domesticNameservers = [
    "https://223.5.5.5/dns-query", // 阿里DoH
    "https://doh.pub/dns-query" // 腾讯DoH
];
// 国外DNS服务器
const foreignNameservers = [
    "https://208.67.222.222/dns-query", // OpenDNS
    "https://77.88.8.8/dns-query", //YandexDNS
    "https://1.1.1.1/dns-query", // CloudflareDNS
    "https://8.8.4.4/dns-query", // GoogleDNS

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
        // // Windows网络出现小地球图标
        "+.msftconnecttest.com",
        "+.msftncsi.com",
        // QQ快速登录检测失败
        "localhost.ptlogin2.qq.com",
        "localhost.sec.qq.com",
        // 追加以下条目
        "+.in-addr.arpa",
        "+.ip6.arpa",
        "time.*.com",
        "time.*.gov",
        "pool.ntp.org",
        // 微信快速登录检测失败
        "localhost.work.weixin.qq.com"
    ],
    "default-nameserver": ["223.5.5.5", "1.2.4.8"],//可修改成自己ISP的DNS
    "nameserver": [...foreignNameservers],
    "proxy-server-nameserver": [...domesticNameservers],
    "nameserver-policy": {
        "geosite:private,cn": domesticNameservers
    }
};
// 规则集通用配置
const ruleProviderCommon = {
    "type": "http",
    "format": "yaml",
    "interval": 86400
};
// 规则集配置
const ruleProviders = {
    "ai": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/ai.yaml",
        "path": "./ruleset/private/ai.yaml"
    },
    "youtube": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/youtube.yaml",
        "path": "./ruleset/private/youtube.yaml"
    },
    "appleCnDirect": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/apple-cn-direct.yaml",
        "path": "./ruleset/private/apple-cn-direct.yaml"
    },
    "appleComProxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/apple-com-proxy.yaml",
        "path": "./ruleset/private/apple-com-proxy.yaml"
    },
    "google": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/google.yaml",
        "path": "./ruleset/private/google.yaml"
    },
    "proxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/proxy.yaml",
        "path": "./ruleset/private/proxy.yaml"
    },
    "github": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/github.yaml",
        "path": "./ruleset/private/github.yaml"
    },
    "canva": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/canva.yaml",
        "path": "./ruleset/private/canva.yaml"
    },
    "custom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/windows-rules/custom.yaml",
        "path": "./ruleset/private/custom.yaml"
    },
};
// 规则
const rules = [
    // Apple 路由
    "RULE-SET,appleCnDirect,直连",
    "RULE-SET,appleComProxy,AI",
    // 代理
    "RULE-SET,canva,AI",
    "RULE-SET,ai,AI",
    "RULE-SET,youtube,AI",
    "RULE-SET,google,AI",
    "RULE-SET,proxy,AI",
    "RULE-SET,github,AI",
    "RULE-SET,custom,AI",
    // 直连
    "MATCH,直连"
];
// 代理组通用配置
const groupBaseOption = {
    "interval": 300,
    "timeout": 3000,
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

    // 静态住宅代理
    const staticResidentialServer = "69.3.";
    const staticProxyBase = {
        "type": "socks5",
        "server": staticResidentialServer,
        "port": 443,
        "username": "",
        "password": "",
        "udp": true
    };

    // 直连节点 (速度快，但可能被墙)
    const staticProxyDirect = {
        ...staticProxyBase,
        "name": "静态住宅 (直连)"
    };

    // 只对订阅原始节点建链，跳过脚本已生成的静态住宅节点
    const isSubscriptionProxy = (proxy) => {
        if (!proxy?.name) return false;
        if (proxy.name.startsWith("静态住宅")) return false;
        if (proxy.type === "socks5" && proxy.server === staticResidentialServer) return false;
        return true;
    };

    // 链式节点 (稳定，通过前置代理转发)
    // const chainConfigs = [
    //     {name: "前置跳板A", filter: "日本"},
    //     {name: "前置跳板B", filter: "香港"},
    //     {name: "前置跳板C", filter: "美国"},
    //     {name: "前置跳板D", filter: "新加坡"},
    // ];
    const subscriptionProxies = (config.proxies || []).filter(isSubscriptionProxy);
    const chainConfigs = subscriptionProxies.map(p => {
        const safeName = p.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        return {
            name: `前置跳板${p.name}`,
            filter: `^${safeName}$`
        };
    });

    const generatedChainProxies = chainConfigs.map(item => ({
        ...staticProxyBase,
        "name": `静态住宅 (链式-${item.name.replace('前置跳板', '')})`,
        "dialer-proxy": item.name
    }));
    const generatedProxyGroups = chainConfigs.map(item => ({
        ...groupBaseOption,
        "name": item.name,
        "type": "select",
        "include-all": true,
        "filter": item.filter,
        "icon": `https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/google.svg`
    }));

    // 将静态代理添加到总节点列表中（先移除同名节点，避免合并重复执行时 duplicate name）
    if (!Array.isArray(config.proxies)) {
        config.proxies = [];
    }
    const newProxyNames = new Set([
        staticProxyDirect.name,
        ...generatedChainProxies.map(p => p.name),
    ]);
    config.proxies = config.proxies.filter(p => !newProxyNames.has(p.name));
    config.proxies.push(staticProxyDirect, ...generatedChainProxies);

    // 覆盖原配置中DNS配置
    config["dns"] = dnsConfig;

    // 覆盖原配置中的代理组
    config["proxy-groups"] = [
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
            "interval": 120,
            "tolerance": 20,
            "proxies": [staticProxyDirect.name, ...generatedChainProxies.map(p => p.name)],
            "include-all": false,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/chatgpt.svg"
        },
        ...generatedProxyGroups,
        {
            ...groupBaseOption,
            "name": "直连",
            "type": "select",
            "proxies": ["DIRECT"],
            "include-all": false,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/link.svg"
        }
    ];

    // 覆盖原配置中的规则
    config["rule-providers"] = ruleProviders;
    config["rules"] = rules;
    // 添加判断
    if (config["proxies"]) {
        config["proxies"].forEach(proxy => {
            // 为每个节点设置 udp = true
            proxy.udp = true
        })
    }
    // 返回修改后的配置
    return config;

}
