// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-27
 * @summary: Slicetroller contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
//import "./math/ExponentialNoError.sol";
import "./interfaces/ISlice.sol";
import "./interfaces/IProtocol.sol";
import "./SlicetrollerStorage.sol";

contract Slicetroller is Initializable, SlicetrollerStorage/*, ExponentialNoError*/ {
    using SafeMath for uint256;

    function initialize (address _token) public initializer() {
        OwnableUpgradeable.__Ownable_init();
        sliceAddress = _token;
        admin = msg.sender;
    }

    /**
     * @notice Checks caller is admin
     */
    function adminOrInitializing() internal view returns (bool) {
        return msg.sender == admin;
    }

    /*** Assets You Are In ***/
/*
    /**
     * @notice Returns the assets an account has entered
     * @param account The address of the account to pull assets for
     * @return A dynamic list with the assets the account has entered
     */
/*    function getAssetsIn(address account) external view returns (TrancheToken[] memory) {
        TrancheToken[] memory assetsIn = accountAssets[account];

        return assetsIn;
    }

    /**
     * @notice Returns whether the given account is entered in the given asset
     * @param account The address of the account to check
     * @param trToken The trToken to check
     * @return True if the account is in the asset, otherwise false.
     */
/*    function checkMembership(address account, TrancheToken trToken) external view returns (bool) {
        return markets[address(trToken)].accountMembership[account];
    }

    /**
     * @notice Add assets to be included in account liquidity calculation
     * @param trTokens The list of addresses of the trToken markets to be enabled
     * @return Success indicator for whether each corresponding market was entered
     */
/*    function enterMarkets(address[] memory trTokens) public returns (uint[] memory) {
        uint len = trTokens.length;

        uint[] memory results = new uint[](len);
        for (uint i = 0; i < len; i++) {
            ITrancheToken trToken = ITrancheToken(trTokens[i]);

            results[i] = uint(addToMarketInternal(trToken, msg.sender));
        }

        return results;
    }

    /**
     * @notice Add the market to the borrower's "assets in" for liquidity calculations
     * @param trToken The market to enter
     * @param borrower The address of the account to modify
     * @return Success indicator for whether the market was entered
     */
/*    function addToMarketInternal(TrancheToken trToken, address borrower) internal returns (bool) {
        Market storage marketToJoin = markets[address(trToken)];

        if (marketToJoin.isListed && marketToJoin.accountMembership[borrower] == false) {
            // already joined
            return Error.NO_ERROR;
            
            // survived the gauntlet, add to list
            // NOTE: we store these somewhat redundantly as a significant optimization
            //  this avoids having to iterate through the list for the most common use cases
            //  that is, only when we need to perform liquidity checks
            //  and not whenever we want to check if an account is in a particular market
            marketToJoin.accountMembership[borrower] = true;
            accountAssets[borrower].push(trToken);

            //emit MarketEntered(trToken, borrower);

            return true;
        } else
            return false;
    }

    /**
     * @notice Removes asset from sender's account liquidity calculation
     * @dev Sender must not have an outstanding borrow balance in the asset,
     *  or be providing necessary collateral for an outstanding borrow.
     * @param trTokenAddress The address of the asset to be removed
     * @return Whether or not the account successfully exited the market
     */
/*    function exitMarket(address trTokenAddress) external returns (uint) {
        CToken cToken = CToken(trTokenAddress);
        /* Get sender tokensHeld and amountOwed underlying from the cToken */
/*        (uint oErr, uint tokensHeld, uint amountOwed, ) = cToken.getAccountSnapshot(msg.sender);
        require(oErr == 0, "exitMarket: getAccountSnapshot failed"); // semi-opaque error code

        /* Fail if the sender has a borrow balance */
/*        if (amountOwed != 0) {
            return fail(Error.NONZERO_BORROW_BALANCE, FailureInfo.EXIT_MARKET_BALANCE_OWED);
        }

        /* Fail if the sender is not permitted to redeem all of their tokens */
/*        uint allowed = redeemAllowedInternal(cTokenAddress, msg.sender, tokensHeld);
        if (allowed != 0) {
            return failOpaque(Error.REJECTION, FailureInfo.EXIT_MARKET_REJECTION, allowed);
        }

        Market storage marketToExit = markets[address(cToken)];

        /* Return true if the sender is not already ‘in’ the market */
/*        if (!marketToExit.accountMembership[msg.sender]) {
            return uint(Error.NO_ERROR);
        }

        /* Set cToken account membership to false */
/*        delete marketToExit.accountMembership[msg.sender];

        /* Delete cToken from the account’s list of assets */
        // load into memory for faster iteration
/*        CToken[] memory userAssetList = accountAssets[msg.sender];
        uint len = userAssetList.length;
        uint assetIndex = len;
        for (uint i = 0; i < len; i++) {
            if (userAssetList[i] == cToken) {
                assetIndex = i;
                break;
            }
        }

        // We *must* have found the asset in the list or our redundant data structure is broken
        assert(assetIndex < len);

        // copy last item in list to location of item to be removed, reduce length by 1
        CToken[] storage storedList = accountAssets[msg.sender];
        storedList[assetIndex] = storedList[storedList.length - 1];
        storedList.length--;

        emit MarketExited(cToken, msg.sender);

        return uint(Error.NO_ERROR);
    }
*/
    /**
     * @dev get all markets total value locked
     * @return allMarketTVL total value locked
     */
    function getAllMarketsTVL() public view returns(uint256 allMarketTVL) {
        for (uint256 i = 0; i < allMarkets.length; i++) {
            address trToken = address(allMarkets[i]);
            if (markets[trToken].isSliced) {
                if (markets[trToken].isTrancheA) { 
                    allMarketTVL = getTrancheAMarketTVL(trToken).add(allMarketTVL);
                } else {
                    allMarketTVL = getTrancheBMarketTVL(trToken).add(allMarketTVL);
                }
            }
        }

        return allMarketTVL;
    }

    /**
     * @dev get total value locked in tranche A
     * @param _trToken tranche A token address
     * @return trancheATVL total value locked by tranche A
     */
    function getTrancheAMarketTVL(address _trToken) public view returns(uint256 trancheATVL) {
        if (markets[_trToken].isSliced && markets[_trToken].isTrancheA) {
            address _protocol = markets[_trToken].protocol;
            uint256 _trNum = markets[_trToken].protocolTrNumber;
            trancheATVL = IProtocol(_protocol).getTrAValue(_trNum);
        }
        return trancheATVL;
    }

    /**
     * @dev get total value locked in tranche B
     * @param _trToken tranche B token address
     * @return trancheBTVL total value locked by tranche B
     */
    function getTrancheBMarketTVL(address _trToken) public view returns(uint256 trancheBTVL) {
        if (markets[_trToken].isSliced && !markets[_trToken].isTrancheA) {
            address _protocol = markets[_trToken].protocol;
            uint256 _trNum = markets[_trToken].protocolTrNumber;
            trancheBTVL = IProtocol(_protocol).getTrBValue(_trNum);
        }
        return trancheBTVL;
    }

    /**
     * @notice Set the amount of Slice distributed per block
     * @param _sliceRate The amount of Slice wei per block to distribute
     */
    function _setSliceRate(uint _sliceRate, bool _refreshAuto) public {
        require(adminOrInitializing(), "only admin can change comp rate");

        //uint oldRate = sliceRate;
        sliceRate = _sliceRate;
        //emit NewCompRate(oldRate, sliceRate);
        if (_refreshAuto)
            refreshSliceSpeedsInternal();
    }

    function _setSingleMarketSliceRate(address _trToken, uint _sliceSpeed) public {
        require(adminOrInitializing(), "only admin can change comp rate");

        //uint oldSpeed = sliceSpeeds[_trToken];
        sliceSpeeds[_trToken] = _sliceSpeed;
        //emit NewSliceSpeed(oldRate, sliceRate);
    }

    /**
     * @notice Add markets to sliceMarkets, allowing them to earn Slice in the flywheel
     * @param _trToken The addresses of the markets to add
     * @param _isTrancheA wether is tranche A token or not
     */
    function _addSliceMarket(address _protocol, 
            uint256 _trNum, 
            address _trToken, 
            bool _isTrancheA,
            bool _refreshAuto) public {
        require(adminOrInitializing(), "only admin can add slice market");
        Market storage market = markets[_trToken];
        IProtocol protocol = IProtocol(_protocol);
        address token;
        if (_isTrancheA)
            ( , , token, ) = protocol.trancheAddresses(_trNum);
        else
            ( , , , token ) = protocol.trancheAddresses(_trNum);
        require(_trToken == token, "not a tranche token");
        require(market.isListed == false, "slice market is already listed");
        require(market.isSliced == false, "slice market already added");
        market.protocol = _protocol;
        market.protocolTrNumber = _trNum;
        market.isSliced = true;
        market.isListed = true;
        market.isTrancheA = _isTrancheA;
        allMarkets.push(TrancheToken(_trToken));
        //emit MarketComped(ITrancheToken(_trToken), true);

        if (sliceState[_trToken].index == 0 && sliceState[_trToken].lastUpdatedBlock == 0) {
            sliceState[_trToken] = SliceMarketState({
                index: sliceInitialIndex,
                lastUpdatedBlock: getBlockNumber()
            });
        }

        if (_refreshAuto)
            refreshSliceSpeedsInternal();
    }

    /**
     * @notice Remove a market from sliceMarkets, preventing it from earning Slice in the flywheel
     * @param _trToken The address of the market to drop
     */
    function _disableSliceMarket(address _trToken, bool _refreshAuto) public {
        require(msg.sender == admin, "only admin can drop comp market");

        Market storage market = markets[_trToken];
        require(market.isListed == true, "slice market is not listed");
        require(market.isSliced == true, "market is not a comp market");

        market.isSliced = false;
        //emit MarketComped(ITrancheToken(_trToken), false);
        if (_refreshAuto)
            refreshSliceSpeedsInternal();
    }

    function _enableSliceMarket(address _trToken, bool _refreshAuto) public {
        require(msg.sender == admin, "only admin can drop comp market");

        Market storage market = markets[_trToken];
        require(market.isListed == true, "slice market is not listed");
        require(market.isSliced == false, "market is not a comp market");

        market.isSliced = true;
        //emit MarketComped(ITrancheToken(_trToken), false);

        if (_refreshAuto)
            refreshSliceSpeedsInternal();
    }

    /**
     * @notice Recalculate and update Slice speeds for all Slice markets
     */
    function refreshSliceSpeeds() public {
        require(msg.sender == tx.origin, "only externally owned accounts may refresh speeds");
        refreshSliceSpeedsInternal();
    }

    function refreshSliceSpeedsInternal() internal {
        TrancheToken[] memory allMarkets_ = allMarkets;

        for (uint i = 0; i < allMarkets_.length; i++) {
            ITrancheToken trToken = allMarkets_[i];
            //Exp memory borrowIndex = Exp({mantissa: trToken.borrowIndex()});
            updateSliceIndex(address(trToken));
        }
/*
        Exp memory totalUtility = Exp({mantissa: 0});
        Exp[] memory utilities = new Exp[](allMarkets_.length);
        for (uint i = 0; i < allMarkets_.length; i++) {
            ITrancheToken trToken = allMarkets_[i];
            if (markets[address(trToken)].isSliced) {
                IProtocol protocol = IProtocol(markets[address(trToken)].protocol);
                Exp memory assetPrice;
                if (markets[address(trToken)].isTrancheA)
                    assetPrice = Exp({mantissa: protocol.getTrancheAExchangeRate(markets[address(trToken)].protocolTrNumber)});
                else
                    assetPrice = Exp({mantissa: protocol.getTrancheBExchangeRate(markets[address(trToken)].protocolTrNumber, 0)});

                //Exp memory utility = mul_(assetPrice, trToken.totalBorrows());
                Exp memory utility = mul_(assetPrice, 1);
                utilities[i] = utility;
                totalUtility = add_(totalUtility, utility);
            }
        }

        for (uint i = 0; i < allMarkets_.length; i++) {
            ITrancheToken trToken = allMarkets[i];
            uint newSpeed = totalUtility.mantissa > 0 ? mul_(sliceRate, div_(utilities[i], totalUtility)) : 0;
            sliceSpeeds[address(trToken)] = newSpeed;
            //emit SliceSpeedUpdated(trToken, newSpeed);
        }
*/
        uint256 allMarketsTVL = getAllMarketsTVL();
        uint256 singleMarketTVL;
        for (uint i = 0; i < allMarkets_.length; i++) {
            ITrancheToken trToken = allMarkets_[i];
            if (markets[address(trToken)].isSliced) {
                //IProtocol protocol = IProtocol(markets[address(trToken)].protocol);
                if (markets[address(trToken)].isTrancheA)
                    singleMarketTVL = getTrancheAMarketTVL(address(trToken)).mul(1e18);
                else
                    singleMarketTVL = getTrancheBMarketTVL(address(trToken)).mul(1e18);
                uint256 percentTVL = singleMarketTVL.div(allMarketsTVL);
                uint newSpeed = allMarketsTVL > 0 ? sliceRate.mul(percentTVL).div(1e18) : 0;
                sliceSpeeds[address(trToken)] = newSpeed;
                //emit SliceSpeedUpdated(trToken, newSpeed);
            }
        }
    }

    /**
     * @notice Accrue Slice to the market by updating the supply index
     * @param trToken The market whose supply index to update
     */
    function updateSliceIndex(address trToken) internal {
        SliceMarketState storage state = sliceState[trToken];
        uint sliceSpeed = sliceSpeeds[trToken];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = blockNumber.sub(uint256(state.lastUpdatedBlock));
        if (deltaBlocks > 0 && sliceSpeed > 0) {
            uint256 supplyTokens = ITrancheToken(trToken).totalSupply();
            uint256 sliceAccrued = deltaBlocks.mul(sliceSpeed);
            uint256 ratio = supplyTokens > 0 ? sliceAccrued.mul(1e18).div(supplyTokens) : 0;
            //Double memory index = add_(Double({mantissa: state.index}), ratio);
            uint256 index = state.index.add(ratio);
            sliceState[trToken] = SliceMarketState({
                index: index,   // safe224(index.mantissa, "new index exceeds 224 bits"),
                lastUpdatedBlock: blockNumber
            });
        } else if (deltaBlocks > 0) {
            state.lastUpdatedBlock = blockNumber;
        }
    }

    /**
     * @notice Transfer Slice to the user, if they are above the threshold
     * @dev Note: If there is not enough Slice, we do not perform the transfer all.
     * @param user The address of the user to transfer Slice to
     * @param userAccrued The amount of Slice to (possibly) transfer
     * @return The amount of Slice which was NOT transferred to the user
     */
    function transferSlice(address user, uint userAccrued, uint threshold) internal returns (uint) {
        if (userAccrued >= threshold && userAccrued > 0) {
            ISlice slice = ISlice(getSliceAddress());
            uint sliceRemaining = slice.balanceOf(address(this));
            if (userAccrued <= sliceRemaining) {
                slice.transfer(user, userAccrued);
                return 0;
            }
        }
        return userAccrued;
    }

    /**
     * @notice Calculate additional accrued COMP for a contributor since last accrual
     * @param contributor The address to calculate contributor rewards for
     */
    function updateContributorRewards(address contributor) public {
        uint sliceSpeed = sliceContributorSpeeds[contributor];
        uint blockNumber = getBlockNumber();
        uint deltaBlocks = blockNumber.sub(lastContributorBlock[contributor]);
        if (deltaBlocks > 0 && sliceSpeed > 0) {
            uint newAccrued = deltaBlocks.mul(sliceSpeed);
            uint contributorAccrued = sliceAccrued[contributor].add(newAccrued);

            sliceAccrued[contributor] = contributorAccrued;
            lastContributorBlock[contributor] = blockNumber;
        }
    }

    /**
     * @notice Set slice speed for a single contributor
     * @param contributor The contributor whose COMP speed to update
     * @param sliceSpeed New COMP speed for contributor
     */
    function _setContributorSliceSpeed(address contributor, uint sliceSpeed) public {
        require(adminOrInitializing(), "only admin can set comp speed");

        // note that COMP speed could be set to 0 to halt liquidity rewards for a contributor
        updateContributorRewards(contributor);
        if (sliceSpeed == 0) {
            // release storage
            delete lastContributorBlock[contributor];
        }
        lastContributorBlock[contributor] = getBlockNumber();
        sliceContributorSpeeds[contributor] = sliceSpeed;

        //emit ContributorCompSpeedUpdated(contributor, compSpeed);
    }

    /**
     * @notice Transfer Slice to the user
     * @dev Note: If there is not enough Slice, we do not perform the transfer all.
     * @param user The address of the user to transfer Slice to
     * @param amount The amount of Slice to (possibly) transfer
     * @return The amount of Slice which was NOT transferred to the user
     */
    function grantSliceInternal(address user, uint amount) internal returns (uint) {
        ISlice slice = ISlice(getSliceAddress());
        uint sliceRemaining = slice.balanceOf(address(this));
        if (amount > 0 && amount <= sliceRemaining) {
            slice.transfer(user, amount);
            return 0;
        }
        return amount;
    }

    /**
     * @notice Calculate Slice accrued by a supplier and possibly transfer it to them
     * @param trToken The market in which the supplier is interacting
     * @param user The address of the supplier to distribute Slice to
     */
    function distributeSlice(address trToken, address user, bool distributeAll) internal {
        SliceMarketState storage state = sliceState[trToken];
        // Double memory supplyIndex = Double({mantissa: state.index});
        // Double memory userIndex = Double({mantissa: sliceIndex[trToken][user]});
        uint256 supplyIndex = state.index;
        uint256 userIndex = sliceIndex[trToken][user];
        sliceIndex[trToken][user] = supplyIndex;

        if (userIndex == 0 && supplyIndex > 0) {
            userIndex = sliceInitialIndex;
        }

        // Double memory deltaIndex = sub_(supplyIndex, userIndex);
        uint256 deltaIndex = supplyIndex.sub(userIndex);
        uint userTokens = ITrancheToken(trToken).balanceOf(user);
        uint userDelta = userTokens.mul(deltaIndex);
        uint userAccrued = sliceAccrued[user].add(userDelta);
        sliceAccrued[user] = transferSlice(user, userAccrued, distributeAll ? 0 : sliceClaimThreshold);
        //emit DistributedSupplierComp(ITrancheToken(trToken), supplier, supplierDelta, supplyIndex.mantissa);
    }

    /**
     * @notice Claim all the comp accrued by holder in all markets
     * @param holder The address to claim Slice for
     */
    function claimComp(address holder) public {
        return claimComp(holder, allMarkets);
    }

    /**
     * @notice Claim all the comp accrued by holder in the specified markets
     * @param holder The address to claim Slice for
     * @param sTokens The list of markets to claim Slice in
     */
    function claimComp(address holder, TrancheToken[] memory sTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimComp(holders, sTokens);
    }

    /**
     * @notice Claim all comp accrued by the holders
     * @param holders The addresses to claim Slice for
     * @param sTokens The list of markets to claim Slice in
     */
    function claimComp(address[] memory holders, TrancheToken[] memory sTokens) public {
        for (uint i = 0; i < sTokens.length; i++) {
            TrancheToken trToken = sTokens[i];
            require(markets[address(trToken)].isListed, "market must be listed");
            updateSliceIndex(address(trToken));
            for (uint j = 0; j < holders.length; j++) {
                distributeSlice(address(trToken), holders[j], true);
                sliceAccrued[holders[j]] = grantSliceInternal(holders[j], sliceAccrued[holders[j]]);
            }
        }
    }

    /**
     * @notice Return all of the markets
     * @dev The automatic getter may be used to access an individual market.
     * @return The list of market addresses
     */
    function getAllMarkets() public view returns (TrancheToken[] memory) {
        return allMarkets;
    }

    function getBlockNumber() public view returns (uint256) {
        return block.number;
    }

    /**
     * @notice Return the address of the Slice token
     * @return The address of Slice
     */
    function getSliceAddress() public view returns (address) {
        return sliceAddress;
    }

}
