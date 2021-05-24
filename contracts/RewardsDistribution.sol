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
import "./interfaces/IJTrancheTokens.sol";
import "./math/SafeMathInt.sol";

contract RewardsDistribution is OwnableUpgradeable, RewardsDistributionStorage, IRewardsDistribtuion {
    using SafeMath for uint256;
    using SafeMathInt for int256;

    /**
     * @dev initialize contract
     * @param _token reward token address (SLICE or others)
     */
    function initialize (address _token) public initializer() {
        OwnableUpgradeable.__Ownable_init();
        rewardToken = _token;
    }
    
    /**
     * @dev internal function - utility function to transform numbers in int256
     * @param a number to be converted in int256
     * @return number transformed in int256 
     */
    function toInt256Safe(uint256 a) internal pure returns (int256) {
        int256 b = int256(a);
        require(b >= 0);
        return b;
    }

    /**
     * @dev set the address of the reward token
     * @param _token rewards token address (SLICE or other)
     */
    function setRewardTokenAddress(address _token) external onlyOwner {
        rewardToken = _token;
    }

    /**
     * @dev add a new market to this contract
     * @param _protocol protocol address
     * @param _protocolTrNumber protocol tranche number
     * @param _balFactor balance factor, meaning percentage on tranche B for asintotic values (scaled by 1e18)
     * @param _marketPercentage initial percantage for this market (scaled by 1e18)
     * @param _extProtReturn external protocol returns (compound, aave, and so on) (scaled by 1e18)
     */
    function addTrancheMarket(address _protocol, 
            uint256 _protocolTrNumber,
            uint256 _balFactor,
            uint256 _marketPercentage,
            uint256 _extProtReturn,
            uint256 _rewardsFreq) external onlyOwner{
        availableMarkets[marketsCounter].protocol = _protocol;
        availableMarkets[marketsCounter].protocolTrNumber = _protocolTrNumber;
        ( , , address trAAddress, address trBAddress) = IProtocol(_protocol).trancheAddresses(_protocolTrNumber);
        availableMarkets[marketsCounter].aTranche = trAAddress;
        availableMarkets[marketsCounter].bTranche = trBAddress;
        availableMarkets[marketsCounter].balanceFactor = _balFactor; // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarkets[marketsCounter].updateBlock = block.number;
        availableMarkets[marketsCounter].enabled = true;
        availableMarkets[marketsCounter].extProtocolPercentage = _extProtReturn;  // percentage scaled by 10^18: 0 - 1e18 (i.e. 30000000000000000 = 0.03 * 1e18 = 3%)
        availableMarketsRewards[marketsCounter].marketRewardsPercentage = _marketPercentage;  // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarketsRewards[marketsCounter].rewardsFrequency = _rewardsFreq * 1 days; // expressed in days
        
        marketsCounter = marketsCounter.add(1);
    }

    /**
     * @dev enable or disable a single market
     * @param _idxMarket market index
     * @param _enable true or false
     */
    function enableMarket(uint256 _idxMarket, bool _enable) external onlyOwner {
        availableMarkets[_idxMarket].enabled = _enable;
    }

    /**
     * @dev set reward frequency for a single market
     * @param _idxMarket market index
     * @param _rewardsFreq rewards frequency (in days)
     */
    function setSingleMarketRewardsFrequency(uint256 _idxMarket, uint256 _rewardsFreq) external onlyOwner {
        require(_rewardsFreq > 0, "TokenRewards: rewards frequency can not be zero");
        availableMarketsRewards[_idxMarket].rewardsFrequency = _rewardsFreq * 1 days;
    }

    /**
     * @dev set reward frequency for all markets
     * @param _rewardsFreq rewards frequency (in days)
     */
    function setAllMarketsRewardsFrequency(uint256 _rewardsFreq) external onlyOwner {
        require(_rewardsFreq > 0, "TokenRewards: rewards frequency can not be zero");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].rewardsFrequency = _rewardsFreq * 1 days;
        }
    }

    /**
     * @dev set single market rewards percentage
     * @param _idxMarket market index
     * @param _percentage rewards percentage (scaled by 1e18)
     */
    function setSingleMarketRewardsPercentage(uint256 _idxMarket, uint256 _percentage) external onlyOwner {
        require(_idxMarket < marketsCounter, "TokenRewards: Market does not exist");
        availableMarketsRewards[_idxMarket].marketRewardsPercentage = _percentage;
    }

    /**
     * @dev get the summation of all percentages in all enabled markets
     * @return totalPercentage sum of all percentages in all enabled markets
     */
    function getMarketRewardsPercentage() external view returns (uint256 totalPercentage) {
        for (uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled) {
                totalPercentage = totalPercentage.add(availableMarketsRewards[i].marketRewardsPercentage);
            }
        }
        return totalPercentage;
    }

    /**
     * @dev set external returns for a market
     * @param _idxMarket market index
     * @param _extProtPerc external protocol rewards percentage (scaled by 1e18)
     */
    function setExtProtocolPercent(uint256 _idxMarket, uint256 _extProtPerc) external onlyOwner {
        availableMarkets[_idxMarket].extProtocolPercentage = _extProtPerc;
    }

    /**
     * @dev set balance factor (asynthotic value for tranche B) for a market
     * @param _idxMarket market index
     * @param _balFactor balance factor (scaled by 1e18)
     */
    function setBalanceFactor(uint256 _idxMarket, uint256 _balFactor) external onlyOwner {
        availableMarkets[_idxMarket].balanceFactor = _balFactor;
    }

    /**
     * @dev Recalculate and update Slice speeds for all markets
     */
    function refreshSliceSpeeds() external onlyOwner {
        require(msg.sender == tx.origin, "TokenRewards: only externally owned accounts may refresh speeds");
        refreshSliceSpeedsInternal();
    }

    /**
     * @dev internal function - refresh rewards percentage of available and enabled markets
     */
    function refreshSliceSpeedsInternal() internal {
        uint256 allMarketsEnabledTVL = getAllMarketsTVL();

        for (uint i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled && allMarketsEnabledTVL > 0) {
                uint256 percentTVL = getTrancheMarketTVL(i).mul(1e18).div(allMarketsEnabledTVL); //percentage scaled 1e18
                availableMarketsRewards[i].marketRewardsPercentage = percentTVL;
            } else {
                availableMarketsRewards[i].marketRewardsPercentage = 0;
            }
        }
        //emit SliceSpeedUpdated(trToken, newSpeed);
    }

    /**
     * @dev return total values locked in all available and enabled markets
     * @return markets total value locked 
     */
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

    /**
     * @dev return total values locked in a market (tranche A)
     * @param _idxMarket market index
     * @return trancheATVL market total value locked (tracnhe A)
     */
    function getTrancheAMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheATVL) {
        //require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheATVL = IProtocol(_protocol).getTrAValue(_trNum);
        return trancheATVL;
    }

    /**
     * @dev return total values locked in a market (tranche B)
     * @param _idxMarket market index
     * @return trancheBTVL market total value locked (tracnhe B)
     */
    function getTrancheBMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheBTVL) {
        //require(availableMarkets[_idxMarket].enabled, "Market not enabled");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheBTVL = IProtocol(_protocol).getTrBValue(_trNum);
        return trancheBTVL;
    }

    /**
     * @dev return total values locked in a market
     * @param _idxMarket market index
     * @return trancheTVL market total value locked
     */
    function getTrancheMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheTVL) {
        uint256 trATVL = getTrancheAMarketTVL(_idxMarket);
        uint256 trBTVL = getTrancheBMarketTVL(_idxMarket);
        trancheTVL = trATVL.add(trBTVL);
        return trancheTVL;
    }

    /**
     * @dev return market share of an enabled market respect to all values locked in all markets
     * @param _idxMarket market index
     * @return marketShare market share
     */
    //marketShare = getTrancheValue / sumAllMarketsValueLocked
    function getMarketSharePerTranche(uint256 _idxMarket) external view returns(uint256 marketShare) {
        uint256 totalValue = getAllMarketsTVL();

        if (totalValue > 0 && availableMarkets[_idxMarket].enabled) {
            uint256 trancheVal = getTrancheMarketTVL(_idxMarket);
            marketShare = trancheVal.mul(1e18).div(totalValue);
        } else 
            marketShare = 0;
        return marketShare;
    }

    /**
     * @dev distribute an amount of rewards tokens to all available and enabled markets, splitting the amount between all markets and tranches
     * @param _amount amount of tokens to distribute to this market (tranche A + tranche B)
     */
    function distributeAllMarketsFunds(uint256 _amount) external {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > 0, "TokenRewards: no markets");
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);
        for(uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarketsRewards[i].marketRewardsPercentage > 0) {
                uint256 trRewardsAmount = _amount.mul(availableMarketsRewards[i].marketRewardsPercentage).div(1e18);
                distributeSingleMarketsFundsInternal(i, trRewardsAmount);
            }
        }
    }

    /**
     * @dev internal function
     * @dev distribute an amount of rewards tokens to an enabled market, splitting the amount between tranche A & B
     * @param _idxMarket market index
     * @param _amount amount of tokens to distribute to this market (tranche A + tranche B)
     */
    function distributeSingleMarketsFundsInternal(uint256 _idxMarket, uint256 _amount) internal {
        if (_amount > 0 && _idxMarket < marketsCounter && availableMarkets[_idxMarket].enabled){
            uint256 trBPercent = uint256(getTrancheBRewardsPercentage(_idxMarket));
            uint256 trBAmount = _amount.mul(trBPercent).div(1e18);
            uint256 trAAmount = _amount.sub(trBAmount);
            availableMarketsRewards[_idxMarket].trancheBRewardsAmount = trBAmount;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardToken), availableMarkets[_idxMarket].bTranche, trBAmount);

            availableMarketsRewards[_idxMarket].trancheARewardsAmount = trAAmount;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardToken), availableMarkets[_idxMarket].aTranche, trAAmount);

            availableMarkets[_idxMarket].updateBlock = block.number;
        }
    }

    /**
     * @dev distribute an amount of rewards tokens to an available and enabled market, splitting the amount between tranche A & B
     * @param _idxMarket market index
     * @param _amount amount of tokens to distribute to this market (tranche A + tranche B)
     */
    function distributeSingleMarketsFunds(uint256 _idxMarket, uint256 _amount) external {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > _idxMarket, "TokenRewards: market not found");
        require(availableMarkets[_idxMarket].enabled, "TokenRewards: market disabled");

        uint256 trBPercent = uint256(getTrancheBRewardsPercentage(_idxMarket));
        uint256 trBAmount = _amount.mul(trBPercent).div(1e18);
        uint256 trAAmount = _amount.sub(trBAmount);
        availableMarketsRewards[_idxMarket].trancheBRewardsAmount = trBAmount;
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, availableMarkets[_idxMarket].bTranche, trBAmount);

        availableMarketsRewards[_idxMarket].trancheARewardsAmount = trAAmount;
        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, availableMarkets[_idxMarket].aTranche, trAAmount);

        availableMarkets[_idxMarket].updateBlock = block.number;
    }

    /**
     * @dev distribute rewards tokens to users in a single market
     * @param _idxMarket market index
     */
    function distributeRewardsTokenSingleMarket(uint256 _idxMarket) public {
        require(marketsCounter > _idxMarket, "TokenRewards: market not found");
        if (availableMarkets[_idxMarket].enabled){
            if (availableMarketsRewards[_idxMarket].trancheARewardsAmount > 0) {
                IJTrancheTokens(availableMarkets[_idxMarket].aTranche).updateFundsReceived();
                uint256 trATVL = getTrancheAMarketTVL(_idxMarket);
                uint256 distribTimes = 365 days / availableMarketsRewards[_idxMarket].rewardsFrequency;
                availableMarketsRewards[_idxMarket].rewardsTrAAPY = 
                        availableMarketsRewards[_idxMarket].trancheARewardsAmount.mul(distribTimes).mul(1e18).div(trATVL); // scaled by 1e18
                availableMarketsRewards[_idxMarket].trancheARewardsAmount = 0;
            }
            if (availableMarketsRewards[_idxMarket].trancheBRewardsAmount > 0) {
                IJTrancheTokens(availableMarkets[_idxMarket].bTranche).updateFundsReceived();
                uint256 trBTVL = getTrancheBMarketTVL(_idxMarket);
                uint256 distribTimes = 365 days / availableMarketsRewards[_idxMarket].rewardsFrequency;
                availableMarketsRewards[_idxMarket].rewardsTrBAPY = 
                        availableMarketsRewards[_idxMarket].trancheBRewardsAmount.mul(distribTimes).mul(1e18).div(trBTVL); // scaled by 1e18
                availableMarketsRewards[_idxMarket].trancheBRewardsAmount = 0;
            }
        }
    }

    /**
     * @dev distribute rewards tokens to users in all markets
     */
    function distributeRewardsTokenAllMarkets() external {
        require(marketsCounter > 0, "TokenRewards: no markets");
        for(uint256 i = 0; i < marketsCounter; i++) {
            distributeRewardsTokenSingleMarket(i);
        }
    }

    function getRewardsAPYSingleMarketTrancheA(uint256 _idxMarket) external view returns(uint256 rewardsAPY) {
        // uint256 trATVL = getTrancheAMarketTVL(_idxMarket);
        // uint256 distribTimes = 365 days / availableMarketsRewards[_idxMarket].rewardsFrequency;
        // rewardsAPY = availableMarketsRewards[_idxMarket].trancheARewardsAmount.mul(distribTimes).mul(1e18).div(trATVL);
        rewardsAPY = availableMarketsRewards[_idxMarket].rewardsTrAAPY;
        return rewardsAPY;
    }

    function getRewardsAPYSingleMarketTrancheB(uint256 _idxMarket) external view returns(uint256 rewardsAPY) {
        // uint256 trBTVL = getTrancheBMarketTVL(_idxMarket);
        // uint256 distribTimes = 365 days / availableMarketsRewards[_idxMarket].rewardsFrequency;
        // rewardsAPY = availableMarketsRewards[_idxMarket].trancheBRewardsAmount.mul(distribTimes).mul(1e18).div(trBTVL); // scaled by 1e18
        rewardsAPY = availableMarketsRewards[_idxMarket].rewardsTrBAPY;
        return rewardsAPY;
    }

/*************************************** MODEL ************************************************/
    /**
     * @dev get tranche A returns of an available market
     * @param _idxMarket market index
     * @return trAReturns tranche A returns (0 - 1e18)
     */
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

    /**
     * @dev get tranche B returns of an available market
     * @param _idxMarket market index
     * @return trBReturns tranche B returns (0 - 1e18)
     */
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

    /**
     * @dev get tranche B rewards percentage of an available market (scaled by 1e18)
     * @param _idxMarket market index
     * @return trBRewardsPercentage tranche B rewards percentage (0 - 1e18)
     */
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

    /**
     * @dev get the balance of a token in this contract
     * @param _token token address
     * @return token balance
     */
    function getTokenBalance(address _token) external view returns(uint256) {
        return IERC20Upgradeable(_token).balanceOf(address(this));
    }

    /**
     * @dev transfer tokens from here to a destination address (emergency only)
     * @param _token token address to transfer
     * @param _to recipient address
     * @param _amount token amount to transfer
     */
    function emergencyTokenTransfer(address _token, address _to, uint256 _amount) external onlyOwner {
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_token), _to, _amount);
    }

}