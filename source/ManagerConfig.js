import fs from 'fs';
import path from 'path';
import os from 'os';

const MANAGER_CONFIG_PATH = path.join(os.homedir(), '.gwyy_ms_Manager.json');

export class ManagerConfig {
  constructor() {
    this.config = this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(MANAGER_CONFIG_PATH)) {
        const data = fs.readFileSync(MANAGER_CONFIG_PATH, 'utf8');
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load manager config:', error);
    }
    
    return {
      version: 1,
      trash: {}, // 回收站：{ mcpName: { config, deletedAt, fromCLIs: [] } }
      settings: {
        lastUsed: null
      }
    };
  }

  saveConfig() {
    try {
      fs.writeFileSync(
        MANAGER_CONFIG_PATH,
        JSON.stringify(this.config, null, 2),
        'utf8'
      );
      return true;
    } catch (error) {
      console.error('Failed to save manager config:', error);
      return false;
    }
  }

  // 移入回收站
  moveToTrash(name, config, fromCLIs) {
    this.config.trash[name] = {
      config,
      deletedAt: new Date().toISOString(),
      fromCLIs: fromCLIs || []
    };
    this.saveConfig();
  }

  // 从回收站恢复
  restoreFromTrash(name) {
    const item = this.config.trash[name];
    if (!item) return null;
    
    delete this.config.trash[name];
    this.saveConfig();
    return item;
  }

  // 清空回收站
  clearTrash() {
    this.config.trash = {};
    this.saveConfig();
  }

  getTrash() {
    return this.config.trash;
  }
}
