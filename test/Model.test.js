const { BN, constants, ether, balance, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
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

const Model = artifacts.require('Model');

contract('Model', function (accounts) {
  const [owner, tokenHolder1, tokenHolder2, tokenHolder3, anyone] = accounts;
  const gasPrice = new BN('1');
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
  /*
  Compound price: 21409027297510851 (trAPrice)

  // calc percentage
  // trAAPY = trARPB * 2102400 / trAPrice
  // trARPB = trAAPY * trAPrice / 2102400

  TrARPB: 305494111 (3%)
          407325481 (4%)
          509156852 (5%)
          203662741 (2%)
          101831370 (1%)
  */                               
  const MY_TRANCHE_A_RPB = new BN("541286150");
  const MY_EXT_PROT_RET = new BN("125300000000000000");
  const MY_BAL_FACTOR = new BN("500000000000000000");
  const MY_TRANCHE_A_PRICE = new BN("28450000000000000");
                                     

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
  it('deploy model contract with 3% external protocol return', async function () {
    this.model = await Model.new(MY_TRANCHE_A_RPB, MY_EXT_PROT_RET, MY_BAL_FACTOR, MY_TRANCHE_A_PRICE, {from: owner});
    expect(this.model.address).to.be.not.equal(ZERO_ADDRESS);
    expect(this.model.address).to.match(/0x[0-9a-fA-F]{40}/);
    console.log("Model Address: " + this.model.address);
  });

  describe('settings', function () {
    it('get tranches values', async function () {
      await this.model.setTranchesMarketTVL(ether('3941.4'), ether('1493.4'));
      trATVL = await this.model.trancheAMarketTVL();
      trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
      // expect(trATVL).to.be.bignumber.equal(ether('3000'));
      // expect(trBTVL.toString()).to.be.bignumber.equal(ether('7000'));
      console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
    });

    it('read values', async function () {
      trARet = await this.model.getTrancheAReturns();
      console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
      trBRet = await this.model.getTrancheBReturns();
      console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
      trBRewPerc = await this.model.getTrancheBRewardsPercentage();
      console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
      trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
      console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
    });
  });

  describe('changing parameters of external return', function () {
    describe('external protocol return low, 2%', function () {
      it('setting extProtRet to 2%', async function () {
        tx = await this.model.setExtProtocolPercent(ether('0.02'), {from: owner});
        expect(await this.model.extProtocolPercentage()).to.be.bignumber.equal(ether('0.02'));
      });

      it('read values', async function () {
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('changing parameters on tranche B amount', function () {
    describe('tranche B Amount increases', function () {
      it('setting tranche B amount to 20000', async function () {
        await this.model.setTranchesMarketTVL(ether('23000'), ether('3000'));
        trATVL = await this.model.trancheAMarketTVL();
        trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
        expect(trATVL).to.be.bignumber.equal(ether('3000'));
        expect(trBTVL.toString()).to.be.bignumber.equal(ether('20000'));
        console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });

      it('setting tranche B amount to 100000', async function () {
        await this.model.setTranchesMarketTVL(ether('103000'), ether('3000'));
        trATVL = await this.model.trancheAMarketTVL();
        trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
        expect(trATVL).to.be.bignumber.equal(ether('3000'));
        expect(trBTVL.toString()).to.be.bignumber.equal(ether('100000'));
        console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('changing parameters of external return', function () {
    describe('external protocol return high, 4%', function () {
      it('setting extProtRet to 4%', async function () {
        tx = await this.model.setExtProtocolPercent(ether('0.04'), {from: owner});
        expect(await this.model.extProtocolPercentage()).to.be.bignumber.equal(ether('0.04'));
      });

      it('read values', async function () {
        await this.model.setTranchesMarketTVL(ether('10000'), ether('3000'));
        trATVL = await this.model.trancheAMarketTVL();
        trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
        console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

  describe('changing parameters on tranche A amount', function () {
    describe('tranche A Amount increases', function () {
      it('setting tranche A amount to 5000', async function () {
        await this.model.setTranchesMarketTVL(ether('12000'), ether('5000'));
        trATVL = await this.model.trancheAMarketTVL();
        trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
        expect(trATVL).to.be.bignumber.equal(ether('5000'));
        expect(trBTVL.toString()).to.be.bignumber.equal(ether('7000'));
        console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });

      it('setting tranche A amount to 10000', async function () {
        await this.model.setTranchesMarketTVL(ether('17000'), ether('10000'));
        trATVL = await this.model.trancheAMarketTVL();
        trBTVL = (await this.model.totalTrancheMarketTVL()).sub(trATVL);
        expect(trATVL).to.be.bignumber.equal(ether('10000'));
        expect(trBTVL.toString()).to.be.bignumber.equal(ether('7000'));
        console.log("trATVL: "+ web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " + web3.utils.fromWei(trBTVL, "ether"));
      });

      it('read values', async function () {
        trARet = await this.model.getTrancheAReturns();
        console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
        trBRet = await this.model.getTrancheBReturns();
        console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
        trBRewPerc = await this.model.getTrancheBRewardsPercentage();
        console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
        trARewPerc = ether('1').sub(await this.model.getTrancheBRewardsPercentage());
        console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
      });
    });
  });

});
