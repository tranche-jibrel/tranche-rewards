// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-17
 * @summary: Staking Rewards Factory contract
 * @author: Jibrel Team
 */
pragma solidity 0.8.7;


import "./IncentiveRewards.sol";
import "./IncentiveRewardsFactoryStorage.sol";
import "./interfaces/IMarkets.sol";


contract IncentiveRewardsFactory is IncentiveRewardsFactoryStorage {
    
    /**
    * @dev initializer
    * @param _rewardsToken rewards token address
    * @param _stakingRewardsGenesis start unix timestamp 
    * @param _markets markets contract address
    */
    function initialize (address _rewardsToken, uint256 _stakingRewardsGenesis, address _markets) public initializer() {
        require(_stakingRewardsGenesis >= block.timestamp, 'IncentiveRewardsFactory::constructor: genesis too soon');
        OwnableUpgradeable.__Ownable_init_unchained();
        rewardsToken = _rewardsToken;
        stakingRewardsGenesis = _stakingRewardsGenesis;
        marketsAddress = _markets;
    }

    ///// permissioned functions
    /**
    * @dev set markets contract address
    * @param _markets markets contract address
    */
    function setMarketAddress(address _markets) external onlyOwner {
        marketsAddress = _markets;
    }

    /**
    * @dev deploy a staking reward contract for the staking token, and store the reward amount
    * the reward will be distributed to the staking reward contract no sooner than the genesis
    * @param _idxMarket market index
    * @param _ATranche is A tranche? 
    * @param _stakingToken staking token address
    * @param _rewardAmount rewards token amount
    * @param _rewardsDuration rewards duration 
    */
    function deploy(uint256 _idxMarket, 
            bool _ATranche,
            address _stakingToken, 
            uint256 _rewardAmount, 
            uint256 _rewardsDuration) public onlyOwner {
        IncentiveRewardsInfo storage info = incentiveRewardsInfoByStakingToken[_stakingToken];
        require(info.stakingRewards == address(0), 'IncentiveRewardsFactory::deploy: already deployed');

        info.stakingRewards = address(new IncentiveRewards());
        IIncentiveRewards(info.stakingRewards).initialize(address(this), rewardsToken, _stakingToken);

        update(_stakingToken, _rewardAmount, _rewardsDuration);
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

    /**
    * @dev get amounts splitted for every enabled market, tranche A & B
    * @param _totalAmount total amount of rewards to be splitted
    * @return trAAmounts tranche A array amounts
    * @return trBAmounts tranche B array amounts
    */
    function getAmountsForMarkets(uint256 _totalAmount) external returns(uint256[] memory trAAmounts, uint256[] memory trBAmounts) {
        (trAAmounts,trBAmounts) = IMarkets(marketsAddress).distributeAllMarketsFunds(_totalAmount);
        return (trAAmounts,trBAmounts);
    }

    /**
    * @dev update reward amount and duration for a tranche token to be staked
    * @param _stakingToken staking token address
    * @param _rewardAmount rewards token amount
    * @param _rewardsDuration rewards duration
    */
    function update(address _stakingToken, uint256 _rewardAmount, uint256 _rewardsDuration) public onlyOwner {
        IncentiveRewardsInfo storage info = incentiveRewardsInfoByStakingToken[_stakingToken];
        require(info.stakingRewards != address(0), 'IncentiveRewardsFactory::update: not deployed');

        info.rewardAmount = _rewardAmount;
        info.duration = _rewardsDuration;
    }

    /**
    * @dev emergency function to pull out tokens
    * @param _token token contract address
    * @param _amount token amount to pull out
    */
    function pullExtraTokens(address _token, uint256 _amount) external onlyOwner {
        IERC20Upgradeable(_token).transfer(msg.sender, _amount);
    }

    ///// permissionless functions
    /**
    * @dev call notifyRewardAmount for all staking tokens.
    */
    function notifyRewardAmounts() public {
        require(stakingTokens.length > 0, 'IncentiveRewardsFactory::notifyRewardAmounts: called before any deploys');
        for (uint i = 0; i < stakingTokens.length; i++) {
            notifyRewardAmount(stakingTokens[i]);
        }
    }

    /**
    * @dev notify reward amount for an individual staking token.
    * this is a fallback in case the notifyRewardAmounts costs too much gas to call for all contracts
    * @param _stakingToken staking token address
    */
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