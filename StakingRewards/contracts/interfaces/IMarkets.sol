// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-18
 * @summary: Markets Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IMarkets {
    event SliceSpeedUpdated(uint256 indexed id, uint256 sliceSpeed);

	event NewMarketAdded(uint256 indexed id, address indexed protocol, uint256 protocolTrNumber, uint256 balanceFactor, 
		uint256 extProtocolPercentage, uint256 marketRewardsPercentage, uint256 rewardsFrequency, uint256 blockNumber);

    function setStakingATrancheMarket(uint256 _idxMarket, address _staking) external;
    function setStakingBTrancheMarket(uint256 _idxMarket, address _staking) external;
    function getATrancheMarket(uint256 _idxMarket) external view returns(address);
    function getBTrancheMarket(uint256 _idxMarket) external view returns(address);
    function getATrancheStaking(uint256 _idxMarket) external view returns(address);
    function getBTrancheStaking(uint256 _idxMarket) external view returns(address);
}