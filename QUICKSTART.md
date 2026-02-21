# 快速开始指南

## 1. 安装依赖

```bash
npm install
```

## 2. 编译项目

```bash
npm run build
```

## 3. 运行应用

```bash
npm start
# 或直接运行
node dist/cli.js
```

## 4. 基本操作

### 查看 MCP 服务器
启动应用后，默认显示所有 MCP 服务器列表。

### 启用/禁用服务器
1. 使用 `↑` `↓` 键选择服务器
2. 按 `Enter` 或 `Space` 切换状态
3. 配置自动保存到 `~/.claude.json`

### 删除服务器
1. 选择要删除的服务器
2. 按 `d` 键
3. 服务器将从配置中移除

### 刷新配置
按 `r` 键重新加载配置（如果您在外部修改了配置文件）

### 切换标签
- 按 `1` 切换到 MCP 服务器
- 按 `2` 切换到 Skills（开发中）
- 按 `Tab` 在标签间切换

### 退出
按 `q` 键退出应用

## 5. 配置备份

应用会在每次修改配置前自动创建备份：
- 备份位置: `~/.claude-backups/`
- 保留最近 10 个备份
- 文件名格式: `claude-2026-02-21T00-10-30-158Z.json`

## 6. 全局安装（可选）

```bash
# 在项目目录下运行
npm link

# 现在可以在任何地方运行
skills-manager
```

## 示例场景

### 场景 1: 临时禁用某个 MCP 服务器

假设您想临时禁用 `puppeteer` 服务器：

1. 运行 `npm start`
2. 使用 `↓` 键找到 `puppeteer`
3. 按 `Enter` 禁用
4. 按 `q` 退出

现在 Claude Code 将不会加载 `puppeteer` 服务器。

### 场景 2: 删除不再使用的服务器

假设您想删除 `chrome-devtools` 服务器：

1. 运行 `npm start`
2. 使用 `↓` 键找到 `chrome-devtools`
3. 按 `d` 删除
4. 按 `q` 退出

服务器配置已从 `~/.claude.json` 中移除。

### 场景 3: 恢复配置

如果误操作，可以从备份恢复：

```bash
# 查看备份
ls ~/.claude-backups/

# 恢复最新备份
cp ~/.claude-backups/claude-2026-02-21T00-10-30-158Z.json ~/.claude.json

# 刷新应用
# 在应用中按 'r' 键刷新
```

## 故障排除

### 问题: 应用无法启动
```bash
# 确保已编译
npm run build

# 检查 Node 版本（需要 >= 16）
node --version
```

### 问题: 配置未同步
```bash
# 检查配置文件权限
ls -l ~/.claude.json

# 手动刷新配置
# 在应用中按 'r' 键
```

### 问题: 备份目录不存在
```bash
# 创建备份目录
mkdir -p ~/.claude-backups
```

## 下一步

- 查看 [README.md](README.md) 了解更多功能
- 探索源代码 `source/` 目录
- 提交问题或建议到 GitHub Issues
