# EasyBet 智能合约项目

本目录包含 EasyBet 彩票系统的智能合约代码和相关配置。

## 项目结构

```
contracts/
├── contracts/              # 智能合约源码目录
│   └── EasyBet.sol        # 主合约文件 - 实现彩票系统的核心逻辑
├── scripts/                # 部署脚本目录
│   └── deploy.ts          # 合约部署脚本
├── test/                   # 测试文件目录
│   └── testEasyBet.ts     # 合约测试文件
├── artifacts/              # 编译输出目录（自动生成）
│   ├── contracts/         # 编译后的合约ABI和字节码
│   └── @openzeppelin/     # OpenZeppelin库的编译产物
├── cache/                  # Hardhat缓存目录（自动生成）
├── typechain-types/        # TypeScript类型定义（自动生成）
├── hardhat.config.ts       # Hardhat配置文件
├── tsconfig.json           # TypeScript配置
└── package.json            # 项目依赖配置
```

## 核心文件说明

### `contracts/EasyBet.sol`
主智能合约文件，实现了完整的彩票系统功能：
- **继承关系**: `ERC721` (NFT标准) + `Ownable` (权限管理) + `ReentrancyGuard` (重入攻击保护)
- **核心功能**:
  - 彩票创建与管理
  - 彩票购买（NFT形式）
  - 彩票交易市场
  - 自动结算与奖金分配
- **主要数据结构**:
  - `Lottery`: 彩票信息结构
  - `Ticket`: 彩票（NFT）结构
  - `Listing`: 挂单信息结构

### `scripts/deploy.ts`
部署脚本，用于将合约部署到区块链网络：
- 自动部署 EasyBet 合约
- 创建示例彩票用于测试
- 输出部署信息（合约地址、管理员地址等）

### `test/testEasyBet.ts`
合约测试文件，包含完整的测试用例：
- 部署测试
- 彩票创建测试
- 购买功能测试
- 交易功能测试
- 结算功能测试

### `hardhat.config.ts`
Hardhat配置文件，包含：
- Solidity编译器版本和优化设置
- 网络配置（本地Ganache等）
- 其他Hardhat插件配置

## 依赖说明

### 主要依赖

- **hardhat**: Ethereum开发环境
- **@nomicfoundation/hardhat-toolbox**: Hardhat工具集
- **@openzeppelin/contracts**: 安全合约库
  - `ERC721`: NFT标准实现
  - `Ownable`: 权限管理
  - `ReentrancyGuard`: 重入攻击保护

## 合约功能详解

### 管理员功能
- `createLottery()`: 创建新彩票期
- `endSales()`: 结束彩票销售
- `settleLottery()`: 结算彩票并设置中奖号码

### 用户功能
- `buyTicket()`: 购买彩票（需要支付ETH）
- `listTicket()`: 在交易市场挂单出售彩票
- `buyListedTicket()`: 购买交易市场中的彩票
- `cancelListing()`: 取消挂单
- `claimPrize()`: 领取奖金

### 查询功能
- `getLottery()`: 获取彩票信息
- `getTicket()`: 获取彩票详情
- `getUserTickets()`: 获取用户持有的所有彩票
- `getLotteryTickets()`: 获取某个彩票期的所有彩票
- `getWinningTickets()`: 获取中奖彩票列表
- `getActiveListings()`: 获取所有活跃的挂单

## 彩票状态流转

```
NotStarted (0) → Selling (1) → Trading (2) → Settled (3)
```

1. **NotStarted**: 彩票创建后，等待开始销售
2. **Selling**: 销售中，玩家可以购买彩票
3. **Trading**: 销售结束，玩家可以交易彩票
4. **Settled**: 已结算，中奖者可以领取奖金
