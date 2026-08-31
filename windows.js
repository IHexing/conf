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
const cdnBase = "https://fastly.jsdelivr.net/gh/IHexing/conf@main/windows-rules";
const ruleProviders = {
    "ai": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": `${cdnBase}/ai.yaml`,
        "path": "./ruleset/private/ai.yaml"
    },
    "youtube": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": `${cdnBase}/youtube.yaml`,
        "path": "./ruleset/private/youtube.yaml"
    },
    "appleCnDirect": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": `${cdnBase}/apple-cn-direct.yaml`,
        "path": "./ruleset/private/apple-cn-direct.yaml"
    },
    "appleComProxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": `${cdnBase}/apple-com-proxy.yaml`,
        "path": "./ruleset/private/apple-com-proxy.yaml"
    },
    "google": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": `${cdnBase}/google.yaml`,
        "path": "./ruleset/private/google.yaml"
    },
    "proxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": `${cdnBase}/proxy.yaml`,
        "path": "./ruleset/private/proxy.yaml"
    },
    "github": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": `${cdnBase}/github.yaml`,
        "path": "./ruleset/private/github.yaml"
    },
    "canva": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": `${cdnBase}/canva.yaml`,
        "path": "./ruleset/private/canva.yaml"
    },
    "custom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": `${cdnBase}/custom.yaml`,
        "path": "./ruleset/private/custom.yaml"
    },
};
// 规则
const rules = [
    // Apple 路由
    "RULE-SET,appleCnDirect,直连",
    "RULE-SET,appleComProxy,AI",
    "DOMAIN-SUFFIX,novproxy.com,AI",
    "DOMAIN-SUFFIX,oyunfor.com,AI",
    "DOMAIN-SUFFIX,iyzico.com,AI",
    "DOMAIN-SUFFIX,chatgpt.site,AI",
    "DOMAIN-SUFFIX,cc.cd,AI",
    "DOMAIN-SUFFIX,miyaip.com,AI",
    "DOMAIN-SUFFIX,iproyal.cn,AI",




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
    const staticResidentialServer = "";
    const staticProxyBase = {
        "type": "socks5",
        "server": staticResidentialServer,
        "port": 8022,
        "username": "",
        "password": "",
        "udp": true
    };

    // 只对订阅原始节点建链，跳过脚本已生成的静态住宅节点
    const isSubscriptionProxy = (proxy) => {
        if (!proxy?.name) return false;
        if (proxy.name.startsWith("静态住宅")) return false;
        if (proxy.type === "socks5" && proxy.server === staticResidentialServer) return false;
        return true;
    };

    const subscriptionProxies = (config.proxies || []).filter(isSubscriptionProxy);
    const generatedChainProxies = subscriptionProxies.map(p => ({
        ...staticProxyBase,
        "name": `静态住宅 (链式-${p.name})`,
        "dialer-proxy": p.name
    }));

    // 将静态代理添加到总节点列表中（先移除同名节点，避免合并重复执行时 duplicate name）
    if (!Array.isArray(config.proxies)) {
        config.proxies = [];
    }
    const newProxyNames = new Set(generatedChainProxies.map(p => p.name));
    config.proxies = config.proxies.filter(p => !newProxyNames.has(p.name));
    config.proxies.push(...generatedChainProxies);

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
            "proxies": generatedChainProxies.map(p => p.name),
            "include-all": false,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/chatgpt.svg"
        },
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
