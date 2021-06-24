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

var IncentivesController = artifacts.require("./IncentivesController.sol");

let protocolContract, trAFDTContract, trBFDTContract, rewardTokenContract, trAMarket, trBMarket;
let incentiveRewardsFactoryContract, marketsContract, stakingRewardsTrA, stakingRewardsTrB;
let owner, user1, user2, user3, user4;

contract('Staking Rewards', function (accounts) {
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
    
        await trBFDTContract1.mint(user1,  ether("1000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user1))
        expect(bal).to.be.equal("1000")
        await trBFDTContract1.mint(user2,  ether("2000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user2))
        expect(bal).to.be.equal("2000")
        await trBFDTContract1.mint(user3,  ether("3000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user3))
        expect(bal).to.be.equal("3000")
        await trBFDTContract1.mint(user4,  ether("4000"));
        bal = web3.utils.fromWei(await trBFDTContract1.balanceOf(user4))
        expect(bal).to.be.equal("4000")
    
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
          tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, 
                MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {from: owner});
    
          tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 1, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE, 
                MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {from: owner});
    
          console.log("Total TVL: " + (web3.utils.fromWei(await incentiveControllerContract.getAllMarketsTVL()).toString()))
          console.log("Total TVL in Market0: " + (web3.utils.fromWei(await incentiveControllerContract.getTrancheMarketTVL(0)).toString()))
          console.log("Total TVL in Market1: " + (web3.utils.fromWei(await incentiveControllerContract.getTrancheMarketTVL(1)).toString()))
    
          await incentiveControllerContract.refreshSliceSpeeds();
    
          mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
          mkt1Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(1))
          console.log("Market0: " + mkt0Share*100 + " %, Market1: " + mkt1Share*100 + " %")
    
          count = await incentiveControllerContract.marketsCounter();
          console.log("Count markets: " + count)
          trATVL = await incentiveControllerContract.getTrancheAMarketTVL(0);
          trBTVL = await incentiveControllerContract.getTrancheBMarketTVL(0);
          totTrTVL = await incentiveControllerContract.getTrancheMarketTVL(0);
          paramTr = await incentiveControllerContract.availableMarketsRewards(0);
          console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
            web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") + 
            ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");
    
          trATVL = await incentiveControllerContract.getTrancheAMarketTVL(1);
          trBTVL = await incentiveControllerContract.getTrancheBMarketTVL(1);
          totTrTVL = await incentiveControllerContract.getTrancheMarketTVL(1);
          paramTr = await incentiveControllerContract.availableMarketsRewards(1);
          console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
            web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") + 
            ", MarketShare: " + web3.utils.fromWei(paramTr[0].toString()) * 100 + " %");
        });
    
        it('read values and distribute rewards to tranches', async function () {
          trARet = await incentiveControllerContract.getTrancheAReturns(0);
          console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
          trBRet = await incentiveControllerContract.getTrancheBReturns(0);
          console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
          trBRewPerc = await incentiveControllerContract.getTrancheBRewardsPercentage(0);
          console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
          trARewPerc = ether('1').sub(trBRewPerc);
          console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
    
          trARet = await incentiveControllerContract.getTrancheAReturns(1);
          console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
          trBRet = await incentiveControllerContract.getTrancheBReturns(1);
          console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
          trBRewPerc = await incentiveControllerContract.getTrancheBRewardsPercentage(1);
          console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
          trARewPerc = ether('1').sub(trBRewPerc);
          console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });


/*
    describe('deploy staking rewards contracts and staking tokens', function () {
        it('deploy Staking Contracts for A & B', async function () {
            // now = Date.now() / 1000 | 0;
            duration = 864000; // 10 giorni

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
            for (i = 0; i < 1000; i++) {
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
            for (i = 0; i < 1000; i++) {
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
*/
});