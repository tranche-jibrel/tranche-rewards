// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-18
 * @summary: Staking Rewards Factory Storage
 * @author: Jibrel Team
 */
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


contract IncentiveRewardsFactoryStorage is OwnableUpgradeable {
    /* ========== STATE VARIABLES ========== */
    address public rewardsToken;
    uint256 public stakingRewardsGenesis;

    // the staking tokens for which the rewards contract has been deployed
    address[] public stakingTokens;

    // info about rewards for a particular staking token
    struct IncentiveRewardsInfo {
        address stakingRewards;
        uint256 rewardAmount;
        uint256 duration;
    }

    address public marketsAddress;

    // rewards info by staking token
    mapping(address => IncentiveRewardsInfo) public incentiveRewardsInfoByStakingToken;

    // staking token => trancheToken
    mapping(address => address) public stakingTokenTranches;

}