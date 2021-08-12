// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-24
 * @summary: Incentive Rewards Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IIncentiveRewards {
    // Views
    function lastTimeRewardApplicable() external view returns (uint256);
    function rewardPerToken() external view returns (uint256);
    function earned(address account) external view returns (uint256);

    // Mutative
    function getReward() external;

    function initialize(address _rewardsDistribution,
            address _rewardsToken,
            address _stakingToken) external;

    /* ========== EVENTS ========== */
    event RewardAdded(uint256 reward, uint256 periodFinish);
    event RewardPaid(address indexed user, uint256 reward);
}