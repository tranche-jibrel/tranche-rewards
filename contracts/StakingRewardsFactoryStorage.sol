// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-18
 * @summary: Staking Rewards Factory Storage
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";


contract StakingRewardsFactoryStorage is OwnableUpgradeable {
    /* ========== STATE VARIABLES ========== */
    address public rewardsToken;
    uint256 public stakingRewardsGenesis;

    // the staking tokens for which the rewards contract has been deployed
    address[] public stakingTokens;

    // info about rewards for a particular staking token
    struct StakingRewardsInfo {
        address stakingRewards;
        uint256 rewardAmount;
        uint256 duration;
    }

    // rewards info by staking token
    mapping(address => StakingRewardsInfo) public stakingRewardsInfoByStakingToken;

    address marketsAddress;
    // staking token => trancheToken
    mapping(address => address) public stakingTokenTranches;

}