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
let distCount;

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
    // calc percentage
    // trAAPY = trARPB * 2102400 / trAPrice
    // trARPB = trAAPY * trAPrice / 2102400

    Compound price: 21409027297510851 (trAPrice)
    TrARPB: 305494111 (3%)
            407325481 (4%)
            509156852 (5%)
            203662741 (2%)
            101831370 (1%)
    */
    const MY_TRANCHE_A_RPB = new BN("541286150");
    const MY_EXT_PROT_RET0 = new BN("125300000000000000"); //12,53%
    const MY_EXT_PROT_RET1 = new BN("30000000000000000"); //3%
    const MY_BAL_FACTOR = new BN("500000000000000000"); //50%
    const MY_MARKET_PERCENTAGE = new BN("1000000000000000000"); //100%
    const MY_TRANCHE_A_PRICE_NUM0 = Number(web3.utils.fromWei("28450000000000000", "ether"))
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

    describe('settings', function () {
        let res1, res2, res3, res4;

        it('set some user tokens and tranche in rewards distribution contract', async function () {
            let block = await web3.eth.getBlockNumber();
            now = (await web3.eth.getBlock(block)).timestamp

            await incentiveControllerContract.trancheANewEnter(user1, trAFDTContract0.address)
            await trAFDTContract0.mint(user1, ether("10000"));
            await protocolContract.setTrAStakingDetails(user1, 0, now, ether("10000"), 1)
            expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("1")
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user1))
            expect(bal).to.be.equal("10000")

            await incentiveControllerContract.trancheBNewEnter(user1, trBFDTContract0.address)
            await trBFDTContract0.mint(user1, ether("500"));
            await protocolContract.setTrBStakingDetails(user1, 0, now, ether("500"), 1)
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user1))
            expect(bal).to.be.equal("500")

            totASupply = await trAFDTContract0.totalSupply();
            // trAPrice = await protocolContract.getTrancheAExchangeRate(0);
            // console.log(totASupply, trAPrice);
            // console.log(web3.utils.fromWei(totASupply))
            trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
            // console.log(trAVal.toString())
            // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
            await protocolContract.setTrAValue(0, ether(trAVal.toString()));
            await protocolContract.setTrBValue(0, ether('500'));
            await protocolContract.setTotalValue(0);
            trATVL = await protocolContract.getTrAValue(0);
            trBTVL = await protocolContract.getTrBValue(0);
            totTrTVL = await protocolContract.getTotalValue(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET0, /*1000,*/ MKT1_DECS, 1000000, chainlink1Contract.address, false, {
                    from: owner
                });

            res = await incentiveControllerContract.getATrancheMarket(0);
            expect(res.toString()).to.be.equal(trAFDTContract0.address.toString())
            res = await incentiveControllerContract.getBTrancheMarket(0);
            expect(res.toString()).to.be.equal(trBFDTContract0.address.toString())

            console.log("Total TVL: " + (web3.utils.fromWei(await incentiveControllerContract.getAllMarketsTVL()).toString()))

            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            await incentiveControllerContract.refreshSliceSpeeds();

            mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
            console.log("Market0: " + mkt0Share * 100 + " %")

            count = await incentiveControllerContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            res = await incentiveControllerContract.getMarketRewardsPercentage();
            console.log(approxeq(Number(web3.utils.fromWei(res.toString()), 1))); // true
            // expect(approxeq(Number(web3.utils.fromWei(res.toString())), 1)).to.be.true
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
        });
    });

    describe('Distributing rewards', function () {
        it('distribute rewards mkt0 tranche A & B', async function () {
            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            console.log("mkt0 A: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            console.log("mkt0 B: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 3600, {
                from: owner
            })

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            expect(web3.utils.fromWei(res.toString())).to.be.equal("25")

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]));
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));
            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", rewards dur.: " + res[4]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", rewards dur.: " + res[4]);
            mkt0trBRRate = res[1]

            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.lte(25)
            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.gt(24)
            // expect(web3.utils.fromWei(totRewards.toString())).to.be.equal("1000")
        });
    });

    describe('other Users enters', function () {
        it('user2 enters after a while in market 0', async function () {
            // total 52,492.1 token to have 1493.4 dollar in tranche A
            const maturity = Number(time.duration.seconds(300));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            now = (await web3.eth.getBlock(block)).timestamp
            console.log((await web3.eth.getBlock(block)).timestamp)

            await incentiveControllerContract.trancheANewEnter(user2, trAFDTContract0.address)
            await trAFDTContract0.mint(user2, ether("20000"));
            await protocolContract.setTrAStakingDetails(user2, 0, now, ether("20000"), 1)
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user2))
            expect(bal).to.be.equal("20000")
            
            await incentiveControllerContract.trancheBNewEnter(user2, trBFDTContract0.address)
            await trBFDTContract0.mint(user2, ether("500"));
            await protocolContract.setTrBStakingDetails(user2, 0, now, ether("500"), 1)
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user2))
            expect(bal).to.be.equal("500")

            totASupply = await trAFDTContract0.totalSupply();
            // console.log(web3.utils.fromWei(totASupply))
            trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
            // console.log(trAVal.toString())
            // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
            await protocolContract.setTrAValue(0, ether(trAVal.toString()));
            await protocolContract.setTrBValue(0, ether('1000'));
            await protocolContract.setTotalValue(0);
            trATVL = await protocolContract.getTrAValue(0);
            trBTVL = await protocolContract.getTrBValue(0);
            totTrTVL = await protocolContract.getTotalValue(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
        });

        it('user3 enters after a while in market 0', async function () {
            // total 52,492.1 token to have 1493.4 dollar in tranche A
            const maturity = Number(time.duration.seconds(300));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            now = (await web3.eth.getBlock(block)).timestamp
            console.log((await web3.eth.getBlock(block)).timestamp)

            await incentiveControllerContract.trancheANewEnter(user3, trAFDTContract0.address)
            await trAFDTContract0.mint(user3, ether("10000"));
            await protocolContract.setTrAStakingDetails(user3, 0, now, ether("10000"), 1)
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user3))
            expect(bal).to.be.equal("10000")

            await incentiveControllerContract.trancheBNewEnter(user3, trBFDTContract0.address)
            await trBFDTContract0.mint(user3, ether("1000"));
            await protocolContract.setTrBStakingDetails(user3, 0, now, ether("1000"), 1)
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user3))
            expect(bal).to.be.equal("1000")

            totASupply = await trAFDTContract0.totalSupply();
            // console.log(web3.utils.fromWei(totASupply))
            trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
            // console.log(trAVal.toString())
            // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
            await protocolContract.setTrAValue(0, ether(trAVal.toString()));
            await protocolContract.setTrBValue(0, ether('2000'));
            await protocolContract.setTotalValue(0);
            trATVL = await protocolContract.getTrAValue(0);
            trBTVL = await protocolContract.getTrBValue(0);
            totTrTVL = await protocolContract.getTotalValue(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
        });

        it('user4 enters after a while in market 0', async function () {
            // total 52,492.1 token to have 1493.4 dollar in tranche A
            const maturity = Number(time.duration.seconds(300));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            now = (await web3.eth.getBlock(block)).timestamp
            console.log((await web3.eth.getBlock(block)).timestamp)

            await incentiveControllerContract.trancheANewEnter(user4, trAFDTContract0.address)
            await trAFDTContract0.mint(user4, ether("12492.1"));
            await protocolContract.setTrAStakingDetails(user4, 0, now, ether("12492.1"), 1)
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user4))
            expect(bal).to.be.equal("12492.1")

            await incentiveControllerContract.trancheBNewEnter(user4, trBFDTContract0.address)
            await trBFDTContract0.mint(user4, ether("448"));
            await protocolContract.setTrBStakingDetails(user4, 0, now, ether("448"), 1)
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user4))
            expect(bal).to.be.equal("448")

            totASupply = await trAFDTContract0.totalSupply();
            // console.log(web3.utils.fromWei(totASupply))
            trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
            // console.log(trAVal.toString())
            // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
            await protocolContract.setTrAValue(0, ether(trAVal.toString()));
            await protocolContract.setTrBValue(0, ether('2448'));
            await protocolContract.setTotalValue(0);
            trATVL = await protocolContract.getTrAValue(0);
            trBTVL = await protocolContract.getTrBValue(0);
            totTrTVL = await protocolContract.getTotalValue(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
        });
    });

    describe('Getting rewards after some time', function () {

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(360));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user1, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user2, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user3, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user4, distCount)).toString())
            
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

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            console.log("mkt0 A: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            console.log("mkt0 B: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[3]);
        });

        it('user2 and user4 claim all their rewards', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets(user2, {
                from: user2
            })
            // await incentiveControllerContract.claimRewardSingleMarketTrA(0, {from: user2})
            // bal = await rewardTokenContract.balanceOf(user2)
            // console.log("User2 rewards: " + web3.utils.fromWei(bal.toString()))
            // await incentiveControllerContract.claimRewardSingleMarketTrB(0, {from: user2})
            // bal = await rewardTokenContract.balanceOf(user2)
            // console.log("User2 rewards: " + web3.utils.fromWei(bal.toString()))
            // await incentiveControllerContract.claimRewardSingleMarketTrA(1, {from: user2})
            // bal = await rewardTokenContract.balanceOf(user2)
            // console.log("User2 rewards: " + web3.utils.fromWei(bal.toString()))
            // await incentiveControllerContract.claimRewardSingleMarketTrB(1, {from: user2})
            bal = await rewardTokenContract.balanceOf(user2)
            console.log("User2 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user2, distCount)).toString()).to.be.equal("0")

            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user2)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user2)).toString())

            await incentiveControllerContract.claimRewardsAllMarkets(user4, {
                from: user4
            })
            bal = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user4, distCount)).toString()).to.be.equal("0")

            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user4)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user4)).toString())
        });
    });

    describe('Getting rewards after some time', function () {

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(360));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('User3 claim rewards and withdraws tranche tokens', async function () {
            // total 52,492.1 token to have 1493.4 dollar in tranche A
            const maturity = Number(time.duration.seconds(1000));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            now = (await web3.eth.getBlock(block)).timestamp
            console.log((await web3.eth.getBlock(block)).timestamp)

            await incentiveControllerContract.claimRewardsAllMarkets(user3, {
                from: user3
            })

            bal = await rewardTokenContract.balanceOf(user3)
            console.log("User3 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user3, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user3, distCount)).toString()).to.be.equal("0")

            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user3)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user3)).toString())
 
            await trAFDTContract0.burn(ether("10000"), {from: user3});
            await protocolContract.setTrAStakingDetails(user3, 0, now, 0, 1)
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user3))
            expect(bal).to.be.equal("0")

            await trBFDTContract0.burn(ether("1000"), {from: user3});
            await protocolContract.setTrBStakingDetails(user3, 0, now, 0, 1)
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user3))
            expect(bal).to.be.equal("0")

            totASupply = await trAFDTContract0.totalSupply();
            // console.log(web3.utils.fromWei(totASupply))
            trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM0 / Math.pow(10, 18);
            // console.log(trAVal.toString())
            // console.log(totASupply * MY_TRANCHE_A_PRICE_NUM)
            await protocolContract.setTrAValue(0, ether(trAVal.toString()));
            await protocolContract.setTrBValue(0, ether('1448'));
            await protocolContract.setTotalValue(0);
            trATVL = await protocolContract.getTrAValue(0);
            trBTVL = await protocolContract.getTrBValue(0);
            totTrTVL = await protocolContract.getTotalValue(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]));
        });

    });

    describe('Getting rewards at the end of duration', function () {
        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(3600));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[3] + ", B rewards: " + res[4]);// + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())

            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user1, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user2, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user3, distCount)).toString())
            // console.log((await incentiveControllerContract.calcDurationRewardsPercentageTrA(0, user4, distCount)).toString())

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
        });

        it('all users claim all their rewards', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets(user1, {
                from: user1
            })
            bal1 = await rewardTokenContract.balanceOf(user1)
            console.log("User1 rewards: " + web3.utils.fromWei(bal1.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user1, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user1, distCount)).toString()).to.be.equal("0")
            
            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user1)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user1)).toString())

            await incentiveControllerContract.claimRewardsAllMarkets(user2, {
                from: user2
            })
            bal2 = await rewardTokenContract.balanceOf(user2)
            console.log("User2 rewards: " + web3.utils.fromWei(bal2.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user2, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user2, distCount)).toString()).to.be.equal("0")
            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user2)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user2)).toString())

            await incentiveControllerContract.claimRewardsAllMarkets(user3, {
                from: user3
            })
            bal3 = await rewardTokenContract.balanceOf(user3)
            console.log("User3 rewards: " + web3.utils.fromWei(bal3.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user3, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user3, distCount)).toString()).to.be.equal("0")
            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user3)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user3)).toString())

            await incentiveControllerContract.claimRewardsAllMarkets(user4, {
                from: user4
            })
            bal4 = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal4.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user4, distCount)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user4, distCount)).toString()).to.be.equal("0")
            console.log((await incentiveControllerContract.userRewardPerTokenTrAPaid(0, distCount, user4)).toString())
            console.log((await incentiveControllerContract.userRewardPerTokenTrBPaid(0, distCount, user4)).toString())

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log(web3.utils.fromWei(bal.toString()))
            // expect(approxeq(Number(web3.utils.fromWei(bal.toString())), 0)).to.be.true
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

        it('No rewards earned for anyone', async function () {
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
        });

        it('Claiming rewards after duration elapsed', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets(user1, {
                from: user1
            })
            bal1 = await rewardTokenContract.balanceOf(user1)
            console.log("User1 rewards: " + web3.utils.fromWei(bal1.toString()))

            await incentiveControllerContract.claimRewardsAllMarkets(user2, {
                from: user2
            })
            bal2 = await rewardTokenContract.balanceOf(user2)
            console.log("User2 rewards: " + web3.utils.fromWei(bal2.toString()))

            await incentiveControllerContract.claimRewardsAllMarkets(user3, {
                from: user3
            })
            bal3 = await rewardTokenContract.balanceOf(user3)
            console.log("User3 rewards: " + web3.utils.fromWei(bal3.toString()))

            await incentiveControllerContract.claimRewardsAllMarkets(user4, {
                from: user4
            })
            bal4 = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal4.toString()))

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log(web3.utils.fromWei(bal.toString()))
        });
    });

});