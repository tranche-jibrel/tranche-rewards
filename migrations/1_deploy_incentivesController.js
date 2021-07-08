require('dotenv').config();
const {
  deployProxy,
  upgradeProxy
} = require('@openzeppelin/truffle-upgrades');
const {
  BN,
  ether
} = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAFDT = artifacts.require("./mocks/TrancheAToken.sol");
var TrancheBFDT = artifacts.require("./mocks/TrancheBToken.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");
var Chainlink1 = artifacts.require("./mocks/Chainlink1.sol");
var Chainlink2 = artifacts.require("./mocks/Chainlink2.sol");

var MarketHelper = artifacts.require("./MarketHelper.sol");
var PriceHelper = artifacts.require("./PriceHelper.sol");
var IncentivesController = artifacts.require("./IncentivesController.sol");

module.exports = async (deployer, network, accounts) => {

  if (network == "development") {
    const MYERC20_TOKEN_SUPPLY = new BN(5000000);

    // createTranche(address _trA,
    //   address _trB,
    //   uint256 _trAVal,
    //   uint256 _trBVal,
    //   uint256 _trARBP,
    //   uint256 _trAPrice)
    /*
    TrARPB: 305494111 (3%)
            407325481 (4%)
            509156852 (5%)
            203662741 (2%)
            101831370 (1%)
    */
    const MY_TRANCHE_A_RPB = new BN("305494111");
    const MY_TRANCHE_A_PRICE = new BN("21409027297510851")
    const MY_TRANCHE_A_RPB2 = new BN("203662741");
    const MY_TRANCHE_A_PRICE2 = new BN("23569787412556962")
    // const MY_TRANCHE_A_PRICE_NUM =  Number(web3.utils.fromWei("21409027297510851", "ether"))

    // const MY_TRANCHE_A_TVL = new BN("1000");
    // const MY_TRANCHE_B_TVL = new BN("2000");

    // let MY_TRANCHE_A_SUPPLY = new BN(MY_TRANCHE_A_TVL / MY_TRANCHE_A_PRICE_NUM);
    // let MY_TRANCHE_B_SUPPLY = new BN(MY_TRANCHE_B_TVL);
    //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

    const tokenOwner = accounts[0];

    const myChainlink1Inst = await deployProxy(Chainlink1, [], {
      from: tokenOwner
    });
    console.log('myChainlink1 Deployed: ', myChainlink1Inst.address);

    const myChainlink2Inst = await deployProxy(Chainlink2, [], {
      from: tokenOwner
    });
    console.log('myChainlink2 Deployed: ', myChainlink2Inst.address);

    const myPriceHelperInst = await deployProxy(PriceHelper, [], {
      from: tokenOwner
    });
    console.log('myPriceHelper Deployed: ', myPriceHelperInst.address);

    const myProtocolinstance = await deployProxy(Protocol, [], {
      from: tokenOwner
    });
    console.log('myProtocol Deployed: ', myProtocolinstance.address);

    const myTrAFDTinstance = await deployProxy(TrancheAFDT, [], {
      from: tokenOwner
    });
    console.log('myTrAFDT1 Deployed: ', myTrAFDTinstance.address);

    const myTrBFDTinstance = await deployProxy(TrancheBFDT, [], {
      from: tokenOwner
    });
    console.log('myTrBFDT1 Deployed: ', myTrBFDTinstance.address);

    const myMktHelperinstance = await deployProxy(MarketHelper, [], {
      from: tokenOwner
    });
    console.log('myMktHelperinstance Deployed: ', myMktHelperinstance.address);

    await myProtocolinstance.createTranche(myTrAFDTinstance.address, myTrBFDTinstance.address,
      0, 0, MY_TRANCHE_A_RPB, MY_TRANCHE_A_PRICE, {
      from: tokenOwner
    });
    count = await myProtocolinstance.trCounter();
    tranchePar = await myProtocolinstance.tranchesMocks(count.toNumber() - 1)
    console.log('count: ', count.toNumber(), ', myTrancheMocks: ', tranchePar[0].toString(),
      tranchePar[1].toString(), tranchePar[2].toString(), tranchePar[3].toString(), tranchePar[4].toString());

    const myTrAFDTinst2 = await deployProxy(TrancheAFDT, [], {
      from: tokenOwner
    });
    console.log('myTrAFDT2 Deployed: ', myTrAFDTinst2.address);

    const myTrBFDTinst2 = await deployProxy(TrancheBFDT, [], {
      from: tokenOwner
    });
    console.log('myTrBFDT2 Deployed: ', myTrBFDTinst2.address);

    await myProtocolinstance.createTranche(myTrAFDTinst2.address, myTrBFDTinst2.address,
      0, 0, MY_TRANCHE_A_RPB2, MY_TRANCHE_A_PRICE2, {
      from: tokenOwner
    });
    count = await myProtocolinstance.trCounter();
    tranchePar = await myProtocolinstance.tranchesMocks(count.toNumber() - 1)
    console.log('count: ', count.toNumber(), ', myTrancheMocks: ', tranchePar[0].toString(),
      tranchePar[1].toString(), tranchePar[2].toString(), tranchePar[3].toString(), tranchePar[4].toString());

    const myRewardTokeninstance = await deployProxy(RewardToken, [MYERC20_TOKEN_SUPPLY], {
      from: tokenOwner
    });
    console.log('myReward Deployed: ', myRewardTokeninstance.address);

    // set rewards token address into tranche tokens
    await myTrAFDTinstance.setRewardTokenAddress(myRewardTokeninstance.address, {
      from: tokenOwner
    });
    await myTrBFDTinstance.setRewardTokenAddress(myRewardTokeninstance.address, {
      from: tokenOwner
    });
    await myTrAFDTinst2.setRewardTokenAddress(myRewardTokeninstance.address, {
      from: tokenOwner
    });
    await myTrBFDTinst2.setRewardTokenAddress(myRewardTokeninstance.address, {
      from: tokenOwner
    });

    genesisDate = Date.now() / 1000 | 0
    console.log(genesisDate)

    let block = await web3.eth.getBlockNumber();
    console.log("Actual Block: " + block);
    genesisDate = (await web3.eth.getBlock(block)).timestamp
    console.log(genesisDate)

    const myIncentivesControllerInstance =
      await deployProxy(IncentivesController, [myRewardTokeninstance.address, myMktHelperinstance.address, myPriceHelperInst.address], {
        from: tokenOwner
      });
    console.log('myIncentivesControllerInstance Deployed: ', myIncentivesControllerInstance.address);

    await myPriceHelperInst.setControllerAddress(myIncentivesControllerInstance.address, { from: tokenOwner })

  } else if (network == "kovan") {
    const { SLICE_ADDRESS, PROTOCOL_ADDRESS, MARKET_1_CHAIN_ADDRESS, MARKET_2_CHAIN_ADDRESS } = process.env;
    console.log(SLICE_ADDRESS, PROTOCOL_ADDRESS, MARKET_1_CHAIN_ADDRESS, MARKET_2_CHAIN_ADDRESS)
    const tokenOwner = accounts[0];
    const marketHelper = await deployProxy(MarketHelper, [], {
      from: tokenOwner
    });
    console.log('MARKET_HELPER_ADDRESS=' + marketHelper.address);

    const priceHelper = await deployProxy(PriceHelper, [], {
      from: tokenOwner
    });
    console.log('PRICE_HELPER_ADDRESS=' + priceHelper.address);

    const SIRInstance = await deployProxy(IncentivesController, [SLICE_ADDRESS, marketHelper.address, priceHelper.address], {
      from: tokenOwner
    });
    console.log('SIR_ADDRESS=' + SIRInstance.address);
    await priceHelper.setControllerAddress(SIRInstance.address, { from: tokenOwner })
    console.log('control in adding first tranche')
    await SIRInstance.addTrancheMarket(
      PROTOCOL_ADDRESS,
      0, // TrancheNumber
      web3.utils.toWei('0.5'),  // 50% balance factor
      web3.utils.toWei('1'), // 100% tranche percentage
      web3.utils.toWei('0.03'), // 3% external protocol return
      300, // 5 minute 
      18,
      web3.utils.toWei("1"), // underlying price
      MARKET_1_CHAIN_ADDRESS,
      false,
      { from: tokenOwner });
    console.log('control in adding second tranche')
    await SIRInstance.addTrancheMarket(
      PROTOCOL_ADDRESS,
      1, // TrancheNumber
      web3.utils.toWei('0.5'),  // 50% balance factor
      web3.utils.toWei('1'), // 100% tranche percentage
      web3.utils.toWei('0.03'), // 3% external protocol return
      300, // 5 minute 
      6,
      web3.utils.toWei("1"), // underlying price
      MARKET_2_CHAIN_ADDRESS,
      false,
      { from: tokenOwner });
    console.log('refresh slice speed')
    await SIRInstance.refreshSliceSpeeds();
    console.log('approve slice amount');
    let sliceInstance = await RewardToken.at(SLICE_ADDRESS);
    await sliceInstance.approve(SIRInstance.address, web3.utils.toWei('3000'));
  }
}