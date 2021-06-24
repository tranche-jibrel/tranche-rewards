// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-18
 * @summary: Staking Rewards Storage
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract IncentiveRewardsStorage is OwnableUpgradeable {
    /* ========== STATE VARIABLES ========== */
    address public rewardsDistribution;
    address public rewardsToken;
    address public stakingToken;

    uint256 public periodFinish = 0;
    uint256 public rewardRate = 0;
    uint256 public lastUpdateTime;
    uint256 public rewardPerTokenStored;

    mapping(address => uint256) public userRewardPerTokenPaid;
    mapping(address => uint256) public rewards;

}