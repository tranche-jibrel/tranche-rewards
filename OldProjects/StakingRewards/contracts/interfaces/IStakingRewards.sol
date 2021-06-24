// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-17
 * @summary: Staking Rewards Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IStakingRewards {
    // Views
    function lastTimeRewardApplicable() external view returns (uint256);
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);

    // Mutative
    function stake(uint256 amount) external;
    function withdraw(uint256 amount) external;
    function getReward() external;
    function exit() external;

    function initialize(address _rewardsDistribution,
            address _rewardsToken,
            address _stakingToken) external;

    /* ========== EVENTS ========== */
    event RewardAdded(uint256 reward, uint256 periodFinish);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
}