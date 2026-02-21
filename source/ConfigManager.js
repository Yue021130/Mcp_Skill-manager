import fs from 'fs';
import path from 'path';
import os from 'os';

// Claude Code 配置
const CLAUDE_CONFIG_PATH = path.join(os.homedir(), '.claude.json');
const CLAUDE_PLUGINS_PATH = path.join(os.homedir(), '.claude/plugins/installed_plugins.json');

// Gemini Code Assist 配置
const GEMINI_CONFIG_PATH = path.join(os.homedir(), '.gemini/settings.json');

const BACKUP_DIR = path.join(os.homedir(), '.claude-backups');

// 支持的 CLI 列表
export const SUPPORTED_CLIS = {
  CLAUDE: 'claude',
  GEMINI: 'gemini'
};

class ConfigManager {
  constructor() {
    this.managers = {}; // 存储每个 CLI 的管理器
    this.availableCLIs = [];
    this.detectAndLoadCLIs();
  }

  detectAndLoadCLIs() {
    // 检测 Claude Code
    if (fs.existsSync(CLAUDE_CONFIG_PATH)) {
      try {
        const data = fs.readFileSync(CLAUDE_CONFIG_PATH, 'utf8');
        this.managers[SUPPORTED_CLIS.CLAUDE] = {
          config: JSON.parse(data),
          configPath: CLAUDE_CONFIG_PATH
        };
        
        // 加载 Claude Plugins
        if (fs.existsSync(CLAUDE_PLUGINS_PATH)) {
          const pluginsData = fs.readFileSync(CLAUDE_PLUGINS_PATH, 'utf8');
          this.managers[SUPPORTED_CLIS.CLAUDE].pluginsConfig = JSON.parse(pluginsData);
        }
        
        this.availableCLIs.push(SUPPORTED_CLIS.CLAUDE);
      } catch (error) {
        console.error('Failed to load Claude config:', error);
      }
    }

    // 检测 Gemini Code Assist
    if (fs.existsSync(GEMINI_CONFIG_PATH)) {
      try {
        const data = fs.readFileSync(GEMINI_CONFIG_PATH, 'utf8');
        this.managers[SUPPORTED_CLIS.GEMINI] = {
          config: JSON.parse(data),
          configPath: GEMINI_CONFIG_PATH
        };
        this.availableCLIs.push(SUPPORTED_CLIS.GEMINI);
      } catch (error) {
        console.error('Failed to load Gemini config:', error);
      }
    }
  }

  reload() {
    this.managers = {};
    this.availableCLIs = [];
    this.detectAndLoadCLIs();
  }

  getAvailableCLIs() {
    return this.availableCLIs;
  }

  saveConfig(cli) {
    try {
      const manager = this.managers[cli];
      if (!manager) return false;
      
      // 创建备份
      this.createBackup(cli);
      
      // 保存配置
      fs.writeFileSync(
        manager.configPath,
        JSON.stringify(manager.config, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to save ${cli} config: ${error.message}`);
    }
  }

  savePluginsConfig() {
    try {
      const manager = this.managers[SUPPORTED_CLIS.CLAUDE];
      if (!manager?.pluginsConfig) return false;
      
      // 创建备份
      this.createPluginsBackup();
      
      // 保存插件配置
      fs.writeFileSync(
        CLAUDE_PLUGINS_PATH,
        JSON.stringify(manager.pluginsConfig, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      throw new Error(`Failed to save plugins config: ${error.message}`);
    }
  }

  createBackup(cli) {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const manager = this.managers[cli];
      const filename = path.basename(manager.configPath, path.extname(manager.configPath));
      const backupPath = path.join(BACKUP_DIR, `${cli}-${filename}-${timestamp}.json`);
      
      fs.copyFileSync(manager.configPath, backupPath);
      
      // 只保留最近 10 个备份
      const prefix = `${cli}-${filename}-`;
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith(prefix))
        .sort()
        .reverse();
      
      backups.slice(10).forEach(backup => {
        fs.unlinkSync(path.join(BACKUP_DIR, backup));
      });
    } catch (error) {
      console.error('Backup failed:', error);
    }
  }

  createPluginsBackup() {
    try {
      if (!fs.existsSync(BACKUP_DIR)) {
        fs.mkdirSync(BACKUP_DIR, { recursive: true });
      }
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(BACKUP_DIR, `plugins-${timestamp}.json`);
      
      if (fs.existsSync(CLAUDE_PLUGINS_PATH)) {
        fs.copyFileSync(CLAUDE_PLUGINS_PATH, backupPath);
      }
      
      // 只保留最近 10 个备份
      const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => f.startsWith('plugins-'))
        .sort()
        .reverse();
      
      backups.slice(10).forEach(backup => {
        fs.unlinkSync(path.join(BACKUP_DIR, backup));
      });
    } catch (error) {
      console.error('Plugins backup failed:', error);
    }
  }

  // 获取所有 MCP 服务器（合并所有 CLI）
  getMcpServers() {
    const allServers = {};
    
    for (const cli of this.availableCLIs) {
      const manager = this.managers[cli];
      const servers = manager.config?.mcpServers || {};
      
      for (const [name, config] of Object.entries(servers)) {
        if (!allServers[name]) {
          allServers[name] = {
            name,
            config,
            clis: {}
          };
        }
        
        allServers[name].clis[cli] = {
          enabled: !config.disabled,
          config
        };
      }
    }
    
    return allServers;
  }

  // 切换某个 MCP 在某个 CLI 中的状态
  toggleMcpServer(name, cli) {
    const manager = this.managers[cli];
    if (!manager?.config?.mcpServers?.[name]) return false;
    
    manager.config.mcpServers[name].disabled = !manager.config.mcpServers[name].disabled;
    return this.saveConfig(cli);
  }

  // 删除某个 MCP（从指定 CLI 或所有 CLI）
  deleteMcpServer(name, cli = null) {
    if (cli) {
      const manager = this.managers[cli];
      if (manager?.config?.mcpServers?.[name]) {
        delete manager.config.mcpServers[name];
        return this.saveConfig(cli);
      }
    } else {
      // 从所有 CLI 删除
      let success = false;
      for (const cliId of this.availableCLIs) {
        if (this.managers[cliId]?.config?.mcpServers?.[name]) {
          delete this.managers[cliId].config.mcpServers[name];
          this.saveConfig(cliId);
          success = true;
        }
      }
      return success;
    }
    return false;
  }

  // 同步 MCP 到指定 CLI（复制完整配置）
  syncMcpServerTo(name, fromCli, toCli, configOverride = null) {
    let config;
    
    if (configOverride) {
      // 使用提供的配置（例如从回收站恢复）
      config = JSON.parse(JSON.stringify(configOverride));
    } else {
      const fromManager = this.managers[fromCli];
      if (!fromManager?.config?.mcpServers?.[name]) {
        throw new Error(`${name} 在 ${fromCli} 中不存在`);
      }
      config = JSON.parse(JSON.stringify(fromManager.config.mcpServers[name]));
    }
    
    const toManager = this.managers[toCli];
    if (!toManager) {
      throw new Error(`${toCli} 不可用`);
    }
    
    // 确保 mcpServers 对象存在
    if (!toManager.config.mcpServers) {
      toManager.config.mcpServers = {};
    }
    
    // 写入配置
    toManager.config.mcpServers[name] = config;
    
    return this.saveConfig(toCli);
  }

  // 同步 MCP 到所有其他 CLI（复制完整配置）
  syncMcpServerToAll(name, sourceCli = null) {
    // 找到源 CLI（第一个有这个 MCP 的 CLI）
    if (!sourceCli) {
      for (const cli of this.availableCLIs) {
        if (this.managers[cli]?.config?.mcpServers?.[name]) {
          sourceCli = cli;
          break;
        }
      }
    }
    
    if (!sourceCli) {
      throw new Error(`未找到 ${name} 的配置`);
    }
    
    const sourceConfig = this.managers[sourceCli].config.mcpServers[name];
    
    // 复制到所有其他 CLI
    for (const cli of this.availableCLIs) {
      if (cli !== sourceCli && this.managers[cli]) {
        if (!this.managers[cli].config.mcpServers) {
          this.managers[cli].config.mcpServers = {};
        }
        
        // 复制完整配置
        this.managers[cli].config.mcpServers[name] = JSON.parse(JSON.stringify(sourceConfig));
        this.saveConfig(cli);
      }
    }
    
    return true;
  }

  // 启用/禁用 MCP（不同于同步）
  enableMcpServer(name, cli, enable) {
    const manager = this.managers[cli];
    if (!manager?.config?.mcpServers?.[name]) return false;
    
    manager.config.mcpServers[name].disabled = !enable;
    return this.saveConfig(cli);
  }

  getSkills() {
    // 只有 Claude Code 有 Plugins/Skills
    const manager = this.managers[SUPPORTED_CLIS.CLAUDE];
    if (!manager?.pluginsConfig?.plugins) {
      return {};
    }
    
    const skills = {};
    for (const [pluginKey, instances] of Object.entries(manager.pluginsConfig.plugins)) {
      const [name, marketplace] = pluginKey.split('@');
      
      if (instances && instances.length > 0) {
        const instance = instances[0];
        skills[pluginKey] = {
          name,
          marketplace,
          version: instance.version,
          installPath: instance.installPath,
          installedAt: instance.installedAt,
          lastUpdated: instance.lastUpdated,
          scope: instance.scope,
          disabled: instance.disabled || false
        };
      }
    }
    
    return skills;
  }

  toggleSkill(pluginKey) {
    const manager = this.managers[SUPPORTED_CLIS.CLAUDE];
    if (!manager?.pluginsConfig?.plugins?.[pluginKey]) return false;
    
    const instances = manager.pluginsConfig.plugins[pluginKey];
    if (instances && instances.length > 0) {
      instances[0].disabled = !instances[0].disabled;
      return this.savePluginsConfig();
    }
    return false;
  }

  deleteSkill(pluginKey) {
    const manager = this.managers[SUPPORTED_CLIS.CLAUDE];
    if (!manager?.pluginsConfig?.plugins?.[pluginKey]) return false;
    
    delete manager.pluginsConfig.plugins[pluginKey];
    return this.savePluginsConfig();
  }
}

export { ConfigManager };
