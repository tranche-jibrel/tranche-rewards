// SPDX-License-Identifier: MIT
/**
 * Created on 2021-01-16
 * @summary: Slice Rewards Storage
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract RewardsDistributionStorage is OwnableUpgradeable {
/* WARNING: NEVER RE-ORDER VARIABLES! Always double-check that new variables are added APPEND-ONLY. Re-ordering variables can permanently BREAK the deployed proxy contract.*/

    struct Market {
        address protocol;
        address aTranche;
        address bTranche;
        uint256 protocolTrNumber;
        uint256 balanceFactor;  // scaled by 1e18
        uint256 trancheARewardsAmount;
        uint256 trancheBRewardsAmount;
        uint256 updateBlock;
        uint256 trancheRewardsPercentage;  // scaled by 1e18
        uint256 extProtocolPercentage;  // scaled by 1e18
        bool enabled;
    }

    mapping(uint256 => Market) public availableMarkets;
    // market -> current rewards balance
    mapping(uint256 => uint256) public fundsATokenBalance;
    mapping(uint256 => uint256) public fundsBTokenBalance;

    uint256 public marketsCounter;

    address public rewardToken;
}