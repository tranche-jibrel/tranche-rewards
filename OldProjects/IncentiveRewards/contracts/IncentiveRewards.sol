// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-24
 * @summary: Incentive Rewards contract
 * @author: Jibrel Team
 */
pragma solidity 0.8.7;

import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "./interfaces/IIncentiveRewards.sol";
import "./IncentiveRewardsStorage.sol";


contract IncentiveRewards is IIncentiveRewards, IncentiveRewardsStorage, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;

    /* ========== CONSTRUCTOR ========== */
    /**
    * @dev initializer
    * @param _rewardsDistribution distributor address
    * @param _rewardsToken reward token address
    * @param _stakingToken tranche token address
    */
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
    /**
    * @dev find the minimum timestamp between actual and finish time
    */
    function lastTimeRewardApplicable() public view override returns (uint256) {
        return MathUpgradeable.min(block.timestamp, periodFinish);
    }

    /**
    * @dev rewards per token staked
    */
    function rewardPerToken() public view override returns (uint256) {
        uint256 _totalSupply = IERC20Upgradeable(stakingToken).totalSupply();
        return rewardPerTokenStored.add(lastTimeRewardApplicable().sub(lastUpdateTime).mul(rewardRate).mul(1e18).div(_totalSupply));
    }

    /**
    * @dev rewards earned per user account
    * @param _account user wallet address
    * @return accrued rewards
    */
    function earned(address _account) public view override returns (uint256) {
        return IERC20Upgradeable(stakingToken).balanceOf(_account).mul(rewardPerToken().sub(userRewardPerTokenPaid[_account])).div(1e18).add(rewards[_account]);
    }

    /* ========== MUTATIVE FUNCTIONS ========== */
    /**
    * @dev claim rewards earned per user account, sending reward tokens to user account (if any)
    */
    function getReward() public override nonReentrant updateReward(msg.sender) {
        uint256 reward = rewards[msg.sender];
        if (reward > 0) {
            rewards[msg.sender] = 0;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardsToken), msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /* ========== RESTRICTED FUNCTIONS ========== */
    /**
    * @dev notify and update rewards amount and duration
    * @param _rewardAmount distributor address
    * @param _rewardsDuration reward duration
    */
    function notifyRewardAmount(uint256 _rewardAmount, uint256 _rewardsDuration) external onlyRewardsDistribution updateReward(address(0)) {
        require(block.timestamp.add(_rewardsDuration) >= periodFinish, "IncentiveRewards: Cannot reduce existing period");
        
        if (block.timestamp >= periodFinish) {
            rewardRate = _rewardAmount.div(_rewardsDuration);
        } else {
            uint256 remaining = periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(rewardRate);
            rewardRate = _rewardAmount.add(leftover).div(_rewardsDuration);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint balance = IERC20Upgradeable(rewardsToken).balanceOf(address(this));
        require(rewardRate <= balance.div(_rewardsDuration), "IncentiveRewards: Provided reward too high");

        lastUpdateTime = block.timestamp;
        periodFinish = block.timestamp.add(_rewardsDuration);
        emit RewardAdded(_rewardAmount, periodFinish);
    }

}
