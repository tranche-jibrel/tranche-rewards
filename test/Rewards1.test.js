const {
  BN,
  constants,
  ether,
  balance,
  expectEvent,
  expectRevert
} = require('@openzeppelin/test-helpers');
const {
  deployProxy,
  upgradeProxy
} = require('@openzeppelin/truffle-upgrades');
const {
  expect
} = require('chai');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAFDT = artifacts.require("./mocks/TrancheAToken.sol");
var TrancheBFDT = artifacts.require("./mocks/TrancheBToken.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");

var RewardsDistribution = artifacts.require("./RewardsDistribution.sol");

let protocolContract, trAFDTContract, trBFDTContract, rewardTokenContract, rewardsDistribContract;
let owner, user1, user2, user3, user4;

contract('Rewards1', function (accounts) {
  const gasPrice = new BN('1');
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  /*
  Compound price: 21409027297510851 (trAPrice)

  TrARPB: 305494111 (3%)
          407325481 (4%)
          509156852 (5%)
          203662741 (2%)
          101831370 (1%)

  createTranche(address _trA,
            address _trB,
            uint256 _trAVal,
            uint256 _trBVal,
            uint256 _trARBP,
            uint256 _trAPrice)
  */
  const MY_TRANCHE_A_RPB = new BN("305494111");
  const MY_EXT_PROT_RET = new BN("30000000000000000"); //3%
  const MY_BAL_FACTOR = new BN("500000000000000000"); //50%
  const MY_TRANCHE_A_PRICE = new BN("21409027297510851");
  const MY_TRANCHE_PERCENTAGE = new BN("1000000000000000000"); //100%
  const MY_TRANCHE_A_PRICE_NUM =  Number(web3.utils.fromWei("21409027297510851", "ether"))

  // before each `it`, even in `describe`
  /*  beforeEach(async function () {
      this.fundsToken = await ERC20SampleToken.new("sampleToken", "SAM");

      await this.fundsToken.transfer(tokenHolder1, ether('1000'));
      await this.fundsToken.transfer(tokenHolder2, ether('1000'));
      await this.fundsToken.transfer(tokenHolder3, ether('1000'));
      await this.fundsToken.transfer(anyone, ether('1000'));

      this.fundsDistributionToken = await JTrancheERC20.new('FundsDistributionToken', 'FDT', this.fundsToken.address);
    });
  */

  it("ETH balances", async function () {
    //accounts = await web3.eth.getAccounts();
    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];
    // console.log(owner);
    // console.log(await web3.eth.getBalance(owner));
    // console.log(await web3.eth.getBalance(user1));
  });

  it('get deployed contracts', async function () {
    protocolContract = await Protocol.deployed();
    expect(protocolContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(protocolContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(protocolContract.address);
    trA0 = await protocolContract.getTrA(0);
    trAFDTContract = await TrancheAFDT.at(trA0);
    expect(trAFDTContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trAFDTContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trAFDTContract.address);
    trB0 = await protocolContract.getTrB(0);
    trBFDTContract = await TrancheBFDT.at(trB0);
    expect(trBFDTContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trBFDTContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trBFDTContract.address);
    rewardTokenContract = await RewardToken.deployed();
    expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(rewardTokenContract.address);
    rewardsDistribContract = await RewardsDistribution.deployed();
    expect(rewardsDistribContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardsDistribContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(rewardsDistribContract.address);
  });

  it('mint some tokens from tranche A and B', async function () {
    await trAFDTContract.mint(user1,  ether("10000"));
    console.log("User1 trA tokens: " + web3.utils.fromWei(await trAFDTContract.balanceOf(user1)))
    await trAFDTContract.mint(user2,  ether("20000"));
    console.log("User2 trA tokens: " + web3.utils.fromWei(await trAFDTContract.balanceOf(user2)))
    await trAFDTContract.mint(user3,  ether("30000"));
    console.log("User3 trA tokens: " + web3.utils.fromWei(await trAFDTContract.balanceOf(user3)))
    await trAFDTContract.mint(user4,  ether("40000"));
    console.log("User4 trA tokens: " + web3.utils.fromWei(await trAFDTContract.balanceOf(user4)))

    await trBFDTContract.mint(user1,  ether("1000"));
    console.log("User1 trB tokens: " + web3.utils.fromWei(await trBFDTContract.balanceOf(user1)))
    await trBFDTContract.mint(user2,  ether("2000"));
    console.log("User2 trB tokens: " + web3.utils.fromWei(await trBFDTContract.balanceOf(user2)))
    await trBFDTContract.mint(user3,  ether("3000"));
    console.log("User3 trB tokens: " + web3.utils.fromWei(await trBFDTContract.balanceOf(user3)))
    await trBFDTContract.mint(user4,  ether("4000"));
    console.log("User4 trB tokens: " + web3.utils.fromWei(await trBFDTContract.balanceOf(user4)))

    totASupply = await trAFDTContract.totalSupply();
    // console.log(web3.utils.fromWei(totASupply))
    trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM / Math.pow(10,18);
    // console.log(trAVal.toString())
    // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
    await protocolContract.setTrAValue(0, ether(trAVal.toString()));
    await protocolContract.setTrBValue(0, ether('10000'));
    await protocolContract.setTotalValue(0);
    trATVL = await protocolContract.getTrAValue(0);
    trBTVL = await protocolContract.getTrBValue(0);
    totTrTVL = await protocolContract.getTotalValue(0);
    console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
        web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
  });

  describe('settings', function () {
    it('set tranche in rewards distribution contract', async function () {
      tx = await rewardsDistribContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, 
        MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {
        from: owner
      });

      console.log("Total TVL: " + (await rewardsDistribContract.getAllMarketsTVL()).toString())
      console.log("Total TVL in Market0: " + (await rewardsDistribContract.getTrancheMarketTVL(0)).toString())

      await rewardsDistribContract.refreshSliceSpeeds();

      count = await rewardsDistribContract.marketsCounter();
      console.log("Count markets: " + count)
      trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
      trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
      totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
      console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
        web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      mktShare = await rewardsDistribContract.getMarketSharePerTranche(0);
      console.log("Market Share tr 0: " + web3.utils.fromWei(mktShare) * 100 + " %");
    });

    it('read values and distribute rewards to tranches', async function () {
      trARet = await rewardsDistribContract.getTrancheAReturns(0);
      console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
      trBRet = await rewardsDistribContract.getTrancheBReturns(0);
      console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
      trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
      console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
      trARewPerc = ether('1').sub(trBRewPerc);
      console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

      await rewardTokenContract.approve(rewardsDistribContract.address, ether("100"), {from: owner})
      await rewardsDistribContract.distributeAllMarketsFunds(ether("100"));
    });

    it('distribute rewards tranche A to users', async function () {
      console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
      console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
      tx = await rewardsDistribContract.distributeRewardsTokenSingleMarket(0);

      console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
      console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")

      console.log("User1 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user4)))

      console.log("User1 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user4)))
    });

    it('users withdraw rewards from tranche A', async function () {
      console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
      console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
      tx = await trAFDTContract.withdrawFunds({from: user1});
      console.log("User1 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user1)))
      console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
      //tx = await trAFDTContract.withdrawFunds({from: user2});
      console.log("User2 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user2)))
      console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
      tx = await trAFDTContract.withdrawFunds({from: user3});
      console.log("User3 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user3)))
      console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
      //tx = await trAFDTContract.withdrawFunds({from: user4});
      console.log("User4 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user4)))
      console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
    });

    it('users withdraw rewards from tranche B', async function () {
      console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
      //tx = await trBFDTContract.withdrawFunds({from: user1});
      console.log("User1 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user1)))
      console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
      tx = await trBFDTContract.withdrawFunds({from: user2});
      console.log("User2 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user2)))
      console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
      //tx = await trBFDTContract.withdrawFunds({from: user3});
      console.log("User3 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user3)))
      console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
      tx = await trBFDTContract.withdrawFunds({from: user4});
      console.log("User4 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user4)))
      console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
      console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
      console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
    });
  });

  describe('changing parameters of external return', function () {
    describe('external protocol return low, 2%', function () {
      it('setting extProtRet to 2%', async function () {
        tx = await rewardsDistribContract.setExtProtocolPercentSingleMarket(0, ether('0.02'), {
          from: owner
        });
        availMkt = await rewardsDistribContract.availableMarkets(0);
        expect(availMkt.extProtocolPercentage).to.be.bignumber.equal(ether('0.02'));
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

        await rewardTokenContract.approve(rewardsDistribContract.address, ether("100"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("100"));
      });
  
      it('distribute rewards tranche A to users', async function () {
        console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
        console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
        tx = await trAFDTContract.updateFundsReceived();

        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
      
        console.log("User1 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user4)))
      });
  
      it('distribute rewards tranche B to users', async function () {
        tx = await trBFDTContract.updateFundsReceived();

        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")

        console.log("User1 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user4)))
      });
  
      it('users withdraw rewards from tranche A', async function () {
        console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
        console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
        tx = await trAFDTContract.withdrawFunds({from: user1});
        console.log("User1 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user1)))
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract.withdrawFunds({from: user2});
        console.log("User2 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user2)))
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract.withdrawFunds({from: user3});
        console.log("User3 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user3)))
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract.withdrawFunds({from: user4});
        console.log("User4 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user4)))
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
      });
  
      it('users withdraw rewards from tranche B', async function () {
        console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
        tx = await trBFDTContract.withdrawFunds({from: user1});
        console.log("User1 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user1)))
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trBFDTContract.withdrawFunds({from: user2});
        console.log("User2 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user2)))
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trBFDTContract.withdrawFunds({from: user3});
        console.log("User3 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user3)))
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trBFDTContract.withdrawFunds({from: user4});
        console.log("User4 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user4)))
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
        console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
        console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
      });
    });
  });

  describe('changing parameters on tranche B amount and test single market distribution', function () {
    describe('tranche B Amount increases', function () {
      it('setting tranche B amount to 20000', async function () {
        await protocolContract.setTrBValue(0, ether('20000'));
        await protocolContract.setTotalValue(0);
        trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
        trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
        totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

        await rewardTokenContract.approve(rewardsDistribContract.address, ether("100"), {from: owner})
        await rewardsDistribContract.distributeSingleMarketsFunds(0, ether("100"));
      });

      it('distribute rewards tranche A to users', async function () {
        console.log("rewards tokens in tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract.address)))
        console.log("rewards tokens in tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract.address)))
        tx = await trAFDTContract.updateFundsReceived();

        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
      
        console.log("User1 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawableFundsOf(user4)))
      });

      it('distribute rewards tranche B to users', async function () {
        tx = await trBFDTContract.updateFundsReceived();

        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")

        console.log("User1 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from tranche B: " + web3.utils.fromWei(await trBFDTContract.withdrawableFundsOf(user4)))
      });

      it('setting tranche B amount to 100000', async function () {
        await protocolContract.setTrBValue(0, ether('100000'));
        await protocolContract.setTotalValue(0);
        trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
        trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
        totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('changing parameters of external return', function () {
    describe('external protocol return high, 4%', function () {
      it('setting extProtRet to 4%', async function () {
        tx = await rewardsDistribContract.setExtProtocolPercentSingleMarket(0, ether('0.04'), {
          from: owner
        });
        availMkt = await rewardsDistribContract.availableMarkets(0);
        expect(availMkt.extProtocolPercentage).to.be.bignumber.equal(ether('0.04'));
      });

      it('setting tranche B amount to 2000', async function () {
        await protocolContract.setTrBValue(0, ether('2000'));
        await protocolContract.setTotalValue(0);
        trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
        trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
        totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('changing parameters on tranche A amount', function () {
    describe('tranche A Amount increases', function () {
      it('setting tranche A amount to 5000', async function () {
        await protocolContract.setTrAValue(0, ether('5000'));
        await protocolContract.setTotalValue(0);
        trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
        trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
        totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });

      it('setting tranche A amount to 10000', async function () {
        await protocolContract.setTrAValue(0, ether('10000'));
        await protocolContract.setTotalValue(0);
        trATVL = await rewardsDistribContract.getTrancheAMarketTVL(0);
        trBTVL = await rewardsDistribContract.getTrancheBMarketTVL(0);
        totTrTVL = await rewardsDistribContract.getTrancheMarketTVL(0);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await rewardsDistribContract.getTrancheAReturns(0);
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await rewardsDistribContract.getTrancheBReturns(0);
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await rewardsDistribContract.getTrancheBRewardsPercentage(0);
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('calling methods to modify parameters', function () {
    it('changing single market parameters', async function () {
      tx = await rewardsDistribContract.enableSingleMarket(0, false);
      tx = await rewardsDistribContract.setSingleMarketRewardsFrequency(0, 30);
      tx = await rewardsDistribContract.setRewardsPercentageSingleMarket(0, web3.utils.toWei('0.8'));
      tx = await rewardsDistribContract.setExtProtocolPercentSingleMarket(0, web3.utils.toWei('0.06'));
      tx = await rewardsDistribContract.setBalanceFactorSingleMarket(0, web3.utils.toWei('0.7'));
      tx = await rewardsDistribContract.setUnderlyingPriceSingleMarket(0, web3.utils.toWei('1.5'));

      mkt0Params = await rewardsDistribContract.availableMarkets(0);
      mkt0ParamRewards = await rewardsDistribContract.availableMarketsRewards(0);
/*
      for (i=0; i < 8; i++) {
        console.log(mkt0Params[i].toString());
      }
*/
      expect(mkt0Params[4].toString()).to.be.equal(web3.utils.toWei('0.7'))
      expect(mkt0Params[6].toString()).to.be.equal(web3.utils.toWei('0.06'))
      expect(mkt0Params[7]).to.be.false
/*
      console.log("---")

      for (i=0; i < 7; i++) {
        console.log(mkt0ParamRewards[i].toString());
      }
*/
      expect(mkt0ParamRewards[0].toString()).to.be.equal(web3.utils.toWei('1.5'))
      expect(mkt0ParamRewards[1].toString()).to.be.equal(web3.utils.toWei('0.8'))
      expect(mkt0ParamRewards[4].toString()).to.be.equal((2592000).toString()) // 86400 * 30

      percent = await rewardsDistribContract.getMarketRewardsPercentage()
      expect(percent.toString()).to.be.equal(web3.utils.toWei('0')) // no market enabled!

    });

    it('changing all markets parameters', async function () {
      tx = await rewardsDistribContract.enableAllMarket([true]);
      tx = await rewardsDistribContract.setRewardsFrequencyAllMarkets([7]);
      tx = await rewardsDistribContract.setRewardsPercentageAllMarkets([web3.utils.toWei('0.6')]);
      tx = await rewardsDistribContract.setExtProtocolPercentAllMarkets([web3.utils.toWei('0.03')]);
      tx = await rewardsDistribContract.setBalanceFactorAllMarkets([web3.utils.toWei('0.4')]);
      tx = await rewardsDistribContract.setUnderlyingPriceAllMarkets([web3.utils.toWei('1.2')]);

      mkt0Params = await rewardsDistribContract.availableMarkets(0);
      mkt0ParamRewards = await rewardsDistribContract.availableMarketsRewards(0);
/* 
      for (i=0; i < 8; i++) {
        console.log(mkt0Params[i].toString());
      }
*/      
      expect(mkt0Params[4].toString()).to.be.equal(web3.utils.toWei('0.4'))
      expect(mkt0Params[6].toString()).to.be.equal(web3.utils.toWei('0.03'))
      expect(mkt0Params[7]).to.be.true
/*
      console.log("---")

      for (i=0; i < 7; i++) {
        console.log(mkt0ParamRewards[i].toString());
      }
*/
      expect(mkt0ParamRewards[0].toString()).to.be.equal(web3.utils.toWei('1.2'))
      expect(mkt0ParamRewards[1].toString()).to.be.equal(web3.utils.toWei('0.6'))
      expect(mkt0ParamRewards[4].toString()).to.be.equal((604800).toString()) // 86400 * 7

      percent = await rewardsDistribContract.getMarketRewardsPercentage()
      expect(percent.toString()).to.be.equal(web3.utils.toWei('0.6'))

    });

  });

});