// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-17
 * @summary: Staking Rewards Factory contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;


import "./IncentiveRewards.sol";
import "./IncentiveRewardsFactoryStorage.sol";
import "./interfaces/IMarkets.sol";


contract IncentiveRewardsFactory is IncentiveRewardsFactoryStorage {
    
    function initialize (address _rewardsToken, uint256 _stakingRewardsGenesis) public initializer() {
        require(_stakingRewardsGenesis >= block.timestamp, 'IncentiveRewardsFactory::constructor: genesis too soon');
        OwnableUpgradeable.__Ownable_init_unchained();
        rewardsToken = _rewardsToken;
        stakingRewardsGenesis = _stakingRewardsGenesis;
    }

    ///// permissioned functions

    function setMarketAddress(address _markets) external onlyOwner {
        marketsAddress = _markets;
    }

    // deploy a staking reward contract for the staking token, and store the reward amount
    // the reward will be distributed to the staking reward contract no sooner than the genesis
    function deploy(uint256 _idxMarket, 
            bool _ATranche,
            address _stakingToken, 
            uint256 _rewardAmount, 
            uint256 _rewardsDuration) public onlyOwner {
        IncentiveRewardsInfo storage info = incentiveRewardsInfoByStakingToken[_stakingToken];
        require(info.stakingRewards == address(0), 'IncentiveRewardsFactory::deploy: already deployed');

        info.stakingRewards = address(new IncentiveRewards());
        IIncentiveRewards(info.stakingRewards).initialize(address(this), rewardsToken, _stakingToken);
        // info.stakingRewards = address(new StakingRewards(/*_rewardsDistribution=*/ address(this), rewardsToken, _stakingToken));
        update(_stakingToken, _rewardAmount, _rewardsDuration);
        // info.rewardAmount = _rewardAmount;
        // info.duration = _rewardsDuration;
        stakingTokens.push(_stakingToken);
        
        if (_ATranche) {
            IMarkets(marketsAddress).setStakingATrancheMarket(_idxMarket,  info.stakingRewards);
            stakingTokenTranches[info.stakingRewards] = IMarkets(marketsAddress).getATrancheMarket(_idxMarket);
        }
        else {
            IMarkets(marketsAddress).setStakingBTrancheMarket(_idxMarket,  info.stakingRewards);
            stakingTokenTranches[info.stakingRewards] = IMarkets(marketsAddress).getBTrancheMarket(_idxMarket);
        }
    }

    function update(address _stakingToken, uint256 _rewardAmount, uint256 _rewardsDuration) public onlyOwner {
        IncentiveRewardsInfo storage info = incentiveRewardsInfoByStakingToken[_stakingToken];
        require(info.stakingRewards != address(0), 'IncentiveRewardsFactory::update: not deployed');

        info.rewardAmount = _rewardAmount;
        info.duration = _rewardsDuration;
    }

    function pullExtraTokens(address token, uint256 amount) external onlyOwner {
        IERC20Upgradeable(token).transfer(msg.sender, amount);
    }

    ///// permissionless functions

    // call notifyRewardAmount for all staking tokens.
    function notifyRewardAmounts() public {
        require(stakingTokens.length > 0, 'IncentiveRewardsFactory::notifyRewardAmounts: called before any deploys');
        for (uint i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    // notify reward amount for an individual staking token.
    // this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    function notifyRewardAmount(address _stakingToken) public {
        require(block.timestamp >= stakingRewardsGenesis, 'IncentiveRewardsFactory::notifyRewardAmount: not ready');

        IncentiveRewardsInfo storage info = incentiveRewardsInfoByStakingToken[_stakingToken];
        require(info.stakingRewards != address(0), 'IncentiveRewardsFactory::notifyRewardAmount: not deployed');

        if (info.rewardAmount > 0 && info.duration > 0) {
            uint256 rewardAmount = info.rewardAmount;
            uint256 duration = info.duration;
            info.rewardAmount = 0;
            info.duration = 0;

            require(
                IERC20Upgradeable(rewardsToken).transfer(info.stakingRewards, rewardAmount),
                'IncentiveRewardsFactory::notifyRewardAmount: transfer failed'
            );
            IncentiveRewards(info.stakingRewards).notifyRewardAmount(rewardAmount, duration);
        }
    }

}