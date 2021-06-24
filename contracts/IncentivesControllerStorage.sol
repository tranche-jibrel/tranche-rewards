// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-24
 * @summary: Incentives Controller Storage contract
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract IncentivesControllerStorage is OwnableUpgradeable {
/* WARNING: NEVER RE-ORDER VARIABLES! Always double-check that new variables are added APPEND-ONLY. Re-ordering variables can permanently BREAK the deployed proxy contract.*/

    struct Market {
        address protocol;
        address aTranche;
        address bTranche;
        address stakingATranche;
        address stakingBTranche;
        uint256 protocolTrNumber;
        uint256 balanceFactor;  // scaled by 1e18
        uint256 updateBlock;
        uint256 extProtocolPercentage;  // scaled by 1e18
        bool enabled;
    }

    struct MarketRewards {
        uint256 underlyingPrice;  // scaled by 1e18
        uint256 marketRewardsPercentage;  // scaled by 1e18
        uint256 trancheARewardsAmount;
        uint256 trancheBRewardsAmount;
        uint256 rewardsDuration;  // in days
        uint256 rewardsTrAAPY; // scaled by 1e18
        uint256 rewardsTrBAPY; // scaled by 1e18
    }

    struct Rewards {
        address rewardsDistribution;
        uint256 periodFinish;
        uint256 rewardRate;
        uint256 lastUpdateTime;
        uint256 rewardPerTokenStored;
    }

    mapping(uint256 => Market) public availableMarkets;
    mapping(uint256 => MarketRewards) public availableMarketsRewards;

    // market -> current rewards info
    mapping(uint256 => Rewards) public trancheARewardsInfo;
    mapping(uint256 => Rewards) public trancheBRewardsInfo;
    // market -> current rewards balance
    mapping(uint256 => uint256) public fundsATokenBalance;
    mapping(uint256 => uint256) public fundsBTokenBalance;
    // market => user => tranche rewards per token
    mapping(uint256 => mapping(address => uint256)) public userRewardPerTokenTrAPaid;
    mapping(uint256 => mapping(address => uint256)) public userRewardPerTokenTrBPaid;
    // market => user => tranche rewards amount
    mapping(uint256 => mapping(address => uint256)) public trARewards;
    mapping(uint256 => mapping(address => uint256)) public trBRewards;

    uint256 public marketsCounter;
    uint256 public stakingRewardsGenesis;
    
    address public rewardFactoryAddress;
    address public rewardsToken;
}