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
var AggregatorProxy = artifacts.require("./mocks/AggregatorProxy.sol");


var MarketHelper = artifacts.require("./MarketHelper.sol");
var PriceHelper = artifacts.require("./PriceHelper.sol");
var IncentivesController = artifacts.require("./IncentivesController.sol");

const SLICE_ADDRESS = '0x0aee8703d34dd9ae107386d3eff22ae75dd616d1';
const PROTOCOL_ADDRESS = '0x05060F5ab3e7A98E180B418A96fFc82A85b115e7';

const tr0_A = '0x769fBF12016C9Df5247b2a13D1aE3c93d6B4CB0f'
const tr0_B = '0x0f18F632e2046F5c28F94498905806F2D52Ff6F1'

const tr1_A = '0xC3777A4Ab9d62403d08550193F74C769986Bff6c'
const tr1_B = '0x5F5b8ef49FBaEADAbA3611B43C68FbCAEAcDa5b1'

const tr2_A = '0x57866541f993B66357acb00e2Bc6cF9c5067539E'
const tr2_B = '0xf73183AC8F7158F40593CCA3108969A5a859cEd0'

const tr3_A = '0xF94cB5735a8A68c670734128cA45542Ac96052db'
const tr3_B = '0xE8988c2156fBF670E0CAf6ea21309b236fb39900'

// DAI/USD
const MARKET_1_CHAIN_ADDRESS='0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9';
// USDC/USD
const MARKET_2_CHAIN_ADDRESS='0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6';
// WBTC/USD
const MARKET_3_CHAIN_ADDRESS='0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c';
// LINK/USD
const MARKET_4_CHAIN_ADDRESS='0x2c1d072e956AFFC0D435Cb7AC38EF18d24d9127c';

const MY_BAL_FACTOR = new BN("500000000000000000"); //50%
const MY_MARKET_PERCENTAGE = new BN("1000000000000000000"); //100%
const MKT1_DECS = 6;
const MKT2_DECS = 18;
const MKT3_DECS = 8;
const MY_EXT_PROT_RET0 = new BN("27700000000000000"); //2,77%
const MY_EXT_PROT_RET1 = new BN("43300000000000000"); //4,33%
const MY_EXT_PROT_RET2 = new BN("3600000000000000"); //0,36%
const MY_EXT_PROT_RET3 = new BN("5000000000000000"); //0,5%

const impersonateAccount = '0x5ad3330aebdd74d7dda641d37273ac1835ee9330';

let protocolContract, rewardTokenContract, priceHelperContract, chainlink1Contract, chainlink2Contract, chainlink3Contract, chainlink4Contract;
let mkt0trARewards, mkt0trBRewards, mkt1trARewards, mkt1trBRewards;
let mkt0trARRate, mkt0trBRRate, mkt1trARRate, mkt1trBRRate;
let owner, user1, user2, user3, user4;
let distCountMkt0, distCountMkt1, distCount;

contract('Incentive Controller Chainlink', function (accounts) {
    // const gasPrice = new BN('1');
    const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    owner = accounts[0];
    user1 = accounts[1];
    user2 = accounts[2];
    user3 = accounts[3];
    user4 = accounts[4];

    it('get deployed contracts', async function () {
        protocolContract = await Protocol.at(PROTOCOL_ADDRESS);
        expect(protocolContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(protocolContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(protocolContract.address);

        // DAI
        trAFDTContract0 = await TrancheAFDT.at(tr0_A);
        expect(trAFDTContract0.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trAFDTContract0.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trAFDTContract0.address);
        trBFDTContract0 = await TrancheBFDT.at(tr0_B);
        expect(trBFDTContract0.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trBFDTContract0.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trBFDTContract0.address);

        // USDC
        trAFDTContract1 = await TrancheAFDT.at(tr1_A);
        expect(trAFDTContract1.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trAFDTContract1.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trAFDTContract1.address);
        trBFDTContract1 = await TrancheBFDT.at(tr1_B);
        expect(trBFDTContract1.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trBFDTContract1.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trBFDTContract1.address);

        // WBTC
        trAFDTContract2 = await TrancheAFDT.at(tr2_A);
        expect(trAFDTContract2.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trAFDTContract2.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trAFDTContract2.address);
        trBFDTContract2 = await TrancheBFDT.at(tr2_B);
        expect(trBFDTContract2.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trBFDTContract2.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trBFDTContract2.address);

        // LINK
        trAFDTContract3 = await TrancheAFDT.at(tr3_A);
        expect(trAFDTContract3.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trAFDTContract3.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trAFDTContract3.address);
        trBFDTContract3 = await TrancheBFDT.at(tr3_B);
        expect(trBFDTContract1.address).to.be.not.equal(ZERO_ADDRESS);
        expect(trBFDTContract1.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(trBFDTContract3.address);

        chainlink1Contract = await AggregatorProxy.at(MARKET_1_CHAIN_ADDRESS);
        expect(chainlink1Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink1Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(chainlink1Contract.address);
        chainlink2Contract = await AggregatorProxy.at(MARKET_2_CHAIN_ADDRESS);
        expect(chainlink2Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink2Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(chainlink2Contract.address);
        chainlink3Contract = await AggregatorProxy.at(MARKET_3_CHAIN_ADDRESS);
        expect(chainlink3Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink3Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(chainlink3Contract.address);
        chainlink4Contract = await AggregatorProxy.at(MARKET_4_CHAIN_ADDRESS);
        expect(chainlink4Contract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(chainlink4Contract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(chainlink4Contract.address);

        priceHelperContract = await PriceHelper.deployed();
        expect(priceHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(priceHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(priceHelperContract.address);
        marketHelperContract = await MarketHelper.deployed();
        expect(marketHelperContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(marketHelperContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(marketHelperContract.address);
        rewardTokenContract = await RewardToken.at(SLICE_ADDRESS);
        expect(rewardTokenContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(rewardTokenContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(rewardTokenContract.address);
        incentiveControllerContract = await IncentivesController.deployed();
        expect(incentiveControllerContract.address).to.be.not.equal(ZERO_ADDRESS);
        expect(incentiveControllerContract.address).to.match(/0x[0-9a-fA-F]{40}/);
        console.log(incentiveControllerContract.address);
    });

    describe('settings', function () {
        let res1, res2, res3, res4;

        it('set tranche in rewards distribution contract', async function () {
            // DAI
            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 0, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET0, MKT2_DECS, 0, chainlink1Contract.address, false, {
                    from: owner
                });

            console.log("Reading raw prices from market helper:")
            res = await priceHelperContract.getLatestChainlinkPairInfo(0);
            console.log(res[0] + ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            // USDC
            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 1, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET1, MKT1_DECS, 0, chainlink2Contract.address, false, {
                    from: owner
                });

            res = await priceHelperContract.getLatestChainlinkPairInfo(1);
            console.log(res[0] + ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 2, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET2, MKT3_DECS, 0, chainlink3Contract.address, false, {
                    from: owner
                });

            res = await priceHelperContract.getLatestChainlinkPairInfo(2);
            console.log(res[0] + ": "+res[1].toString() + " - Decs: "+ res[2].toString())

            // USDC
            tx = await incentiveControllerContract.addTrancheMarket(protocolContract.address, 3, MY_BAL_FACTOR, MY_MARKET_PERCENTAGE,
                MY_EXT_PROT_RET3, MKT2_DECS, 0, chainlink4Contract.address, false, {
                    from: owner
                });

            res = await priceHelperContract.getLatestChainlinkPairInfo(3);
            console.log(res[0] + ": "+res[1].toString() + " - Decs: "+ res[2].toString())

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
            console.log("Total TVL in Market0: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT2_DECS)).toString()))
            res3 = await incentiveControllerContract.availableMarkets(1)
            res4 = await incentiveControllerContract.availableMarketsRewards(1)
            console.log("Total TVL in Market1: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0], MKT1_DECS)).toString()))
            res5 = await incentiveControllerContract.availableMarkets(2)
            res6 = await incentiveControllerContract.availableMarketsRewards(2)
            console.log("Total TVL in Market2: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res5[0], res5[3], res6[0], MKT3_DECS)).toString()))
            res7 = await incentiveControllerContract.availableMarkets(3)
            res8 = await incentiveControllerContract.availableMarketsRewards(3)
            console.log("Total TVL in Market3: " + (web3.utils.fromWei(await marketHelperContract.getTrancheMarketTVL(res7[0], res7[3], res8[0], MKT2_DECS)).toString()))

            await incentiveControllerContract.refreshSliceSpeeds();

            mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
            mkt1Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(1))
            mkt2Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(2))
            mkt3Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(3))
            console.log("Market0: " + mkt0Share * 100 + " %, Market1: " + mkt1Share * 100 + " %, Market2: " + mkt2Share * 100 + " %, Market3: " + mkt3Share * 100 + " %")

            count = await incentiveControllerContract.marketsCounter();
            console.log("Count markets: " + count)
            trATVL = await marketHelperContract.getTrancheAMarketTVL(res1[0], res1[3], res2[0], MKT2_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res1[0], res1[3], res2[0], MKT2_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res1[0], res1[3], res2[0], MKT2_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(0);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            trATVL = await marketHelperContract.getTrancheAMarketTVL(res3[0], res3[3], res4[0], MKT1_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res3[0], res3[3], res4[0], MKT1_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res3[0], res3[3], res4[0], MKT1_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(1);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            trATVL = await marketHelperContract.getTrancheAMarketTVL(res5[0], res5[3], res6[0], MKT3_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res5[0], res5[3], res6[0], MKT3_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res5[0], res5[3], res6[0], MKT3_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(2);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            trATVL = await marketHelperContract.getTrancheAMarketTVL(res7[0], res7[3], res8[0], MKT2_DECS);
            trBTVL = await marketHelperContract.getTrancheBMarketTVL(res7[0], res7[3], res8[0], MKT2_DECS);
            totTrTVL = await marketHelperContract.getTrancheMarketTVL(res7[0], res7[3], res8[0], MKT2_DECS);
            paramTr = await incentiveControllerContract.availableMarketsRewards(3);
            console.log("trATVL: " + web3.utils.fromWei(trATVL, "ether") + ", trBTVL: " +
                web3.utils.fromWei(trBTVL, "ether") + ", totTVL: " + web3.utils.fromWei(totTrTVL, "ether") +
                ", MarketShare: " + web3.utils.fromWei(paramTr[2].toString()) * 100 + " %");

            res = await incentiveControllerContract.getMarketRewardsPercentage();
            console.log("Total mkts percentage: " + web3.utils.fromWei(res.toString())); // true
            expect(approxeq(Number(web3.utils.fromWei(res.toString())), 1)).to.be.true
        });

        it('read values and distribute rewards to tranches', async function () {
            trARet = await marketHelperContract.getTrancheAReturns(res1[0], res1[3]);
            console.log("mkt0 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res1[0], res1[3], res2[0], MKT2_DECS, res1[5]);
            console.log("mkt0 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res1[0], res1[3], res2[0], MKT1_DECS, res1[5], res1[4]);
            console.log("mkt0 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt0 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            trARet = await marketHelperContract.getTrancheAReturns(res3[0], res3[3]);
            console.log("mkt1 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res3[0], res3[3], res4[0], MKT1_DECS, res3[5]);
            console.log("mkt1 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res3[0], res3[3], res4[0], MKT2_DECS, res3[5], res3[4]);
            console.log("mkt1 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt1 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            trARet = await marketHelperContract.getTrancheAReturns(res5[0], res5[3]);
            console.log("mkt2 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res5[0], res5[3], res6[0], MKT2_DECS, res3[5]);
            console.log("mkt2 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res5[0], res5[3], res6[0], MKT3_DECS, res5[5], res5[4]);
            console.log("mkt2 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt2 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");

            trARet = await marketHelperContract.getTrancheAReturns(res7[0], res7[3]);
            console.log("mkt3 tranche A return: " + web3.utils.fromWei(trARet) * 100 + " %");
            trBRet = await marketHelperContract.getTrancheBReturns(res7[0], res7[3], res8[0], MKT2_DECS, res7[5]);
            console.log("mkt3 tranche B return: " + web3.utils.fromWei(trBRet) * 100 + " %");
            trBRewPerc = await marketHelperContract.getTrancheBRewardsPercentage(res7[0], res7[3], res8[0], MKT2_DECS, res7[5], res7[4]);
            console.log("mkt3 tranche B rewards percentage: " + web3.utils.fromWei(trBRewPerc) * 100 + " %");
            trARewPerc = ether('1').sub(trBRewPerc);
            console.log("mkt3 tranche A rewards percentage: " + web3.utils.fromWei(trARewPerc) * 100 + " %");
        });
    });

    describe('Getting normalized prices from chainlink', function () {
        it('call one shot function and read values', async function () {
          res = await priceHelperContract.getLatestChainlinkPairInfo(0);
          console.log(res[0]+ ": "+ web3.utils.fromWei(res[1].toString()) + " - Decs: "+ res[2].toString())
    
          res = await priceHelperContract.getLatestChainlinkPairInfo(1);
          console.log(res[0]+ ": "+ web3.utils.fromWei(res[1].toString()) + " - Decs: "+ res[2].toString())

          res = await priceHelperContract.getLatestChainlinkPairInfo(2);
          console.log(res[0]+ ": "+ web3.utils.fromWei(res[1].toString()) + " - Decs: "+ res[2].toString())
    
          res = await priceHelperContract.getLatestChainlinkPairInfo(3);
          console.log(res[0]+ ": "+ web3.utils.fromWei(res[1].toString()) + " - Decs: "+ res[2].toString())
    
          rec = await priceHelperContract.reciprocal(res[1])
          console.log("testing reciprocal: " + web3.utils.fromWei(rec.toString()) + " is reciprocal of " + web3.utils.fromWei(res[1].toString()))
        });

        it('#1 distributing rewards to markets', async function () {
            console.log("Updating prices...")
            await incentiveControllerContract.setUnderlyingPriceFromChainlinkAllMarkets();
            console.log("Updating slice speeds...")
            await incentiveControllerContract.refreshSliceSpeeds();

            mkt0Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(0))
            mkt1Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(1))
            mkt2Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(2))
            mkt3Share = web3.utils.fromWei(await incentiveControllerContract.getMarketSharePerTranche(3))
            console.log("Market0: " + mkt0Share * 100 + " %, Market1: " + mkt1Share * 100 + " %, Market2: " + mkt2Share * 100 + " %, Market3: " + mkt3Share * 100 + " %")

            await rewardTokenContract.transfer(owner, web3.utils.toWei("100"), {
                from: impersonateAccount
            })

            await rewardTokenContract.approve(incentiveControllerContract.address, web3.utils.toWei("100"), {
                from: owner
            })

            await incentiveControllerContract.updateRewardAmountsAllMarkets(web3.utils.toWei("100"), 3600, {
                from: owner
            })

            res = await incentiveControllerContract.getTokenBalance(rewardTokenContract.address)
            expect(web3.utils.fromWei(res.toString())).to.be.equal("100")
            console.log("Incentive controller balance: " + web3.utils.fromWei(res.toString()) + " SLICE")

            res = await incentiveControllerContract.availableMarketsRewards(0);
            console.log("Rew. TrA mkt0: " + web3.utils.fromWei(res[3].toString()) + " SLICE, Rew. TrB mkt0: " + web3.utils.fromWei(res[4].toString()) + " SLICE")
            res = await incentiveControllerContract.availableMarketsRewards(1);
            console.log("Rew. TrA mkt1: " + web3.utils.fromWei(res[3].toString()) + " SLICE, Rew. TrB mkt1: " + web3.utils.fromWei(res[4].toString()) + " SLICE")
            res = await incentiveControllerContract.availableMarketsRewards(2);
            console.log("Rew. TrA mkt2: " + web3.utils.fromWei(res[3].toString()) + " SLICE, Rew. TrB mkt2: " + web3.utils.fromWei(res[4].toString()) + " SLICE")
            res = await incentiveControllerContract.availableMarketsRewards(3);
            console.log("Rew. TrA mkt3: " + web3.utils.fromWei(res[3].toString()) + " SLICE, Rew. TrB mkt3: " + web3.utils.fromWei(res[4].toString()) + " SLICE")
        })

    });


})