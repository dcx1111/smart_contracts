import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import { ethers } from "hardhat";

describe("EasyBet 彩票系统", function () {
  async function deployEasyBetFixture() {
    const [owner, player1, player2, player3] = await ethers.getSigners();

    const EasyBet = await ethers.getContractFactory("EasyBet");
    const easyBet = await EasyBet.deploy();

    return { easyBet, owner, player1, player2, player3 };
  }

  describe("部署测试", function () {
    it("应该设置正确的所有者", async function () {
      const { easyBet, owner } = await loadFixture(deployEasyBetFixture);
      expect(await easyBet.owner()).to.equal(owner.address);
    });

    it("应该返回合约名称", async function () {
      const { easyBet } = await loadFixture(deployEasyBetFixture);
      expect(await easyBet.name()).to.equal("EasyBet Ticket");
    });
  });

  describe("彩票创建测试", function () {
    it("只有所有者可以创建彩票", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      // 所有者创建彩票应该成功
      await expect(
        easyBet.connect(owner).createLottery(
          ethers.utils.parseEther("0.01"),
          100,
          3600,
          "测试彩票"
        )
      ).to.not.be.reverted;

      // 非所有者创建彩票应该失败
      await expect(
        easyBet.connect(player1).createLottery(
          ethers.utils.parseEther("0.01"),
          100,
          3600,
          "测试彩票"
        )
      ).to.be.revertedWithCustomError(easyBet, "OwnableUnauthorizedAccount");
    });

    it("创建彩票后应该正确设置参数", async function () {
      const { easyBet, owner } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        3600,
        "测试彩票"
      );

      const lottery = await easyBet.getLottery(1);
      expect(lottery.lotteryId).to.equal(1);
      expect(lottery.ticketPrice).to.equal(ethers.utils.parseEther("0.01"));
      expect(lottery.maxTickets).to.equal(100);
      expect(lottery.state).to.equal(1); // Selling state
      expect(lottery.description).to.equal("测试彩票");
    });
  });

  describe("购买彩票测试", function () {
    it("玩家可以购买彩票", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      // 创建彩票
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        3600,
        "测试彩票"
      );

      // 购买彩票
      await expect(
        easyBet.connect(player1).buyTicket(1, 1, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.not.be.reverted;

      // 检查彩票信息
      const ticket = await easyBet.getTicket(1);
      expect(ticket.number).to.equal(1);
      expect(ticket.owner).to.equal(player1.address);
      expect(ticket.lotteryId).to.equal(1);
    });

    it("不能购买已售出的号码", async function () {
      const { easyBet, owner, player1, player2 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        3600,
        "测试彩票"
      );

      // 第一个玩家购买号码1
      await easyBet.connect(player1).buyTicket(1, 1, {
        value: ethers.utils.parseEther("0.01")
      });

      // 第二个玩家尝试购买相同号码应该失败
      await expect(
        easyBet.connect(player2).buyTicket(1, 1, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Number already taken");
    });

    it("支付金额必须正确", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        3600,
        "测试彩票"
      );

      // 支付错误金额应该失败
      await expect(
        easyBet.connect(player1).buyTicket(1, 1, {
          value: ethers.utils.parseEther("0.02")
        })
      ).to.be.revertedWith("Incorrect payment amount");
    });
  });

  describe("彩票交易测试", function () {
    it("玩家可以交易彩票", async function () {
      const { easyBet, owner, player1, player2 } = await loadFixture(deployEasyBetFixture);
      
      // 创建彩票并购买
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        1, // 只允许1张彩票，立即售罄
        3600,
        "测试彩票"
      );
      
      await easyBet.connect(player1).buyTicket(1, 1, {
        value: ethers.utils.parseEther("0.01")
      });

      // 结束销售，开始交易阶段
      await easyBet.connect(owner).endSales(1);

      // 交易彩票
      await expect(
        easyBet.connect(player1).tradeTicket(1, player2.address, ethers.utils.parseEther("0.02"), {
          value: ethers.utils.parseEther("0.02")
        })
      ).to.not.be.reverted;

      // 检查彩票所有权是否转移
      const ticket = await easyBet.getTicket(1);
      expect(ticket.owner).to.equal(player2.address);
    });

    it("只有彩票拥有者可以交易", async function () {
      const { easyBet, owner, player1, player2, player3 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        1, // 只允许1张彩票，立即售罄
        3600,
        "测试彩票"
      );
      
      await easyBet.connect(player1).buyTicket(1, 1, {
        value: ethers.utils.parseEther("0.01")
      });

      await easyBet.connect(owner).endSales(1);

      // 非拥有者尝试交易应该失败
      await expect(
        easyBet.connect(player3).tradeTicket(1, player2.address, ethers.utils.parseEther("0.02"), {
          value: ethers.utils.parseEther("0.02")
        })
      ).to.be.revertedWith("Not ticket owner");
    });
  });

  describe("彩票结算测试", function () {
    it("只有所有者可以结算彩票", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        1, // 只允许1张彩票，立即售罄
        3600,
        "测试彩票"
      );
      
      await easyBet.connect(player1).buyTicket(1, 1, {
        value: ethers.utils.parseEther("0.01")
      });

      await easyBet.connect(owner).endSales(1);

      // 非所有者尝试结算应该失败
      await expect(
        easyBet.connect(player1).settleLottery(1, 1)
      ).to.be.revertedWithCustomError(easyBet, "OwnableUnauthorizedAccount");
    });

    it("结算后中奖者可以领取奖金", async function () {
      const { easyBet, owner, player1, player2 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        2, // 允许2张彩票
        3600,
        "测试彩票"
      );
      
      // 两个玩家购买不同号码
      await easyBet.connect(player1).buyTicket(1, 1, {
        value: ethers.utils.parseEther("0.01")
      });
      
      await easyBet.connect(player2).buyTicket(1, 2, {
        value: ethers.utils.parseEther("0.01")
      });

      await easyBet.connect(owner).endSales(1);
      await easyBet.connect(owner).settleLottery(1, 1);

      // 检查中奖彩票
      const winningTickets = await easyBet.getWinningTickets(1);
      expect(winningTickets.length).to.equal(1);
      expect(winningTickets[0]).to.equal(1);

      // 中奖者领取奖金
      const initialBalance = await ethers.provider.getBalance(player1.address);
      await easyBet.connect(player1).claimPrize(1);
      const finalBalance = await ethers.provider.getBalance(player1.address);
      
      // 余额应该增加（扣除gas费用）
      expect(finalBalance).to.be.gt(initialBalance);
    });
  });

  describe("边界情况测试", function () {
    it("不能购买超出范围的号码", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        3600,
        "测试彩票"
      );

      // 尝试购买号码0应该失败
      await expect(
        easyBet.connect(player1).buyTicket(1, 0, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Invalid ticket number");

      // 尝试购买超出最大号码的彩票应该失败
      await expect(
        easyBet.connect(player1).buyTicket(1, 101, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Invalid ticket number");
    });

    it("销售结束后不能购买彩票", async function () {
      const { easyBet, owner, player1 } = await loadFixture(deployEasyBetFixture);
      
      await easyBet.connect(owner).createLottery(
        ethers.utils.parseEther("0.01"),
        100,
        1, // 1秒后结束
        "测试彩票"
      );

      // 等待销售结束
      await new Promise(resolve => setTimeout(resolve, 2000));

      // 尝试购买应该失败
      await expect(
        easyBet.connect(player1).buyTicket(1, 1, {
          value: ethers.utils.parseEther("0.01")
        })
      ).to.be.revertedWith("Lottery sales ended");
    });
  });
});