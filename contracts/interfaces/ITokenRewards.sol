// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Slice Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface ITokenRewards {
    event NewSliceRate(uint256 oldRate, uint256 sliceRate);

	/**
	 * @dev This event emits when new funds are distributed
	 * @param by the address of the sender who distributed funds
	 * @param fundsDistributed the amount of funds received for distribution
	 */
	event FundsDistributed(address indexed by, uint256 fundsDistributed);

	/**
	 * @dev This event emits when distributed funds are withdrawn by a token holder.
	 * @param by the address of the receiver of funds
	 * @param fundsWithdrawn the amount of funds that were withdrawn
	 */
	event FundsWithdrawn(address indexed by, uint256 fundsWithdrawn);
}