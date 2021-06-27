// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-27
 * @summary: Slicetroller contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";
import "./interfaces/IProtocol.sol";
import "./math/SafeMathInt.sol";
import "./SlicetrollerStorage.sol";

contract Slicetroller is Initializable, SlicetrollerStorage {
    using SafeMath for uint256;
    using SafeMathInt for int256;

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

    // (((extProtRet-(totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL)/extProtRet)+balFactor)*dailySliceAmount
    // (totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL = trancheBReturn
    // extProtRet-(trancheBReturn) = DeltaAPY
    // DeltaAPY / extProtRet = DeltaAPYPercentage
    // DeltaAPYPercentage + balanceFactor = trBPercentage
    // trBPercentage * dailySliceAmount = trBSliceRewards
    // dailySliceAmount - trBSliceRewards = trASliceRewards

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

    function getTranchesTVL(address _trA, address _trB) public view returns(uint256 tranchesTVL) {
        address _trAProtocol = markets[_trA].protocol;
        address _trBProtocol = markets[_trB].protocol;
        require(_trAProtocol == _trBProtocol, "not the same protocol");
        uint256 _trANum = markets[_trA].protocolTrNumber;
        uint256 _trBNum = markets[_trB].protocolTrNumber;
        require(_trANum == _trBNum, "not the same tranches");
        tranchesTVL = IProtocol(_trAProtocol).getTotalValue(_trANum);
        return tranchesTVL;
    }

    /**
     * @dev get total value locked in tranche A token
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

    function getTrancheAReturns(address _trToken) public view returns (uint trAReturns) {
        require(markets[_trToken].isTrancheA, "token is not a trancheA token");
        if (markets[_trToken].isSliced) {
            address _protocol = markets[_trToken].protocol;
            uint256 _trNum = markets[_trToken].protocolTrNumber;
            uint256 trancheARPB = IProtocol(_protocol).getTrancheACurrentRPB(_trNum);
            uint256 totBlksYear = IProtocol(_protocol).totalBlocksPerYear();
            uint256 trAPrice = IProtocol(_protocol).getTrancheAExchangeRate(_trNum);
            // calc percentage
            // trA APY = trARPB * 2102400 / trAPrice
            // trB APY = ( compoundAPY * trBSupply + trASupply * (compoundAPY - trA APY)  ) / trBSupply
            // with compound APY = supplyRatePerBlock * (10 ^18) / 2102400
            trAReturns = trancheARPB.mul(totBlksYear).mul(1e18).div(trAPrice);  //check decimals!!!
        }
        return trAReturns;
    }

    function getTrancheBReturns(address _trToken) public view returns (int256 trBReturns) {
        require(!markets[_trToken].isTrancheA, "token is not a trancheB token");
        if (markets[_trToken].isSliced) {
            address _protocol = markets[_trToken].protocol;
            uint256 _trNum = markets[_trToken].protocolTrNumber;
            address tokenTrA;
            ( , , tokenTrA, ) = IProtocol(_protocol).trancheAddresses(_trNum);
            if(markets[tokenTrA].isListed) {
                uint256 trAReturns = getTrancheAReturns(tokenTrA);
                uint256 trARetPercent = trAReturns.add(1e18); //(1+trARet)
                uint256 totTrancheTVL = getTranchesTVL(tokenTrA, _trToken);
                uint256 trATVL = getTrancheAMarketTVL(tokenTrA);
                uint256 trBTVL = totTrancheTVL.sub(trATVL);
                uint256 totRetPercent = (markets[_trToken].externalProtocolReturn).add(1e18); //(1+extProtRet)

                uint256 extFutureValue = totTrancheTVL.mul(totRetPercent).div(1e18); // totalTVL*(1+extProtRet)
                uint256 trAFutureValue = trATVL.mul(trARetPercent).div(1e18); // trATVL*(1+trARet)
                // (totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL
                trBReturns = (int256(extFutureValue).sub(int256(trAFutureValue)).sub(int256(trBTVL))).mul(int256(1e18)).div(int256(trBTVL));  //check decimals!!!
            } else 
                trBReturns = 0;
        }
        return trBReturns;
    }

    function getTrancheBRewardsPercentage(address _trToken) public view returns (int256 trBRewardsPercentage) {
        require(!markets[_trToken].isTrancheA, "token is not a trancheB token");
        int256 trBReturns = int256(getTrancheBReturns(_trToken));
        int256 extProtRet = int256(markets[_trToken].externalProtocolReturn);
        int256 deltaAPY = (extProtRet).sub(trBReturns); // extProtRet - trancheBReturn = DeltaAPY
        int256 deltaAPYPercentage = deltaAPY.mul(1e18).div(extProtRet); // DeltaAPY / extProtRet = DeltaAPYPercentage
        trBRewardsPercentage = deltaAPYPercentage.add(int256(markets[_trToken].balanceFactor)); // DeltaAPYPercentage + balanceFactor = trBPercentage
        if (trBRewardsPercentage < 0 )
            trBRewardsPercentage = 0;
        else if (trBRewardsPercentage > 1e18)
            trBRewardsPercentage = 1e18;
        return trBRewardsPercentage;
    }

    /**
     * @dev get total value locked in tranche B token
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
     * @param _protocol protocol address
     * @param _trNum protocol tranche number 
     * @param _trToken The addresses of the markets to add
     * @param _isTrancheA wether is tranche A token or not
     * @param _refreshAuto wether automatically refresh slice speed or not
     * @param _balFactor balance factor (SIR)
     * @param _extProtReturn external protocol return
     */
    function _addSliceMarket(address _protocol, 
            uint256 _trNum, 
            address _trToken, 
            bool _isTrancheA,
            bool _refreshAuto,
            uint256 _balFactor,
            uint256 _extProtReturn) public onlyOwner {
        require(adminOrInitializing(), "only admin can add slice market");
        require(_balFactor < 10000, "check unbalanced percentage");
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
        if(_isTrancheA)
            market.balanceFactor = uint256(1e18).sub(_balFactor);
        else
            market.balanceFactor = _balFactor;
        market.externalProtocolReturn = _extProtReturn;
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

    function setExternalProtocolReturn(address _trToken, uint256 _extProtReturn) external {
        require(markets[_trToken].isListed == true, "slice market is not listed");
        markets[_trToken].externalProtocolReturn = _extProtReturn;
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
            IERC20Upgradeable slice = IERC20Upgradeable(getSliceAddress());
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
        IERC20Upgradeable slice = IERC20Upgradeable(getSliceAddress());
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
     * @notice Claim all the slice accrued by holder in all markets
     * @param holder The address to claim Slice for
     */
    function claimSlice(address holder) public {
        return claimSlice(holder, allMarkets);
    }

    /**
     * @notice Claim all the slice accrued by holder in the specified markets
     * @param holder The address to claim Slice for
     * @param sTokens The list of markets to claim Slice in
     */
    function claimSlice(address holder, TrancheToken[] memory sTokens) public {
        address[] memory holders = new address[](1);
        holders[0] = holder;
        claimSlice(holders, sTokens);
    }

    /**
     * @notice Claim all slice accrued by the holders
     * @param holders The addresses to claim Slice for
     * @param sTokens The list of markets to claim Slice in
     */
    function claimSlice(address[] memory holders, TrancheToken[] memory sTokens) public {
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