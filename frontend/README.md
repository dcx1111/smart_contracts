# EasyBet 前端项目

本目录包含 EasyBet 彩票系统的 React 前端应用。

## 项目结构

```
frontend/
├── public/                 # 静态资源目录
│   ├── index.html         # HTML模板
│   ├── favicon.ico         # 网站图标
│   └── ...
├── src/                    # 源代码目录
│   ├── App.tsx            # 主应用组件
│   ├── App.css            # 主样式文件
│   ├── index.tsx          # 应用入口文件
│   ├── index.css          # 全局样式
│   ├── contracts/         # 合约ABI文件目录
│   │   └── EasyBet.json   # EasyBet合约的ABI（从合约编译产物复制）
│   ├── types/             # TypeScript类型定义
│   │   └── ethereum.d.ts  # Ethereum相关类型定义
│   ├── App.test.tsx       # 测试文件
│   └── ...
├── build/                  # 构建输出目录（自动生成）
├── package.json            # 项目依赖配置
├── tsconfig.json           # TypeScript配置
└── README.md              # 本文件
```

## 核心文件说明

### `src/App.tsx`
主应用组件，包含所有前端逻辑：
- **钱包连接**: 使用 MetaMask 连接以太坊账户
- **合约交互**: 通过 ethers.js 与智能合约交互
- **功能模块**:
  - 管理员功能：创建彩票、结束销售、结算彩票
  - 用户功能：购买彩票、交易彩票、领取奖金
  - 市场功能：挂单、购买挂单、取消挂单
- **状态管理**: 管理彩票列表、用户彩票、市场挂单等状态
- **UI渲染**: 响应式界面，支持桌面和移动端

### `src/App.css`
样式文件，包含：
- 现代化的UI设计
- 响应式布局
- 动画效果
- 深色/浅色主题支持

### `src/contracts/EasyBet.json`
合约ABI文件，包含：
- 合约的所有函数接口
- 事件定义
- 数据结构定义

**注意**: 此文件需要从合约编译产物中手动复制，或从 `contracts/artifacts/contracts/EasyBet.sol/EasyBet.json` 复制。

### `src/types/ethereum.d.ts`
TypeScript类型定义，为 `window.ethereum` 提供类型支持。

## 依赖说明

### 主要依赖

- **react**: React框架
- **react-dom**: React DOM渲染
- **ethers**: 以太坊JavaScript库，用于与区块链交互
- **react-scripts**: Create React App的脚本工具
- **typescript**: TypeScript支持

### 开发依赖

- **@types/react**: React类型定义
- **@types/react-dom**: React DOM类型定义
- **@testing-library/react**: React测试工具

## 功能模块

### 1. 钱包连接
- 检测 MetaMask 是否安装
- 连接/断开钱包
- 显示当前账户地址和余额

### 2. 彩票管理（管理员）
- **创建彩票**: 设置价格、数量、时长、描述
- **结束销售**: 将彩票从销售状态转为交易状态
- **结算彩票**: 设置中奖号码并结算奖金

### 3. 彩票购买（用户）
- 浏览所有彩票
- 选择号码购买彩票
- 查看持有的彩票

### 4. 交易市场
- **挂单**: 将持有的彩票挂单出售
- **购买**: 购买市场中挂单的彩票
- **取消**: 取消自己的挂单

### 5. 奖金领取
- 查看中奖彩票
- 一键领取奖金

## 与合约交互

前端通过以下方式与合约交互：

1. **Provider**: 使用 `window.ethereum` 作为Provider
2. **Contract实例**: 通过 `ethers.Contract` 创建合约实例
3. **函数调用**:
   - 只读函数: 使用 `contract.functionName()`
   - 写入函数: 使用 `contract.functionName({ value: amount })` 并等待交易确认

## 配置说明

### 合约地址配置

在 `src/App.tsx` 中硬编码了合约地址：

```typescript
const CONTRACT_ADDRESS = "0x..."; // 需要更新为实际部署的地址
const ADMIN_ADDRESS = "0x...";    // 需要更新为管理员地址
```
