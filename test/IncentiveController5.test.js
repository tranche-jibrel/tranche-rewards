const {
    BN,
    constants,
    ether,
    time,
    balance,
    expectEvent,
    expectRevert
} = require('@openzeppelin/test-helpers');
const {
    expect
} = require('chai');

const timeMachine = require('ganache-time-traveler');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

const approxeq = (v1, v2, epsilon = 0.001) => Math.abs(v1 - v2) <= epsilon;

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAFDT = artifacts.require("./mocks/TrancheAToken.sol");
var TrancheBFDT = artifacts.require("./mocks/TrancheBToken.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");
var Chainlink1 = artifacts.require("./mocks/Chainlink1.sol");
var Chainlink2 = artifacts.require("./mocks/Chainlink2.sol");

var MarketHelper = artifacts.require("./MarketHelper.sol");
var PriceHelper = artifacts.require("./PriceHelper.sol");
var IncentivesController = artifacts.require("./IncentivesController.sol");

let protocolContract, trA0, trB0, trA1, trB1, rewardTokenContract, priceHelperContract, chainlink1Contract, chainlink2Contract;
let mkt0trARewards, mkt0trBRewards, mkt1trARewards, mkt1trBRewards;
let mkt0trARRate, mkt0trBRRate, mkt1trARRate, mkt1trBRRate;
let owner, user1, user2, user3, user4;
let distCountMkt0, distCountMkt1, distCount;

contract('Incentive Controller', function (accounts) {
    // const gasPrice = new BN('1');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const MKT1_DECS = 6;
    const MKT2_DECS = 18;

    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

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
    const MY_MARKET_PERCENTAGE = new BN("1000000000000000000"); //100%
    const MY_TRANCHE_A_PRICE_NUM0 = Number(web3.utils.fromWei("21409027297510851", "ether"))
    const MY_TRANCHE_A_PRICE_NUM1 = Number(web3.utils.fromWei("23569787412556962", "ether"))

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

        chainlink1Contract = await Chainlink1.deployed();
        expect(chainlink1Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink1Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        chainlink2Contract = await Chainlink2.deployed();
        expect(chainlink2Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink2Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        priceHelperContract = await PriceHelper.deployed();
        expect(priceHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(priceHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);

        marketHelperContract = await MarketHelper.deployed();
        expect(marketHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(marketHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(marketHelperContract.address);
        rewardTokenContract = await RewardToken.deployed();
        expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(rewardTokenContract.address);
        incentiveControllerContract = await IncentivesController.deployed();
        expect(incentiveControllerContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(incentiveControllerContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(incentiveControllerContract.address);
    });

    it('mint some tokens from tranche A and B for market 0', async function () {
        let block = await web3.eth.getBlockNumber();
        now = (await web3.eth.getBlock(block)).timestamp

        await incentiveControllerContract.trancheANewEnter(user1, trAFDTContract0.address)
        await trAFDTContract0.mint(user1, ether("10000"));
        await protocolContract.setTrAStakingDetails(user1, 0, now, ether("10000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user1))
        expect(bal).to.be.equal("10000")

        await incentiveControllerContract.trancheANewEnter(user2, trAFDTContract0.address)
        await trAFDTContract0.mint(user2, ether("20000"));
        await protocolContract.setTrAStakingDetails(user2, 0, now, ether("20000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user2, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user2))
        expect(bal).to.be.equal("20000")

        await incentiveControllerContract.trancheANewEnter(user3, trAFDTContract0.address)
        await trAFDTContract0.mint(user3, ether("30000"));
        await protocolContract.setTrAStakingDetails(user3, 0, now, ether("30000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user3, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user3))
        expect(bal).to.be.equal("30000")

        await incentiveControllerContract.trancheANewEnter(user4, trAFDTContract0.address)
        await trAFDTContract0.mint(user4, ether("40000"));
        await protocolContract.setTrAStakingDetails(user4, 0, now, ether("40000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user4, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user4))
        expect(bal).to.be.equal("40000")

        await incentiveControllerContract.trancheBNewEnter(user1, trBFDTContract0.address)
        await trBFDTContract0.mint(user1, ether("1000"));
        await protocolContract.setTrBStakingDetails(user1, 0, now, ether("1000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user1))
        expect(bal).to.be.equal("1000")

        await incentiveControllerContract.trancheBNewEnter(user2, trBFDTContract0.address)
        await trBFDTContract0.mint(user2, ether("2000"));
        await protocolContract.setTrBStakingDetails(user2, 0, now, ether("2000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user2, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user2))
        expect(bal).to.be.equal("2000")

        await incentiveControllerContract.trancheBNewEnter(user3, trBFDTContract0.address)
        await trBFDTContract0.mint(user3, ether("3000"));
        await protocolContract.setTrBStakingDetails(user3, 0, now, ether("3000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user3, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user3))
        expect(bal).to.be.equal("3000")

        await incentiveControllerContract.trancheBNewEnter(user4, trBFDTContract0.address)
        await trBFDTContract0.mint(user4, ether("4000"));
        await protocolContract.setTrBStakingDetails(user4, 0, now, ether("4000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user4, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user4))
        expect(bal).to.be.equal("4000")

        totASupply = await trAFDTContract0.totalSupply();
        // console.log(web3.utils.fromWei(totASupply))
        trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
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
        let block = await web3.eth.getBlockNumber();
        now = (await web3.eth.getBlock(block)).timestamp

        await incentiveControllerContract.trancheANewEnter(user1, trAFDTContract1.address)
        await trAFDTContract1.mint(user1, ether("1000"));
        await protocolContract.setTrAStakingDetails(user1, 1, now, ether("1000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user1))
        expect(bal).to.be.equal("1000")

        await incentiveControllerContract.trancheANewEnter(user2, trAFDTContract1.address)
        await trAFDTContract1.mint(user2, ether("2000"));
        await protocolContract.setTrAStakingDetails(user2, 1, now, ether("2000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user2, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user2))
        expect(bal).to.be.equal("2000")

        await incentiveControllerContract.trancheANewEnter(user3, trAFDTContract1.address)
        await trAFDTContract1.mint(user3, ether("3000"));
        await protocolContract.setTrAStakingDetails(user3, 1, now, ether("3000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user3, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user3))
        expect(bal).to.be.equal("3000")

        await incentiveControllerContract.trancheANewEnter(user4, trAFDTContract1.address)
        await trAFDTContract1.mint(user4, ether("4000"));
        await protocolContract.setTrAStakingDetails(user4, 1, now, ether("4000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user4, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user4))
        expect(bal).to.be.equal("4000")

        await incentiveControllerContract.trancheBNewEnter(user1, trBFDTContract1.address)
        await trBFDTContract1.mint(user1, ether("1000"));
        await protocolContract.setTrBStakingDetails(user1, 1, now, ether("1000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user1))
        expect(bal).to.be.equal("1000")

        await incentiveControllerContract.trancheBNewEnter(user2, trBFDTContract1.address)
        await trBFDTContract1.mint(user2, ether("2000"));
        await protocolContract.setTrBStakingDetails(user2, 1, now, ether("2000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user2, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user2))
        expect(bal).to.be.equal("2000")

        await incentiveControllerContract.trancheBNewEnter(user3, trBFDTContract1.address)
        await trBFDTContract1.mint(user3, ether("3000"));
        await protocolContract.setTrBStakingDetails(user3, 1, now, ether("3000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user3, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user3))
        expect(bal).to.be.equal("3000")

        await incentiveControllerContract.trancheBNewEnter(user4, trBFDTContract1.address)
        await trBFDTContract1.mint(user4, ether("4000"));
        await protocolContract.setTrBStakingDetails(user4, 1, now, ether("4000"), 1)
        expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user4, 0)).toString()).to.be.equal("1")
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user4))
        expect(bal).to.be.equal("4000")

        totASupply = await trAFDTContract1.totalSupply();
        // console.log(web3.utils.fromWei(totASupply))
        trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM1 / Math.pow(10, 18);
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

    describe('settings, with manual settings of market percentages', function () {
        let res1, res2, res3, res4;

        it('set tranche in rewards distribution contract', async function () {
            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET, /*1000,*/ MKT1_DECS, 1000000, chainlink1Contract.address, false, {
                    from: owner
                });

            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 1, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET, /*1000,*/ MKT2_DECS, web3.utils.toWei('1'), chainlink2Contract.address, false, {
                    from: owner
                });

            res = await incentiveControllerContract.getATrancheMarket(0);
            expect(res.toString()).to.be.equal(trAFDTContract0.address.toString())
            res = await incentiveControllerContract.getBTrancheMarket(0);
            expect(res.toString()).to.be.equal(trBFDTContract0.address.toString())
            res = await incentiveControllerContract.getATrancheMarket(1);
            expect(res.toString()).to.be.equal(trAFDTContract1.address.toString())
            res = await incentiveControllerContract.getBTrancheMarket(1);
            expect(res.toString()).to.be.equal(trBFDTContract1.address.toString())

            console.log("Total TVL: " + (web3.utils.fromWei(await incentiveControllerContract.getAllMarketsTVL()).toString()))

            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            res3 = await incentiveControllerContract.availableMarkets(1)
            res4 = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("Total TVL in Market1: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0], MKT2_DECS)).toString()))

            // await incentiveControllerContract.refreshSliceSpeeds();
            await incentiveControllerContract.setRewardsPercentageAllMarkets([web3.utils.toWei("0.5"), web3.utils.toWei("0.4")])

            mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
            mkt1Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(1))
            console.log("Market0: " + mkt0Share * 100 + " %, Market1: " + mkt1Share * 100 + " %")

            count = await incentiveControllerContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0], MKT2_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0], MKT2_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0], MKT2_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(1);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            res = await incentiveControllerContract.getMarketRewardsPercentage();
            expect(approxeq(Number(web3.utils.fromWei(res.toString())), 0.9)).to.be.true
        });

        it('read values and distribute rewards to tranches', async function () {
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
            console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], MKT2_DECS, res3[5]);
            console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], MKT2_DECS, res3[5], res3[4]);
            console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });

    describe('Distributing rewards', function () {
        it('distribute rewards mkt0 and mkt1, tranche A & B', async function () {
            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            console.log("mkt0 A: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            console.log("mkt0 B: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("100"), {
                from: owner
            })

            percent = (await incentiveControllerContract.getMarketRewardsPercentage());
            console.log(web3.utils.fromWei(percent.toString()))
            maxAmount = new BN("100")
            calcAmount = maxAmount * new BN(percent.toString())
            console.log(web3.utils.fromWei(calcAmount.toString()))

            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("100"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            expect(web3.utils.fromWei(res.toString())).to.be.equal("100")

            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[3] + ", B rewards: " + res[4] + ", distr counter: " + res[5].toString());
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            distCount = res[5];

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt0trARRate = res[1]
            console.log("mkt0 TrA APY: " + web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheA(0)).toString())
            console.log("mkt0 TrB APY: " + web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheB(0)).toString())
            // expect(Number(res[1])).to.be.equal(mkt0trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt0trBRRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt0trBRewards / 1000)

            res = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("mkt1: A rewards: " + res[3] + ", B rewards: " + res[4] + ", distr counter: " + res[5].toString());
            mkt1trARewards = new BN(res[3].toString())
            mkt1trBRewards = new BN(res[4].toString())
            totRewards = totRewards.add(new BN(res[3].toString())).add(new BN(res[4].toString()));

            distCount = res[5];
            
            res = await incentiveControllerContract.trancheARewardsInfo(1, distCount)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trARewards.divn(1000).toString())))
            console.log("mkt1 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt1trARRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt1trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(1, distCount)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trBRewards.divn(1000).toString())))
            console.log("mkt1 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt1trBRRate = res[1]
            // expect(Number(res[1])).to.be.lte(mkt1trBRewards / 1000)

            // expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.lte(calcAmount)
            // expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.gt(calcAmount)
            console.log(Number(web3.utils.fromWei(totRewards.toString())))
            console.log(Number(web3.utils.fromWei(calcAmount.toString())))
            expect(approxeq(Number(totRewards), Number(calcAmount))).to.be.true
            // expect(web3.utils.fromWei(totRewards.toString())).to.be.equal("1000")
        });
    });

    describe('Getting rewards after some time', function () {

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(100));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            balanceA2 = await incentiveControllerContract.trAEarned(0, user2, distCount)
            balanceA3 = await incentiveControllerContract.trAEarned(0, user3, distCount)
            balanceA4 = await incentiveControllerContract.trAEarned(0, user4, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal0trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal0trA.toString() + " around " + mkt0trARewards.divn(10).toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt0trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            balanceB2 = await incentiveControllerContract.trBEarned(0, user2, distCount)
            balanceB3 = await incentiveControllerContract.trBEarned(0, user3, distCount)
            balanceB4 = await incentiveControllerContract.trBEarned(0, user4, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal0trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal0trB.toString() + " around " + mkt0trBRewards.divn(10).toString())
            // expect(approxeq(web3.utils.fromWei(bal0trB.toString()), web3.utils.fromWei(mkt0trBRewards.divn(10).toString()))).to.be.true
            // expect(web3.utils.fromWei(bal0trB.toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(10).toString())))

            balanceA1 = await incentiveControllerContract.trAEarned(1, user1, distCount)
            balanceA2 = await incentiveControllerContract.trAEarned(1, user2, distCount)
            balanceA3 = await incentiveControllerContract.trAEarned(1, user3, distCount)
            balanceA4 = await incentiveControllerContract.trAEarned(1, user4, distCount)
            console.log("User1 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal1trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal1trA.toString() + " around " + mkt1trARewards.divn(10).toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt1trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(1, user1, distCount)
            balanceB2 = await incentiveControllerContract.trBEarned(1, user2, distCount)
            balanceB3 = await incentiveControllerContract.trBEarned(1, user3, distCount)
            balanceB4 = await incentiveControllerContract.trBEarned(1, user4, distCount)
            console.log("User1 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal1trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal1trB.toString() + " around " + mkt1trBRewards.divn(10).toString())
            totBal = bal0trA.add(bal0trB).add(bal1trA).add(bal1trB)
            console.log(web3.utils.fromWei(totBal.toString()) + " around 9")
            // expect(web3.utils.fromWei(totBal.toString())).to.be.equal("100")
        });

        it('user2 and user4 claim all their rewards', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets(user2, {
                from: user2
            })

            bal = await rewardTokenContract.balanceOf(user2)
            console.log("User2 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user2, distCount)).toString()).to.be.equal("0")

            await incentiveControllerContract.claimRewardsAllMarkets(user4, {
                from: user4
            })
            bal = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user4, distCount)).toString()).to.be.equal("0")
        });

        it('update rewards amount again before period finish', async function () {
            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("100"), {
                from: owner
            })
            // previous rewards
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Previous mkt0: A rewards: " + res[2] + ", B rewards: " + res[3] + ", rewards dur.: " + res[4]);
            mkt0trARewards = new BN(res[2].toString())
            mkt0trBRewards = new BN(res[3].toString())
            totRewards = new BN(res[2].toString()).add(new BN(res[3].toString()));

            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("100"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[2] + ", B rewards: " + res[3] + ", rewards dur.: " + res[4]);
            mkt0trARewards = new BN(res[2].toString())
            mkt0trBRewards = new BN(res[3].toString())
            totRewards = new BN(res[2].toString()).add(new BN(res[3].toString()));

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]  + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt0trARRate = res[1]
            console.log("mkt0 TrA APY: " + web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheA(0)).toString())
            console.log("mkt0 TrB APY: " + web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheB(0)).toString())
            // expect(Number(res[1])).to.be.equal(mkt0trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", rewards dur.: " + res[4] + ", periodFinish: " + res[0]);
            mkt0trBRRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt0trBRewards / 1000)

            res = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("mkt1: A rewards: " + res[2] + ", B rewards: " + res[3]);
            mkt1trARewards = new BN(res[2].toString())
            mkt1trBRewards = new BN(res[3].toString())
            totRewards = totRewards.add(new BN(res[2].toString())).add(new BN(res[3].toString()));
            res = await incentiveControllerContract.trancheARewardsInfo(1, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trARewards.divn(1000).toString())))
            console.log("mkt1 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", periodFinish: " + res[0]);
            mkt1trARRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt1trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(1, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trBRewards.divn(1000).toString())))
            console.log("mkt1 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3] + ", periodFinish: " + res[0]);
            mkt1trBRRate = res[1]
            // expect(Number(res[1])).to.be.lte(mkt1trBRewards / 1000)

            // expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.lte(194)
            // expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.gt(193)
        });
    });

    describe('Getting rewards at the end of duration', function () {
        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1000));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[3] + ", B rewards: " + res[4]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            res = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("mkt1: A rewards: " + res[3] + ", B rewards: " + res[4]);
            mkt1trARewards = new BN(res[3].toString())
            mkt1trBRewards = new BN(res[4].toString())

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            balanceA2 = await incentiveControllerContract.trAEarned(0, user2, distCount)
            balanceA3 = await incentiveControllerContract.trAEarned(0, user3, distCount)
            balanceA4 = await incentiveControllerContract.trAEarned(0, user4, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal0trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal0trA.toString() + " around " + mkt0trARewards.toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt0trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            balanceB2 = await incentiveControllerContract.trBEarned(0, user2, distCount)
            balanceB3 = await incentiveControllerContract.trBEarned(0, user3, distCount)
            balanceB4 = await incentiveControllerContract.trBEarned(0, user4, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal0trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal0trB.toString() + " around " + mkt0trBRewards.toString())
            // expect(approxeq(web3.utils.fromWei(bal0trB.toString()), web3.utils.fromWei(mkt0trBRewards.divn(10).toString()))).to.be.true
            // expect(web3.utils.fromWei(bal0trB.toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(10).toString())))

            balanceA1 = await incentiveControllerContract.trAEarned(1, user1, distCount)
            balanceA2 = await incentiveControllerContract.trAEarned(1, user2, distCount)
            balanceA3 = await incentiveControllerContract.trAEarned(1, user3, distCount)
            balanceA4 = await incentiveControllerContract.trAEarned(1, user4, distCount)
            console.log("User1 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal1trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal1trA.toString() + " around " + mkt1trARewards.toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt1trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(1, user1, distCount)
            balanceB2 = await incentiveControllerContract.trBEarned(1, user2, distCount)
            balanceB3 = await incentiveControllerContract.trBEarned(1, user3, distCount)
            balanceB4 = await incentiveControllerContract.trBEarned(1, user4, distCount)
            console.log("User1 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal1trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal1trB.toString() + " around " + mkt1trBRewards.toString())
            totBal = bal0trA.add(bal0trB).add(bal1trA).add(bal1trB)
            console.log(web3.utils.fromWei(totBal.toString()) + " around 180")

            expect(Number(web3.utils.fromWei(totBal.toString()))).to.be.lte(175)
            expect(Number(web3.utils.fromWei(totBal.toString()))).to.be.gt(174)
            // expect(web3.utils.fromWei(totBal.toString())).to.be.equal("100")
        });

        it('all users claim all their rewards', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets(user1, {
                from: user1
            })
            bal1 = await rewardTokenContract.balanceOf(user1)
            console.log("User1 rewards: " + web3.utils.fromWei(bal1.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user1, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user1, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user1, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user1, distCount)).toString()).to.be.equal("0")

            await incentiveControllerContract.claimRewardsAllMarkets(user2, {
                from: user2
            })
            bal2 = await rewardTokenContract.balanceOf(user2)
            console.log("User2 rewards: " + web3.utils.fromWei(bal2.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user2, distCount)).toString()).to.be.equal("0")

            await incentiveControllerContract.claimRewardsAllMarkets(user3, {
                from: user3
            })
            bal3 = await rewardTokenContract.balanceOf(user3)
            console.log("User2 rewards: " + web3.utils.fromWei(bal3.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user3, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user3, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user3, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user3, distCount)).toString()).to.be.equal("0")

            await incentiveControllerContract.claimRewardsAllMarkets(user4, {
                from: user4
            })
            bal4 = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal4.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user4, distCount)).toString()).to.be.equal("0")

            expect(approxeq(Number(web3.utils.fromWei(bal1.toString())), 18)).to.be.true
            expect(approxeq(Number(web3.utils.fromWei(bal2.toString())), 36)).to.be.true
            expect(approxeq(Number(web3.utils.fromWei(bal3.toString())), 54)).to.be.true
            expect(approxeq(Number(web3.utils.fromWei(bal4.toString())), 72)).to.be.true

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log(web3.utils.fromWei(bal.toString()))
            expect(approxeq(Number(web3.utils.fromWei(bal.toString())), 20)).to.be.true
        });
    });

    describe('Getting rewards after all rewards distributed', function () {
        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(100));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('No rewards for anyone', async function () {
            bal = await incentiveControllerContract.trAEarned(0, user1, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(0, user2, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(0, user3, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(0, user4, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")

            bal = await incentiveControllerContract.trBEarned(0, user1, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(0, user2, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(0, user3, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(0, user4, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")

            bal = await incentiveControllerContract.trAEarned(1, user1, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(1, user2, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(1, user3, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trAEarned(1, user4, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")

            bal = await incentiveControllerContract.trBEarned(1, user1, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(1, user2, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(1, user3, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")
            bal = await incentiveControllerContract.trBEarned(1, user4, distCount)
            expect(web3.utils.fromWei(bal.toString())).to.be.equal("0")

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Rewards reamining in contract: " + web3.utils.fromWei(bal.toString()))
            expect(approxeq(Number(web3.utils.fromWei(bal.toString())), 20)).to.be.true
        });
    });

    describe('Getting normalized prices from chainlink mockups', function () {
        it('call one shot function and read values', async function () {
            res = await priceHelperContract.getLatestChainlinkPairInfo(0);
            console.log(res[0]+ ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            res = await priceHelperContract.getLatestChainlinkPairInfo(1);
            console.log(res[0]+ ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            await incentiveControllerContract.setUnderlyingPriceFromChainlinkAllMarkets();
            res = await incentiveControllerContract.availableMarketsRewards(0);
            console.log(res[0].toString())
            res = await incentiveControllerContract.availableMarketsRewards(1);
            console.log(res[0].toString())

            res = await priceHelperContract.reciprocal(res[0])
            console.log(res.toString())
        });

        it('and now something unnecessary, just to have a greater test coverage', async function () {
            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("300"), {from: owner})
            await incentiveControllerContract.updateRewardsSingleMarket(0, web3.utils.toWei("300"), 86400, {from: owner}) 
            await incentiveControllerContract.enableAllMarket([false, false], {from: owner})
            await incentiveControllerContract.enableSingleMarket(0, true, {from: owner})
            await incentiveControllerContract.enableSingleMarket(1, true, {from: owner})
            await incentiveControllerContract.setRewardTokenAddress(rewardTokenContract.address, {from: owner})
            await incentiveControllerContract.setMarketHelperAddress(priceHelperContract.address, {from: owner})
            // await incentiveControllerContract.setRewardsFrequencyAllMarkets([86400, 86400], {from: owner})
            // await incentiveControllerContract.setRewardsFrequencySingleMarket(0, 86400, {from: owner})
            await incentiveControllerContract.setRewardsPercentageAllMarkets([web3.utils.toWei("0.5"), web3.utils.toWei("0.5")], {from: owner})
            await incentiveControllerContract.setRewardsPercentageSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await incentiveControllerContract.setExtProtocolPercentAllMarkets([web3.utils.toWei("0.03"), web3.utils.toWei("0.0255")], {from: owner})
            await incentiveControllerContract.setExtProtocolPercentSingleMarket(0, web3.utils.toWei("0.033"), {from: owner})
            await incentiveControllerContract.setBalanceFactorAllMarkets([web3.utils.toWei("0.6"), web3.utils.toWei("0.65")], {from: owner})
            await incentiveControllerContract.setBalanceFactorSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await incentiveControllerContract.setUnderlyingPriceManuallyAllMarkets([web3.utils.toWei("1.02"), web3.utils.toWei("1.01")], {from: owner})
            await incentiveControllerContract.setUnderlyingPriceManuallySingleMarket(0, web3.utils.toWei("1.01111"), {from: owner})
            await incentiveControllerContract.setUnderlyingDecimalsAllMarkets([6, 18], {from: owner})
            await incentiveControllerContract.setUnderlyingDecimalsSingleMarket(0, 18, {from: owner})
            await incentiveControllerContract.emergencyTokenTransfer(rewardTokenContract.address, user1, 0, {from: owner})
            await incentiveControllerContract.setUnderlyingPriceFromChainlinkSingleMarket(0, {from: owner})
            await incentiveControllerContract.setUnderlyingPriceFromChainlinkAllMarkets({from: owner})
        });
    });
});