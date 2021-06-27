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

var MarketHelper = artifacts.require("./MarketHelper.sol");
var IncentivesController = artifacts.require("./IncentivesController.sol");

let protocolContract, trA0, trB0, trA1, trB1, rewardTokenContract, trAMarket, trBMarket;
let mkt0trARewards, mkt0trBRewards, mkt1trARewards, mkt1trBRewards;
let mkt0trARRate, mkt0trBRRate, mkt1trARRate, mkt1trBRRate;
let owner, user1, user2, user3, user4;

contract('Incentive Controller', function (accounts) {
    // const gasPrice = new BN('1');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

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
    const MY_TRANCHE_PERCENTAGE = new BN("1000000000000000000"); //100%
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
        await trAFDTContract0.mint(user1, ether("10000"));
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user1))
        expect(bal).to.be.equal("10000")
        await trAFDTContract0.mint(user2, ether("20000"));
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user2))
        expect(bal).to.be.equal("20000")
        await trAFDTContract0.mint(user3, ether("30000"));
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user3))
        expect(bal).to.be.equal("30000")
        await trAFDTContract0.mint(user4, ether("40000"));
        bal = web3.utils.fromWei(await trAFDTContract0.balanceOf(user4))
        expect(bal).to.be.equal("40000")

        await trBFDTContract0.mint(user1, ether("1000"));
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user1))
        expect(bal).to.be.equal("1000")
        await trBFDTContract0.mint(user2, ether("2000"));
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user2))
        expect(bal).to.be.equal("2000")
        await trBFDTContract0.mint(user3, ether("3000"));
        bal = web3.utils.fromWei(await trBFDTContract0.balanceOf(user3))
        expect(bal).to.be.equal("3000")
        await trBFDTContract0.mint(user4, ether("4000"));
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
        await trAFDTContract1.mint(user1, ether("1000"));
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user1))
        expect(bal).to.be.equal("1000")
        await trAFDTContract1.mint(user2, ether("2000"));
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user2))
        expect(bal).to.be.equal("2000")
        await trAFDTContract1.mint(user3, ether("3000"));
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user3))
        expect(bal).to.be.equal("3000")
        await trAFDTContract1.mint(user4, ether("4000"));
        bal = web3.utils.fromWei(await trAFDTContract1.balanceOf(user4))
        expect(bal).to.be.equal("4000")

        await trBFDTContract1.mint(user1, ether("1000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user1))
        expect(bal).to.be.equal("1000")
        await trBFDTContract1.mint(user2, ether("2000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user2))
        expect(bal).to.be.equal("2000")
        await trBFDTContract1.mint(user3, ether("3000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user3))
        expect(bal).to.be.equal("3000")
        await trBFDTContract1.mint(user4, ether("4000"));
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

    describe('settings', function () {
        let res1, res2, res3, res4;
        it('set tranche in rewards distribution contract', async function () {
            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE,
                MY_EXT_PROT_RET, 7, web3.utils.toWei("1"), /*web3.utils.toWei("1"), 1,*/ {
                    from: owner
                });

            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 1, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE,
                MY_EXT_PROT_RET, 7, web3.utils.toWei("1"), /*web3.utils.toWei("1"), 1,*/ {
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
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[5], res2[0])).toString()))
            res3 = await incentiveControllerContract.availableMarkets(1)
            res4 = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("Total TVL in Market1: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res3[0], res3[5], res4[0])).toString()))

            await incentiveControllerContract.refreshSliceSpeeds();

            mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
            mkt1Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(1))
            console.log("Market0: " + mkt0Share * 100 + " %, Market1: " + mkt1Share * 100 + " %")

            count = await incentiveControllerContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[5], res2[0]);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[5], res2[0]);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[5], res2[0]);
            paramTr = await incentiveControllerContract.availableMarketsRewards(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");

            trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[5], res4[0]);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[5], res4[0]);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[5], res4[0]);
            paramTr = await incentiveControllerContract.availableMarketsRewards(1);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");

            res = await incentiveControllerContract.getMarketRewardsPercentage();
            console.log(approxeq(Number(web3.utils.fromWei(res.toString()), 1))); // true
            expect(approxeq(Number(web3.utils.fromWei(res.toString())), 1)).to.be.true
        });

        it('read values and distribute rewards to tranches', async function () {
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[5]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[5], res2[0], res1[7]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[5], res2[0], res1[7], res1[6]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[5]);
            console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[5], res4[0], res3[7]);
            console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[5], res4[0], res3[7], res3[6]);
            console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });

    describe('Distributing rewards', function () {
        it('distribute rewards mkt0 and mkt1, tranche A & B', async function () {
            res = await incentiveControllerContract.trancheARewardsInfo(0)
            console.log("mkt0 A: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            res = await incentiveControllerContract.trancheBRewardsInfo(0)
            console.log("mkt0 B: periodFinish: " + res[0] + ", rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("100"), {
                from: owner
            })
            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("100"), 1000, {
                from: owner
            })

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            expect(web3.utils.fromWei(res.toString())).to.be.equal("100")

            res = await incentiveControllerContract.availableMarketsRewards(0)
            console.log("mkt0: A rewards: " + res[2] + ", B rewards: " + res[3] + ", rewards dur.: " + res[4]);
            mkt0trARewards = new BN(res[2].toString())
            mkt0trBRewards = new BN(res[3].toString())
            totRewards = new BN(res[2].toString()).add(new BN(res[3].toString()));
            res = await incentiveControllerContract.trancheARewardsInfo(0)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt0trARRate = res[1]
            console.log(web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheA(0)).toString())
            // expect(Number(res[1])).to.be.equal(mkt0trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(0)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt0trBRRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt0trBRewards / 1000)

            res = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("mkt1: A rewards: " + res[2] + ", B rewards: " + res[3] + ", rewards dur.: " + res[4]);
            mkt1trARewards = new BN(res[2].toString())
            mkt1trBRewards = new BN(res[3].toString())
            totRewards = totRewards.add(new BN(res[2].toString())).add(new BN(res[3].toString()));
            res = await incentiveControllerContract.trancheARewardsInfo(1)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trARewards.divn(1000).toString())))
            console.log("mkt1 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt1trARRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt1trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(1)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trBRewards.divn(1000).toString())))
            console.log("mkt1 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt1trBRRate = res[1]
            // expect(Number(res[1])).to.be.lte(mkt1trBRewards / 1000)

            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.lte(100)
            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.gt(99)
            // expect(web3.utils.fromWei(totRewards.toString())).to.be.equal("1000")
        });
    });

    describe('Getting rewards from Staking Contracts', function () {

        it('time passes...', async function () {
            const maturity = Number(time.duration.seconds(100));
            let block = await web3.eth.getBlockNumber();
            console.log((await web3.eth.getBlock(block)).timestamp)

            await timeMachine.advanceTimeAndBlock(maturity);

            block = await web3.eth.getBlockNumber()
            console.log((await web3.eth.getBlock(block)).timestamp)
        });

        it('Read values', async function () {
            balanceA1 = await incentiveControllerContract.trAEarned(0, user1)
            balanceA2 = await incentiveControllerContract.trAEarned(0, user2)
            balanceA3 = await incentiveControllerContract.trAEarned(0, user3)
            balanceA4 = await incentiveControllerContract.trAEarned(0, user4)
            console.log("User1 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt0 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal0trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal0trA.toString() + " around " + mkt0trARewards.divn(10).toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt0trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(0, user1)
            balanceB2 = await incentiveControllerContract.trBEarned(0, user2)
            balanceB3 = await incentiveControllerContract.trBEarned(0, user3)
            balanceB4 = await incentiveControllerContract.trBEarned(0, user4)
            console.log("User1 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt0 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal0trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal0trB.toString() + " around " + mkt0trBRewards.divn(10).toString())
            expect(approxeq(web3.utils.fromWei(bal0trB.toString()), web3.utils.fromWei(mkt0trBRewards.divn(10).toString()))).to.be.true
            // expect(web3.utils.fromWei(bal0trB.toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(10).toString())))

            balanceA1 = await incentiveControllerContract.trAEarned(1, user1)
            balanceA2 = await incentiveControllerContract.trAEarned(1, user2)
            balanceA3 = await incentiveControllerContract.trAEarned(1, user3)
            balanceA4 = await incentiveControllerContract.trAEarned(1, user4)
            console.log("User1 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards mkt1 TrA: " + web3.utils.fromWei(balanceA4.toString()))
            bal1trA = new BN(balanceA1.toString()).add(new BN(balanceA2.toString())).add(new BN(balanceA3.toString())).add(new BN(balanceA4.toString()));
            console.log(bal1trA.toString() + " around " + mkt1trARewards.divn(10).toString())
            // expect(web3.utils.fromWei(bal0trA.toString())).to.be.equal((web3.utils.fromWei((mkt1trARewards.divn(10).toString()))))

            balanceB1 = await incentiveControllerContract.trBEarned(1, user1)
            balanceB2 = await incentiveControllerContract.trBEarned(1, user2)
            balanceB3 = await incentiveControllerContract.trBEarned(1, user3)
            balanceB4 = await incentiveControllerContract.trBEarned(1, user4)
            console.log("User1 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards mkt1 TrB: " + web3.utils.fromWei(balanceB4.toString()))
            bal1trB = new BN(balanceB1.toString()).add(new BN(balanceB2.toString())).add(new BN(balanceB3.toString())).add(new BN(balanceB4.toString()));
            console.log(bal1trB.toString() + " around " + mkt1trBRewards.divn(10).toString())
            totBal = bal0trA.add(bal0trB).add(bal1trA).add(bal1trB)
            console.log(web3.utils.fromWei(totBal.toString()) + " around 100")
            // expect(web3.utils.fromWei(totBal.toString())).to.be.equal("100")
        });

        it('user2 and user4 claim all their rewards', async function () {
            await incentiveControllerContract.claimRewardsAllMarkets({
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
            expect((await incentiveControllerContract.trAEarned(0, user2)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user2)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user2)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user2)).toString()).to.be.equal("0")

            await incentiveControllerContract.claimRewardsAllMarkets({
                from: user4
            })
            bal = await rewardTokenContract.balanceOf(user4)
            console.log("User4 rewards: " + web3.utils.fromWei(bal.toString()))
            expect((await incentiveControllerContract.trAEarned(0, user4)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(0, user4)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trAEarned(1, user4)).toString()).to.be.equal("0")
            expect((await incentiveControllerContract.trBEarned(1, user4)).toString()).to.be.equal("0")
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
            res = await incentiveControllerContract.trancheARewardsInfo(0)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trARewards.divn(1000).toString())))
            console.log("mkt0 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt0trARRate = res[1]
            console.log(web3.utils.fromWei(await incentiveControllerContract.getRewardsAPYSingleMarketTrancheA(0)).toString())
            // expect(Number(res[1])).to.be.equal(mkt0trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(0)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt0trBRewards.divn(1000).toString())))
            console.log("mkt0 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt0trBRRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt0trBRewards / 1000)

            res = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("mkt1: A rewards: " + res[2] + ", B rewards: " + res[3] + ", rewards dur.: " + res[4]);
            mkt1trARewards = new BN(res[2].toString())
            mkt1trBRewards = new BN(res[3].toString())
            totRewards = totRewards.add(new BN(res[2].toString())).add(new BN(res[3].toString()));
            res = await incentiveControllerContract.trancheARewardsInfo(1)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trARewards.divn(1000).toString())))
            console.log("mkt1 A rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt1trARRate = res[1]
            // expect(Number(res[1])).to.be.equal(mkt1trARewards / 1000)
            res = await incentiveControllerContract.trancheBRewardsInfo(1)
            expect(web3.utils.fromWei(res[1].toString())).to.be.equal(web3.utils.fromWei((mkt1trBRewards.divn(1000).toString())))
            console.log("mkt1 B rewardRate: " + res[1] + ", rewardPerTokenStored: " + res[2]);
            mkt1trBRRate = res[1]
            // expect(Number(res[1])).to.be.lte(mkt1trBRewards / 1000)

            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.lte(200)
            expect(Number(web3.utils.fromWei(totRewards.toString()))).to.be.gt(100)
        });
    });

});