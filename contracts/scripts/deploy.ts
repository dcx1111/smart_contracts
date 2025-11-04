import { ethers } from "hardhat";

async function main() {
  console.log("开始部署 EasyBet 彩票合约...");
  
  // 获取部署者（管理员）信息
  const [deployer] = await ethers.getSigners();
  console.log(`📝 部署者（管理员）地址: ${deployer.address}`);
  console.log(`💰 部署者余额: ${ethers.utils.formatEther(await deployer.provider.getBalance(deployer.address))} ETH`);
  
  const EasyBet = await ethers.getContractFactory("EasyBet");
  const easyBet = await EasyBet.deploy();
  await easyBet.deployed();

  const contractAddress = easyBet.address;
  console.log(`✅ EasyBet 合约已部署到: ${contractAddress}`);
  
  // 验证合约所有者
  const owner = await easyBet.owner();
  console.log(`👑 合约所有者: ${owner}`);
  console.log(`✅ 所有者验证: ${owner.toLowerCase() === deployer.address.toLowerCase() ? '成功' : '失败'}`);
  
  // 获取合约余额
  const balance = await ethers.provider.getBalance(contractAddress);
  console.log(`💰 合约余额: ${ethers.utils.formatEther(balance)} ETH`);
  
  console.log("\n🎉 部署完成！请将以下信息更新到前端代码中：");
  console.log(`CONTRACT_ADDRESS = "${contractAddress}";`);
  console.log(`ADMIN_ADDRESS = "${deployer.address}";`);
  
  // 创建示例彩票
  console.log("\n🎰 创建示例彩票...");
  try {
    const tx = await easyBet.createLottery(
      ethers.utils.parseEther("0.01"), // 0.01 ETH per ticket
      100, // max 100 tickets
      1, // 1 second duration (for testing)
      "第一期彩票 - 测试用"
    );
    await tx.wait();
    console.log("✅ 示例彩票创建成功！");
    
    // 显示彩票信息
    const lottery = await easyBet.getLottery(1);
    console.log(`📋 彩票ID: ${lottery.lotteryId}`);
    console.log(`💵 彩票价格: ${ethers.utils.formatEther(lottery.ticketPrice)} ETH`);
    console.log(`🎫 最大数量: ${lottery.maxTickets}`);
    console.log(`📝 描述: ${lottery.description}`);
    
    // 购买一些彩票
    console.log("\n🎫 购买示例彩票...");
    const buyTx1 = await easyBet.buyTicket(1, 1, { value: ethers.utils.parseEther("0.01") });
    await buyTx1.wait();
    console.log("✅ 购买彩票1成功！");
    
    const buyTx2 = await easyBet.buyTicket(1, 2, { value: ethers.utils.parseEther("0.01") });
    await buyTx2.wait();
    console.log("✅ 购买彩票2成功！");
    
    console.log("\n📝 注意：彩票已创建并购买了示例彩票，但需要手动将彩票状态改为交易状态才能创建挂单");
    
  } catch (error) {
    console.log("❌ 创建示例数据失败:", error);
  }
  
  console.log("\n📋 下一步操作：");
  console.log("1. 将合约地址更新到前端代码");
  console.log("2. 在MetaMask中导入部署者私钥作为管理员账户");
  console.log("3. 启动前端应用开始测试");
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});