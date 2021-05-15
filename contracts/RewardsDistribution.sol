// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Slice Rewards contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;


import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./RewardsDistributionStorage.sol";
import "./interfaces/IProtocol.sol";
import "./interfaces/IRewardsDistribtuion.sol";
import "./math/SafeMathInt.sol";

contract RewardsDistribution is OwnableUpgradeable, RewardsDistributionStorage, IRewardsDistribtuion {
    using SafeMath for uint256;
    using SafeMathInt for int256;
    //using WadRayMath for uint256;

    function initialize (address _token) public initializer() {
        OwnableUpgradeable.__Ownable_init();
        rewardToken = _token;
    }
    
    function toInt256Safe(uint256 a) internal pure returns (int256) {
        int256 b = int256(a);
        require(b >= 0);
        return b;
    }

    function addTrancheMarket(address _protocol, 
            uint256 _protocolTrNumber,
            uint256 _balFactor,
            uint256 _tranchePercentage,
            uint256 _extProtReturn) public {
        availableMarkets[marketsCounter].protocol = _protocol;
        availableMarkets[marketsCounter].protocolTrNumber = _protocolTrNumber;
        ( , , address trAAddress, address trBAddress) = IProtocol(_protocol).trancheAddresses(_protocolTrNumber);
        availableMarkets[marketsCounter].aTranche = trAAddress;
        availableMarkets[marketsCounter].bTranche = trBAddress;
        availableMarkets[marketsCounter].balanceFactor = _balFactor; // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarkets[marketsCounter].updateBlock = block.number;
        availableMarkets[marketsCounter].enabled = true;
        availableMarkets[marketsCounter].trancheRewardsPercentage = _tranchePercentage;  //5000 --> 50% (divider = 10000)
        availableMarkets[marketsCounter].extProtocolPercentage = _extProtReturn;  // percentage scaled by 10^18: 0 - 1e18 (i.e. 30000000000000000 = 0.03 * 1e18 = 3%)
        marketsCounter = marketsCounter.add(1);
    }

    function enableTrancheMarket(uint256 _idxMarket) public {
        availableMarkets[_idxMarket].enabled = true;
    }

    function disableTrancheMarket(uint256 _idxMarket) public {
        availableMarkets[_idxMarket].enabled = false;
    }

    function changeSingleTrancheRewardsPercentage(uint256 _idxMarket, uint256 _percentage) public onlyOwner {
        require(_idxMarket < marketsCounter, "Market does not exist");
        availableMarkets[_idxMarket].trancheRewardsPercentage = _percentage;
    }

    function checkTrancheRewardsPercentage() public view returns (uint256 totalPercentage) {
        for (uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled) {
                totalPercentage = totalPercentage.add(availableMarkets[i].trancheRewardsPercentage);
            }
        }
        return totalPercentage;
    }

    function setExtProtocolPercent(uint256 _idxMarket, uint256 _extProtPerc) public {
        availableMarkets[_idxMarket].extProtocolPercentage = _extProtPerc;
    }

    function setBalanceFactor(uint256 _idxMarket, uint256 _balFactor) public {
        availableMarkets[_idxMarket].balanceFactor = _balFactor;
    }

    /**
     * @notice Recalculate and update Slice speeds for all Slice markets
     */
    function refreshSliceSpeeds() public {
        require(msg.sender == tx.origin, "only externally owned accounts may refresh speeds");
        refreshSliceSpeedsInternal();
    }

    function refreshSliceSpeedsInternal() internal {
        uint256 allMarketsEnabledTVL = getAllMarketsTVL();

        for (uint i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled && allMarketsEnabledTVL > 0) {
                uint256 percentTVL = getTrancheMarketTVL(i).mul(1e18).div(allMarketsEnabledTVL); //percentage scaled 1e18
                availableMarkets[i].trancheRewardsPercentage = percentTVL;
            } else {
                availableMarkets[i].trancheRewardsPercentage = 0;
            }
        }
        //emit SliceSpeedUpdated(trToken, newSpeed);
    }

    function getAllMarketsTVL() public view returns(uint256) {
        uint256 allMarketTVL;
        address _protocol;
        uint256 _trNum;

        for (uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled) {
                _protocol = availableMarkets[i].protocol;
                _trNum = availableMarkets[i].protocolTrNumber;
                allMarketTVL = allMarketTVL.add(IProtocol(_protocol).getTotalValue(_trNum));
            }
        }

        return allMarketTVL;
  }

    function getTrancheAMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheATVL) {
        //require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheATVL = IProtocol(_protocol).getTrAValue(_trNum);
        return trancheATVL;
    }

    function getTrancheBMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheBTVL) {
        //require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheBTVL = IProtocol(_protocol).getTrBValue(_trNum);
        return trancheBTVL;
    }

    function getTrancheMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheTVL) {
        uint256 trATVL = getTrancheAMarketTVL(_idxMarket);
        uint256 trBTVL = getTrancheBMarketTVL(_idxMarket);
        trancheTVL = trATVL.add(trBTVL);
        return trancheTVL;
    }

    //marketShare = getTrancheValue / sumAllMarketsValueLocked
    function getMarketSharePerTranche(uint256 _idxMarket) public view returns(uint256 marketShare) {
        uint256 totalValue = getAllMarketsTVL();

        if (totalValue > 0) {
            uint256 trancheVal = getTrancheAMarketTVL(_idxMarket).add(getTrancheBMarketTVL(_idxMarket));
            marketShare = trancheVal.mul(1e18).div(totalValue);
        } else 
            marketShare = 0;
        return marketShare;
    }

    function distributeAllMarketsFunds(uint256 _amount) external {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > 0, "TokenRewards: no markets");
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);
        for(uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].trancheRewardsPercentage > 0) {
                //uint256 trAmount = _amount.mul(getMarketSharePerTranche(i));
                uint256 trRewardsAmount = _amount.mul(availableMarkets[i].trancheRewardsPercentage).div(1e18);
                distributeSingleMarketsFundsInternal(i, trRewardsAmount);
            }
        }
    }

    function distributeSingleMarketsFundsInternal(uint256 _idxMarket, uint256 _amount) internal {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > _idxMarket, "TokenRewards: no markets");
        require(availableMarkets[_idxMarket].enabled, "TokenRewards: market disabled");

        uint256 trBPercent = uint256(getTrancheBRewardsPercentage(_idxMarket));
        uint256 trBAmount = _amount.mul(trBPercent).div(1e18);
        uint256 trAAmount = _amount.sub(trBAmount);
        availableMarkets[_idxMarket].trancheBRewardsAmount = trBAmount;
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardToken), availableMarkets[_idxMarket].bTranche, trBAmount);

        availableMarkets[_idxMarket].trancheARewardsAmount = trAAmount;
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardToken), availableMarkets[_idxMarket].aTranche, trAAmount);

        availableMarkets[_idxMarket].updateBlock = block.number;
    }

    function distributeSingleMarketsFunds(uint256 _idxMarket, uint256 _amount) external {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > _idxMarket, "TokenRewards: no markets");
        require(availableMarkets[_idxMarket].enabled, "TokenRewards: market disabled");

        uint256 trBPercent = uint256(getTrancheBRewardsPercentage(_idxMarket));
        uint256 trBAmount = _amount.mul(trBPercent).div(1e18);
        uint256 trAAmount = _amount.sub(trBAmount);
        availableMarkets[_idxMarket].trancheBRewardsAmount = trBAmount;
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, availableMarkets[_idxMarket].bTranche, trBAmount);

        availableMarkets[_idxMarket].trancheARewardsAmount = trAAmount;
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, availableMarkets[_idxMarket].aTranche, trAAmount);

        availableMarkets[_idxMarket].updateBlock = block.number;
    }

/*************************************** MODEL ************************************************/
    function getTrancheAReturns(uint256 _idxMarket) public view returns (uint256 trAReturns) {
        require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        uint256 trancheARPB = IProtocol(_protocol).getTrancheACurrentRPB(_trNum);
        uint256 totBlksYear = IProtocol(_protocol).totalBlocksPerYear();
        uint256 trAPrice = IProtocol(_protocol).getTrancheAExchangeRate(_trNum);
        // calc percentage
        // trA APY = trARPB * 2102400 / trAPrice
        trAReturns = trancheARPB.mul(totBlksYear).mul(1e18).div(trAPrice);
        return trAReturns;
    }

    function getTrancheBReturns(uint256 _idxMarket) public view returns (int256 trBReturns) {
        require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        uint256 trAReturns = getTrancheAReturns(_idxMarket);
        uint256 trARetPercent = trAReturns.add(1e18); //(1+trARet)
        uint256 totTrancheTVL = getTrancheMarketTVL(_idxMarket);
        uint256 trATVL = getTrancheAMarketTVL(_idxMarket);
        uint256 trBTVL = totTrancheTVL.sub(trATVL);
        uint256 totRetPercent = (availableMarkets[_idxMarket].extProtocolPercentage).add(1e18); //(1+extProtRet)

        uint256 extFutureValue = totTrancheTVL.mul(totRetPercent).div(1e18); // totalTVL*(1+extProtRet)
        uint256 trAFutureValue = trATVL.mul(trARetPercent).div(1e18); // trATVL*(1+trARet)
        // (totalTVL*(1+extProtRet)-trATVL*(1+trARet)-trBTVL)/trBTVL
        trBReturns = (int256(extFutureValue).sub(int256(trAFutureValue)).sub(int256(trBTVL))).mul(int256(1e18)).div(int256(trBTVL));  //check decimals!!!
        return trBReturns;
    }

    function getTrancheBRewardsPercentage(uint256 _idxMarket) public view returns (int256 trBRewardsPercentage) {
        require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        int256 trBReturns = int256(getTrancheBReturns(_idxMarket));
        int256 extProtRet = int256(availableMarkets[_idxMarket].extProtocolPercentage);
        int256 deltaAPY = (extProtRet).sub(trBReturns); // extProtRet - trancheBReturn = DeltaAPY
        int256 deltaAPYPercentage = deltaAPY.mul(1e18).div(extProtRet); // DeltaAPY / extProtRet = DeltaAPYPercentage
        trBRewardsPercentage = deltaAPYPercentage.add(int256(availableMarkets[_idxMarket].balanceFactor)); // DeltaAPYPercentage + balanceFactor = trBPercentage
        if (trBRewardsPercentage < 0 )
            trBRewardsPercentage = 0;
        else if (trBRewardsPercentage > 1e18)
            trBRewardsPercentage = 1e18;
        return trBRewardsPercentage;
    }

/*************************************** END MODEL ************************************************/

    function getBlockNumber() public view returns(uint) {
        return block.number;
    }

    function getTokenBalance(address _token) public view returns(uint256) {
        return IERC20Upgradeable(_token).balanceOf(address(this));
    }

    function emergencyTokenTransfer(address _token, address _to, uint256 _amount) public onlyOwner {
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_token), _to, _amount);
    }

    /**
    * @notice Return the address of the reward token
    * @return The address of reward token
    */
    function getRewardTokenAddress() public view returns(address) {
        return rewardToken;
    }

}