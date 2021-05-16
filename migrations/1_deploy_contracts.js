require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const { BN, ether } = require('@openzeppelin/test-helpers');

const Web3 = require('web3');
// Ganache UI on 8545
const web3 = new Web3(new Web3.providers.HttpProvider("http://localhost:8545"));

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAToken = artifacts.require("./mocks/TrancheAERC20.sol");
var TrancheBToken = artifacts.require("./mocks/TrancheBERC20.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");

var RewardsDistribution = artifacts.require("./RewardsDistribution.sol");

module.exports = async (deployer, network, accounts) => {
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
  const MY_TRANCHE_A_PRICE =  new BN("21409027297510851")
  const MY_TRANCHE_A_PRICE_NUM =  Number(web3.utils.fromWei("21409027297510851", "ether"))

  const MY_TRANCHE_A_TVL = new BN("1000");
  const MY_TRANCHE_B_TVL = new BN("2000");

  let MY_TRANCHE_A_SUPPLY = new BN(MY_TRANCHE_A_TVL / MY_TRANCHE_A_PRICE_NUM);
  //let MY_TRANCHE_A_SUPPLY = MY_TRANCHE_A_TVL;
  let MY_TRANCHE_B_SUPPLY = new BN(MY_TRANCHE_B_TVL);
  //const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  if (network == "development") {
    const tokenOwner = accounts[0];

    const myProtocolinstance = await deployProxy(Protocol, [], { from: tokenOwner });
    console.log('myProtocol Deployed: ', myProtocolinstance.address);

    const myTrAinstance = await deployProxy(TrancheAToken, [MY_TRANCHE_A_SUPPLY], { from: tokenOwner });
    console.log('myTrancheA Deployed: ', myTrAinstance.address);

    const myTrBinstance = await deployProxy(TrancheBToken, [MY_TRANCHE_B_SUPPLY], { from: tokenOwner });
    console.log('myTrancheB Deployed: ', myTrBinstance.address);

    await myProtocolinstance.createTranche(myTrAinstance.address, myTrBinstance.address, 
      ether(MY_TRANCHE_A_TVL), ether(MY_TRANCHE_B_TVL), MY_TRANCHE_A_RPB, MY_TRANCHE_A_PRICE, { from: tokenOwner });
    count = await myProtocolinstance.trCounter();
    tranchePar = await myProtocolinstance.tranchesMocks(count.toNumber()-1)
    console.log('count: ', count.toNumber(), ', myTrancheMocks: ', tranchePar[0].toString(), 
        tranchePar[1].toString(), tranchePar[2].toString(), tranchePar[3].toString(), tranchePar[4].toString());

    const myRewardTokeninstance = await deployProxy(RewardToken, [MYERC20_TOKEN_SUPPLY], { from: tokenOwner });
    console.log('myReward Deployed: ', myRewardTokeninstance.address);

    const myRewardsDistribution = await deployProxy(RewardsDistribution, [myRewardTokeninstance.address], { from: tokenOwner });
    console.log('myRewardsDistribution Deployed: ', myRewardsDistribution.address);

  } 
}