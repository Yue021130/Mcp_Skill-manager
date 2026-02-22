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
  PARAMS: 2   // right panel: params (top) + CLI assignment (bottom)
};

const CLI_NAMES = {
  [SUPPORTED_CLIS.CLAUDE]: 'Claude Code',
  [SUPPORTED_CLIS.GEMINI]: 'Gemini Code Assist'
};

const SENSITIVE_RE = /token|key|secret|auth|password|bearer|credential/i;
function maskValue(k, v) {
  const s = String(v);
  if (SENSITIVE_RE.test(k)) return s.slice(0, 4) + '***';
  return s.length > 32 ? s.slice(0, 32) + '\u2026' : s;
}

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

    // Tab / arrow keys - switch window (MCP page)
    if (key.tab || key.leftArrow || key.rightArrow) {
      if (page === PAGES.MCP) {
        if (key.leftArrow) {
          setActiveWindow(prev => prev === 0 ? MCP_WINDOWS.PARAMS : prev - 1);
        } else {
          setActiveWindow(prev => (prev + 1) % 3);
        }
      }
      return;
    }

    // Page switch 1-4
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

    // Params/CLI window - CLI assignment navigation
    if (page === PAGES.MCP && activeWindow === MCP_WINDOWS.PARAMS) {
      if (key.upArrow) { setCliSelectedIndex(prev => Math.max(0, prev - 1)); return; }
      if (key.downArrow) { setCliSelectedIndex(prev => Math.min(availableCLIs.length - 1, prev + 1)); return; }
      if (key.return && selectedItem) {
        const serverInfo = mcpServers[selectedItem];
        const selectedCli = availableCLIs[cliSelectedIndex];
        try {
          if (serverInfo.clis[selectedCli]) {
            const remaining = Object.keys(serverInfo.clis).filter(c => c !== selectedCli);
            if (remaining.length === 0) {
              setError('取消后将无CLI，请用 Delete 删除');
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
        <Text bold color="cyan">MCP & Skills Manager</Text>
        <Text color="gray">  |  </Text>
        <Text color={page === PAGES.MCP ? 'green' : 'gray'}>[1] MCP</Text>
        <Text>  </Text>
        <Text color={page === PAGES.SKILLS ? 'green' : 'gray'}>[2] Skills</Text>
        <Text>  </Text>
        <Text color={page === PAGES.TRASH ? 'green' : 'gray'}>[3] Trash</Text>
        <Text>  </Text>
        <Text color={page === PAGES.SETTINGS ? 'green' : 'gray'}>[4] Settings</Text>
      </Box>

      {/* 消息/错误栏 - 固定1行高度，始终占位避免layout抖动 */}
      <Box paddingX={2} height={1}>
        {error && <Text color="red">❌ {error}</Text>}
        {!error && message && <Text color="green">✅ {message}</Text>}
      </Box>

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
          <SettingsPage availableCLIs={availableCLIs} />
        )}
      </Box>

      {/* 底部状态栏 */}
      <Box borderStyle="single" borderColor="cyan" paddingX={2} height={3}>
        <Text color="cyan" wrap="truncate">
          {page === PAGES.MCP
            ? `MCP | focus: ${activeWindow === MCP_WINDOWS.LIST ? 'list' : activeWindow === MCP_WINDOWS.DETAILS ? 'details' : 'params'} | Tab/\u2190\u2192 switch | \u2191\u2193 nav | Enter confirm | d delete | r refresh | q quit`
            : page === PAGES.SKILLS
            ? 'Skills | \u2191\u2193 nav | Enter toggle | r refresh | q quit'
            : page === PAGES.TRASH
            ? 'Trash | \u2191\u2193 nav | Enter restore | r refresh | q quit'
            : 'Settings | r refresh | q quit'}
        </Text>
      </Box>
    </Box>
  );
}

// ─── MCP Page ──────────────────────────────────────────────────────────────
function MCPPage({ mcpServers, selectedItem, selectedIndex, cliSelectedIndex, detailMenuIndex, detailMenu, activeWindow, availableCLIs, terminalWidth, terminalHeight }) {
  const mcpList = Object.keys(mcpServers).sort();
  const serverInfo = selectedItem ? mcpServers[selectedItem] : null;

  // Column widths: 22% | 50% | 28%
  const leftWidth = Math.floor(terminalWidth * 0.22);
  const middleWidth = Math.floor(terminalWidth * 0.50);
  const rightWidth = terminalWidth - leftWidth - middleWidth;

  // Virtual scroll: subtract top(3) + msgbar(1) + bottom(3) + border(2) + title(1) + margin(1) = 11
  const listVisible = Math.max(3, terminalHeight - 11);
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(listVisible / 2),
    Math.max(0, mcpList.length - listVisible)
  ));
  const visibleList = mcpList.slice(scrollOffset, scrollOffset + listVisible);

  // Build details content — show ALL config key-value pairs
  const renderDetails = () => {
    if (!serverInfo) return <Text color="gray" dimColor>Select an MCP to view details</Text>;

    const firstCli = Object.keys(serverInfo.clis)[0];
    const config = serverInfo.clis[firstCli]?.config || {};
    const isDisabled = !!config.disabled;
    const configPaths = Object.keys(serverInfo.clis)
      .map(cli =>
        cli === SUPPORTED_CLIS.CLAUDE ? '~/.claude.json' :
        cli === SUPPORTED_CLIS.GEMINI ? '~/.gemini/settings.json' : cli
      )
      .join(', ');

    const configEntries = Object.entries(config).filter(([k]) => k !== 'disabled');

    return (
      <Box flexDirection="column">
        <Text bold color="white">{selectedItem} MCP Server</Text>
        <Text> </Text>
        <Text>
          {'Status: '}
          <Text color={isDisabled ? 'red' : 'green'}>
            {isDisabled ? '\u2716 disabled' : '\u2714 configured'}
          </Text>
        </Text>
        <Text>{'Config: '}<Text color="white">{configPaths}</Text></Text>
        <Text> </Text>
        {configEntries.map(([key, value]) => {
          if (Array.isArray(value)) {
            return (
              <Box key={key} flexDirection="column">
                <Text color="gray">{key}:</Text>
                {value.map((item, i) => (
                  <Text key={i} color="white" wrap="truncate">{'  '}{String(item)}</Text>
                ))}
              </Box>
            );
          }
          if (typeof value === 'object' && value !== null) {
            return (
              <Box key={key} flexDirection="column">
                <Text color="gray">{key}:</Text>
                {Object.entries(value).map(([k, v]) => (
                  <Text key={k} color="white" wrap="truncate">{'  '}{k}: <Text color="gray">{maskValue(k, v)}</Text></Text>
                ))}
              </Box>
            );
          }
          return (
            <Text key={key} wrap="truncate">
              <Text color="gray">{key}: </Text>
              <Text color="white">{String(value)}</Text>
            </Text>
          );
        })}
        <Text> </Text>
        {detailMenu.map((item, i) => {
          const active = activeWindow === MCP_WINDOWS.DETAILS && i === detailMenuIndex;
          return (
            <Text key={item.action} color={active ? 'cyan' : 'gray'}>
              {active ? '\u276f ' : '  '}{i + 1}. {item.label}
            </Text>
          );
        })}
      </Box>
    );
  };

  return (
    <>
      {/* Left: MCP list with virtual scroll */}
      <Box
        width={leftWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.LIST ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">MCP ({mcpList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {scrollOffset > 0 && (
            <Text color="gray" dimColor>  {'\u2191'} {scrollOffset} more</Text>
          )}
          {visibleList.map((name, i) => {
            const realIdx = scrollOffset + i;
            const active = realIdx === selectedIndex;
            return (
              <Text key={name} color={active ? 'cyan' : 'white'} wrap="truncate">
                {active ? '\u25ba' : ' '} {name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < mcpList.length && (
            <Text color="gray" dimColor>  {'\u2193'} {mcpList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      {/* Middle: /mcp-style details + action menu */}
      <Box
        width={middleWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.DETAILS ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">Details</Text>
        <Box flexDirection="column" marginTop={1}>
          {renderDetails()}
        </Box>
      </Box>

      {/* Right: CLI assignment */}
      <Box
        width={rightWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.PARAMS ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">CLI</Text>
        {serverInfo ? (
          <Box flexDirection="column" marginTop={1}>
            {availableCLIs.map((cli, index) => {
              const hasCli = !!serverInfo.clis[cli];
              const isSelected = activeWindow === MCP_WINDOWS.PARAMS && index === cliSelectedIndex;
              return (
                <Box key={cli} flexDirection="column">
                  <Text color={isSelected ? 'cyan' : 'white'}>
                    {isSelected ? '\u25ba' : ' '} {hasCli ? '\ud83d\udfe2' : '\u26aa'} {CLI_NAMES[cli]}
                  </Text>
                  {isSelected && (
                    <Text color="yellow" dimColor>  [Enter] {hasCli ? 'remove' : 'add'}</Text>
                  )}
                </Box>
              );
            })}
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>select MCP</Text>
        )}
      </Box>
    </>
  );
}

// ─── Skills Page ───────────────────────────────────────────────────────────
function SkillsPage({ skills, selectedItem, selectedIndex, terminalWidth, terminalHeight }) {
  const skillsList = Object.keys(skills).sort();
  const skill = selectedItem ? skills[selectedItem] : null;
  const leftWidth = Math.floor(terminalWidth * 0.38);
  const listVisible = Math.max(3, terminalHeight - 11);
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
          {scrollOffset > 0 && <Text color="gray" dimColor>  {'\u2191'} {scrollOffset} more</Text>}
          {visibleList.map((key, i) => {
            const realIdx = scrollOffset + i;
            const s = skills[key];
            const active = realIdx === selectedIndex;
            return (
              <Text key={key} color={active ? 'cyan' : 'white'} wrap="truncate">
                {active ? '\u25ba' : ' '} {s.disabled ? '\u26aa' : '\ud83d\udfe2'} {s.name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < skillsList.length && (
            <Text color="gray" dimColor>  {'\u2193'} {skillsList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Details</Text>
        {skill ? (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="white">{skill.name}</Text>
            <Text> </Text>
            <Text>{'Status: '}<Text color={skill.disabled ? 'red' : 'green'}>{skill.disabled ? '\u2716 disabled' : '\u2714 enabled'}</Text></Text>
            <Text>{'Version: '}<Text color="white">{skill.version}</Text></Text>
            <Text>{'Marketplace: '}<Text color="white">{skill.marketplace}</Text></Text>
            {skill.installedAt && (
              <Text>{'Installed: '}<Text color="gray">{new Date(skill.installedAt).toLocaleDateString()}</Text></Text>
            )}
            <Text> </Text>
            <Text color="yellow">{'  \u276f'} 1. {skill.disabled ? 'Enable' : 'Disable'}</Text>
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>Select a skill</Text>
        )}
      </Box>
    </>
  );
}

// ─── Trash Page ────────────────────────────────────────────────────────────
function TrashPage({ trash, selectedItem, selectedIndex, terminalWidth, terminalHeight }) {
  const trashList = Object.keys(trash).sort();
  const item = selectedItem ? trash[selectedItem] : null;
  const leftWidth = Math.floor(terminalWidth * 0.38);
  const listVisible = Math.max(3, terminalHeight - 11);
  const scrollOffset = Math.max(0, Math.min(
    selectedIndex - Math.floor(listVisible / 2),
    Math.max(0, trashList.length - listVisible)
  ));
  const visibleList = trashList.slice(scrollOffset, scrollOffset + listVisible);

  return (
    <>
      <Box width={leftWidth} borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Trash ({trashList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {scrollOffset > 0 && <Text color="gray" dimColor>  {'\u2191'} {scrollOffset} more</Text>}
          {visibleList.map((name, i) => {
            const realIdx = scrollOffset + i;
            const active = realIdx === selectedIndex;
            return (
              <Text key={name} color={active ? 'cyan' : 'white'} wrap="truncate">
                {active ? '\u25ba' : ' '} {name}
              </Text>
            );
          })}
          {scrollOffset + listVisible < trashList.length && (
            <Text color="gray" dimColor>  {'\u2193'} {trashList.length - scrollOffset - listVisible} more</Text>
          )}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Details</Text>
        {item ? (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="white">{selectedItem} MCP Server</Text>
            <Text> </Text>
            <Text>{'Deleted: '}<Text color="gray">{new Date(item.deletedAt).toLocaleString()}</Text></Text>
            <Text>{'From CLI: '}<Text color="white">{item.fromCLIs.map(c => CLI_NAMES[c] || c).join(', ')}</Text></Text>
            <Text> </Text>
            <Text color="yellow">{'  \u276f'} 1. Restore</Text>
          </Box>
        ) : (
          <Text color="gray" dimColor marginTop={1}>Select an item</Text>
        )}
      </Box>
    </>
  );
}

// ─── Settings Page ─────────────────────────────────────────────────────────
function SettingsPage({ availableCLIs }) {
  return (
    <Box flexGrow={1} borderStyle="single" borderColor="green" flexDirection="column" paddingX={2} paddingY={1}>
      <Text bold color="cyan">Settings</Text>
      <Text> </Text>
      <Text bold color="yellow">Detected CLIs</Text>
      {availableCLIs.map((cli, index) => (
        <Text key={cli} color="green">  {index + 1}. {CLI_NAMES[cli]}</Text>
      ))}
      <Text> </Text>
      <Text bold color="yellow">Config paths</Text>
      {availableCLIs.includes(SUPPORTED_CLIS.CLAUDE) && (
        <Text color="gray">  Claude Code: ~/.claude.json</Text>
      )}
      {availableCLIs.includes(SUPPORTED_CLIS.GEMINI) && (
        <Text color="gray">  Gemini: ~/.gemini/settings.json</Text>
      )}
      <Text> </Text>
      <Text bold color="yellow">Manager config</Text>
      <Text color="gray">  ~/.gwyy_ms_Manager.json</Text>
      <Text> </Text>
      <Text bold color="yellow">Version</Text>
      <Text color="gray">  v1.0.0</Text>
    </Box>
  );
}
