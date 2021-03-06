const {
    BN,
    constants,
    ether,
    balance,
    expectEvent,
    expectRevert
} = require('@openzeppelin/test-helpers');
// const {
//     deployProxy,
//     upgradeProxy
// } = require('@openzeppelin/truffle-upgrades');
const {
    expect
} = require('chai');

const timeMachine = require('ganache-time-traveler');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAFDT = artifacts.require("./mocks/TrancheAToken.sol");
var TrancheBFDT = artifacts.require("./mocks/TrancheBToken.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");
var Chainlink1 = artifacts.require("./mocks/Chainlink1.sol");
var Chainlink2 = artifacts.require("./mocks/Chainlink2.sol");

var IncentiveRewardsFactory = artifacts.require("./IncentiveRewardsFactory.sol");
var IncentiveRewards = artifacts.require("./IncentiveRewards.sol");
var Markets = artifacts.require("./Markets.sol");
var MarketHelper = artifacts.require("./MarketHelper.sol");
var PriceHelper = artifacts.require("./PriceHelper.sol");

let protocolContract, trAFDTContract, trBFDTContract, rewardTokenContract, trAMarket, trBMarket;
let incentiveRewardsFactoryContract, marketsContract, stakingRewardsTrA, stakingRewardsTrB, priceHelperContract, chainlink1Contract, chainlink2Contract;
let owner, user1, user2, user3, user4;
let rst1, res2, res3, res4;

contract('Incentive Rewards', function (accounts) {
    const gasPrice = new BN('1');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const MKT1_DECS = 18;
    const MKT2_DECS = 18;

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
    const MY_TRANCHE_A_PRICE_NUM = Number(web3.utils.fromWei("21409027297510851", "ether"))

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

        chainlink1Contract = await Chainlink1.deployed();
        expect(chainlink1Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink1Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        chainlink2Contract = await Chainlink2.deployed();
        expect(chainlink2Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink2Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        priceHelperContract = await PriceHelper.deployed();
        expect(priceHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(priceHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);

        rewardTokenContract = await RewardToken.deployed();
        expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(rewardTokenContract.address);
        incentiveRewardsFactoryContract = await IncentiveRewardsFactory.deployed();
        expect(incentiveRewardsFactoryContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(incentiveRewardsFactoryContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(rewardsDistribContract.address);
        marketsContract = await Markets.deployed();
        expect(marketsContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(marketsContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        marketHelperContract = await MarketHelper.deployed();
        expect(marketHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(marketHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);
    });

    it('mint some tokens from tranche A and B', async function () {
        await trAFDTContract.mint(user1, ether("10000"));
        expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user1))).to.be.equal("10000")
        await trAFDTContract.mint(user2, ether("20000"));
        expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user2))).to.be.equal("20000")
        await trAFDTContract.mint(user3, ether("30000"));
        expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user3))).to.be.equal("30000")
        await trAFDTContract.mint(user4, ether("40000"));
        expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user4))).to.be.equal("40000")

        await trBFDTContract.mint(user1, ether("1000"));
        expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user1))).to.be.equal("1000")
        await trBFDTContract.mint(user2, ether("2000"));
        expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user2))).to.be.equal("2000")
        await trBFDTContract.mint(user3, ether("3000"));
        expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user3))).to.be.equal("3000")
        await trBFDTContract.mint(user4, ether("4000"));
        expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user4))).to.be.equal("4000")

        totASupply = await trAFDTContract.totalSupply();
        trAVal = totASupply * MY_TRANCHE_A_PRICE_NUM / Math.pow(10, 18);
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
        it('set tranche in Markets contract', async function () {
            await marketsContract.setRewardsFactory(incentiveRewardsFactoryContract.address);

            tx = await marketsContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE,
                MY_EXT_PROT_RET, 7, MKT1_DECS, web3.utils.toWei('1'), chainlink1Contract.address, false, {
                    from: owner
                });

            console.log("Total TVL: " + web3.utils.fromWei((await marketsContract.getAllMarketsTVL()).toString()))

            res1 = await marketsContract.availableMarkets(0)
            res2 = await marketsContract.availableMarketsRewards(0)
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[5], res2[0], MKT1_DECS)).toString()))
            // ret3 = await marketsContract.availableMarkets(1)
            // ret4 = await marketsContract.availableMarketsRewards(1)
            // console.log("Total TVL in Market1: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(ret3[0], ret3[5], ret4[0])).toString()))

            await marketsContract.refreshSliceSpeeds();

            count = await marketsContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[5], res2[0], MKT1_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[5], res2[0], MKT1_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[5], res2[0], MKT1_DECS);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
            mktShare = await marketsContract.getMarketSharePerTranche(0);
            console.log("Market Share tr 0: " + web3.utils.fromWei(mktShare) * 100 + " %");
        });

        it('read values from tranches', async function () {
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[5]);
            console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[5], res2[0], MKT1_DECS, res1[7]);
            console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[5], res2[0], MKT1_DECS, res1[7], res1[6]);
            console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });

    describe('deploy staking rewards contracts and staking tokens', function () {
        it('deploy Staking Contracts for A & B', async function () {
            // now = Date.now() / 1000 | 0;
            duration = 86400; // 1 giorno

            trAMarket = await marketsContract.getATrancheMarket(0)
            trBMarket = await marketsContract.getBTrancheMarket(0)

            await incentiveRewardsFactoryContract.deploy(0, true, trAMarket, ether("70"), duration, {from: owner});
            stkAddressA = await incentiveRewardsFactoryContract.stakingTokens(0);
            stakingAAddress = await marketsContract.getATrancheStaking(0)
            stakingRewardsTrA = await IncentiveRewards.at(stakingAAddress)
            expect(stkAddressA).to.be.equal(trAMarket)
            
            await incentiveRewardsFactoryContract.deploy(0, false, trBMarket, ether("100"), duration, {from: owner});
            stkAddressB = await incentiveRewardsFactoryContract.stakingTokens(1);
            stakingBAddress = await marketsContract.getBTrancheStaking(0)
            stakingRewardsTrB = await IncentiveRewards.at(stakingBAddress)
            expect(stkAddressB).to.be.equal(trBMarket)

            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
        });

        it('read amounts to split for A & B tranche', async function () {
            result = await marketsContract.availableMarketsRewards(0)
            console.log("TrA Rewards Percent: " + web3.utils.fromWei(result[2].toString()), 
                "%, TrA Rewards Percent: " + web3.utils.fromWei(result[3].toString()) + "%")

            await incentiveRewardsFactoryContract.getAmountsForMarkets(ether("100"))
            
            result = await marketsContract.availableMarketsRewards(0)
            console.log("TrA Rewards Percent: " + web3.utils.fromWei(result[2].toString()), 
                "%, TrA Rewards Percent: " + web3.utils.fromWei(result[3].toString()) + "%")
        });

        it('stake tranche tokens in Staking Contracts for A & B', async function () {
           
            await rewardTokenContract.transfer(incentiveRewardsFactoryContract.address, ether("1000"), {from: owner})
            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(incentiveRewardsFactoryContract.address))).to.be.equal("1000")
            await incentiveRewardsFactoryContract.notifyRewardAmounts()

            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            // expect((await stakingRewardsTrA.lastUpdateTime()).toString()).to.be.equal((Date.now() / 1000 | 0).toString())
            // expect((await stakingRewardsTrB.lastUpdateTime()).toString()).to.be.equal((Date.now() / 1000 | 0).toString())

            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(stakingRewardsTrA.address))).to.be.equal("70")
            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(stakingRewardsTrB.address))).to.be.equal("100")
        });
    });

    describe('Getting rewards from Staking Contracts', function () {

        it('time passes...', async function () {
            let block = await web3.eth.getBlockNumber();
            console.log("Actual Block: " + block);
            for (i = 0; i < 100; i++) {
                await timeMachine.advanceBlockAndSetTime()
            }
            console.log("New Actual Block: " + await web3.eth.getBlockNumber())
        });

        it('Read values in staking contracts', async function () {
            console.log("Reward per Token TrA: " + web3.utils.fromWei((await stakingRewardsTrA.rewardPerToken()).toString()))
            console.log("Reward per Token TrB: " + web3.utils.fromWei((await stakingRewardsTrB.rewardPerToken()).toString()))

            balanceA1 = await stakingRewardsTrA.earned(user1)
            balanceA2 = await stakingRewardsTrA.earned(user2)
            balanceA3 = await stakingRewardsTrA.earned(user3)
            balanceA4 = await stakingRewardsTrA.earned(user4)
            console.log("User1 Rewards TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards TrA: " + web3.utils.fromWei(balanceA4.toString()))

            balanceB1 = await stakingRewardsTrB.earned(user1)
            balanceB2 = await stakingRewardsTrB.earned(user2)
            balanceB3 = await stakingRewardsTrB.earned(user3)
            balanceB4 = await stakingRewardsTrB.earned(user4)
            console.log("User1 Rewards TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards TrB: " + web3.utils.fromWei(balanceB4.toString()))
        });

        it('Exit from staking contracts', async function () {
            await stakingRewardsTrA.getReward({from: user1})
            await stakingRewardsTrA.getReward({from: user2})
            await stakingRewardsTrA.getReward({from: user3})
            await stakingRewardsTrA.getReward({from: user4})
            console.log("User1 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user2)).toString()))
            console.log("User3 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user3)).toString()))
            console.log("User4 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user4)).toString()))
            console.log("User1 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))
            console.log("User3 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user3)).toString()))
            console.log("User4 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user4)).toString()))

            await stakingRewardsTrB.getReward({from: user1})
            await stakingRewardsTrB.getReward({from: user2})
            await stakingRewardsTrB.getReward({from: user3})
            await stakingRewardsTrB.getReward({from: user4})
            console.log("User1 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user2)).toString()))
            console.log("User3 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user3)).toString()))
            console.log("User4 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user4)).toString()))
            console.log("User1 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))
            console.log("User3 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user3)).toString()))
            console.log("User4 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user4)).toString()))

            expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(incentiveRewardsFactoryContract.address)).toString())).to.be.equal("830"); // 1000 - 70 - 100
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrA.address)).toString())).to.be.lt("70"); // 70 - something
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrB.address)).toString())).to.be.lt("100"); // 100 - something
            stkBalA = await rewardTokenContract.balanceOf(stakingRewardsTrA.address)
            console.log("Undistrib tokens from Staking Contract TrA: " + web3.utils.fromWei(stkBalA))
            stkBalB = await rewardTokenContract.balanceOf(stakingRewardsTrB.address)
            console.log("Undistrib tokens from Staking Contract TrB: " + web3.utils.fromWei(stkBalB))
        });

        it('call notify rewards amount again before period finish', async function () {
            await incentiveRewardsFactoryContract.notifyRewardAmounts()

            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
        });
    });

    describe('Getting other rewards from Staking Contracts', function () {

        it('time passes...', async function () {
            let block = await web3.eth.getBlockNumber();
            console.log("Actual Block: " + block);
            for (i = 0; i < 100; i++) {
                await timeMachine.advanceBlockAndSetTime()
            }
            console.log("New Actual Block: " + await web3.eth.getBlockNumber())
        });

        it('Read values in staking contracts', async function () {
            console.log("Reward per Token TrA: " + web3.utils.fromWei((await stakingRewardsTrA.rewardPerToken()).toString()))
            console.log("Reward per Token TrB: " + web3.utils.fromWei((await stakingRewardsTrB.rewardPerToken()).toString()))

            balanceA1 = await stakingRewardsTrA.earned(user1)
            balanceA2 = await stakingRewardsTrA.earned(user2)
            balanceA3 = await stakingRewardsTrA.earned(user3)
            balanceA4 = await stakingRewardsTrA.earned(user4)
            console.log("User1 Rewards TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards TrA: " + web3.utils.fromWei(balanceA2.toString()))
            console.log("User3 Rewards TrA: " + web3.utils.fromWei(balanceA3.toString()))
            console.log("User4 Rewards TrA: " + web3.utils.fromWei(balanceA4.toString()))

            balanceB1 = await stakingRewardsTrB.earned(user1)
            balanceB2 = await stakingRewardsTrB.earned(user2)
            balanceB3 = await stakingRewardsTrB.earned(user3)
            balanceB4 = await stakingRewardsTrB.earned(user4)
            console.log("User1 Rewards TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards TrB: " + web3.utils.fromWei(balanceB2.toString()))
            console.log("User3 Rewards TrB: " + web3.utils.fromWei(balanceB3.toString()))
            console.log("User4 Rewards TrB: " + web3.utils.fromWei(balanceB4.toString()))
        });

        it('Exit from staking contracts', async function () {
            await stakingRewardsTrA.getReward({from: user1})
            await stakingRewardsTrA.getReward({from: user2})
            await stakingRewardsTrA.getReward({from: user3})
            await stakingRewardsTrA.getReward({from: user4})
            console.log("User1 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user2)).toString()))
            console.log("User3 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user3)).toString()))
            console.log("User4 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user4)).toString()))
            console.log("User1 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))
            console.log("User3 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user3)).toString()))
            console.log("User4 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user4)).toString()))

            await stakingRewardsTrB.getReward({from: user1})
            await stakingRewardsTrB.getReward({from: user2})
            await stakingRewardsTrB.getReward({from: user3})
            await stakingRewardsTrB.getReward({from: user4})
            console.log("User1 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user2)).toString()))
            console.log("User3 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user3)).toString()))
            console.log("User4 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user4)).toString()))
            console.log("User1 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))
            console.log("User3 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user3)).toString()))
            console.log("User4 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user4)).toString()))

            expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(incentiveRewardsFactoryContract.address)).toString())).to.be.equal("830"); // 1000 - 70 - 100
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrA.address)).toString())).to.be.lt("70"); // 70 - something
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrB.address)).toString())).to.be.lt("100"); // 100 - something
            stkBalA = await rewardTokenContract.balanceOf(stakingRewardsTrA.address)
            console.log("Undistrib tokens from Staking Contract TrA: " + web3.utils.fromWei(stkBalA))
            stkBalB = await rewardTokenContract.balanceOf(stakingRewardsTrB.address)
            console.log("Undistrib tokens from Staking Contract TrB: " + web3.utils.fromWei(stkBalB))
        });

        it('call notify rewards amount again before period finish', async function () {
            await incentiveRewardsFactoryContract.notifyRewardAmounts()

            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await incentiveRewardsFactoryContract.incentiveRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
        });
    });

    describe('Getting normalized prices from chainlink mockups', function () {
        it('call one shot function and read values', async function () {
            res = await priceHelperContract.getLatestChainlinkPairInfo(0);
            console.log(res[0]+ ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            // res = await priceHelperContract.getLatestChainlinkPairInfo(1);
            // console.log(res[0]+ ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            await marketsContract.setUnderlyingPriceFromChainlinkAllMarkets();
            res = await marketsContract.availableMarketsRewards(0);
            console.log(res[0].toString())
            // res = await marketsContract.availableMarketsRewards(1);
            // console.log(res[0].toString())

            res = await priceHelperContract.reciprocal(res[0])
            console.log(res.toString())
        });

        it('and now something unnecessary, just to have a greater test coverage', async function () {
            await marketsContract.enableAllMarket([false], {from: owner})
            await marketsContract.enableSingleMarket(0, true, {from: owner})
            await marketsContract.setRewardsFactory(incentiveRewardsFactoryContract.address, {from: owner})
            await marketsContract.setMarketAddress(priceHelperContract.address, {from: owner})
            await marketsContract.setRewardsFrequencyAllMarkets([10], {from: owner})
            await marketsContract.setRewardsFrequencySingleMarket(0, 7, {from: owner})
            await marketsContract.setRewardsPercentageAllMarkets([web3.utils.toWei("0.5")], {from: owner})
            await marketsContract.setRewardsPercentageSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await marketsContract.setExtProtocolPercentAllMarkets([web3.utils.toWei("0.03")], {from: owner})
            await marketsContract.setExtProtocolPercentSingleMarket(0, web3.utils.toWei("0.033"), {from: owner})
            await marketsContract.setBalanceFactorAllMarkets([web3.utils.toWei("0.6")], {from: owner})
            await marketsContract.setBalanceFactorSingleMarket(0, web3.utils.toWei("0.5"), {from: owner})
            await marketsContract.setUnderlyingPriceManuallyAllMarkets([web3.utils.toWei("1.02")], {from: owner})
            await marketsContract.setUnderlyingPriceManuallySingleMarket(0, web3.utils.toWei("1.01111"), {from: owner})
            await marketsContract.emergencyTokenTransfer(rewardTokenContract.address, user1, 0, {from: owner})
        });
    });

});