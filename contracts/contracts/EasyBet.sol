// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "hardhat/console.sol";

contract EasyBet is ERC721, Ownable, ReentrancyGuard {
    
    // 彩票状态枚举
    enum LotteryState {
        NotStarted,    // 未开始
        Selling,       // 销售中
        Trading,       // 交易中
        Settled        // 已结算
    }
    
    // 彩票信息结构
    struct Lottery {
        uint256 lotteryId;
        uint256 ticketPrice;        // 彩票价格
        uint256 maxTickets;         // 最大彩票数量
        uint256 soldTickets;        // 已售彩票数量
        uint256 totalPrizePool;     // 总奖池
        uint256 winningNumber;      // 中奖号码
        uint256[] winningTickets;   // 中奖彩票列表
        LotteryState state;         // 彩票状态
        uint256 startTime;          // 开始时间
        uint256 endTime;            // 销售结束时间
        uint256 settleTime;         // 结算时间
        string description;         // 彩票描述
    }
    
    // 彩票结构
    struct Ticket {
        uint256 ticketId;
        uint256 lotteryId;
        uint256 number;             // 彩票号码
        address owner;              // 当前拥有者
        uint256 purchasePrice;      // 购买价格
        uint256 purchaseTime;       // 购买时间
        bool isWinning;             // 是否中奖
    }
    
    // 挂单信息结构
    struct Listing {
        uint256 ticketId;           // 彩票ID
        address seller;             // 卖家地址
        uint256 price;              // 挂单价格
        uint256 listingTime;        // 挂单时间
        bool isActive;              // 是否有效
    }
    
    // 状态变量
    uint256 public nextLotteryId = 1;
    uint256 public nextTicketId = 1;
    
    mapping(uint256 => Lottery) public lotteries;
    mapping(uint256 => Ticket) public tickets;
    mapping(uint256 => uint256[]) public lotteryTickets; // lotteryId => ticketIds
    mapping(address => uint256[]) public userTickets;    // user => ticketIds
    mapping(uint256 => mapping(uint256 => bool)) public lotteryNumbers; // lotteryId => number => exists
    
    // 交易市场相关
    mapping(uint256 => Listing) public listings;  // 彩票ID => 挂单信息
    uint256[] public activeListings;             // 活跃挂单列表
    
    // 事件
    event LotteryCreated(uint256 indexed lotteryId, uint256 ticketPrice, uint256 maxTickets, string description);
    event TicketPurchased(uint256 indexed lotteryId, uint256 indexed ticketId, address indexed buyer, uint256 number);
    event TicketTraded(uint256 indexed ticketId, address indexed from, address indexed to, uint256 price);
    event LotterySettled(uint256 indexed lotteryId, uint256 winningNumber, uint256[] winningTickets);
    event PrizeClaimed(uint256 indexed ticketId, address indexed winner, uint256 amount);
    
    // 交易市场事件
    event TicketListed(uint256 indexed ticketId, address indexed seller, uint256 price);
    event TicketBought(uint256 indexed ticketId, address indexed buyer, address indexed seller, uint256 price);
    event ListingCancelled(uint256 indexed ticketId, address indexed seller);
    
    constructor() ERC721("EasyBet Ticket", "EBT") Ownable(msg.sender) {}
    
    // 创建新彩票（仅管理员）
    function createLottery(
        uint256 _ticketPrice,
        uint256 _maxTickets,
        uint256 _duration, // 销售持续时间（秒）
        string memory _description
    ) external onlyOwner {
        require(_ticketPrice > 0, "Ticket price must be greater than 0");
        require(_maxTickets > 0, "Max tickets must be greater than 0");
        require(_duration > 0, "Duration must be greater than 0");
        
        uint256 lotteryId = nextLotteryId++;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + _duration;
        
        lotteries[lotteryId] = Lottery({
            lotteryId: lotteryId,
            ticketPrice: _ticketPrice,
            maxTickets: _maxTickets,
            soldTickets: 0,
            totalPrizePool: 0,
            winningNumber: 0,
            winningTickets: new uint256[](0),
            state: LotteryState.Selling,
            startTime: startTime,
            endTime: endTime,
            settleTime: 0,
            description: _description
        });
        
        emit LotteryCreated(lotteryId, _ticketPrice, _maxTickets, _description);
    }
    
    // 购买彩票
    function buyTicket(uint256 _lotteryId, uint256 _number) external payable nonReentrant {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.state == LotteryState.Selling, "Lottery not in selling state");
        require(block.timestamp <= lottery.endTime, "Lottery sales ended");
        require(lottery.soldTickets < lottery.maxTickets, "All tickets sold");
        require(msg.value == lottery.ticketPrice, "Incorrect payment amount");
        require(_number > 0 && _number <= lottery.maxTickets, "Invalid ticket number");
        require(!lotteryNumbers[_lotteryId][_number], "Number already taken");
        
        uint256 ticketId = nextTicketId++;
        
        tickets[ticketId] = Ticket({
            ticketId: ticketId,
            lotteryId: _lotteryId,
            number: _number,
            owner: msg.sender,
            purchasePrice: lottery.ticketPrice,
            purchaseTime: block.timestamp,
            isWinning: false
        });
        
        // 更新状态
        lottery.soldTickets++;
        lottery.totalPrizePool += lottery.ticketPrice;
        lotteryNumbers[_lotteryId][_number] = true;
        lotteryTickets[_lotteryId].push(ticketId);
        userTickets[msg.sender].push(ticketId);
        
        // 铸造NFT
        _mint(msg.sender, ticketId);
        
        emit TicketPurchased(_lotteryId, ticketId, msg.sender, _number);
    }
    
    // 交易彩票
    function tradeTicket(uint256 _ticketId, address _to, uint256 _price) external payable nonReentrant {
        require(tickets[_ticketId].ticketId != 0, "Ticket does not exist");
        require(ownerOf(_ticketId) == msg.sender, "Not ticket owner");
        require(_to != address(0), "Invalid recipient");
        require(_to != msg.sender, "Cannot trade to yourself");
        require(msg.value == _price, "Incorrect payment amount");
        
        Ticket storage ticket = tickets[_ticketId];
        Lottery storage lottery = lotteries[ticket.lotteryId];
        require(lottery.state == LotteryState.Trading, "Lottery not in trading state");
        
        address previousOwner = msg.sender;
        
        // 转移所有权
        _transfer(previousOwner, _to, _ticketId);
        ticket.owner = _to;
        
        // 更新用户彩票列表
        _removeFromUserTickets(previousOwner, _ticketId);
        userTickets[_to].push(_ticketId);
        
        // 支付给原拥有者
        if (_price > 0) {
            payable(previousOwner).transfer(_price);
        }
        
        emit TicketTraded(_ticketId, previousOwner, _to, _price);
    }
    
    // 结束销售，开始交易阶段
    function endSales(uint256 _lotteryId) external onlyOwner {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.state == LotteryState.Selling, "Lottery not in selling state");
        require(block.timestamp > lottery.endTime || lottery.soldTickets == lottery.maxTickets, "Sales not ended");
        
        lottery.state = LotteryState.Trading;
    }
    
    // 结算彩票（仅管理员）
    function settleLottery(uint256 _lotteryId, uint256 _winningNumber) external onlyOwner {
        Lottery storage lottery = lotteries[_lotteryId];
        require(lottery.state == LotteryState.Trading, "Lottery not in trading state");
        require(_winningNumber > 0 && _winningNumber <= lottery.maxTickets, "Invalid winning number");
        require(lotteryNumbers[_lotteryId][_winningNumber], "Winning number not sold");
        
        lottery.winningNumber = _winningNumber;
        lottery.settleTime = block.timestamp;
        lottery.state = LotteryState.Settled;
        
        // 找出所有中奖彩票
        uint256[] storage allTickets = lotteryTickets[_lotteryId];
        for (uint256 i = 0; i < allTickets.length; i++) {
            if (tickets[allTickets[i]].number == _winningNumber) {
                lottery.winningTickets.push(allTickets[i]);
                tickets[allTickets[i]].isWinning = true;
            }
        }
        
        // 移除该彩票的所有活跃挂单
        _removeLotteryListings(_lotteryId);
        
        emit LotterySettled(_lotteryId, _winningNumber, lottery.winningTickets);
    }
    
    // 领取奖金
    function claimPrize(uint256 _ticketId) external nonReentrant {
        require(tickets[_ticketId].ticketId != 0, "Ticket does not exist");
        require(ownerOf(_ticketId) == msg.sender, "Not ticket owner");
        
        Ticket storage ticket = tickets[_ticketId];
        Lottery storage lottery = lotteries[ticket.lotteryId];
        require(lottery.state == LotteryState.Settled, "Lottery not settled");
        require(ticket.isWinning, "Ticket not winning");
        
        // 计算奖金
        uint256 prizeAmount = lottery.totalPrizePool / lottery.winningTickets.length;
        
        // 标记为已领取（防止重复领取）
        ticket.isWinning = false;
        
        // 转账奖金
        payable(msg.sender).transfer(prizeAmount);
        
        emit PrizeClaimed(_ticketId, msg.sender, prizeAmount);
    }
    
    // 获取彩票信息
    function getLottery(uint256 _lotteryId) external view returns (Lottery memory) {
        return lotteries[_lotteryId];
    }
    
    // 获取彩票信息
    function getTicket(uint256 _ticketId) external view returns (Ticket memory) {
        return tickets[_ticketId];
    }
    
    // 获取用户的彩票列表
    function getUserTickets(address _user) external view returns (uint256[] memory) {
        return userTickets[_user];
    }
    
    // 获取彩票的所有彩票
    function getLotteryTickets(uint256 _lotteryId) external view returns (uint256[] memory) {
        return lotteryTickets[_lotteryId];
    }
    
    // 获取中奖彩票列表
    function getWinningTickets(uint256 _lotteryId) external view returns (uint256[] memory) {
        return lotteries[_lotteryId].winningTickets;
    }
    
    // 内部函数：从用户彩票列表中移除
    function _removeFromUserTickets(address _user, uint256 _ticketId) internal {
        uint256[] storage userTicketList = userTickets[_user];
        for (uint256 i = 0; i < userTicketList.length; i++) {
            if (userTicketList[i] == _ticketId) {
                userTicketList[i] = userTicketList[userTicketList.length - 1];
                userTicketList.pop();
                break;
            }
        }
    }
    
    // 获取合约余额
    function getContractBalance() external view returns (uint256) {
        return address(this).balance;
    }
    
    // 紧急提取（仅管理员）
    function emergencyWithdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }
    
    // ============ 交易市场功能 ============
    
    // 挂单出售彩票
    function listTicket(uint256 _ticketId, uint256 _price) external nonReentrant {
        require(tickets[_ticketId].ticketId != 0, "Ticket does not exist");
        require(ownerOf(_ticketId) == msg.sender, "Not ticket owner");
        require(_price > 0, "Price must be greater than 0");
        require(!listings[_ticketId].isActive, "Ticket already listed");
        
        Ticket storage ticket = tickets[_ticketId];
        Lottery storage lottery = lotteries[ticket.lotteryId];
        require(lottery.state == LotteryState.Trading, "Lottery not in trading state");
        require(lottery.state != LotteryState.Settled, "Cannot list settled lottery tickets");
        
        // 创建挂单
        listings[_ticketId] = Listing({
            ticketId: _ticketId,
            seller: msg.sender,
            price: _price,
            listingTime: block.timestamp,
            isActive: true
        });
        
        // 添加到活跃挂单列表
        activeListings.push(_ticketId);
        
        emit TicketListed(_ticketId, msg.sender, _price);
    }
    
    // 购买挂单的彩票
    function buyListedTicket(uint256 _ticketId) external payable nonReentrant {
        // 检查彩票是否存在
        require(_ticketId > 0 && _ticketId <= nextTicketId, "Ticket does not exist");
        
        Listing storage listing = listings[_ticketId];
        require(listing.isActive, "Ticket not listed or listing inactive");
        require(msg.value == listing.price, "Incorrect payment amount");
        require(msg.sender != listing.seller, "Cannot buy your own ticket");
        
        Ticket storage ticket = tickets[_ticketId];
        require(ticket.lotteryId > 0, "Invalid lottery ID");
        
        Lottery storage lottery = lotteries[ticket.lotteryId];
        require(lottery.state == LotteryState.Trading, "Lottery not in trading state");
        
        address seller = listing.seller;
        
        // 检查卖家是否真的拥有这张彩票
        require(ticket.owner == seller, "Seller does not own this ticket");
        
        // 转移所有权
        _transfer(seller, msg.sender, _ticketId);
        ticket.owner = msg.sender;
        
        // 更新用户彩票列表
        _removeFromUserTickets(seller, _ticketId);
        userTickets[msg.sender].push(_ticketId);
        
        // 支付给卖家
        payable(seller).transfer(listing.price);
        
        // 取消挂单
        listing.isActive = false;
        _removeFromActiveListings(_ticketId);
        
        emit TicketBought(_ticketId, msg.sender, seller, listing.price);
    }
    
    // 取消挂单
    function cancelListing(uint256 _ticketId) external nonReentrant {
        Listing storage listing = listings[_ticketId];
        require(listing.isActive, "Ticket not listed");
        require(listing.seller == msg.sender, "Not the seller");
        
        listing.isActive = false;
        _removeFromActiveListings(_ticketId);
        
        emit ListingCancelled(_ticketId, msg.sender);
    }
    
    // 获取活跃挂单列表
    function getActiveListings() external view returns (uint256[] memory) {
        uint256[] memory result = new uint256[](activeListings.length);
        uint256 count = 0;
        
        for (uint256 i = 0; i < activeListings.length; i++) {
            uint256 ticketId = activeListings[i];
            if (listings[ticketId].isActive) {
                result[count] = ticketId;
                count++;
            }
        }
        
        // 创建正确大小的数组
        uint256[] memory finalResult = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            finalResult[i] = result[i];
        }
        
        return finalResult;
    }
    
    // 获取挂单信息
    function getListing(uint256 _ticketId) external view returns (Listing memory) {
        Listing memory listing = listings[_ticketId];
        // 如果彩票从未被挂单过，返回一个默认的挂单信息
        if (listing.ticketId == 0) {
            return Listing({
                ticketId: _ticketId,
                seller: address(0),
                price: 0,
                listingTime: 0,
                isActive: false
            });
        }
        return listing;
    }
    
    // 内部函数：从活跃挂单列表中移除
    function _removeFromActiveListings(uint256 _ticketId) internal {
        for (uint256 i = 0; i < activeListings.length; i++) {
            if (activeListings[i] == _ticketId) {
                activeListings[i] = activeListings[activeListings.length - 1];
                activeListings.pop();
                break;
            }
        }
    }
    
    // 内部函数：移除指定彩票的所有挂单
    function _removeLotteryListings(uint256 _lotteryId) internal {
        uint256[] storage allTickets = lotteryTickets[_lotteryId];
        
        for (uint256 i = 0; i < allTickets.length; i++) {
            uint256 ticketId = allTickets[i];
            Listing storage listing = listings[ticketId];
            
            // 如果该彩票有活跃挂单，则移除
            if (listing.isActive) {
                listing.isActive = false;
                _removeFromActiveListings(ticketId);
                
                // 发出取消挂单事件
                emit ListingCancelled(ticketId, listing.seller);
            }
        }
    }
    
}