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

var MarketHelper = artifacts.require("./MarketHelper.sol");
var RewardsDistribution = artifacts.require("./RewardsDistribution.sol");

let protocolContract, rewardTokenContract, rewardsDistribContract;
let owner, user1, user2, user3, user4;
let res1, res2, res3, res4;

contract('Rewards2', function (accounts) {
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
  const MY_TRANCHE_A_PRICE_NUM0 =  Number(web3.utils.fromWei("21409027297510851", "ether"))
  const MY_TRANCHE_A_PRICE_NUM1 =  Number(web3.utils.fromWei("23569787412556962", "ether"))

  owner = accounts[0];
  user1 = accounts[1];
  user2 = accounts[2];
  user3 = accounts[3];
  user4 = accounts[4];

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
/*
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
*/
  it('get deployed contracts', async function () {
    protocolContract = await Protocol.deployed();
    expect(protocolContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(protocolContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(protocolContract.address);
    trA0 = await protocolContract.getTrA(0);
    trAFDTContract0 = await TrancheAFDT.at(trA0);
    expect(trAFDTContract0.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trAFDTContract0.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trAFDTContract0.address);
    trB0 = await protocolContract.getTrB(0);
    trBFDTContract0 = await TrancheBFDT.at(trB0);
    expect(trBFDTContract0.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trBFDTContract0.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trBFDTContract0.address);
    trA1 = await protocolContract.getTrA(1);
    trAFDTContract1 = await TrancheAFDT.at(trA1);
    expect(trAFDTContract1.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trAFDTContract1.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trAFDTContract1.address);
    trB1 = await protocolContract.getTrB(1);
    trBFDTContract1 = await TrancheBFDT.at(trB1);
    expect(trBFDTContract1.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trBFDTContract1.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(trBFDTContract1.address);

    marketHelperContract = await MarketHelper.deployed();
    expect(marketHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(marketHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(marketHelperContract.address);
    rewardTokenContract = await RewardToken.deployed();
    expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(rewardTokenContract.address);
    rewardsDistribContract = await RewardsDistribution.deployed();
    expect(rewardsDistribContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardsDistribContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    // console.log(rewardsDistribContract.address);
  });

  it('mint some tokens from tranche A and B for market 0', async function () {
    await trAFDTContract0.mint(user1,  ether("10000"));
    console.log("User1 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user1)))
    await trAFDTContract0.mint(user2,  ether("20000"));
    console.log("User2 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user2)))
    await trAFDTContract0.mint(user3,  ether("30000"));
    console.log("User3 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user3)))
    await trAFDTContract0.mint(user4,  ether("40000"));
    console.log("User4 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user4)))

    await trBFDTContract0.mint(user1,  ether("1000"));
    console.log("User1 trB tokens: " + web3.utils.fromWei(await trBFDTContract0.balanceOf(user1)))
    await trBFDTContract0.mint(user2,  ether("2000"));
    console.log("User2 trB tokens: " + web3.utils.fromWei(await trBFDTContract0.balanceOf(user2)))
    await trBFDTContract0.mint(user3,  ether("3000"));
    console.log("User3 trB tokens: " + web3.utils.fromWei(await trBFDTContract0.balanceOf(user3)))
    await trBFDTContract0.mint(user4,  ether("4000"));
    console.log("User4 trB tokens: " + web3.utils.fromWei(await trBFDTContract0.balanceOf(user4)))

    totASupply = await trAFDTContract0.totalSupply();
    // console.log(web3.utils.fromWei(totASupply))
    trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10,18);
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

  it('mint some tokens from tranche A and B for market 1', async function () {
    await trAFDTContract1.mint(user1,  ether("1000"));
    console.log("User1 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user1)))
    await trAFDTContract1.mint(user2,  ether("2000"));
    console.log("User2 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user2)))
    await trAFDTContract1.mint(user3,  ether("3000"));
    console.log("User3 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user3)))
    await trAFDTContract1.mint(user4,  ether("4000"));
    console.log("User4 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user4)))

    await trBFDTContract1.mint(user1,  ether("1000"));
    console.log("User1 trB tokens: " + web3.utils.fromWei(await trBFDTContract1.balanceOf(user1)))
    await trBFDTContract1.mint(user2,  ether("2000"));
    console.log("User2 trB tokens: " + web3.utils.fromWei(await trBFDTContract1.balanceOf(user2)))
    await trBFDTContract1.mint(user3,  ether("3000"));
    console.log("User3 trB tokens: " + web3.utils.fromWei(await trBFDTContract1.balanceOf(user3)))
    await trBFDTContract1.mint(user4,  ether("4000"));
    console.log("User4 trB tokens: " + web3.utils.fromWei(await trBFDTContract1.balanceOf(user4)))

    totASupply = await trAFDTContract1.totalSupply();
    // console.log(web3.utils.fromWei(totASupply))
    trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM1 / Math.pow(10,18);
    // console.log(trAVal.toString())
    // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
    await protocolContract.setTrAValue(1, ether(trAVal.toString()));
    await protocolContract.setTrBValue(1, ether('10000'));
    await protocolContract.setTotalValue(1);
    trATVL = await protocolContract.getTrAValue(1);
    trBTVL = await protocolContract.getTrBValue(1);
    totTrTVL = await protocolContract.getTotalValue(1);
    console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
        web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
  });

  describe('settings', function () {
    it('set tranche in rewards distribution contract', async function () {
      tx = await rewardsDistribContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, 
            MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {from: owner});

      tx = await rewardsDistribContract.addTrancheMarket(protocolContract.address, 1, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, 
            MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {from: owner});

      console.log("Total TVL: " + (await rewardsDistribContract.getAllMarketsTVL()).toString())
      res1 = await rewardsDistribContract.availableMarkets(0)
      res2 = await rewardsDistribContract.availableMarketsRewards(0)     
      console.log("Total TVL in Market0: " + (await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0])).toString())
      res3 = await rewardsDistribContract.availableMarkets(1)
      res4 = await rewardsDistribContract.availableMarketsRewards(1)  
      console.log("Total TVL in Market1: " + (await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0])).toString())

      await rewardsDistribContract.refreshSliceSpeeds();

      mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
      mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
      console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")

      count = await rewardsDistribContract.marketsCounter();
      console.log("Count markets: " + count)
      trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
      trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
      totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);
      paramTr = await rewardsDistribContract.availableMarketsRewards(0);
      console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
        web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") + 
        ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");

      trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
      trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
      totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
      paramTr = await rewardsDistribContract.availableMarketsRewards(1);
      console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
        web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") + 
        ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");
    });

    it('read values and distribute rewards to tranches', async function () {
      trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
      console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
      trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
      console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
      trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
      console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
      trARewPerc = ether('1').sub(trBRewPerc);
      console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

      trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
      console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
      trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
      console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
      trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
      console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
      trARewPerc = ether('1').sub(trBRewPerc);
      console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

      await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
      await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
    });

    it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
      console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
      console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
      console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
      console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();

      console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
      console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
      console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
      console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")

      console.log("User1 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user4)))
      console.log("User1 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user4)))

      console.log("User1 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user4)))

      console.log("User1 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user1)))
      console.log("User2 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user2)))
      console.log("User3 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user3)))
      console.log("User4 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user4)))
    });

    it('some users withdraw rewards from markets tranche A', async function () {
      tx = await trAFDTContract0.withdrawFunds({from: user1});
      tx = await trAFDTContract1.withdrawFunds({from: user1});
      console.log("User1 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user1)))
      console.log("User1 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user1)))
      console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
      //tx = await trAFDTContract.withdrawFunds({from: user2});
      //console.log("User2 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user2)))
      console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
      tx = await trAFDTContract0.withdrawFunds({from: user3});
      tx = await trAFDTContract1.withdrawFunds({from: user3});
      console.log("User3 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user3)))
      console.log("User3 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user3)))
      console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
      //tx = await trAFDTContract.withdrawFunds({from: user4});
      //console.log("User4 withdrawn tokens from tranche A: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user4)))
      console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
    });

    it('some users withdraw rewards from markets tranche B', async function () {
      console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
      console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      //tx = await trBFDTContract.withdrawFunds({from: user1});
      // console.log("User1 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user1)))
      console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
      tx = await trBFDTContract0.withdrawFunds({from: user2});
      tx = await trBFDTContract1.withdrawFunds({from: user2});
      console.log("User2 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user2)))
      console.log("User2 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user2)))
      console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
      //tx = await trBFDTContract.withdrawFunds({from: user3});
      //console.log("User3 withdrawn tokens from tranche B: " + web3.utils.fromWei(await trAFDTContract.withdrawnFundsOf(user3)))
      console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
      tx = await trBFDTContract0.withdrawFunds({from: user4});
      tx = await trBFDTContract1.withdrawFunds({from: user4});
      console.log("User4 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user4)))
      console.log("User4 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user4)))
      console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
      console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
      console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
      console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
      console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
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
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });
  
      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();

        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")

        console.log("User1 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user4)))
      });
  
      it('users withdraw rewards from mkt0 and mkt1 tranche A', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        console.log("User1 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user1)))
        console.log("User1 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user1)))
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        console.log("User2 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user2)))
        console.log("User2 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user2)))
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        console.log("User3 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user3)))
        console.log("User3 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user3)))
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        console.log("User4 withdrawn tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user4)))
        console.log("User4 withdrawn tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user4)))
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))
      });
  
      it('users withdraw rewards from mkt0 and mkt1 tranche B', async function () {
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user1)))
        console.log("User1 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user1)))
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user2)))
        console.log("User2 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user2)))
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user3)))
        console.log("User3 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user3)))
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 withdrawn tokens from mkt0 tranche B: " + web3.utils.fromWei(await trAFDTContract0.withdrawnFundsOf(user4)))
        console.log("User4 withdrawn tokens from mkt1 tranche B: " + web3.utils.fromWei(await trAFDTContract1.withdrawnFundsOf(user4)))
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      });
    });
  });

  describe('changing parameters on tranche B amount', function () {
    describe('tranche B Amount increases', function () {
      it('setting mkt0 and mkt1 tranche B amount to 20000', async function () {
        await protocolContract.setTrBValue(0, ether('20000'));
        await protocolContract.setTotalValue(0);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await protocolContract.setTrBValue(1, ether('20000'));
        await protocolContract.setTotalValue(1);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();

        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")

        console.log("User1 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user4)))
      });

      it('setting mkt0 tranche B amount to 100000', async function () {
        await protocolContract.setTrBValue(0, ether('100000'));
        await protocolContract.setTotalValue(0);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await protocolContract.setTrBValue(1, ether('20000'));
        await protocolContract.setTotalValue(1);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();
 
        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")

        console.log("User1 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche A: " + web3.utils.fromWei(await trAFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche A: " + web3.utils.fromWei(await trAFDTContract1.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt0 tranche B: " + web3.utils.fromWei(await trBFDTContract0.withdrawableFundsOf(user4)))

        console.log("User1 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user1)))
        console.log("User2 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user2)))
        console.log("User3 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user3)))
        console.log("User4 withdrawable tokens from mkt1 tranche B: " + web3.utils.fromWei(await trBFDTContract1.withdrawableFundsOf(user4)))
      });

      it('users withdraw rewards from mkt0 and mkt1 tranche A & B', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
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

      it('setting tranche B amount to 10000', async function () {
        await protocolContract.setTrBValue(0, ether('10000'));
        await protocolContract.setTotalValue(0);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
        
        await protocolContract.setTrBValue(1, ether('10000'));
        await protocolContract.setTotalValue(1);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
        
        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();
        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")
      });

      it('users withdraw rewards from mkt0 and mkt1 tranche A & B', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      });
    });
  });

  describe('changing parameters on tranche A amount', function () {
    describe('tranche A Amount increases', function () {
      it('mint some tokens from tranche A and B for mkt0 and mkta', async function () {
        await trAFDTContract0.mint(user1,  ether("10000"));
        console.log("User1 mkt0 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user1)))
        await trAFDTContract0.mint(user2,  ether("20000"));
        console.log("User2 mkt0 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user2)))
        await trAFDTContract0.mint(user3,  ether("30000"));
        console.log("User3 mkt0 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user3)))
        await trAFDTContract0.mint(user4,  ether("40000"));
        console.log("User4 mkt0 trA tokens: " + web3.utils.fromWei(await trAFDTContract0.balanceOf(user4)))
    
        await trAFDTContract1.mint(user1,  ether("1000"));
        console.log("User1 mkt1 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user1)))
        await trAFDTContract1.mint(user2,  ether("2000"));
        console.log("User2 mkt1 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user2)))
        await trAFDTContract1.mint(user3,  ether("3000"));
        console.log("User3 mkt1 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user3)))
        await trAFDTContract1.mint(user4,  ether("4000"));
        console.log("User4 mkt1 trA tokens: " + web3.utils.fromWei(await trAFDTContract1.balanceOf(user4)))
    
        totASupply = await trAFDTContract0.totalSupply();
        // console.log(web3.utils.fromWei(totASupply))
        trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10,18);
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

        totASupply = await trAFDTContract1.totalSupply();
        // console.log(web3.utils.fromWei(totASupply))
        trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM1 / Math.pow(10,18);
        // console.log(trAVal.toString())
        // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
        await protocolContract.setTrAValue(1, ether(trAVal.toString()));
        await protocolContract.setTrBValue(1, ether('10000'));
        await protocolContract.setTotalValue(1);
        trATVL = await protocolContract.getTrAValue(1);
        trBTVL = await protocolContract.getTrBValue(1);
        totTrTVL = await protocolContract.getTotalValue(1);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
            web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();
        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")
      });

      it('users withdraw rewards from mkt0 and mkt1 tranche A & B', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      });

      it('setting tranche A amount to 5000', async function () {
        await protocolContract.setTrAValue(0, ether('10000'));
        await protocolContract.setTotalValue(0);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await protocolContract.setTrAValue(1, ether('10000'));
        await protocolContract.setTotalValue(1);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();
        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")
      });

      it('users withdraw rewards from mkt0 and mkt1 tranche A & B', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      });

      it('setting tranche A amount to 10000', async function () {
        await protocolContract.setTrAValue(0, ether('25000'));
        await protocolContract.setTotalValue(0);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0]);;
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await protocolContract.setTrAValue(1, ether('25000'));
        await protocolContract.setTotalValue(1);
        trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0]);
        trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0]);
        totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0]);
        console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
          web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

        await rewardsDistribContract.refreshSliceSpeeds();

        mkt0Share = await rewardsDistribContract.getMarketSharePerTranche(0)
        mkt1Share = await rewardsDistribContract.getMarketSharePerTranche(1)
        console.log("Market0: " + mkt0Share + " %, Market1: " + mkt1Share + " %")
      });

      it('read values and distribute rewards to tranches', async function () {
        trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
        console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], res1[6]);
        console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], res1[6], res1[4]);
        console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
        console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], res3[6]);
        console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], res3[6], res3[4]);
        console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(trBRewPerc);
        console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
  
        await rewardTokenContract.approve(rewardsDistribContract.address, ether("200"), {from: owner})
        await rewardsDistribContract.distributeAllMarketsFunds(ether("200"));
      });

      it('distribute rewards mkt0 and mkt1 tranche A & B to users', async function () {
        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
        tx = await rewardsDistribContract.distributeRewardsTokenAllMarkets();
        console.log("Rewards APY trA mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(0)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt0: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(0)).toString()) * 100 + "%")
        console.log("Rewards APY trA mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheA(1)).toString()) * 100 + "%")
        console.log("Rewards APY trB mkt1: " + web3.utils.fromWei((await rewardsDistribContract.getRewardsAPYSingleMarketTrancheB(1)).toString()) * 100 + "%")
      });

      it('users withdraw rewards from mkt0 and mkt1 tranche A & B', async function () {
        tx = await trAFDTContract0.withdrawFunds({from: user1});
        tx = await trAFDTContract1.withdrawFunds({from: user1});
        tx = await trBFDTContract0.withdrawFunds({from: user1});
        tx = await trBFDTContract1.withdrawFunds({from: user1});
        console.log("User1 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user1)))
        tx = await trAFDTContract0.withdrawFunds({from: user2});
        tx = await trAFDTContract1.withdrawFunds({from: user2});
        tx = await trBFDTContract0.withdrawFunds({from: user2});
        tx = await trBFDTContract1.withdrawFunds({from: user2});
        console.log("User2 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user2)))
        tx = await trAFDTContract0.withdrawFunds({from: user3});
        tx = await trAFDTContract1.withdrawFunds({from: user3});
        tx = await trBFDTContract0.withdrawFunds({from: user3});
        tx = await trBFDTContract1.withdrawFunds({from: user3});
        console.log("User3 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user3)))
        tx = await trAFDTContract0.withdrawFunds({from: user4});
        tx = await trAFDTContract1.withdrawFunds({from: user4});
        tx = await trBFDTContract0.withdrawFunds({from: user4});
        tx = await trBFDTContract1.withdrawFunds({from: user4});
        console.log("User4 balance of rewards token: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(user4)))

        console.log("rewards tokens in mkt0 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract0.address)))
        console.log("rewards tokens in mkt0 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract0.address)))
        console.log("rewards tokens in mkt1 tranche A: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trAFDTContract1.address)))
        console.log("rewards tokens in mkt1 tranche B: " + web3.utils.fromWei(await rewardTokenContract.balanceOf(trBFDTContract1.address)))
      });
    });
  });

});