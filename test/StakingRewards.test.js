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

const timeMachine = require('ganache-time-traveler');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAFDT = artifacts.require("./mocks/TrancheAToken.sol");
var TrancheBFDT = artifacts.require("./mocks/TrancheBToken.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");

var StakingRewardsFactory = artifacts.require("./StakingRewardsFactory.sol");
var StakingRewards = artifacts.require("./StakingRewards.sol");
var Markets = artifacts.require("./Markets.sol");

let protocolContract, trAFDTContract, trBFDTContract, rewardTokenContract, trAMarket, trBMarket;
let stakingRewardsFactoryContract, marketsContract, stakingRewardsTrA, stakingRewardsTrB;
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
        rewardTokenContract = await RewardToken.deployed();
        expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(rewardTokenContract.address);
        stakingRewardsFactoryContract = await StakingRewardsFactory.deployed();
        expect(stakingRewardsFactoryContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(stakingRewardsFactoryContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        // console.log(rewardsDistribContract.address);
        marketsContract = await Markets.deployed();
        expect(marketsContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(marketsContract.address).to.match(/0x[0-9a-fA-F]{40}/);
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
            await marketsContract.setRewardsFactory(stakingRewardsFactoryContract.address);

            tx = await marketsContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_TRANCHE_PERCENTAGE,
                MY_EXT_PROT_RET, 7, web3.utils.toWei("1", "ether"), {
                    from: owner
                });

            console.log("Total TVL: " + web3.utils.fromWei((await marketsContract.getAllMarketsTVL()).toString()))
            console.log("Total TVL in Market0: " + web3.utils.fromWei((await marketsContract.getTrancheMarketTVL(0)).toString()))

            await marketsContract.refreshSliceSpeeds();

            count = await marketsContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketsContract.getTrancheAMarketTVL(0);
            trBTVL = await marketsContract.getTrancheBMarketTVL(0);
            totTrTVL = await marketsContract.getTrancheMarketTVL(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether"));
            mktShare = await marketsContract.getMarketSharePerTranche(0);
            console.log("Market Share tr 0: " + web3.utils.fromWei(mktShare) * 100 + " %");
        });

        it('read values from tranches', async function () {
            trARet = await marketsContract.getTrancheAReturns(0);
            console.log("tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketsContract.getTrancheBReturns(0);
            console.log("tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketsContract.getTrancheBRewardsPercentage(0);
            console.log("tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });

    describe('deploy staking rewards contracts and staking tokens', function () {
        it('deploy Staking Contracts for A & B', async function () {
            // now = Date.now() / 1000 | 0;
            duration = 864000; // 10 giorni

            trAMarket = await marketsContract.getATrancheMarket(0)
            trBMarket = await marketsContract.getBTrancheMarket(0)

            await stakingRewardsFactoryContract.deploy(0, true, trAMarket, ether("70"), duration, {from: owner});
            stkAddressA = await stakingRewardsFactoryContract.stakingTokens(0);
            stakingAAddress = await marketsContract.getATrancheStaking(0)
            stakingRewardsTrA = await StakingRewards.at(stakingAAddress)
            expect(stkAddressA).to.be.equal(trAMarket)
            
            await stakingRewardsFactoryContract.deploy(0, false, trBMarket, ether("100"), duration, {from: owner});
            stkAddressB = await stakingRewardsFactoryContract.stakingTokens(1);
            stakingBAddress = await marketsContract.getBTrancheStaking(0)
            stakingRewardsTrB = await StakingRewards.at(stakingBAddress)
            expect(stkAddressB).to.be.equal(trBMarket)

            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
        });

        it('stake tranche tokens in Staking Contracts for A & B', async function () {
            stkAmount1 = await trAFDTContract.balanceOf(user1);
            await trAFDTContract.approve(stakingRewardsTrA.address, stkAmount1, {from: user1})
            await stakingRewardsTrA.stake(stkAmount1, {from: user1})
            expect(web3.utils.fromWei(await stakingRewardsTrA.balanceOf(user1))).to.be.equal(web3.utils.fromWei(stkAmount1))
            expect(web3.utils.fromWei(await stakingRewardsTrA.totalSupply())).to.be.equal(web3.utils.fromWei(stkAmount1))

            stkAmount2 = await trAFDTContract.balanceOf(user2);
            await trAFDTContract.approve(stakingRewardsTrA.address, stkAmount2, {from: user2})
            await stakingRewardsTrA.stake(stkAmount2, {from: user2})
            expect(web3.utils.fromWei(await stakingRewardsTrA.balanceOf(user2))).to.be.equal(web3.utils.fromWei(stkAmount2))
            totAmount = +web3.utils.fromWei(stkAmount1) + +web3.utils.fromWei(stkAmount2)
            expect(web3.utils.fromWei(await stakingRewardsTrA.totalSupply())).to.be.equal(totAmount.toString())

            stkAmount1 = await trBFDTContract.balanceOf(user1);
            await trBFDTContract.approve(stakingRewardsTrB.address, stkAmount1, {from: user1})
            await stakingRewardsTrB.stake(stkAmount1, {from: user1})
            expect(web3.utils.fromWei(await stakingRewardsTrB.balanceOf(user1))).to.be.equal(web3.utils.fromWei(stkAmount1))
            expect(web3.utils.fromWei(await stakingRewardsTrB.totalSupply())).to.be.equal(web3.utils.fromWei(stkAmount1))

            stkAmount2 = await trBFDTContract.balanceOf(user2);
            await trBFDTContract.approve(stakingRewardsTrB.address, stkAmount2, {from: user2})
            await stakingRewardsTrB.stake(stkAmount2, {from: user2})
            expect(web3.utils.fromWei(await stakingRewardsTrB.balanceOf(user2))).to.be.equal(web3.utils.fromWei(stkAmount2))
            totAmount = +web3.utils.fromWei(stkAmount1) + +web3.utils.fromWei(stkAmount2)
            expect(web3.utils.fromWei(await stakingRewardsTrB.totalSupply())).to.be.equal(totAmount.toString())

            expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user1))).to.be.equal("0")
            expect(web3.utils.fromWei(await trAFDTContract.balanceOf(user2))).to.be.equal("0")
            expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user1))).to.be.equal("0")
            expect(web3.utils.fromWei(await trBFDTContract.balanceOf(user2))).to.be.equal("0")
            
            await rewardTokenContract.transfer(stakingRewardsFactoryContract.address, ether("1000"), {from: owner})
            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(stakingRewardsFactoryContract.address))).to.be.equal("1000")
            await stakingRewardsFactoryContract.notifyRewardAmounts()

            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            expect((await stakingRewardsTrA.lastUpdateTime()).toString()).to.be.equal((Date.now() / 1000 | 0).toString())
            expect((await stakingRewardsTrB.lastUpdateTime()).toString()).to.be.equal((Date.now() / 1000 | 0).toString())

            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(stakingRewardsTrA.address))).to.be.equal("70")
            expect(web3.utils.fromWei(await rewardTokenContract.balanceOf(stakingRewardsTrB.address))).to.be.equal("100")
        });
    });

    describe('Exiting Staking Contracts', function () {
        let balanceA1, balanceA2, balanceB1, balanceB2;

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
            console.log("User1 Rewards TrA: " + web3.utils.fromWei(balanceA1.toString()))
            console.log("User2 Rewards TrA: " + web3.utils.fromWei(balanceA2.toString()))

            balanceB1 = await stakingRewardsTrB.earned(user1)
            balanceB2 = await stakingRewardsTrB.earned(user2)
            console.log("User1 Rewards TrB: " + web3.utils.fromWei(balanceB1.toString()))
            console.log("User2 Rewards TrB: " + web3.utils.fromWei(balanceB2.toString()))
        });

        it('Exit from staking contracts', async function () {
            await stakingRewardsTrA.exit({from: user1})
            await stakingRewardsTrA.exit({from: user2})
            console.log("User1 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrA tokens: " + web3.utils.fromWei((await trAFDTContract.balanceOf(user2)).toString()))
            console.log("User1 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrA withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))

            await stakingRewardsTrB.exit({from: user1})
            await stakingRewardsTrB.exit({from: user2})
            console.log("User1 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user1)).toString()))
            console.log("User2 TrB tokens: " + web3.utils.fromWei((await trBFDTContract.balanceOf(user2)).toString()))
            console.log("User1 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user1)).toString()))
            console.log("User2 Rewards TrB withdrawn: " + web3.utils.fromWei((await rewardTokenContract.balanceOf(user2)).toString()))

            expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsFactoryContract.address)).toString())).to.be.equal("830"); // 1000 - 70 - 100
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrA.address)).toString())).to.be.lt("70"); // 70 - something
            // expect(web3.utils.fromWei((await rewardTokenContract.balanceOf(stakingRewardsTrB.address)).toString())).to.be.lt("100"); // 100 - something
            stkBalA = await rewardTokenContract.balanceOf(stakingRewardsTrA.address)
            console.log("Undistrib tokens from Staking Contract TrA: " + web3.utils.fromWei(stkBalA))
            stkBalB = await rewardTokenContract.balanceOf(stakingRewardsTrB.address)
            console.log("Undistrib tokens from Staking Contract TrB: " + web3.utils.fromWei(stkBalB))
        });

        it('call notify rewards amount again before period finish', async function () {
            await stakingRewardsFactoryContract.notifyRewardAmounts()

            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressA)
            console.log("TrA Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
            res = await stakingRewardsFactoryContract.stakingRewardsInfoByStakingToken(stkAddressB)
            console.log("TrB Staking: " + res[0].toString() + ", Rewards: " + web3.utils.fromWei(res[1].toString()) + ", Duration: " + res[2].toString())
        });
    });

});