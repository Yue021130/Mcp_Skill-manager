#!/bin/bash
# MCP Skills Manager - 安装脚本

echo "🚀 MCP Skills Manager 安装向导"
echo "================================"
echo ""

# 检查 Node.js
echo "📋 检查环境..."
if ! command -v node &> /dev/null; then
    echo "❌ 错误: 未找到 Node.js"
    echo "请先安装 Node.js (>= 16): https://nodejs.org/"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 16 ]; then
    echo "❌ 错误: Node.js 版本过低 (当前: $(node -v), 需要: >= 16)"
    exit 1
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ npm 版本: $(npm -v)"
echo ""

# 检查配置文件
echo "📋 检查 Claude Code 配置..."
if [ ! -f "$HOME/.claude.json" ]; then
    echo "⚠️  警告: 未找到 ~/.claude.json"
    echo "   继续安装，但应用可能无法正常工作"
else
    echo "✅ 找到配置文件: ~/.claude.json"
fi
echo ""

# 安装依赖
echo "📦 安装依赖..."
npm install
if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi
echo ""

# 编译项目
echo "🔨 编译项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "❌ 编译失败"
    exit 1
fi
echo ""

# 询问是否全局安装
echo "❓ 是否要全局安装? (可以在任何地方运行 'skills-manager')"
read -p "   输入 y/n: " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🔗 创建全局链接..."
    npm link
    if [ $? -eq 0 ]; then
        echo "✅ 全局安装成功! 现在可以运行: skills-manager"
    else
        echo "⚠️  全局安装失败，可能需要 sudo 权限"
        echo "   可以稍后手动运行: sudo npm link"
    fi
else
    echo "⏭️  跳过全局安装"
    echo "   可以使用以下命令运行:"
    echo "   • npm start"
    echo "   • node dist/cli.js"
fi
echo ""

echo "================================"
echo "✨ 安装完成!"
echo ""
echo "📖 快速开始:"
echo "   1. 运行应用: npm start"
echo "   2. 查看文档: cat README.md"
echo "   3. 快速指南: cat QUICKSTART.md"
echo ""
echo "🎯 现在就试试吧!"
echo "   npm start"
echo ""
