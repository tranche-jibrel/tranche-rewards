// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-24
 * @summary: Incentive Rewards contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IIncentiveRewards.sol";
import "./IncentiveRewardsStorage.sol";


contract IncentiveRewards is IIncentiveRewards, IncentiveRewardsStorage, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;

    /* ========== CONSTRUCTOR ========== */

    function initialize(address _rewardsDistribution,
            address _rewardsToken,
            address _stakingToken) public override initializer() {
        rewardsToken = _rewardsToken;
        stakingToken = _stakingToken;
        rewardsDistribution = _rewardsDistribution;
    }
    
    /* ========== MODIFIERS ========== */

    modifier updateReward(address account) {
        rewardPerTokenStored = rewardPerToken();
        lastUpdateTime = lastTimeRewardApplicable();
        if (account != address(0)) {
            rewards[account] = earned(account);
            userRewardPerTokenPaid[account] = rewardPerTokenStored;
        }
        _;
    }

    modifier onlyRewardsDistribution() {
        require(msg.sender == rewardsDistribution, "IncentiveRewards: Caller is not RewardsDistribution contract");
        _;
    }

    /* ========== VIEWS ========== */
    function lastTimeRewardApplicable() public view override returns (uint256) {
        return MathUpgradeable.min(block.timestamp, periodFinish);
    }

    function rewardPerToken() public view override returns (uint256) {
        uint256 _totalSupply = IERC20Upgradeable(stakingToken).totalSupply();
        return rewardPerTokenStored.add(lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply));
    }

    function earned(address account) public view override returns (uint256) {
        return IERC20Upgradeable(stakingToken).balanceOf(account).mul(rewardPerToken().sub(userRewardPerTokenPaid[account])).div(1e18).add(rewards[account]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardsToken), msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */

    function notifyRewardAmount(uint256 _reward, uint256 _rewardsDuration) external onlyRewardsDistribution updateReward(address(0)) {
        require(block.timestamp.add(_rewardsDuration) >= periodFinish, "IncentiveRewards: Cannot reduce existing period");
        
        if (block.timestamp >= periodFinish) {
            rewardRate = _reward.div(_rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _reward.add(leftover).div(_rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20Upgradeable(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance.div(_rewardsDuration), "IncentiveRewards: Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(_rewardsDuration);
        emit RewardAdded(_reward, periodFinish);
    }

}
