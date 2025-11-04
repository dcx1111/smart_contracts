import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import './App.css';

// 合约ABI (简化版本，实际使用时需要从编译后的合约获取)
const CONTRACT_ABI = [
  "function createLottery(uint256 _ticketPrice, uint256 _maxTickets, uint256 _durationSeconds, string memory _description) external",
  "function buyTicket(uint256 _lotteryId, uint256 _number) external payable",
  "function tradeTicket(uint256 _ticketId, address _to, uint256 _price) external payable",
  "function endSales(uint256 _lotteryId) external",
  "function settleLottery(uint256 _lotteryId, uint256 _winningNumber) external",
  "function claimPrize(uint256 _ticketId) external",
  "function getLottery(uint256 _lotteryId) external view returns (tuple(uint256 lotteryId, uint256 ticketPrice, uint256 maxTickets, uint256 soldTickets, uint256 totalPrizePool, uint256 winningNumber, uint256[] winningTickets, uint8 state, uint256 startTime, uint256 endTime, uint256 settleTime, string description))",
  "function getTicket(uint256 _ticketId) external view returns (tuple(uint256 ticketId, uint256 lotteryId, uint256 number, address owner, uint256 purchasePrice, uint256 purchaseTime, bool isWinning))",
  "function getUserTickets(address _user) external view returns (uint256[] memory)",
  "function getLotteryTickets(uint256 _lotteryId) external view returns (uint256[] memory)",
  "function getWinningTickets(uint256 _lotteryId) external view returns (uint256[] memory)",
  "function getContractBalance() external view returns (uint256)",
  "function owner() external view returns (address)",
  // 交易市场功能
  "function listTicket(uint256 _ticketId, uint256 _price) external",
  "function buyListedTicket(uint256 _ticketId) external payable",
  "function cancelListing(uint256 _ticketId) external",
  "function getActiveListings() external view returns (uint256[] memory)",
  "function getListing(uint256 _ticketId) external view returns (tuple(uint256 ticketId, address seller, uint256 price, uint256 listingTime, bool isActive))",
  "event LotteryCreated(uint256 indexed lotteryId, uint256 ticketPrice, uint256 maxTickets, string description)",
  "event TicketPurchased(uint256 indexed lotteryId, uint256 indexed ticketId, address indexed buyer, uint256 number)",
  "event TicketTraded(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price)",
  "event LotterySettled(uint256 indexed lotteryId, uint256 winningNumber, uint256[] winningTickets)",
  "event PrizeClaimed(uint256 indexed ticketId, address indexed winner, uint256 amount)",
  // 交易市场事件
  "event TicketListed(uint256 indexed ticketId, address indexed seller, uint256 price)",
  "event TicketBought(uint256 indexed ticketId, address indexed buyer, address indexed seller, uint256 price)",
  "event ListingCancelled(uint256 indexed ticketId, address indexed seller)"
];

const CONTRACT_ADDRESS = "0x8f9075E07A223006D5a4C5421572BaE95DcFBE9C"; // Ganache部署的合约地址
const ADMIN_ADDRESS = "0x17B20aD5Cfe9fC4e1B7a3c2BdE66f3C0e2549e4b"; // Ganache管理员地址

interface Lottery {
  lotteryId: number;
  ticketPrice: string;
  maxTickets: number;
  soldTickets: number;
  totalPrizePool: string;
  winningNumber: number;
  winningTickets: number[];
  state: number; // 0: NotStarted, 1: Selling, 2: Trading, 3: Settled
  startTime: number;
  endTime: number;
  settleTime: number;
  description: string;
}

interface Ticket {
  ticketId: number;
  lotteryId: number;
  number: number;
  owner: string;
  purchasePrice: string;
  purchaseTime: number;
  isWinning: boolean;
}

interface Listing {
  ticketId: number;
  seller: string;
  price: string;
  listingTime: number;
  isActive: boolean;
}

function App() {
  const [, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [, setSigner] = useState<ethers.JsonRpcSigner | null>(null);
  const [contract, setContract] = useState<ethers.Contract | null>(null);
  const [account, setAccount] = useState<string>('');
  const [isOwner, setIsOwner] = useState(false);
  const [lotteries, setLotteries] = useState<Lottery[]>([]);
  const [userTickets, setUserTickets] = useState<Ticket[]>([]);
  const [activeTab, setActiveTab] = useState<'lotteries' | 'my-tickets' | 'admin' | 'marketplace'>('lotteries');
  const [availableAccounts, setAvailableAccounts] = useState<string[]>([]);
  
  // 交易市场相关状态
  const [listings, setListings] = useState<Listing[]>([]);
  const [listTicketId, setListTicketId] = useState('');
  const [listPrice, setListPrice] = useState('');

  // 获取可用账户
  const getAvailableAccounts = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        setAvailableAccounts(accounts);
        return accounts;
      } catch (error) {
        console.error('获取账户失败:', error);
        return [];
      }
    }
    return [];
  };

  // 连接钱包
  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        const provider = new ethers.BrowserProvider(window.ethereum);
        const signer = await provider.getSigner();
        const contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);
        const address = await signer.getAddress();
        const owner = await contract.owner();
        
        setProvider(provider);
        setSigner(signer);
        setContract(contract);
        setAccount(address);
        // 检查是否为管理员（合约所有者或配置的管理员地址）
        setIsOwner(address.toLowerCase() === owner.toLowerCase() || address.toLowerCase() === ADMIN_ADDRESS.toLowerCase());
        
        // 获取可用账户
        await getAvailableAccounts();
        
        await loadData(contract, address);
      } catch (error) {
        console.error('连接钱包失败:', error);
        alert('连接钱包失败，请检查MetaMask是否已安装并解锁');
      }
    } else {
      alert('请安装MetaMask钱包');
    }
  };

  // 切换账户
  const switchAccount = async (newAddress: string) => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        // 请求切换账户
        await window.ethereum.request({
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
        
        // 重新连接钱包
        await connectWallet();
      } catch (error) {
        console.error('切换账户失败:', error);
        alert('切换账户失败，请手动在MetaMask中切换账户后点击"刷新账户"');
      }
    }
  };

  // 刷新账户（手动切换后使用）
  const refreshAccount = async () => {
    await connectWallet();
  };

  // 加载数据
  const loadData = async (contract: ethers.Contract, userAddress: string) => {
    try {
      // 加载彩票列表（这里简化处理，实际应该从事件中获取）
      const lotteries: Lottery[] = [];
      for (let i = 1; i <= 10; i++) {
        try {
          const lottery = await contract.getLottery(i);
          console.log(`彩票 ${i}:`, lottery);
          console.log(`彩票 ${i} 状态:`, lottery.state, '类型:', typeof lottery.state);
          if (lottery.lotteryId.toString() !== '0') {
            lotteries.push(lottery);
          }
        } catch (e) {
          console.log(`彩票 ${i} 不存在或加载失败:`, e);
          break;
        }
      }
      setLotteries(lotteries);

      // 加载用户彩票
      const ticketIds = await contract.getUserTickets(userAddress);
      const tickets: Ticket[] = [];
      for (const ticketId of ticketIds) {
        const ticket = await contract.getTicket(ticketId);
        tickets.push(ticket);
      }
      setUserTickets(tickets);
      
      // 加载挂单列表
      const activeListingIds = await contract.getActiveListings();
      const listings: Listing[] = [];
      for (const ticketId of activeListingIds) {
        const listing = await contract.getListing(ticketId);
        if (listing.isActive) {
          // 检查该彩票所属的彩票是否已结算
          const ticket = await contract.getTicket(ticketId);
          const lottery = await contract.getLottery(ticket.lotteryId);
          const isNotSettled = Number(lottery.state) !== 3; // 确保不是已结算状态
          
          if (isNotSettled) {
            listings.push(listing);
          }
        }
      }
      setListings(listings);
    } catch (error) {
      console.error('加载数据失败:', error);
    }
  };

  // 挂单出售彩票
  const listTicket = async () => {
    if (!contract || !listTicketId || !listPrice) return;
    
    // 验证价格输入
    const priceValue = parseFloat(listPrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert('❌ 请输入有效的价格（大于0的数字）');
      return;
    }
    
    try {
      // 先检查彩票是否存在和状态
      const ticketId = parseInt(listTicketId);
      if (isNaN(ticketId) || ticketId <= 0) {
        alert('❌ 请输入有效的彩票ID');
        return;
      }
      
      console.log('🔍 开始挂单检查，彩票ID:', ticketId);
      
      // 检查彩票是否存在
      const ticket = await contract.getTicket(ticketId);
      console.log('🎫 彩票信息:', ticket);
      
      if (ticket.ticketId.toString() === '0') {
        alert('❌ 彩票不存在，请检查彩票ID');
        return;
      }
      
      // 检查用户是否拥有该彩票
      console.log('👤 彩票拥有者:', ticket.owner, '当前用户:', account);
      if (ticket.owner.toLowerCase() !== account.toLowerCase()) {
        alert('❌ 您不是该彩票的拥有者，无法挂单');
        return;
      }
      
      // 检查彩票对应的彩票状态
      const lottery = await contract.getLottery(ticket.lotteryId);
      console.log('🎰 彩票信息:', lottery);
      console.log('📊 彩票状态值:', Number(lottery.state), '期望值: 2 (Trading)');
      
      if (Number(lottery.state) !== 2) {
        const stateText = ['未开始', '销售中', '交易中', '已结算'][Number(lottery.state)];
        alert(`❌ 彩票不在交易状态，当前状态：${stateText}。只有管理员结束销售后，彩票才能进入交易状态。`);
        return;
      }
      
      // 检查是否已经挂单
      const existingListing = await contract.getListing(ticketId);
      console.log('📋 挂单信息:', existingListing);
      
      if (existingListing.isActive) {
        alert('❌ 该彩票已经挂单，无法重复挂单');
        return;
      }
      
      console.log('✅ 所有检查通过，开始挂单...');
      
      // 执行挂单
      console.log('💰 挂单价格:', listPrice, 'ETH');
      console.log('📝 调用合约方法: listTicket');
      
      const tx = await contract.listTicket(ticketId, ethers.parseEther(listPrice));
      console.log('📤 交易已发送:', tx.hash);
      
      await tx.wait();
      console.log('✅ 交易已确认');
      alert('✅ 挂单成功！');
      setListTicketId('');
      setListPrice('');
      if (contract) {
        loadData(contract, account);
      }
    } catch (error: any) {
      console.error('挂单失败:', error);
      
      let errorMessage = '挂单失败';
      
      if (error.reason) {
        if (error.reason.includes('Not ticket owner')) {
          errorMessage = '❌ 您不是该彩票的拥有者，无法挂单';
        } else if (error.reason.includes('Lottery not in trading state')) {
          errorMessage = '❌ 彩票不在交易状态，无法挂单。请等待管理员结束销售。';
        } else if (error.reason.includes('Ticket already listed')) {
          errorMessage = '❌ 该彩票已经挂单，无法重复挂单';
        } else if (error.reason.includes('Ticket does not exist')) {
          errorMessage = '❌ 彩票不存在，请检查彩票ID';
        } else if (error.reason.includes('Price must be greater than 0')) {
          errorMessage = '❌ 价格必须大于0';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 挂单失败：彩票状态异常或权限不足。请检查：\n1. 彩票是否存在\n2. 您是否拥有该彩票\n3. 彩票是否在交易状态\n4. 彩票是否已经挂单';
        } else if (error.message.includes('Invalid BigNumber Value')) {
          errorMessage = '❌ 价格格式错误，请输入有效的数字（如：0.1 或 1.5）';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 账户余额不足，请确保有足够的ETH支付Gas费用';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  // 购买挂单的彩票
  const buyListedTicket = async (ticketId: number, price: string) => {
    if (!contract) return;
    
    try {
      // 先检查挂单是否存在和活跃
      const listing = await contract.getListing(ticketId);
      console.log('挂单信息:', {
        ticketId: listing.ticketId.toString(),
        seller: listing.seller,
        price: ethers.formatEther(listing.price),
        isActive: listing.isActive
      });
      
      if (!listing.isActive) {
        alert('❌ 该彩票未挂单或挂单已失效');
        loadData(contract, account);
        return;
      }
      
      // 使用合约返回的准确价格
      console.log('开始购买彩票 #' + ticketId + '，价格: ' + ethers.formatEther(listing.price) + ' ETH');
      const tx = await contract.buyListedTicket(ticketId, { value: listing.price });
      console.log('交易已发送:', tx.hash);
      await tx.wait();
      console.log('交易已确认');
      alert('✅ 购买成功！');
      if (contract) {
        loadData(contract, account);
      }
    } catch (error: any) {
      console.error('购买失败:', error);
      
      let errorMessage = '购买失败';
      
      if (error.reason) {
        if (error.reason.includes('Ticket not listed')) {
          errorMessage = '❌ 该彩票未挂单或已被购买';
        } else if (error.reason.includes('Incorrect payment amount')) {
          errorMessage = '❌ 支付金额不正确，请检查价格';
        } else if (error.reason.includes('Cannot buy your own ticket')) {
          errorMessage = '❌ 不能购买自己的彩票';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 账户余额不足，请确保有足够的ETH';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  // 取消挂单
  const cancelListing = async (ticketId: number) => {
    if (!contract) return;
    
    try {
      const tx = await contract.cancelListing(ticketId);
      await tx.wait();
      alert('取消挂单成功！');
      if (contract) {
        loadData(contract, account);
      }
    } catch (error: any) {
      console.error('取消挂单失败:', error);
      
      let errorMessage = '取消挂单失败';
      
      if (error.reason) {
        if (error.reason.includes('Not listing owner')) {
          errorMessage = '❌ 您不是该挂单的拥有者，无法取消';
        } else if (error.reason.includes('Ticket not listed')) {
          errorMessage = '❌ 该彩票未挂单，无法取消';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  useEffect(() => {
    if (contract && account) {
      loadData(contract, account);
    }
  }, [contract, account]);

  return (
    <div className="App">
      <header className="app-header">
        <h1>🎰 EasyBet 彩票系统</h1>
        {!account ? (
          <button onClick={connectWallet} className="connect-btn">
            连接钱包
          </button>
        ) : (
          <div className="account-info">
            <div className="account-selector">
              <select 
                value={account} 
                onChange={(e) => switchAccount(e.target.value)}
                className="account-dropdown"
              >
                {availableAccounts.map(addr => (
                  <option key={addr} value={addr}>
                    {addr.slice(0, 6)}...{addr.slice(-4)} 
                    {addr.toLowerCase() === ADMIN_ADDRESS.toLowerCase() ? ' (管理员)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="account-status">
              <span>当前账户: {account.slice(0, 6)}...{account.slice(-4)}</span>
              {isOwner && <span className="owner-badge">管理员</span>}
              <button onClick={refreshAccount} className="refresh-btn">
                🔄 刷新账户
              </button>
            </div>
          </div>
        )}
      </header>

      {account && (
        <div className="main-content">
          <nav className="tabs">
            <button 
              className={activeTab === 'lotteries' ? 'active' : ''}
              onClick={() => setActiveTab('lotteries')}
            >
              彩票列表
            </button>
            <button 
              className={activeTab === 'my-tickets' ? 'active' : ''}
              onClick={() => setActiveTab('my-tickets')}
            >
              我的彩票
            </button>
            <button 
              className={activeTab === 'marketplace' ? 'active' : ''}
              onClick={() => setActiveTab('marketplace')}
            >
              交易市场
            </button>
            {isOwner && (
              <button 
                className={activeTab === 'admin' ? 'active' : ''}
                onClick={() => setActiveTab('admin')}
              >
                管理面板
              </button>
            )}
          </nav>

          <div className="tab-content">
            {activeTab === 'lotteries' && (
              <LotteryList 
                lotteries={lotteries}
                tickets={userTickets}
                contract={contract}
                account={account}
                onDataUpdate={() => contract && loadData(contract, account)}
              />
            )}
            {activeTab === 'my-tickets' && (
              <MyTickets 
                tickets={userTickets} 
                lotteries={lotteries}
                contract={contract} 
                account={account}
                onDataUpdate={() => contract && loadData(contract, account)}
              />
            )}
            {activeTab === 'marketplace' && (
              <Marketplace 
                listings={listings}
                userTickets={userTickets}
                lotteries={lotteries}
                contract={contract}
                account={account}
                listTicketId={listTicketId}
                setListTicketId={setListTicketId}
                listPrice={listPrice}
                setListPrice={setListPrice}
                onDataUpdate={() => contract && loadData(contract, account)}
                onListTicket={listTicket}
                onBuyListedTicket={buyListedTicket}
                onCancelListing={cancelListing}
              />
            )}
            {activeTab === 'admin' && isOwner && (
              <AdminPanel 
                lotteries={lotteries}
                contract={contract}
                onDataUpdate={() => contract && loadData(contract, account)}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// 彩票列表组件
function LotteryList({ lotteries, tickets, contract, account, onDataUpdate }: {
  lotteries: Lottery[];
  tickets: Ticket[];
  contract: ethers.Contract | null;
  account: string;
  onDataUpdate: () => void;
}) {
  // const [selectedLottery, setSelectedLottery] = useState<Lottery | null>(null);
  const [ticketNumbers, setTicketNumbers] = useState<{[key: number]: string}>({});
  const [tradeTicketId, setTradeTicketId] = useState('');
  const [tradePrice, setTradePrice] = useState('');
  const [tradeTo, setTradeTo] = useState('');

  const getStateText = (state: number) => {
    const states = ['未开始', '销售中', '交易中', '已结算'];
    return states[state] || '未知';
  };

  const buyTicket = async (lotteryId: number, number: number) => {
    if (!contract) return;
    try {
      const lottery = lotteries.find(l => l.lotteryId === lotteryId);
      if (!lottery) return;
      
      // 确认购买
      const confirmMessage = `确认购买彩票 #${lotteryId} 的号码 ${number}？\n价格: ${ethers.formatEther(lottery.ticketPrice.toString())} ETH`;
      if (!window.confirm(confirmMessage)) return;
      
      const tx = await contract.buyTicket(lotteryId, number, {
        value: lottery.ticketPrice.toString()
      });
      await tx.wait();
      alert(`购买成功！\n彩票ID: ${lotteryId}\n号码: ${number}\n价格: ${ethers.formatEther(lottery.ticketPrice.toString())} ETH`);
      
      // 清空输入框
      setTicketNumbers({
        ...ticketNumbers,
        [lotteryId]: ''
      });
      
      onDataUpdate();
    } catch (error: any) {
      console.error('购买失败:', error);
      
      // 解析错误信息，提供更友好的提示
      let errorMessage = '购买失败';
      
      if (error.reason) {
        // 处理合约返回的错误信息
        if (error.reason.includes('Lottery sales ended')) {
          errorMessage = '❌ 彩票销售已结束，无法购买';
        } else if (error.reason.includes('Number already taken')) {
          errorMessage = '❌ 该号码已被购买，请选择其他号码';
        } else if (error.reason.includes('Incorrect payment amount')) {
          errorMessage = '❌ 支付金额不正确，请检查价格';
        } else if (error.reason.includes('Invalid ticket number')) {
          const currentLottery = lotteries.find(l => l.lotteryId === lotteryId);
          errorMessage = '❌ 无效的彩票号码，请选择1到' + (currentLottery?.maxTickets || 'N') + '之间的号码';
        } else if (error.reason.includes('Lottery not in selling state')) {
          errorMessage = '❌ 彩票不在销售状态，无法购买';
        } else if (error.reason.includes('Lottery sold out')) {
          errorMessage = '❌ 彩票已售罄，无法购买';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        // 处理其他类型的错误
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 交易失败：彩票可能已结束销售或状态异常，请刷新页面后重试';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 账户余额不足，请确保有足够的ETH';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else if (error.message.includes('gas')) {
          errorMessage = '❌ Gas费用不足，请增加Gas限制';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  const tradeTicket = async () => {
    if (!contract || !tradeTicketId || !tradePrice || !tradeTo) return;
    
    // 验证价格输入
    const priceValue = parseFloat(tradePrice);
    if (isNaN(priceValue) || priceValue <= 0) {
      alert('❌ 请输入有效的价格（大于0的数字）');
      return;
    }
    
    try {
      const tx = await contract.tradeTicket(tradeTicketId, tradeTo, ethers.parseEther(tradePrice));
      await tx.wait();
      alert('交易成功！');
      setTradeTicketId('');
      setTradePrice('');
      setTradeTo('');
      onDataUpdate();
    } catch (error: any) {
      console.error('交易失败:', error);
      
      let errorMessage = '交易失败';
      
      if (error.reason) {
        if (error.reason.includes('Not ticket owner')) {
          errorMessage = '❌ 您不是该彩票的拥有者，无法交易';
        } else if (error.reason.includes('Lottery not in trading state')) {
          errorMessage = '❌ 彩票不在交易状态，无法交易';
        } else if (error.reason.includes('Incorrect payment amount')) {
          errorMessage = '❌ 支付金额不正确，请检查交易价格';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('Invalid BigNumber Value')) {
          errorMessage = '❌ 价格格式错误，请输入有效的数字（如：0.1 或 1.5）';
        } else if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 交易失败：彩票状态异常或您不是拥有者，请检查后重试';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 账户余额不足，请确保有足够的ETH';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else if (error.message.includes('invalid address')) {
          errorMessage = '❌ 接收者地址格式错误，请输入有效的以太坊地址';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };


  return (
    <div className="lottery-list">
      <h2>彩票列表</h2>
      {lotteries.length === 0 ? (
        <p>暂无彩票</p>
      ) : (
        <div className="lottery-grid">
          {lotteries.map(lottery => (
            <div key={lottery.lotteryId} className="lottery-card">
              <h3>彩票 #{lottery.lotteryId}</h3>
              <p>{lottery.description}</p>
              <div className="lottery-info">
                <p>价格: {ethers.formatEther(lottery.ticketPrice.toString())} ETH</p>
                <p>已售: {lottery.soldTickets}/{lottery.maxTickets}</p>
                <p>奖池: {ethers.formatEther(lottery.totalPrizePool.toString())} ETH</p>
                <p>状态: {getStateText(lottery.state)}</p>
                {Number(lottery.state) === 3 && (
                  <p>中奖号码: {lottery.winningNumber}</p>
                )}
              </div>
              
              {Number(lottery.state) === 1 && (
                <div className="buy-section">
                  <input
                    type="number"
                    placeholder={`选择号码 (1-${lottery.maxTickets})`}
                    value={ticketNumbers[lottery.lotteryId] || ''}
                    onChange={(e) => setTicketNumbers({
                      ...ticketNumbers,
                      [lottery.lotteryId]: e.target.value
                    })}
                    min="1"
                    max={lottery.maxTickets}
                  />
                  <button 
                    onClick={() => buyTicket(lottery.lotteryId, parseInt(ticketNumbers[lottery.lotteryId] || '0'))}
                    disabled={parseInt(ticketNumbers[lottery.lotteryId] || '0') < 1 || parseInt(ticketNumbers[lottery.lotteryId] || '0') > lottery.maxTickets}
                  >
                    购买彩票
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <div className="trade-section">
        <h3>交易彩票</h3>
        
        {/* 显示可交易的彩票ID */}
        <div className="tradeable-tickets">
          <h4>我的可交易彩票：</h4>
          {tickets.length === 0 ? (
            <p>您还没有购买任何彩票</p>
          ) : (
            <div className="tradeable-list">
              {tickets.map((ticket: Ticket) => {
                const lottery = lotteries.find(l => l.lotteryId === ticket.lotteryId);
                const isTradeable = lottery && Number(lottery.state) === 2; // 交易状态
                return (
                  <div key={ticket.ticketId} className={`tradeable-item ${isTradeable ? 'tradeable' : 'not-tradeable'}`}>
                    <span className="ticket-id">彩票ID: {ticket.ticketId}</span>
                    <span className="lottery-info">期号: {ticket.lotteryId}</span>
                    <span className="ticket-number">号码: {ticket.number}</span>
                    <span className="status">
                      {isTradeable ? '✅ 可交易' : '❌ 不可交易'}
                    </span>
                    {isTradeable && (
                      <button 
                        className="select-ticket-btn"
                        onClick={() => setTradeTicketId(ticket.ticketId.toString())}
                      >
                        选择此彩票
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        
        <div className="trade-form">
          <input
            type="number"
            placeholder="彩票ID"
            value={tradeTicketId}
            onChange={(e) => setTradeTicketId(e.target.value)}
          />
          <input
            type="text"
            placeholder="接收者地址"
            value={tradeTo}
            onChange={(e) => setTradeTo(e.target.value)}
          />
          <input
            type="number"
            placeholder="交易价格 (ETH)"
            value={tradePrice}
            onChange={(e) => {
              const value = e.target.value;
              // 只允许数字和小数点
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setTradePrice(value);
              }
            }}
            step="0.001"
            min="0"
          />
          <button onClick={tradeTicket} disabled={!tradeTicketId || !tradeTo || !tradePrice}>
            交易彩票
          </button>
        </div>
      </div>
    </div>
  );
}

// 我的彩票组件
function MyTickets({ tickets, lotteries, contract, account, onDataUpdate }: {
  tickets: Ticket[];
  lotteries: Lottery[];
  contract: ethers.Contract | null;
  account: string;
  onDataUpdate: () => void;
}) {
  const claimPrize = async (ticketId: number) => {
    if (!contract) return;
    try {
      const tx = await contract.claimPrize(ticketId);
      await tx.wait();
      alert('奖金领取成功！');
      onDataUpdate();
    } catch (error: any) {
      console.error('领取失败:', error);
      
      let errorMessage = '领取失败';
      
      if (error.reason) {
        if (error.reason.includes('Not ticket owner')) {
          errorMessage = '❌ 您不是该彩票的拥有者，无法领取奖金';
        } else if (error.reason.includes('Ticket not winning')) {
          errorMessage = '❌ 该彩票未中奖，无法领取奖金';
        } else if (error.reason.includes('Prize already claimed')) {
          errorMessage = '❌ 奖金已经领取过了';
        } else if (error.reason.includes('Lottery not settled')) {
          errorMessage = '❌ 彩票尚未结算，无法领取奖金';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 领取失败：彩票状态异常或您不是中奖者，请检查后重试';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 合约余额不足，请联系管理员';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="my-tickets">
      <h2>我的彩票</h2>
      {tickets.length === 0 ? (
        <p>您还没有购买任何彩票</p>
      ) : (
        <div className="ticket-grid">
          {tickets.map(ticket => {
            const lottery = lotteries.find(l => l.lotteryId === ticket.lotteryId);
            return (
              <div key={ticket.ticketId} className="ticket-card">
                <h3>彩票 #{ticket.ticketId}</h3>
                <div className="ticket-info">
                  <p>彩票期号: {ticket.lotteryId}</p>
                  <p>号码: {ticket.number}</p>
                  <p>购买价格: {ethers.formatEther(ticket.purchasePrice.toString())} ETH</p>
                  <p>购买时间: {new Date(Number(ticket.purchaseTime) * 1000).toLocaleString()}</p>
                  {lottery && (
                    <>
                      <p>彩票状态: {['未开始', '销售中', '交易中', '已结算'][Number(lottery.state)]}</p>
                      {Number(lottery.state) === 3 && (
                        <>
                          <p>中奖号码: {lottery.winningNumber}</p>
                          {(() => {
                            const isWinningNumber = ticket.number === lottery.winningNumber;
                            const hasClaimed = isWinningNumber && !ticket.isWinning;
                            
                            if (hasClaimed) {
                              return (
                                <p className="claimed">
                                  ✅ 已领取奖金
                                </p>
                              );
                            } else if (ticket.isWinning) {
                              return (
                                <>
                                  <p className="winning">
                                    🎉 中奖了！
                                  </p>
                                  <button onClick={() => claimPrize(ticket.ticketId)}>
                                    领取奖金
                                  </button>
                                </>
                              );
                            } else {
                              return (
                                <p className="not-winning">
                                  未中奖
                                </p>
                              );
                            }
                          })()}
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// 管理面板组件
function AdminPanel({ lotteries, contract, onDataUpdate }: {
  lotteries: Lottery[];
  contract: ethers.Contract | null;
  onDataUpdate: () => void;
}) {
  const [newLottery, setNewLottery] = useState({
    ticketPrice: '',
    maxTickets: '',
    durationSeconds: '',
    description: ''
  });
  const [endSalesLotteryId, setEndSalesLotteryId] = useState('');
  const [settleLotteryId, setSettleLotteryId] = useState('');
  const [winningNumber, setWinningNumber] = useState('');

  // 格式化时间显示
  const formatDuration = (seconds: number) => {
    if (seconds < 60) {
      return `${seconds}秒`;
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      return remainingSeconds > 0 ? `${minutes}分${remainingSeconds}秒` : `${minutes}分钟`;
    } else {
      const hours = Math.floor(seconds / 3600);
      const minutes = Math.floor((seconds % 3600) / 60);
      const remainingSeconds = seconds % 60;
      let result = `${hours}小时`;
      if (minutes > 0) result += `${minutes}分钟`;
      if (remainingSeconds > 0) result += `${remainingSeconds}秒`;
      return result;
    }
  };

  const createLottery = async () => {
    if (!contract) return;
    
    // 验证输入
    const durationSeconds = parseInt(newLottery.durationSeconds);
    if (durationSeconds < 1) {
      alert('销售时长必须至少为1秒');
      return;
    }
    
    try {
      const tx = await contract.createLottery(
        ethers.parseEther(newLottery.ticketPrice),
        newLottery.maxTickets,
        durationSeconds, // 直接使用秒
        newLottery.description
      );
      await tx.wait();
      alert('彩票创建成功！');
      setNewLottery({ ticketPrice: '', maxTickets: '', durationSeconds: '', description: '' });
      onDataUpdate();
    } catch (error: any) {
      console.error('创建失败:', error);
      
      let errorMessage = '创建失败';
      
      if (error.reason) {
        if (error.reason.includes('OwnableUnauthorizedAccount')) {
          errorMessage = '❌ 只有合约所有者可以创建彩票';
        } else if (error.reason.includes('Invalid parameters')) {
          errorMessage = '❌ 参数无效，请检查输入值';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 创建失败：权限不足或参数错误，请检查后重试';
        } else if (error.message.includes('insufficient funds')) {
          errorMessage = '❌ 账户余额不足，请确保有足够的ETH';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  const endSales = async () => {
    if (!contract || !endSalesLotteryId) return;
    try {
      const tx = await contract.endSales(endSalesLotteryId);
      await tx.wait();
      alert('销售已结束，进入交易阶段！');
      setEndSalesLotteryId('');
      onDataUpdate();
    } catch (error: any) {
      console.error('操作失败:', error);
      
      let errorMessage = '操作失败';
      
      if (error.reason) {
        if (error.reason.includes('OwnableUnauthorizedAccount')) {
          errorMessage = '❌ 只有合约所有者可以结束销售';
        } else if (error.reason.includes('Lottery not in selling state')) {
          errorMessage = '❌ 彩票不在销售状态，无法结束销售';
        } else if (error.reason.includes('Lottery not found')) {
          errorMessage = '❌ 彩票不存在';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 操作失败：权限不足或彩票状态异常，请检查后重试';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  const settleLottery = async () => {
    if (!contract || !settleLotteryId || !winningNumber) return;
    try {
      const tx = await contract.settleLottery(settleLotteryId, winningNumber);
      await tx.wait();
      alert('彩票已结算！');
      setSettleLotteryId('');
      setWinningNumber('');
      onDataUpdate();
    } catch (error: any) {
      console.error('结算失败:', error);
      
      let errorMessage = '结算失败';
      
      if (error.reason) {
        if (error.reason.includes('OwnableUnauthorizedAccount')) {
          errorMessage = '❌ 只有合约所有者可以结算彩票';
        } else if (error.reason.includes('Lottery not in trading state')) {
          errorMessage = '❌ 彩票不在交易状态，无法结算';
        } else if (error.reason.includes('Lottery not found')) {
          errorMessage = '❌ 彩票不存在';
        } else if (error.reason.includes('Invalid winning number')) {
          errorMessage = '❌ 无效的中奖号码';
        } else {
          errorMessage = '❌ ' + error.reason;
        }
      } else if (error.message) {
        if (error.message.includes('missing revert data')) {
          errorMessage = '❌ 结算失败：权限不足或彩票状态异常，请检查后重试';
        } else if (error.message.includes('user rejected')) {
          errorMessage = '❌ 用户取消了交易';
        } else {
          errorMessage = '❌ ' + error.message;
        }
      }
      
      alert(errorMessage);
    }
  };

  return (
    <div className="admin-panel">
      <h2>管理面板</h2>
      
      <div className="admin-section">
        <h3>创建新彩票</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="彩票价格 (ETH)"
            value={newLottery.ticketPrice}
            onChange={(e) => setNewLottery({...newLottery, ticketPrice: e.target.value})}
            step="0.001"
          />
          <input
            type="number"
            placeholder="最大彩票数量"
            value={newLottery.maxTickets}
            onChange={(e) => setNewLottery({...newLottery, maxTickets: e.target.value})}
          />
          <input
            type="number"
            placeholder="销售时长 (秒，最少1秒)"
            value={newLottery.durationSeconds}
            onChange={(e) => setNewLottery({...newLottery, durationSeconds: e.target.value})}
          />
          {newLottery.durationSeconds && parseInt(newLottery.durationSeconds) > 0 && (
            <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
              时长: {formatDuration(parseInt(newLottery.durationSeconds))}
            </div>
          )}
          <input
            type="text"
            placeholder="彩票描述"
            value={newLottery.description}
            onChange={(e) => setNewLottery({...newLottery, description: e.target.value})}
          />
          <button onClick={createLottery} disabled={!newLottery.ticketPrice || !newLottery.maxTickets || !newLottery.durationSeconds || !newLottery.description}>
            创建彩票
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>结束销售</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="彩票ID"
            value={endSalesLotteryId}
            onChange={(e) => setEndSalesLotteryId(e.target.value)}
          />
          <button onClick={endSales} disabled={!endSalesLotteryId}>
            结束销售
          </button>
        </div>
      </div>

      <div className="admin-section">
        <h3>结算彩票</h3>
        <div className="form-group">
          <input
            type="number"
            placeholder="彩票ID"
            value={settleLotteryId}
            onChange={(e) => setSettleLotteryId(e.target.value)}
          />
          <input
            type="number"
            placeholder="中奖号码"
            value={winningNumber}
            onChange={(e) => setWinningNumber(e.target.value)}
          />
          <button onClick={settleLottery} disabled={!settleLotteryId || !winningNumber}>
            结算彩票
          </button>
        </div>
      </div>
    </div>
  );
}

// 交易市场组件
function Marketplace({ 
  listings, 
  userTickets, 
  lotteries,
  contract, 
  account, 
  listTicketId, 
  setListTicketId, 
  listPrice, 
  setListPrice, 
  onDataUpdate, 
  onListTicket, 
  onBuyListedTicket, 
  onCancelListing 
}: {
  listings: Listing[];
  userTickets: Ticket[];
  lotteries: Lottery[];
  contract: ethers.Contract | null;
  account: string;
  listTicketId: string;
  setListTicketId: (value: string) => void;
  listPrice: string;
  setListPrice: (value: string) => void;
  onDataUpdate: () => void;
  onListTicket: () => void;
  onBuyListedTicket: (ticketId: number, price: string) => void;
  onCancelListing: (ticketId: number) => void;
}) {
  // 获取用户拥有的彩票（未挂单的）
  const availableTickets = userTickets.filter(ticket => {
    const isListed = listings.find(listing => listing.ticketId === ticket.ticketId && listing.isActive);
    const lottery = lotteries.find(l => l.lotteryId === ticket.lotteryId);
    const isInTradingState = lottery && Number(lottery.state) === 2;
    const isNotSettled = lottery && Number(lottery.state) !== 3; // 确保不是已结算状态
    return !isListed && isInTradingState && isNotSettled;
  });

  return (
    <div className="marketplace">
      <h2>🎯 彩票交易市场</h2>
      
      {/* 挂单出售 */}
      <div className="marketplace-section">
        <h3>📤 挂单出售</h3>
        
        {/* 状态说明 */}
        <div className="status-info">
          <h4>📋 挂单条件说明：</h4>
          <ul>
            <li>✅ 彩票必须处于"交易中"状态（管理员结束销售后）</li>
            <li>✅ 您必须是彩票的拥有者</li>
            <li>✅ 彩票不能已经挂单</li>
            <li>✅ 价格必须大于0</li>
          </ul>
        </div>
        
        <div className="form-group">
          <select
            value={listTicketId}
            onChange={(e) => setListTicketId(e.target.value)}
          >
            <option value="">选择要出售的彩票</option>
            {availableTickets.map(ticket => (
              <option key={ticket.ticketId} value={ticket.ticketId}>
                彩票 #{ticket.ticketId} - 号码 {ticket.number} (彩票 #{ticket.lotteryId})
              </option>
            ))}
          </select>
          <input
            type="number"
            placeholder="出售价格 (ETH)"
            value={listPrice}
            onChange={(e) => {
              const value = e.target.value;
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setListPrice(value);
              }
            }}
            min="0"
            step="0.001"
          />
          <button 
            onClick={onListTicket} 
            disabled={!listTicketId || !listPrice || !contract}
          >
            挂单出售
          </button>
        </div>
        
        {availableTickets.length === 0 && (
          <div className="no-tickets">
            <p>❌ 您没有可出售的彩票</p>
            <p>可能的原因：</p>
            <ul>
              <li>您还没有购买任何彩票</li>
              <li>您的彩票还在销售阶段，需要等待管理员结束销售</li>
              <li>您的彩票已经挂单了</li>
              <li>您的彩票对应的彩票已经结算</li>
            </ul>
          </div>
        )}
        
        {/* 显示所有用户彩票的状态 */}
        {userTickets.length > 0 && (
          <div className="ticket-status-list">
            <h4>📊 我的彩票状态：</h4>
            {userTickets.map(ticket => {
              const lottery = lotteries.find(l => l.lotteryId === ticket.lotteryId);
              const isListed = listings.find(listing => listing.ticketId === ticket.ticketId && listing.isActive);
              const stateText = lottery ? ['未开始', '销售中', '交易中', '已结算'][Number(lottery.state)] : '未知';
              const canList = lottery && Number(lottery.state) === 2 && !isListed;
              
              return (
                <div key={ticket.ticketId} className={`ticket-status ${canList ? 'can-list' : 'cannot-list'}`}>
                  <span>彩票 #{ticket.ticketId} (号码 {ticket.number})</span>
                  <span>状态: {stateText}</span>
                  <span>{isListed ? '已挂单' : canList ? '可挂单' : '不可挂单'}</span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 市场挂单列表 */}
      <div className="marketplace-section">
        <h3>🛒 市场挂单</h3>
        {listings.length === 0 ? (
          <p className="no-listings">暂无挂单</p>
        ) : (
          <div className="listings-grid">
            {listings.map(listing => (
              <div key={listing.ticketId} className="listing-card">
                <h4>彩票 #{listing.ticketId}</h4>
                <p>卖家: {listing.seller.slice(0, 6)}...{listing.seller.slice(-4)}</p>
                <p>价格: {ethers.formatEther(listing.price.toString())} ETH</p>
                <p>挂单时间: {new Date(Number(listing.listingTime) * 1000).toLocaleString()}</p>
                <div className="listing-actions">
                  {listing.seller.toLowerCase() === account.toLowerCase() ? (
                    <button 
                      onClick={() => onCancelListing(listing.ticketId)}
                      className="cancel-btn"
                    >
                      取消挂单
                    </button>
                  ) : (
                    <button 
                      onClick={() => onBuyListedTicket(listing.ticketId, listing.price.toString())}
                      className="buy-btn"
                    >
                      立即购买
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 我的挂单 */}
      <div className="marketplace-section">
        <h3>📋 我的挂单</h3>
        {listings.filter(listing => listing.seller.toLowerCase() === account.toLowerCase()).length === 0 ? (
          <p className="no-listings">您没有挂单</p>
        ) : (
          <div className="my-listings">
            {listings
              .filter(listing => listing.seller.toLowerCase() === account.toLowerCase())
              .map(listing => (
                <div key={listing.ticketId} className="my-listing-card">
                  <h4>彩票 #{listing.ticketId}</h4>
                  <p>价格: {ethers.formatEther(listing.price.toString())} ETH</p>
                  <p>挂单时间: {new Date(Number(listing.listingTime) * 1000).toLocaleString()}</p>
                  <button 
                    onClick={() => onCancelListing(listing.ticketId)}
                    className="cancel-btn"
                  >
                    取消挂单
                  </button>
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
