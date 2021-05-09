// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-27
 * @summary: Slicetroller storage contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "./TrancheToken.sol";

contract SlicetrollerStorage is OwnableUpgradeable {

    uint256 public constant doubleScale = 1e36;
    uint256 public constant PERCENT_DIVIDER = 10000;  // percentage divider

    struct Market {
        // protocol address
        address protocol;

        // protocol tranche number
        uint256 protocolTrNumber;

        // Whether or not this market is tranche A
        bool isTrancheA;

        // Whether or not this market is listed
        bool isListed;

        // Per-market mapping of "accounts in this asset"
        //mapping(address => bool) accountMembership;

        // Whether or not this market receives Slice
        bool isSliced;

        // external protocol return
        uint256 externalProtocolReturn;

        // unbalance percentage of tranche B respect to tranche A when tranche B = external protocol percentage (scaled by 1e18)
        uint256 balanceFactor;  // 550000000000000000 means 55% for tranche B and 45% for tranche A
    }

    struct SliceMarketState {
        // The market's last updated silceIndex
        uint256 index;

        // The block number the index was last updated at
        uint256 lastUpdatedBlock;
    }

    // slice token address
    address public sliceAddress;

    // Administrator for this contract
    address public admin;

    /**
     * Official mapping of trTokens -> Market metadata
     * @dev Used e.g. to determine if a market is supported
     */
    mapping(address => Market) public markets;

    // A list of all markets
    TrancheToken[] public allMarkets;

    // The rate at which the flywheel distributes Slice, per block
    uint256 public sliceRate;

    // The portion of compRate that each market currently receives
    mapping(address => uint256) public sliceSpeeds;

    //  The Slice market supply state for each market
    mapping(address => SliceMarketState) public sliceState;

    //  The Slice borrow index for each market for each supplier as of the last time they accrued Slice
    mapping(address => mapping(address => uint256)) public sliceIndex;

    //  The Slice accrued but not yet transferred to each user
    mapping(address => uint256) public sliceAccrued;

    //  The portion of Slice that each contributor receives per block
    mapping(address => uint256) public sliceContributorSpeeds;

    //  Last block at which a contributor's Slice rewards have been allocated
    mapping(address => uint256) public lastContributorBlock;

    // The initial Slice index for a market
    uint224 public constant sliceInitialIndex = 1e18;

    // The threshold above which the flywheel transfers Slice, in wei
    uint256 public constant sliceClaimThreshold = 0.001e18;

    // Per-account mapping of "assets you are in", capped by maxAssets
    mapping(address => TrancheToken[]) public accountAssets;
}