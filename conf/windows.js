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
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/ai.txt",
        "path": "./ruleset/private/ai.yaml"
    },
    "youtube": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/youtube.txt",
        "path": "./ruleset/private/youtube.yaml"
    },
    "google": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/google.txt",
        "path": "./ruleset/private/google.yaml"
    },
    "proxy": {
        ...ruleProviderCommon,
        "behavior": "domain",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/proxy.txt",
        "path": "./ruleset/private/proxy.yaml"
    },
    "gemini": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/gemini.txt",
        "path": "./ruleset/private/gemini.yaml"
    },
    "github": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/github.txt",
        "path": "./ruleset/private/github.yaml"
    },
    "custom": {
        ...ruleProviderCommon,
        "behavior": "classical",
        "url": "https://raw.githubusercontent.com/IHexing/conf/refs/heads/main/txt/custom.txt",
        "path": "./ruleset/private/custom.yaml"
    },
};
// 规则
const rules = [
    // 自定义规则
    "DOMAIN-SUFFIX,mvnrepository.com,AI", // Google服务
    // 代理
    "RULE-SET,ai,AI",
    "RULE-SET,youtube,AI",
    "RULE-SET,google,AI",
    "RULE-SET,proxy,AI",
    "RULE-SET,gemini,AI",
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

    // 覆盖原配置中DNS配置
    config["dns"] = dnsConfig;

    // 覆盖原配置中的代理组
    config["proxy-groups"] = [
        {
            ...groupBaseOption,
            "name": "节点选择",
            "type": "select",
            "include-all": true,
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/adjust.svg"
        },
        {
            ...groupBaseOption,
            "name": "AI",
            "type": "url-test",
            "interval": 120,
            "tolerance": 200,
            "include-all": true,
            "filter": "新加坡",
            "icon": "https://fastly.jsdelivr.net/gh/clash-verge-rev/clash-verge-rev.github.io@main/docs/assets/icons/speed.svg"
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

