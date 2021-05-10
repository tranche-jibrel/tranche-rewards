// SPDX-License-Identifier: MIT
/**
 * Created on 2021-01-16
 * @summary: Slice Rewards Storage
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";

contract TokenRewardsStorage is OwnableUpgradeable {
/* WARNING: NEVER RE-ORDER VARIABLES! Always double-check that new variables are added APPEND-ONLY. Re-ordering variables can permanently BREAK the deployed proxy contract.*/
    uint256 public constant PERCENT_DIVIDER = 10000; // percentage divider
    // optimize, see https://github.com/ethereum/EIPs/issues/1726#issuecomment-472352728
    uint256 constant public pointsMultiplier = 2**128;

    struct Market {
        address protocol;
        address aTranche;
        address bTranche;
        uint256 protocolTrNumber;
        uint256 balanceFactor;  // scaled by 1e18
        uint256 trancheARewardsAmount;
        uint256 trancheBRewardsAmount;
        uint256 updateBlock;
        uint256 trancheRewardsPercentage;
        uint256 extProtocolPercentage;
        uint256 pointsPerShareA;
        uint256 pointsPerShareB;
        bool enabled;
    }

    //IERC20Upgradeable[] public allTrancheTokens;
    mapping(uint256 => Market) public availableMarkets;
    // market -> current rewards balance
    mapping(uint256 => uint256) public fundsATokenBalance;
    mapping(uint256 => uint256) public fundsBTokenBalance;

    uint256 public marketsCounter;
    uint256 public allMarketTVL;

    address public rewardToken;

    //mapping(address => int256) public pointsACorrection;
    //mapping(address => int256) public pointsBCorrection;
    mapping(address => uint256) public withdrawnFunds;
}