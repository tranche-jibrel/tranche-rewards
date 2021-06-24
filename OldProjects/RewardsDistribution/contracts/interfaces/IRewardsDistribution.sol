// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Slice Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IRewardsDistribution {
    event SliceSpeedUpdated(uint256 indexed id, uint256 sliceSpeed);

	/**
	 * @dev This event emits when new funds are distributed to markets
	 */
	event FundsDistributed(uint256 indexed id, uint256 trAAmount, uint256 trBAmount, uint256 blockNumber);

	/**
	 * @dev This event emits when distributed funds are distributed to users
	 */
	event RewardsDistributedAPY(uint256 indexed id, uint256 rewardsTrAAPY, uint256 rewardsTrBAPY, uint256 blockNumber);

	/**
	 * @dev This event emits when new market is added
	 */
	event NewMarketAdded(uint256 indexed id, address indexed protocol, uint256 protocolTrNumber, uint256 balanceFactor, 
		uint256 extProtocolPercentage, uint256 marketRewardsPercentage, uint256 rewardsFrequency, uint256 blockNumber);
}