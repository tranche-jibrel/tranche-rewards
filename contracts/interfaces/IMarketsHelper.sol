// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-26
 * @summary: Markets Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IMarketsHelper {
    function getTrancheBRewardsPercentage(address _protocol, 
            uint256 _protTrNum, 
            uint256 _underlyingPrice, 
            uint256 _extProtRet, 
            uint256 _balFactor) external view returns (int256 trBRewardsPercentage);
    function getTrancheMarketTVL(address _protocol, uint256 _protTrNum, uint256 _underlyingPrice) external view returns(uint256 trancheTVL);
}