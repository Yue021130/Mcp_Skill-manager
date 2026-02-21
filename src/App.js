import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import { ConfigManager, SUPPORTED_CLIS } from './ConfigManager.js';
import { ManagerConfig } from './ManagerConfig.js';

const PAGES = {
  MCP: 'mcp',
  SKILLS: 'skills',
  TRASH: 'trash',
  SETTINGS: 'settings'
};

const MCP_WINDOWS = {
  LIST: 0,
  DETAILS: 1,
  CLI: 2
};

const CLI_NAMES = {
  [SUPPORTED_CLIS.CLAUDE]: 'Claude Code',
  [SUPPORTED_CLIS.GEMINI]: 'Gemini Code Assist'
};

export default function App() {
  const { exit } = useApp();
  const { stdout } = useStdout();
  const [page, setPage] = useState(PAGES.MCP);
  const [activeWindow, setActiveWindow] = useState(MCP_WINDOWS.LIST);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [cliSelectedIndex, setCliSelectedIndex] = useState(0);
  const [detailMenuIndex, setDetailMenuIndex] = useState(0);
  
  const [configManager, setConfigManager] = useState(null);
  const [managerConfig, setManagerConfig] = useState(null);
  const [availableCLIs, setAvailableCLIs] = useState([]);
  const [mcpServers, setMcpServers] = useState({});
  const [skills, setSkills] = useState({});
  const [trash, setTrash] = useState({});
  
  const [error, setError] = useState(null);
  const [message, setMessage] = useState(null);

  useEffect(() => {
    try {
      const manager = new ConfigManager();
      const mConfig = new ManagerConfig();
      
      setConfigManager(manager);
      setManagerConfig(mConfig);
      setAvailableCLIs(manager.getAvailableCLIs());
      setMcpServers(manager.getMcpServers());
      setSkills(manager.getSkills());
      setTrash(mConfig.getTrash());
    } catch (err) {
      setError(err.message);
    }
  }, []);

  const refreshData = () => {
    if (configManager && managerConfig) {
      configManager.reload();
      setMcpServers(configManager.getMcpServers());
      setSkills(configManager.getSkills());
      setTrash(managerConfig.getTrash());
    }
  };

  const getCurrentList = () => {
    switch (page) {
      case PAGES.MCP: return Object.keys(mcpServers).sort();
      case PAGES.SKILLS: return Object.keys(skills).sort();
      case PAGES.TRASH: return Object.keys(trash).sort();
      default: return [];
    }
  };

  const currentList = getCurrentList();
  const selectedItem = currentList[selectedIndex];

  // Build detail action menu for selected MCP
  const getDetailMenu = (name) => {
    if (!name || !mcpServers[name]) return [];
    const serverInfo = mcpServers[name];
    const firstCli = Object.keys(serverInfo.clis)[0];
    const isDisabled = serverInfo.clis[firstCli]?.config?.disabled;
    const items = [];
    if (availableCLIs.length > 1) items.push({ label: 'Sync to all CLIs', action: 'sync' });
    items.push({ label: 'Delete (move to trash)', action: 'delete' });
    items.push({ label: isDisabled ? 'Enable' : 'Disable', action: 'toggle' });
    return items;
  };

  const detailMenu = getDetailMenu(selectedItem);

  useInput((input, key) => {
    if (message) setMessage(null);
    if (error) setError(null);

    if (input === 'q') { exit(); return; }

    // Tab / ←→ - switch window (MCP page)
    if (key.tab || key.leftArrow || key.rightArrow) {
      if (page === PAGES.MCP) {
        if (key.leftArrow) {
          setActiveWindow(prev => prev === 0 ? MCP_WINDOWS.CLI : prev - 1);
        } else {
          setActiveWindow(prev => (prev + 1) % 3);
        }
      }
      return;
    }

    // Page switch
    if (input === '1') { setPage(PAGES.MCP); setActiveWindow(MCP_WINDOWS.LIST); setSelectedIndex(0); return; }
    if (input === '2') { setPage(PAGES.SKILLS); setActiveWindow(0); setSelectedIndex(0); return; }
    if (input === '3') { setPage(PAGES.TRASH); setActiveWindow(0); setSelectedIndex(0); return; }
    if (input === '4') { setPage(PAGES.SETTINGS); return; }

    // List navigation
    if (activeWindow === MCP_WINDOWS.LIST || (page !== PAGES.MCP && activeWindow === 0)) {
      if (key.upArrow) { setSelectedIndex(prev => Math.max(0, prev - 1)); return; }
      if (key.downArrow) { setSelectedIndex(prev => Math.min(currentList.length - 1, prev + 1)); return; }
    }

    // Details window - menu navigation + execute
    if (page === PAGES.MCP && activeWindow === MCP_WINDOWS.DETAILS) {
      if (key.upArrow) { setDetailMenuIndex(prev => Math.max(0, prev - 1)); return; }
      if (key.downArrow) { setDetailMenuIndex(prev => Math.min(detailMenu.length - 1, prev + 1)); return; }
      if (key.return && selectedItem) {
        const action = detailMenu[detailMenuIndex]?.action;
        try {
          if (action === 'sync') {
            configManager.syncMcpServerToAll(selectedItem);
            refreshData();
            setMessage(`已同步 ${selectedItem} 到所有 CLI`);
          } else if (action === 'delete') {
            const serverInfo = mcpServers[selectedItem];
            const fromCLIs = Object.keys(serverInfo.clis);
            const config = serverInfo.clis[fromCLIs[0]].config;
            configManager.deleteMcpServer(selectedItem);
            managerConfig.moveToTrash(selectedItem, config, fromCLIs);
            refreshData();
            setSelectedIndex(prev => Math.max(0, prev - 1));
            setDetailMenuIndex(0);
            setMessage(`已将 ${selectedItem} 移入回收站`);
          } else if (action === 'toggle') {
            const serverInfo = mcpServers[selectedItem];
            for (const cli of Object.keys(serverInfo.clis)) {
              configManager.toggleMcpServer(selectedItem, cli);
            }
            refreshData();
            setMessage(`已切换 ${selectedItem} 状态`);
          }
        } catch (err) {
          setError(err.message);
        }
        return;
      }
    }

    // CLI window - toggle which CLIs have this MCP
    if (page === PAGES.MCP && activeWindow === MCP_WINDOWS.CLI) {
      if (key.upArrow) { setCliSelectedIndex(prev => Math.max(0, prev - 1)); return; }
      if (key.downArrow) { setCliSelectedIndex(prev => Math.min(availableCLIs.length - 1, prev + 1)); return; }
      if (key.return && selectedItem) {
        const serverInfo = mcpServers[selectedItem];
        const selectedCli = availableCLIs[cliSelectedIndex];
        try {
          if (serverInfo.clis[selectedCli]) {
            const remaining = Object.keys(serverInfo.clis).filter(c => c !== selectedCli);
            if (remaining.length === 0) {
              setError(`取消后将无CLI，请用 Delete 删除`);
              return;
            }
            configManager.deleteMcpServer(selectedItem, selectedCli);
            setMessage(`已从 ${CLI_NAMES[selectedCli]} 移除 ${selectedItem}`);
          } else {
            const sourceCli = Object.keys(serverInfo.clis)[0];
            configManager.syncMcpServerTo(selectedItem, sourceCli, selectedCli);
            setMessage(`已添加 ${selectedItem} 到 ${CLI_NAMES[selectedCli]}`);
          }
          refreshData();
        } catch (err) {
          setError(err.message);
        }
        return;
      }
    }

    // 'd' shortcut - delete from list
    if (page === PAGES.MCP && input === 'd' && activeWindow === MCP_WINDOWS.LIST && selectedItem) {
      try {
        const serverInfo = mcpServers[selectedItem];
        const fromCLIs = Object.keys(serverInfo.clis);
        const config = serverInfo.clis[fromCLIs[0]].config;
        configManager.deleteMcpServer(selectedItem);
        managerConfig.moveToTrash(selectedItem, config, fromCLIs);
        refreshData();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        setMessage(`已将 ${selectedItem} 移入回收站`);
      } catch (err) {
        setError(err.message);
      }
      return;
    }

    // Trash restore
    if (page === PAGES.TRASH && selectedItem && key.return) {
      try {
        const trashItem = trash[selectedItem];
        for (const cli of trashItem.fromCLIs) {
          if (availableCLIs.includes(cli)) {
            if (!configManager.managers[cli]) configManager.managers[cli] = { config: { mcpServers: {} } };
            if (!configManager.managers[cli].config.mcpServers) configManager.managers[cli].config.mcpServers = {};
            configManager.managers[cli].config.mcpServers[selectedItem] = trashItem.config;
            configManager.saveConfig(cli);
          }
        }
        managerConfig.restoreFromTrash(selectedItem);
        refreshData();
        setSelectedIndex(prev => Math.max(0, prev - 1));
        setMessage(`已恢复 ${selectedItem}`);
      } catch (err) {
        setError(err.message);
      }
      return;
    }

    // Skills toggle
    if (page === PAGES.SKILLS && selectedItem && key.return) {
      try {
        configManager.toggleSkill(selectedItem);
        refreshData();
        const skill = skills[selectedItem];
        setMessage(`${skill?.name} 已${skill?.disabled ? '启用' : '禁用'}`);
      } catch (err) {
        setError(err.message);
      }
      return;
    }

    if (input === 'r') { refreshData(); setMessage('已刷新'); return; }
  });

  const terminalWidth = stdout?.columns || 120;
  const terminalHeight = stdout?.rows || 30;

  return (
    <Box flexDirection="column" width={terminalWidth} height={terminalHeight}>
      {/* 顶部标题栏 */}
      <Box borderStyle="single" borderColor="cyan" paddingX={2}>
        <Text bold color="cyan">🚀 MCP & Skills Manager</Text>
        <Text> | </Text>
        <Text color={page === PAGES.MCP ? 'green' : 'gray'}>[1] MCP</Text>
        <Text> </Text>
        <Text color={page === PAGES.SKILLS ? 'green' : 'gray'}>[2] Skills</Text>
        <Text> </Text>
        <Text color={page === PAGES.TRASH ? 'green' : 'gray'}>[3] 回收站</Text>
        <Text> </Text>
        <Text color={page === PAGES.SETTINGS ? 'green' : 'gray'}>[4] 设置</Text>
      </Box>

      {/* 消息/错误栏 */}
      {(error || message) && (
        <Box paddingX={2} height={1}>
          {error && <Text color="red">❌ {error}</Text>}
          {message && <Text color="green">✅ {message}</Text>}
        </Box>
      )}

      {/* 主内容区域 */}
      <Box flexGrow={1} flexDirection="row">
        {page === PAGES.MCP && (
          <MCPPage
            mcpServers={mcpServers}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            cliSelectedIndex={cliSelectedIndex}
            detailMenuIndex={detailMenuIndex}
            detailMenu={detailMenu}
            activeWindow={activeWindow}
            availableCLIs={availableCLIs}
            terminalWidth={terminalWidth}
            terminalHeight={terminalHeight}
          />
        )}
        {page === PAGES.SKILLS && (
          <SkillsPage
            skills={skills}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            terminalWidth={terminalWidth}
            terminalHeight={terminalHeight}
          />
        )}
        {page === PAGES.TRASH && (
          <TrashPage
            trash={trash}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            terminalWidth={terminalWidth}
            terminalHeight={terminalHeight}
          />
        )}
        {page === PAGES.SETTINGS && (
          <SettingsPage availableCLIs={availableCLIs} terminalWidth={terminalWidth} />
        )}
      </Box>

      {/* 底部状态栏 */}
      <Box borderStyle="single" borderColor="cyan" paddingX={2} height={3}>
        <Text color="cyan">
          {page === PAGES.MCP && `MCP | 窗口: ${activeWindow === MCP_WINDOWS.LIST ? '列表' : activeWindow === MCP_WINDOWS.DETAILS ? '详情' : 'CLI分配'} | [Tab/←→] 切换 | [↑↓] 导航 | [Enter] 确认 | [d] 删除 | [r] 刷新 | [q] 退出`}
          {page === PAGES.SKILLS && 'Skills | [↑↓] 导航 | [Enter] 切换启用 | [r] 刷新 | [q] 退出'}
          {page === PAGES.TRASH && '回收站 | [↑↓] 导航 | [Enter] 恢复 | [r] 刷新 | [q] 退出'}
          {page === PAGES.SETTINGS && '设置 | [r] 刷新 | [q] 退出'}
        </Text>
      </Box>
    </Box>
  );
}

// MCP 页面 - 三栏布局
function MCPPage({ mcpServers, selectedItem, selectedIndex, cliSelectedIndex, detailMenuIndex, detailMenu, activeWindow, availableCLIs, terminalWidth, terminalHeight }) {
  const mcpList = Object.keys(mcpServers).sort();
  const serverInfo = selectedItem ? mcpServers[selectedItem] : null;

  // 列宽: 26% | 44% | 30%
  const leftWidth = Math.floor(terminalWidth * 0.26);
  const middleWidth = Math.floor(terminalWidth * 0.44);
  const rightWidth = terminalWidth - leftWidth - middleWidth;

  // 虚拟滚动：header(3)+footer(3)+border(2)+title(1)+margin(1) ≈ 12 行开销
  const listVisible = Math.max(3, terminalHeight - 12);
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(listVisible / 2),
    Math.max(0, mcpList.length - listVisible)
  ));
  const visibleList = mcpList.slice(scrollOffset, scrollOffset + listVisible);

  // 中间面板：/mcp 风格
  const renderDetails = () => {
    if (!serverInfo) {
      return <Text color="gray" dimColor>← 选择一个 MCP</Text>;
    }
    const firstCli = Object.keys(serverInfo.clis)[0];
    const config = serverInfo.clis[firstCli]?.config || {};
    const type = config.type || 'stdio';
    const isDisabled = !!config.disabled;
    const configPaths = Object.keys(serverInfo.clis).map(cli =>
      cli === SUPPORTED_CLIS.CLAUDE ? '~/.claude.json' :
      cli === SUPPORTED_CLIS.GEMINI ? '~/.gemini/settings.json' : '~/.config'
    ).join(', ');
    const envCount = config.env ? Object.keys(config.env).length : 0;

    return (
      <Box flexDirection="column">
        <Text bold color="white">{selectedItem} MCP Server</Text>
        <Text> </Text>
        <Text>{'Status: '}<Text color={isDisabled ? 'red' : 'green'}>{isDisabled ? '✖ disabled' : '✔ configured'}</Text></Text>
        {type === 'stdio' && config.command && (
          <Text>{'Command: '}<Text color="white">{config.command}</Text></Text>
        )}
        {type === 'stdio' && config.args?.length > 0 && (
          <Text>{'Args: '}<Text color="white">{config.args.join(' ')}</Text></Text>
        )}
        {(type === 'sse' || type === 'http') && config.url && (
          <Text>{'URL: '}<Text color="white">{config.url}</Text></Text>
        )}
        <Text>{'Config location: '}<Text color="white">{configPaths}</Text></Text>
        <Text>{'Type: '}<Text color="white">{type}</Text></Text>
        {envCount > 0 && (
          <Text>{'Env vars: '}<Text color="white">{envCount} set</Text></Text>
        )}
        <Text> </Text>
        {detailMenu.map((item, i) => {
          const active = activeWindow === MCP_WINDOWS.DETAILS && i === detailMenuIndex;
          return (
            <Text key={item.action} color={active ? 'cyan' : 'gray'}>
              {active ? '❯ ' : '  '}{i + 1}. {item.label}
            </Text>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      {/* 左侧：MCP 列表（虚拟滚动）*/}
      <Box
        width={leftWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.LIST ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">MCP ({mcpList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {scrollOffset > 0 && <Text color="gray" dimColor>↑ {scrollOffset} more</Text>}
          {visibleList.map((name, i) => {
            const realIdx = scrollOffset + i;
            return (
              <Text key={name} color={realIdx === selectedIndex ? 'cyan' : 'white'}>
                {realIdx === selectedIndex ? '►' : ' '} {name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < mcpList.length && (
            <Text color="gray" dimColor>↓ {mcpList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      {/* 中间：/mcp 风格详情 + 操作菜单 */}
      <Box
        width={middleWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.DETAILS ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
        paddingY={0}
      >
        <Text bold color="cyan">详情</Text>
        <Box flexDirection="column" marginTop={1}>
          {renderDetails()}
        </Box>
      </Box>

      {/* 右侧：CLI 分配 */}
      <Box
        width={rightWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.CLI ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">CLI 分配</Text>
        {serverInfo ? (
          <Box flexDirection="column" marginTop={1}>
            {availableCLIs.map((cli, index) => {
              const hasCli = !!serverInfo.clis[cli];
              const isSelected = activeWindow === MCP_WINDOWS.CLI && index === cliSelectedIndex;
              return (
                <Box key={cli} flexDirection="column" marginBottom={1}>
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '►' : ' '} {hasCli ? '🟢' : '⚪'} {CLI_NAMES[cli]}
                  </Text>
                  {isSelected && (
                    <Text color="yellow" dimColor>  [Enter] {hasCli ? '移除' : '添加'}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>选择 MCP</Text>
        )}
      </Box>
    </>
  );
}

// Skills 页面
function SkillsPage({ skills, selectedItem, selectedIndex, terminalWidth, terminalHeight }) {
  const skillsList = Object.keys(skills).sort();
  const skill = selectedItem ? skills[selectedItem] : null;
  const leftWidth = Math.floor(terminalWidth * 0.4);

  const listVisible = Math.max(3, terminalHeight - 12);
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(listVisible / 2),
    Math.max(0, skillsList.length - listVisible)
  ));
  const visibleList = skillsList.slice(scrollOffset, scrollOffset + listVisible);

  return (
    <>
      <Box width={leftWidth} borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Skills ({skillsList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {scrollOffset > 0 && <Text color="gray" dimColor>↑ {scrollOffset} more</Text>}
          {visibleList.map((key, i) => {
            const realIdx = scrollOffset + i;
            const s = skills[key];
            return (
              <Text key={key} color={realIdx === selectedIndex ? 'cyan' : 'white'}>
                {realIdx === selectedIndex ? '►' : ' '} {s.disabled ? '⚪' : '🟢'} {s.name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < skillsList.length && (
            <Text color="gray" dimColor>↓ {skillsList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">详情</Text>
        {skill ? (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="white">{skill.name}</Text>
            <Text> </Text>
            <Text>{'Status: '}<Text color={skill.disabled ? 'red' : 'green'}>{skill.disabled ? '✖ disabled' : '✔ enabled'}</Text></Text>
            <Text>{'Version: '}<Text color="white">{skill.version}</Text></Text>
            <Text>{'Marketplace: '}<Text color="white">{skill.marketplace}</Text></Text>
            {skill.installedAt && (
              <Text>{'Installed: '}<Text color="gray">{new Date(skill.installedAt).toLocaleDateString()}</Text></Text>
            )}
            <Text> </Text>
            <Text color="yellow">❯ 1. {skill.disabled ? 'Enable' : 'Disable'}</Text>
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>← 选择一个 Skill</Text>
        )}
      </Box>
    </>
  );
}

// 回收站页面
function TrashPage({ trash, selectedItem, selectedIndex, terminalWidth, terminalHeight }) {
  const trashList = Object.keys(trash).sort();
  const item = selectedItem ? trash[selectedItem] : null;
  const leftWidth = Math.floor(terminalWidth * 0.4);

  const listVisible = Math.max(3, terminalHeight - 12);
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(listVisible / 2),
    Math.max(0, trashList.length - listVisible)
  ));
  const visibleList = trashList.slice(scrollOffset, scrollOffset + listVisible);

  return (
    <>
      <Box width={leftWidth} borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">回收站 ({trashList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {scrollOffset > 0 && <Text color="gray" dimColor>↑ {scrollOffset} more</Text>}
          {visibleList.map((name, i) => {
            const realIdx = scrollOffset + i;
            return (
              <Text key={name} color={realIdx === selectedIndex ? 'cyan' : 'white'}>
                {realIdx === selectedIndex ? '►' : ' '} 🗑️  {name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < trashList.length && (
            <Text color="gray" dimColor>↓ {trashList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">详情</Text>
        {item ? (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="white">{selectedItem} MCP Server</Text>
            <Text> </Text>
            <Text>{'Deleted: '}<Text color="gray">{new Date(item.deletedAt).toLocaleString()}</Text></Text>
            <Text>{'From CLI: '}<Text color="white">{item.fromCLIs.map(c => CLI_NAMES[c] || c).join(', ')}</Text></Text>
            <Text> </Text>
            <Text color="yellow">❯ 1. Restore</Text>
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>← 选择一个条目</Text>
        )}
      </Box>
    </>
  );
}

// 设置页面
function SettingsPage({ availableCLIs, terminalWidth }) {
  return (
    <Box flexGrow={1} borderStyle="single" borderColor="green" flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan" underline>⚙️  设置</Text>
      
      <Box marginTop={2} flexDirection="column">
        <Text bold color="yellow">检测到的 CLI</Text>
        <Box marginTop={1} flexDirection="column">
          {availableCLIs.map((cli, index) => (
            <Text key={cli} color="green">
              {index + 1}. {CLI_NAMES[cli]}
            </Text>
          ))}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text bold color="yellow">配置文件路径</Text>
        <Box marginTop={1} flexDirection="column">
          {availableCLIs.includes(SUPPORTED_CLIS.CLAUDE) && (
            <Text color="gray">• Claude Code: ~/.claude.json</Text>
          )}
          {availableCLIs.includes(SUPPORTED_CLIS.GEMINI) && (
            <Text color="gray">• Gemini Code Assist: ~/.gemini/settings.json</Text>
          )}
        </Box>
      </Box>

      <Box marginTop={2} flexDirection="column">
        <Text bold color="yellow">Manager 配置</Text>
        <Text color="gray">~/.gwyy_ms_Manager.json</Text>
      </Box>
      
      <Box marginTop={2} flexDirection="column">
        <Text bold color="yellow">版本信息</Text>
        <Text color="gray">v1.0.0</Text>
      </Box>
    </Box>
  );
}
