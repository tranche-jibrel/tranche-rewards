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
var TrancheAToken = artifacts.require("./mocks/TrancheAERC20.sol");
var TrancheBToken = artifacts.require("./mocks/TrancheBERC20.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");

var RewardsDistribution = artifacts.require("./RewardsDistribution.sol");

let protocolContract, trAContract, trBContract, rewardTokenContract, rewardsDistribContract;
let owner, user1;

contract('JTrancheERC20', function (accounts) {
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
    console.log(owner);
    console.log(await web3.eth.getBalance(owner));
    console.log(await web3.eth.getBalance(user1));
  });

  it('get deployed contracts', async function () {
    protocolContract = await Protocol.deployed();
    expect(protocolContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(protocolContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log(protocolContract.address);
    trAContract = await TrancheAToken.deployed();
    expect(trAContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trAContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log(trAContract.address);
    trBContract = await TrancheBToken.deployed();
    expect(trBContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(trBContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log(trBContract.address);
    rewardTokenContract = await RewardToken.deployed();
    expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log(rewardTokenContract.address);
    rewardsDistribContract = await RewardsDistribution.deployed();
    expect(rewardsDistribContract.address).to.be.not.equal(ZERO_ADDRESS);
    expect(rewardsDistribContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log(rewardsDistribContract.address);
  });

  describe('settings', function () {
    it('set tranche in rewards distribution contract', async function () {
      tx = await rewardsDistribContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, MY_EXT_PROT_RET, {
        from: owner
      });
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

  describe('changing parameters of external return', function () {
    describe('external protocol return low, 2%', function () {
      it('setting extProtRet to 2%', async function () {
        tx = await rewardsDistribContract.setExtProtocolPercent(0, ether('0.02'), {
          from: owner
        });
        availMkt = await rewardsDistribContract.availableMarkets(0);
        expect(availMkt.extProtocolPercentage).to.be.bignumber.equal(ether('0.02'));
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

  describe('changing parameters on tranche B amount', function () {
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
        tx = await rewardsDistribContract.setExtProtocolPercent(0, ether('0.04'), {
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

});