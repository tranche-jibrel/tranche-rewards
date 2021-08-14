// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-18
 * @summary: Markets Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IIncentivesController {
    // function trancheANewEnter(address account, uint256 amount, address trancheA) external;
    // function trancheBNewEnter(address account, uint256 amount, address trancheA) external;

    function claimRewardsAllMarkets() external;
    function claimRewardSingleMarketTrA(uint256 _idxMarket, uint256 _distCount) external;
    function claimRewardSingleMarketTrB(uint256 _idxMarket, uint256 _distCount) external;
}
