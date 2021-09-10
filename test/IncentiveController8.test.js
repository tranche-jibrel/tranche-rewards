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
let distCount

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
        let res1, res2;

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
            expect((await protocolContract.getSingleTrancheUserStakeCounterTrB(user1, 0)).toString()).to.be.equal("1")
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user1))
            expect(bal).to.be.equal("500")
            
            totASupply = await trAFDTContract0.totalSupply();
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
        });

        it('set some other user tokens and tranche in rewards distribution contract', async function () {
            let block = await web3.eth.getBlockNumber();
            now = (await web3.eth.getBlock(block)).timestamp

            await incentiveControllerContract.trancheANewEnter(user1, trAFDTContract0.address)
            await trAFDTContract0.mint(user1, ether("10000"));
            await protocolContract.setTrAStakingDetails(user1, 0, now, ether("10000"), 2)
            expect((await protocolContract.getSingleTrancheUserStakeCounterTrA(user1, 0)).toString()).to.be.equal("2")
            bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user1))
            expect(bal).to.be.equal("20000")

            await incentiveControllerContract.trancheBNewEnter(user1, trBFDTContract0.address)
            await trBFDTContract0.mint(user1, ether("500"));
            await protocolContract.setTrBStakingDetails(user1, 0, now, ether("500"), 2)
            expect((await protocolContract.getSingleTrancheUserStakeCounterTrB(user1, 0)).toString()).to.be.equal("2")
            bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user1))
            expect(bal).to.be.equal("1000")
            
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

    describe('Distributing rewards #1', function () {
        it('distribute rewards mkt0 tranche A & B (1)', async function () {    
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

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            expect(web3.utils.fromWei(res.toString())).to.be.equal("25")

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
   
    describe('Getting rewards at the end of duration', function () {
        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(3650));
            let block = await web3.eth.getBlockNumber();
            // console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            // console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[3] + ", B rewards: " + res[4]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())

            ret = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            console.log("Hist. Rew. mkt0 TrA: " + web3.utils.fromWei(ret.toString()))
            ret = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("Hist. Rew. mkt0 TrB: " + web3.utils.fromWei(ret.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))

            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            // console.log(web3.utils.fromWei(bal.toString()))
            totBal = balanceA1.add(balanceB1)
            expect(approxeq(web3.utils.fromWei(totBal.toString()), web3.utils.fromWei(bal.toString()))).to.be.true
        });

    });

    describe('Distribution #2', function () {
        it ("Adding rewards for another duration (2)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1100));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('Check Historical Rewards for users', async function () { 
            ret = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            console.log("Hist. Rew. mkt0 TrA: " + web3.utils.fromWei(ret.toString()))
            ret = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("Hist. Rew. mkt0 TrB: " + web3.utils.fromWei(ret.toString()))
           
            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))

            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });
    });

    describe('distribution #3', function() {
        it ("Adding rewards for another duration (3)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1100));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('distribution #4', function() {
        it ("Adding rewards for another duration (4)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1500));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('distribution #5', function() {
        it ("Adding rewards for another duration (5)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1500));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('distribution #6', function() {
        it ("Adding rewards for another duration (6)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1500));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('distribution #7', function() {
        it ("Adding rewards for another duration (7)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1500));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('distribution #8', function() {
        it ("Adding rewards for another duration (8)", async function () {
            res1 = await incentiveControllerContract.availableMarkets(0)
            res2 = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT1_DECS)).toString()))
            
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT1_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("25"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("25"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.availableMarketsRewards(0);
            distCount = res[5];
            console.log("distr counter: " + distCount.toString())

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            console.log("Contract rewards balance: " + web3.utils.fromWei(res.toString()))
            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + web3.utils.fromWei(res[3]) + ", B rewards: " + web3.utils.fromWei(res[4]) + ", rewards dur.: " + res[5]);
            mkt0trARewards = new BN(res[3].toString())
            mkt0trBRewards = new BN(res[4].toString())
            totRewards = new BN(res[3].toString()).add(new BN(res[4].toString()));

            res = await incentiveControllerContract.trancheARewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trARRate = res[1]
            res = await incentiveControllerContract.trancheBRewardsInfo(0, distCount)
            // expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + web3.utils.fromWei(res[1]) + ", rewardPerTokenStored: " + web3.utils.fromWei(res[3]) + ", PeriodFinish: " + res[0]);
            mkt0trBRRate = res[1]

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(1500));
            let block = await web3.eth.getBlockNumber();

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
        });

        it('check old rewards distributions rewards', async function () {
            rewA1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrA(0, user1)
            rewB1 = await incentiveControllerContract.getHistoricalUnclaimedRewardsAmountTrB(0, user1)
            console.log("unclaimed hist rewards user1 trA: " + web3.utils.fromWei(rewA1.toString()))
            console.log("unclaimed hist rewards user1 trB: " + web3.utils.fromWei(rewB1.toString()))

            balanceA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            balanceB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
        });

    });

    describe('claiming the rewards for anyone', function() {
        it('Claiming rewards after duration elapsed', async function () {
            const maturity = Number(time.duration.seconds(1100));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)

            await incentiveControllerContract.claimRewardsAllMarkets(user1, {
                from: user1
            })
            bal1 = await rewardTokenContract.balanceOf(user1)
            console.log("User1 rewards: " + web3.utils.fromWei(bal1.toString()))
        });

        it('Unclaimed Rewards for anyone', async function () {
            console.log("Dist Count: " + distCount)

            balA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            console.log("user1 rewards trA: " + web3.utils.fromWei(balA1.toString()))

            balB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });
    })

    describe('reclaiming the rewards again for anyone', function() {
        it('Claiming rewards after duration elapsed', async function () {
            const maturity = Number(time.duration.seconds(100));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)

            bal1 = await rewardTokenContract.balanceOf(user1)
            console.log("User1 rewards already collected: " + web3.utils.fromWei(bal1.toString()))

            await incentiveControllerContract.claimRewardsAllMarkets(user1, {
                from: user1
            })
            bal2 = await rewardTokenContract.balanceOf(user1)
            console.log("New User1 rewards already collected: " + web3.utils.fromWei(bal2.toString()))
            expect(bal1.toString()).to.be.equal(bal2.toString())
        });

        it('Unclaimed Rewards for anyone', async function () {
            console.log("Dist Count: " + distCount)

            balA1 = await incentiveControllerContract.trAEarned(0, user1, distCount)
            // console.log("user1 rewards trA: " + web3.utils.fromWei(balA1.toString()))
            expect(balA1.toString()).to.be.equal("0")
            balB1 = await incentiveControllerContract.trBEarned(0, user1, distCount)
            expect(balB1.toString()).to.be.equal("0")

            bal = await rewardTokenContract.balanceOf(incentiveControllerContract.address)
            console.log("Incentive rew bal: " + web3.utils.fromWei(bal.toString()))
        });
    })

    describe('higher percentage for test coverage', function() {
        it('and now something unnecessary, just to have a greater test coverage', async function () {
            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("300"), {from: owner})
            await incentiveControllerContract.updateRewardsSingleMarket(0, web3.utils.toWei("300"), 86400, {from: owner}) 
            await incentiveControllerContract.enableAllMarket([false], {from: owner})
            await incentiveControllerContract.enableSingleMarket(0, true, {from: owner})
            await incentiveControllerContract.setRewardTokenAddress(rewardTokenContract.address, {from: owner})
            await incentiveControllerContract.setMarketHelperAddress(priceHelperContract.address, {from: owner})
            await incentiveControllerContract.setRewardsPercentageAllMarkets([web3.utils.toWei("0.5")], {from: owner})
            await incentiveControllerContract.setRewardsPercentageSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await incentiveControllerContract.setExtProtocolPercentAllMarkets([web3.utils.toWei("0.03")], {from: owner})
            await incentiveControllerContract.setExtProtocolPercentSingleMarket(0, web3.utils.toWei("0.033"), {from: owner})
            await incentiveControllerContract.setBalanceFactorAllMarkets([web3.utils.toWei("0.6")], {from: owner})
            await incentiveControllerContract.setBalanceFactorSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await incentiveControllerContract.setUnderlyingPriceManuallyAllMarkets([web3.utils.toWei("1.02")], {from: owner})
            await incentiveControllerContract.setUnderlyingPriceManuallySingleMarket(0, web3.utils.toWei("1.01111"), {from: owner})
            await incentiveControllerContract.setUnderlyingDecimalsAllMarkets([18], {from: owner})
            await incentiveControllerContract.setUnderlyingDecimalsSingleMarket(0, 18, {from: owner})
            await incentiveControllerContract.emergencyTokenTransfer(rewardTokenContract.address, user1, 0, {from: owner})
            await incentiveControllerContract.setUnderlyingPriceFromChainlinkSingleMarket(0, {from: owner})
            await incentiveControllerContract.setUnderlyingPriceFromChainlinkAllMarkets({from: owner})
        });
    })
});