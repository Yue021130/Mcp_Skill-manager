import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp, useStdout } from 'ink';
import chalk from 'chalk';
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
  RIGHT: 2  // 右侧窗口包含 Config 和 CLI
};

const RIGHT_PANEL = {
  CONFIG: 0,
  CLI: 1
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
  const [rightPanel, setRightPanel] = useState(RIGHT_PANEL.CONFIG);  // 右侧面板选择
  
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
      case PAGES.MCP:
        return Object.keys(mcpServers).sort();
      case PAGES.SKILLS:
        return Object.keys(skills).sort();
      case PAGES.TRASH:
        return Object.keys(trash).sort();
      default:
        return [];
    }
  };

  const currentList = getCurrentList();
  const selectedItem = currentList[selectedIndex];

  useInput((input, key) => {
    if (message) setMessage(null);
    if (error) setError(null);

    if (input === 'q') {
      exit();
      return;
    }

    // Tab 或 左右箭头 - 切换窗口
    if (key.tab || key.leftArrow || key.rightArrow) {
      if (page === PAGES.MCP) {
        if (key.leftArrow) {
          setActiveWindow((prev) => prev === 0 ? MCP_WINDOWS.RIGHT : prev - 1);
        } else {
          setActiveWindow((prev) => (prev + 1) % 3);  // 0, 1, 2 循环
        }
      }
      return;
    }

    // 1-4 切换页面
    if (input === '1') {
      setPage(PAGES.MCP);
      setActiveWindow(MCP_WINDOWS.LIST);
      setSelectedIndex(0);
      return;
    }
    if (input === '2') {
      setPage(PAGES.SKILLS);
      setActiveWindow(0);
      setSelectedIndex(0);
      return;
    }
    if (input === '3') {
      setPage(PAGES.TRASH);
      setActiveWindow(0);
      setSelectedIndex(0);
      return;
    }
    if (input === '4') {
      setPage(PAGES.SETTINGS);
      return;
    }

    // 列表导航
    if (activeWindow === MCP_WINDOWS.LIST || (page !== PAGES.MCP && activeWindow === 0)) {
      if (key.upArrow) {
        setSelectedIndex(prev => Math.max(0, prev - 1));
        return;
      }
      if (key.downArrow) {
        setSelectedIndex(prev => Math.min(currentList.length - 1, prev + 1));
        return;
      }
    }

    // 右侧窗口导航
    if (page === PAGES.MCP && activeWindow === MCP_WINDOWS.RIGHT) {
      if (key.upArrow) {
        if (rightPanel === RIGHT_PANEL.CLI) {
          // CLI 列表内部导航
          setCliSelectedIndex(prev => {
            if (prev === 0) {
              // 切换到 Config 面板
              setRightPanel(RIGHT_PANEL.CONFIG);
              return 0;
            }
            return prev - 1;
          });
        } else {
          // Config 面板，向上不做操作
        }
        return;
      }
      if (key.downArrow) {
        if (rightPanel === RIGHT_PANEL.CONFIG) {
          // 从 Config 切换到 CLI
          setRightPanel(RIGHT_PANEL.CLI);
          setCliSelectedIndex(0);
        } else {
          // CLI 列表内部导航
          setCliSelectedIndex(prev => Math.min(availableCLIs.length - 1, prev + 1));
        }
        return;
      }

      // 回车 - 在 CLI 面板时切换 CLI 状态
      if (key.return && selectedItem && rightPanel === RIGHT_PANEL.CLI) {
        const serverInfo = mcpServers[selectedItem];
        const selectedCli = availableCLIs[cliSelectedIndex];
        
        try {
          const hasThisCli = serverInfo.clis[selectedCli];
          
          if (hasThisCli) {
            // 取消这个 CLI
            const remainingClis = Object.keys(serverInfo.clis).filter(c => c !== selectedCli);
            
            if (remainingClis.length === 0) {
              setError(`警告: 这是最后一个 CLI，取消后 ${selectedItem} 将移入回收站`);
              return;
            }
            
            configManager.deleteMcpServer(selectedItem, selectedCli);
            setMessage(`已从 ${CLI_NAMES[selectedCli]} 移除 ${selectedItem}`);
          } else {
            // 添加到这个 CLI
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

    // MCP 删除
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

    // 回收站恢复
    if (page === PAGES.TRASH && selectedItem && key.return) {
      try {
        const trashItem = trash[selectedItem];
        
        for (const cli of trashItem.fromCLIs) {
          if (availableCLIs.includes(cli)) {
            const firstCli = trashItem.fromCLIs[0];
            configManager.managers[cli] = configManager.managers[cli] || { config: { mcpServers: {} } };
            if (!configManager.managers[cli].config.mcpServers) {
              configManager.managers[cli].config.mcpServers = {};
            }
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

    // Skills 切换
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

    // 刷新
    if (input === 'r') {
      refreshData();
      setMessage('已刷新');
      return;
    }
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
            activeWindow={activeWindow}
            rightPanel={rightPanel}
            availableCLIs={availableCLIs}
            terminalWidth={terminalWidth}
          />
        )}

        {page === PAGES.SKILLS && (
          <SkillsPage
            skills={skills}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            terminalWidth={terminalWidth}
          />
        )}

        {page === PAGES.TRASH && (
          <TrashPage
            trash={trash}
            selectedItem={selectedItem}
            selectedIndex={selectedIndex}
            terminalWidth={terminalWidth}
          />
        )}

        {page === PAGES.SETTINGS && (
          <SettingsPage availableCLIs={availableCLIs} terminalWidth={terminalWidth} />
        )}
      </Box>

      {/* 底部状态栏 */}
      <Box borderStyle="single" borderColor="cyan" paddingX={2} height={3}>
        <Text color="cyan">
          {page === PAGES.MCP && `MCP 管理 | 窗口: ${activeWindow === MCP_WINDOWS.LIST ? '列表' : activeWindow === MCP_WINDOWS.DETAILS ? '详情' : '配置/CLI'} | [Tab/←→] 切换 | [↑↓] 导航 | [Enter] 确认 | [d] 删除 | [r] 刷新 | [q] 退出`}
          {page === PAGES.SKILLS && 'Skills 管理 | [↑↓] 导航 | [Enter] 切换启用 | [r] 刷新 | [q] 退出'}
          {page === PAGES.TRASH && '回收站 | [↑↓] 导航 | [Enter] 恢复 | [r] 刷新 | [q] 退出'}
          {page === PAGES.SETTINGS && '设置 | [r] 刷新 | [q] 退出'}
        </Text>
      </Box>
    </Box>
  );
}

// MCP 页面 - 三栏布局
function MCPPage({ mcpServers, selectedItem, selectedIndex, cliSelectedIndex, activeWindow, rightPanel, availableCLIs, terminalWidth }) {
  const mcpList = Object.keys(mcpServers).sort();
  const serverInfo = selectedItem ? mcpServers[selectedItem] : null;
  
  // 左侧 35%，中间 35%，右侧 30%
  const leftWidth = Math.floor(terminalWidth * 0.35);
  const middleWidth = Math.floor(terminalWidth * 0.35);
  const rightWidth = terminalWidth - leftWidth - middleWidth;
  
  return (
    <>
      {/* 左侧：MCP 列表 */}
      <Box
        width={leftWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.LIST ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
      >
        <Text bold color="cyan">MCP 列表 ({mcpList.length})</Text>
        <Box flexDirection="column" marginTop={1} flexGrow={1} overflow="hidden">
          {mcpList.map((name, index) => (
            <Text key={name} color={index === selectedIndex ? 'cyan' : 'white'}>
              {index === selectedIndex ? '► ' : '  '}{name}
            </Text>
          ))}
        </Box>
      </Box>

      {/* 中间：详情 */}
      <Box
        width={middleWidth}
        borderStyle="single"
        borderColor={activeWindow === MCP_WINDOWS.DETAILS ? 'green' : 'gray'}
        flexDirection="column"
        paddingX={1}
        paddingY={0}
      >
        <Text bold color="cyan">详情</Text>
        {serverInfo ? (() => {
          const firstCli = Object.keys(serverInfo.clis)[0];
          const config = serverInfo.clis[firstCli]?.config || {};
          const args = config.args || [];
          const env = config.env || {};
          const envEntries = Object.entries(env);
          const cliNames = Object.keys(serverInfo.clis).map(c => CLI_NAMES[c] || c);
          return (
            <Box flexDirection="column" marginTop={1}>
              <Text bold color="yellow">{selectedItem}</Text>

              <Text> </Text>
              <Text color="gray">command: <Text color="white">{config.command || 'N/A'}</Text></Text>

              {args.length > 0 && (
                <Box flexDirection="column">
                  <Text color="gray">args:</Text>
                  {args.map((a, i) => (
                    <Text key={i} color="white">  {a}</Text>
                  ))}
                </Box>
              )}

              <Text color="gray">type: <Text color="white">{config.type || 'stdio'}</Text></Text>

              {envEntries.length > 0 && (
                <Box flexDirection="column" marginTop={1}>
                  <Text color="gray">env:</Text>
                  {envEntries.map(([k, v]) => (
                    <Text key={k} color="white">  {k}=<Text color="gray">{String(v).slice(0, 30)}</Text></Text>
                  ))}
                </Box>
              )}

              <Text> </Text>
              <Text color="gray">已配置在:</Text>
              {cliNames.map(n => (
                <Text key={n} color="green">  🟢 {n}</Text>
              ))}
              {availableCLIs.filter(c => !serverInfo.clis[c]).map(c => (
                <Text key={c} color="gray">  ⚪ {CLI_NAMES[c]}</Text>
              ))}
            </Box>
          );
        })() : (
          <Text color="gray" dimColor>选择一个 MCP 查看详情</Text>
        )}
      </Box>

      {/* 右侧：上配置，下CLI */}
      <Box width={rightWidth} flexDirection="column">
        {/* 上：配置参数（60%）*/}
        <Box
          flexGrow={3}
          borderStyle="single"
          borderColor={activeWindow === MCP_WINDOWS.RIGHT && rightPanel === RIGHT_PANEL.CONFIG ? 'green' : 'gray'}
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color="cyan">配置参数</Text>
          {serverInfo && (() => {
            const config = serverInfo.clis[Object.keys(serverInfo.clis)[0]]?.config || {};
            const rows = [];
            for (const [key, value] of Object.entries(config)) {
              if (Array.isArray(value)) {
                rows.push(<Text key={key} color="gray">{key}:</Text>);
                value.forEach((v, i) => rows.push(
                  <Text key={`${key}-${i}`} color="white">  {String(v)}</Text>
                ));
              } else if (value !== null && typeof value === 'object') {
                rows.push(<Text key={key} color="gray">{key}:</Text>);
                Object.entries(value).forEach(([k, v]) => rows.push(
                  <Text key={`${key}-${k}`} color="white">  {k}: <Text color="gray">{String(v).slice(0, 25)}</Text></Text>
                ));
              } else {
                rows.push(
                  <Text key={key} color="gray">{key}: <Text color="white">{String(value)}</Text></Text>
                );
              }
            }
            return <Box flexDirection="column" marginTop={1} overflow="hidden">{rows}</Box>;
          })()}
        </Box>

        {/* 下：CLI 状态（40%）*/}
        <Box
          flexGrow={2}
          borderStyle="single"
          borderColor={activeWindow === MCP_WINDOWS.RIGHT && rightPanel === RIGHT_PANEL.CLI ? 'green' : 'gray'}
          flexDirection="column"
          paddingX={1}
        >
          <Text bold color="cyan">CLI 状态</Text>
          {serverInfo && (
            <Box flexDirection="column" marginTop={1}>
              {availableCLIs.map((cli, index) => {
                const hasCli = serverInfo.clis[cli];
                const isSelected = activeWindow === MCP_WINDOWS.RIGHT && rightPanel === RIGHT_PANEL.CLI && index === cliSelectedIndex;
                
                return (
                  <Text key={cli}>
                    {isSelected ? '► ' : '  '}
                    {hasCli ? '🟢' : '⚪'} {CLI_NAMES[cli]}
                  </Text>
                );
              })}
              {activeWindow === MCP_WINDOWS.RIGHT && rightPanel === RIGHT_PANEL.CLI && (
                <Box marginTop={1}>
                  <Text color="yellow" dimColor>[Enter] 切换</Text>
                </Box>
              )}
            </Box>
          )}
        </Box>
      </Box>
    </>
  );
}

// Skills 页面
function SkillsPage({ skills, selectedItem, selectedIndex, terminalWidth }) {
  const skillsList = Object.keys(skills).sort();
  const skill = selectedItem ? skills[selectedItem] : null;
  
  const leftWidth = Math.floor(terminalWidth * 0.4);
  
  return (
    <>
      <Box width={leftWidth} borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">Skills 列表 ({skillsList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {skillsList.map((key, index) => {
            const s = skills[key];
            return (
              <Text key={key} color={index === selectedIndex ? 'cyan' : 'white'}>
                {index === selectedIndex ? '► ' : '  '}{s.disabled ? '⚪' : '🟢'} {s.name}
              </Text>
            );
          })}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">详情</Text>
        {skill && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="yellow">名称</Text>
            <Text color="white">{skill.name}</Text>
            
            <Box marginTop={1}>
              <Text bold color="yellow">版本</Text>
            </Box>
            <Text color="gray">{skill.version}</Text>
            
            <Box marginTop={1}>
              <Text bold color="yellow">市场</Text>
            </Box>
            <Text color="gray">{skill.marketplace}</Text>
            
            <Box marginTop={1}>
              <Text bold color="yellow">状态</Text>
            </Box>
            <Text color={skill.disabled ? 'red' : 'green'}>{skill.disabled ? '已禁用' : '已启用'}</Text>
          </Box>
        )}
      </Box>
    </>
  );
}

// 回收站页面
function TrashPage({ trash, selectedItem, selectedIndex, terminalWidth }) {
  const trashList = Object.keys(trash).sort();
  const item = selectedItem ? trash[selectedItem] : null;
  
  const leftWidth = Math.floor(terminalWidth * 0.4);
  
  return (
    <>
      <Box width={leftWidth} borderStyle="single" borderColor="green" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">回收站 ({trashList.length})</Text>
        <Box flexDirection="column" marginTop={1}>
          {trashList.map((name, index) => (
            <Text key={name} color={index === selectedIndex ? 'cyan' : 'white'}>
              {index === selectedIndex ? '► ' : '  '}🗑️  {name}
            </Text>
          ))}
        </Box>
      </Box>

      <Box flexGrow={1} borderStyle="single" borderColor="gray" flexDirection="column" paddingX={1}>
        <Text bold color="cyan">详情</Text>
        {item && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold color="yellow">名称</Text>
            <Text color="white">{selectedItem}</Text>
            
            <Box marginTop={1}>
              <Text bold color="yellow">删除时间</Text>
            </Box>
            <Text color="gray">{new Date(item.deletedAt).toLocaleString()}</Text>
            
            <Box marginTop={1}>
              <Text bold color="yellow">来自 CLI</Text>
            </Box>
            <Text color="gray">{item.fromCLIs.map(c => CLI_NAMES[c]).join(', ')}</Text>
            
            <Box marginTop={2}>
              <Text color="green">[Enter] 恢复到原 CLI</Text>
            </Box>
          </Box>
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
