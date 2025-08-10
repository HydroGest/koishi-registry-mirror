const fs = require('fs');
const axios = require('axios');
const { URL } = require('url');

// 配置
const PLUGIN_SOURCES = [
  'https://koishi-registry.yumetsuki.moe/index.json',
  'https://koi.nyan.zone/registry/index.json',
  'https://registry.koishi.t4wefan.pub/index.json',
  'https://kp.itzdrli.cc/index.json'
];

const OUTPUT_FILE = 'index.json';
const RAW_URL = `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/${OUTPUT_FILE}`;

// 获取所有插件源数据
async function fetchSources() {
  const requests = PLUGIN_SOURCES.map(url => 
    axios.get(url, { timeout: 15000 })
      .then(res => res.data?.objects || [])
      .catch(error => {
        console.error(`Error fetching ${url}: ${error.message}`);
        return [];
      })
  );

  const results = await Promise.allSettled(requests);
  
  // 合并所有插件
  const allPlugins = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allPlugins.push(...result.value);
    }
  }
  
  return allPlugins;
}

// 创建虚拟状态插件
function createStatusPlugin(pluginCount, generatedAt) {
  return {
    _id: 'mirror-status',
    shortname: "镜像状态",
    createdAt: generatedAt,
    updatedAt: generatedAt,
    package: {
      name: "koishi-plugin-mirror-status",
      version: "1.0.0",
      description: `Koishi 镜像源状态 | 插件数: ${pluginCount} | RAW: ${RAW_URL}`,
      links: { npm: RAW_URL }
    },
    manifest: {
      description: `最后更新: ${new Date().toLocaleString()} | 插件数: ${pluginCount}`
    },
    downloads: {
      lastMonth: 10000
    }
  };
}

// 主生成函数
async function generateRegistry() {
  try {
    console.log('Starting registry generation...');
    const startTime = new Date();
    
    // 获取所有源数据
    const plugins = await fetchSources();
    console.log(`Fetched ${plugins.length} plugins from ${PLUGIN_SOURCES.length} sources`);
    
    // 去重处理 - 相同插件取最新版本
    const pluginMap = new Map();
    
    for (const plugin of plugins) {
      const id = plugin.package?.name || plugin.shortname;
      if (!id) continue;
      
      const existing = pluginMap.get(id);
      
      if (!existing) {
        pluginMap.set(id, plugin);
      } else {
        // 比较更新时间，取最新的
        const existingDate = new Date(existing.updatedAt || 0);
        const newDate = new Date(plugin.updatedAt || 0);
        
        if (newDate > existingDate) {
          pluginMap.set(id, plugin);
        }
      }
    }
    
    const uniquePlugins = Array.from(pluginMap.values());
    console.log(`Deduplicated to ${uniquePlugins.length} plugins`);
    
    // 添加状态插件
    const generatedAt = new Date().toISOString();
    uniquePlugins.unshift(createStatusPlugin(uniquePlugins.length, generatedAt));
    
    // 构建最终输出
    const output = {
      info: "Hosted by GitHub Pages Mirror",
      total: uniquePlugins.length,
      time: new Date().toUTCString(),
      version: 1,
      generatedAt,
      rawUrl: RAW_URL,
      sources: PLUGIN_SOURCES,
      objects: uniquePlugins
    };
    
    // 写入文件
    fs.writeFileSync(OUTPUT_FILE, JSON.stringify(output, null, 2));
    
    const duration = (new Date() - startTime) / 1000;
    console.log(`✅ Successfully generated registry with ${uniquePlugins.length} plugins in ${duration.toFixed(1)}s`);
    console.log(`Output file: ${OUTPUT_FILE}`);
    console.log(`RAW URL: ${RAW_URL}`);
    
  } catch (error) {
    console.error('❌ Registry generation failed:', error);
    process.exit(1);
  }
}

// 执行生成
generateRegistry();