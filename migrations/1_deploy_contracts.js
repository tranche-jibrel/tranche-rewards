require('dotenv').config();
const { deployProxy, upgradeProxy } = require('@openzeppelin/truffle-upgrades');
const { BN } = require('@openzeppelin/test-helpers');

var Protocol = artifacts.require("./mocks/Protocol.sol");
var TrancheAToken = artifacts.require("./mocks/TrancheAERC20.sol");
var TrancheBToken = artifacts.require("./mocks/TrancheBERC20.sol");
var RewardToken = artifacts.require("./mocks/RewardERC20.sol");

var TokenRewards = artifacts.require("./TokenRewards.sol");

module.exports = async (deployer, network, accounts) => {
  const MYERC20_TOKEN_SUPPLY = new BN(5000000);
  const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

  if (network == "development") {
    const tokenOwner = accounts[0];

    const myProtocolinstance = await deployProxy(Protocol, [], { from: tokenOwner });
    console.log('myProtocol Deployed: ', myProtocolinstance.address);

    const myTrAinstance = await deployProxy(TrancheAToken, [MYERC20_TOKEN_SUPPLY], { from: tokenOwner });
    console.log('myTrancheA Deployed: ', myTrAinstance.address);

    const myTrBinstance = await deployProxy(TrancheBToken, [MYERC20_TOKEN_SUPPLY], { from: tokenOwner });
    console.log('myTrancheB Deployed: ', myTrBinstance.address);

    await myProtocolinstance.createTranche(myTrAinstance.address, myTrBinstance.address, MYERC20_TOKEN_SUPPLY, MYERC20_TOKEN_SUPPLY);
    count = await myProtocolinstance.trCounter();
    tranchePar = await myProtocolinstance.tranchesMocks(count.toNumber()-1)
    console.log('count: ', count.toNumber(), ', myTrancheMocks: ', tranchePar[0], tranchePar[1], tranchePar[2].toString(), tranchePar[3].toString(), tranchePar[4].toString());

    const myRewardinstance = await deployProxy(RewardToken, [MYERC20_TOKEN_SUPPLY], { from: tokenOwner });
    console.log('myReward Deployed: ', myRewardinstance.address);

    const mySliceRewards = await deployProxy(TokenRewards, [myRewardinstance.address], { from: tokenOwner });
    console.log('mySliceRewards Deployed: ', mySliceRewards.address);
/*
    await myRewardinstance.approve(mySliceRewards.address, MYERC20_TOKEN_SUPPLY, { from: tokenOwner });
    await mySliceRewards.setReward(MYERC20_TOKEN_SUPPLY, { from: tokenOwner });
    console.log("Rewards amount: " + await mySliceRewards.getReward());*/

  } else if (network == "kovan") {
    let { FEE_COLLECTOR_ADDRESS, PRICE_ORACLE_ADDRESS, IS_UPGRADE,
      TRANCHE_ONE_TOKEN_ADDRESS, TRANCHE_ONE_CTOKEN_ADDRESS, TRANCHE_TWO_TOKEN_ADDRESS, TRANCHE_TWO_CTOKEN_ADDRESS
    } = process.env;
    const accounts = await web3.eth.getAccounts();
    const factoryOwner = accounts[0];
    if (IS_UPGRADE == 'true') {

      console.log('contracts are upgraded');
    } else {
      // deployed new contract
      try {
        const compoundDeployer = await deployProxy(JTranchesDeployer, [], { from: factoryOwner, unsafeAllowCustomTypes: true });
        console.log(`COMPOUND_DEPLOYER=${compoundDeployer.address}`);

        // Source: https://github.com/compound-finance/compound-config/blob/master/networks/kovan.json
        const JCompoundInstance = await deployProxy(JCompound, [PRICE_ORACLE_ADDRESS, FEE_COLLECTOR_ADDRESS, compoundDeployer.address],
          { from: factoryOwner });

        console.log(`COMPOUND_TRANCHE_ADDRESS=${JCompoundInstance.address}`);
        compoundDeployer.setJCompoundAddress(JCompoundInstance.address);
        console.log('compound deployer 1');

        await JCompoundInstance.setCTokenContract(TRANCHE_ONE_TOKEN_ADDRESS, TRANCHE_ONE_CTOKEN_ADDRESS, { from: factoryOwner });
        console.log('compound deployer 2');

        await JCompoundInstance.setCTokenContract(TRANCHE_TWO_TOKEN_ADDRESS, TRANCHE_TWO_CTOKEN_ADDRESS, { from: factoryOwner });

        console.log('compound deployer 3');
        await JCompoundInstance.addTrancheToProtocol(TRANCHE_ONE_TOKEN_ADDRESS, "Tranche A - Compound DAI", "ACDAI", "Tranche B - Compound DAI", "BCDAI", web3.utils.toWei("0.04", "ether"), 8, 18, { from: factoryOwner });

        console.log('compound deployer 4');
        //await JCompoundInstance.addTrancheToProtocol(ZERO_ADDRESS, "Tranche A - Compound ETH", "ACETH", "Tranche B - Compound ETH", "BCETH", web3.utils.toWei("0.04", "ether"), 8, 18, { from: factoryOwner });
        // await JCompoundInstance.addTrancheToProtocol("0xb7a4f3e9097c08da09517b5ab877f7a917224ede", "Tranche A - Compound USDC", "ACUSDC", "Tranche B - Compound USDC", "BCUSDC", web3.utils.toWei("0.02", "ether"), 8, 6, { from: factoryOwner });
        await JCompoundInstance.addTrancheToProtocol(TRANCHE_TWO_TOKEN_ADDRESS, "Tranche A - Compound USDT", "ACUSDT", "Tranche B - Compound USDT", "BCUSDT", web3.utils.toWei("0.02", "ether"), 8, 6, { from: factoryOwner });

        console.log('compound deployer 5');
        console.log(`JCompound deployed at: ${JCompoundInstance.address}`);
      } catch (error) {
        console.log(error);
      }
    }
  } else if (network == "mainnet") {
    let { FEE_COLLECTOR_ADDRESS, PRICE_ORACLE_ADDRESS,
      TRANCHE_ONE_TOKEN_ADDRESS, TRANCHE_ONE_CTOKEN_ADDRESS, TRANCHE_TWO_TOKEN_ADDRESS, TRANCHE_TWO_CTOKEN_ADDRESS
    } = process.env;
    const accounts = await web3.eth.getAccounts();
    const factoryOwner = accounts[0];
    try {
      const compoundDeployer = await deployProxy(JTranchesDeployer, [], { from: factoryOwner, unsafeAllowCustomTypes: true });
      console.log(`COMPOUND_DEPLOYER=${compoundDeployer.address}`);

      const JCompoundInstance = await deployProxy(JCompound, [PRICE_ORACLE_ADDRESS, FEE_COLLECTOR_ADDRESS, compoundDeployer.address],
        { from: factoryOwner });

      console.log(`COMPOUND_TRANCHE_ADDRESS=${JCompoundInstance.address}`);
      compoundDeployer.setJCompoundAddress(JCompoundInstance.address);
      console.log('compound deployer 1');

      await JCompoundInstance.setCTokenContract(TRANCHE_ONE_TOKEN_ADDRESS, TRANCHE_ONE_CTOKEN_ADDRESS, { from: factoryOwner });
      console.log('compound deployer 2');

      await JCompoundInstance.setCTokenContract(TRANCHE_TWO_TOKEN_ADDRESS, TRANCHE_TWO_CTOKEN_ADDRESS, { from: factoryOwner });

      console.log('compound deployer 3');
      await JCompoundInstance.addTrancheToProtocol(TRANCHE_ONE_TOKEN_ADDRESS, "Tranche A - Compound DAI", "ACDAI", "Tranche B - Compound DAI", "BCDAI", web3.utils.toWei("0.04", "ether"), 8, 18, { from: factoryOwner });

      console.log('compound deployer 4');
      await JCompoundInstance.addTrancheToProtocol(TRANCHE_TWO_TOKEN_ADDRESS, "Tranche A - Compound USDT", "ACUSDT", "Tranche B - Compound USDT", "BCUSDT", web3.utils.toWei("0.02", "ether"), 8, 6, { from: factoryOwner });

      console.log(`JCompound deployed at: ${JCompoundInstance.address}`);
    } catch (error) {
      console.log(error);
    }
  }
}