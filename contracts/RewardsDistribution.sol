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
import "./interfaces/IRewardsDistribution.sol";
import "./interfaces/IJTrancheTokens.sol";
import "./math/SafeMathInt.sol";

contract RewardsDistribution is OwnableUpgradeable, RewardsDistributionStorage, IRewardsDistribution {
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
     * @dev set the address of the reward token
     * @param _token rewards token address (SLICE or other)
     */
    function setRewardTokenAddress(address _token) external onlyOwner {
        require(_token != address(0), "TokenRewards: address not allowed");
        rewardToken = _token;
    }

    /**
     * @dev add a new market to this contract
     * @param _protocol protocol address
     * @param _protocolTrNumber protocol tranche number
     * @param _balFactor balance factor, meaning percentage on tranche B for asintotic values (scaled by 1e18)
     * @param _marketPercentage initial percantage for this market (scaled by 1e18)
     * @param _extProtReturn external protocol returns (compound, aave, and so on) (scaled by 1e18)
     * @param _rewardsFreq rewards frequency in days
     * @param _underlyingPrice initial underlying price, in common currency (scaled by 1e18)
     */
    function addTrancheMarket(address _protocol, 
            uint256 _protocolTrNumber,
            uint256 _balFactor,
            uint256 _marketPercentage,
            uint256 _extProtReturn,
            uint256 _rewardsFreq,
            uint256 _underlyingPrice) external onlyOwner{
        require(_balFactor <= uint256(1e18), "TokenRewards: balance factor too high");
        require(_marketPercentage <= uint256(1e18), "TokenRewards: market percentage too high");
        require(_rewardsFreq > 0 && _rewardsFreq < uint256(366), "TokenRewards: rewards frequency too high");
        availableMarkets[marketsCounter].protocol = _protocol;
        availableMarkets[marketsCounter].protocolTrNumber = _protocolTrNumber;
        ( , , address trAAddress, address trBAddress) = IProtocol(_protocol).trancheAddresses(_protocolTrNumber);
        require(trAAddress != address(0) && trBAddress != address(0), "TokenRewards: tranches not found");
        availableMarkets[marketsCounter].aTranche = trAAddress;
        availableMarkets[marketsCounter].bTranche = trBAddress;
        availableMarkets[marketsCounter].balanceFactor = _balFactor; // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarkets[marketsCounter].updateBlock = block.number;
        availableMarkets[marketsCounter].enabled = true;
        availableMarkets[marketsCounter].extProtocolPercentage = _extProtReturn;  // percentage scaled by 10^18: 0 - 1e18 (i.e. 30000000000000000 = 0.03 * 1e18 = 3%)
        availableMarketsRewards[marketsCounter].marketRewardsPercentage = _marketPercentage;  // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarketsRewards[marketsCounter].rewardsFrequency = _rewardsFreq * 1 days; // expressed in days
        availableMarketsRewards[marketsCounter].underlyingPrice = _underlyingPrice; // scaled in 1e18
        
        emit NewMarketAdded(marketsCounter, availableMarkets[marketsCounter].protocol, availableMarkets[marketsCounter].protocolTrNumber,
            availableMarkets[marketsCounter].balanceFactor, availableMarkets[marketsCounter].extProtocolPercentage,
            availableMarketsRewards[marketsCounter].marketRewardsPercentage, availableMarketsRewards[marketsCounter].rewardsFrequency, block.number);

        marketsCounter = marketsCounter.add(1);
    }

    /**
     * @dev enable or disable a single market
     * @param _idxMarket market index
     * @param _enable true or false
     */
    function enableSingleMarket(uint256 _idxMarket, bool _enable) external onlyOwner {
        availableMarkets[_idxMarket].enabled = _enable;
    }

    /**
     * @dev enable or disable a single market
     * @param _enables true or false array
     */
    function enableAllMarket(bool[] memory _enables) external onlyOwner {
        require(_enables.length == marketsCounter, "TokenRewards: enable array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarkets[i].enabled = _enables[i];
        }
    }

    /**
     * @dev set reward frequency for a single market
     * @param _idxMarket market index
     * @param _rewardsFreq rewards frequency (in days)
     */
    function setRewardsFrequencySingleMarket(uint256 _idxMarket, uint256 _rewardsFreq) external onlyOwner {
        require(_rewardsFreq > 0 && _rewardsFreq <= 365, "TokenRewards: rewards frequency can not be zero nor greater than 1 year");
        availableMarketsRewards[_idxMarket].rewardsFrequency = _rewardsFreq * 1 days;
    }

    /**
     * @dev set reward frequency for all markets
     * @param _rewardsFreqs rewards frequency array (in days)
     */
    function setRewardsFrequencyAllMarkets(uint256[] memory _rewardsFreqs) external onlyOwner {
        require(_rewardsFreqs.length ==  marketsCounter, "TokenRewards: rewards frequency array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].rewardsFrequency = _rewardsFreqs[i] * 1 days;
        }
    }

    /**
     * @dev set single market rewards percentage
     * @param _idxMarket market index
     * @param _percentage rewards percentage (scaled by 1e18)
     */
    function setRewardsPercentageSingleMarket(uint256 _idxMarket, uint256 _percentage) external onlyOwner {
        require(_idxMarket < marketsCounter, "TokenRewards: Market does not exist");
        availableMarketsRewards[_idxMarket].marketRewardsPercentage = _percentage;
    }

    /**
     * @dev set single market rewards percentage
     * @param _percentages rewards percentage array (scaled by 1e18)
     */
    function setRewardsPercentageAllMarkets(uint256[] memory _percentages) external onlyOwner {
        require(_percentages.length == marketsCounter, "TokenRewards: ext protocol array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].marketRewardsPercentage = _percentages[i];
        }
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
    function setExtProtocolPercentSingleMarket(uint256 _idxMarket, uint256 _extProtPerc) external onlyOwner {
        require(_idxMarket < marketsCounter, "TokenRewards: Market does not exist");
        availableMarkets[_idxMarket].extProtocolPercentage = _extProtPerc;
    }

    /**
     * @dev set external returns for all markets
     * @param _extProtPercs external protocol rewards percentage array (scaled by 1e18)
     */
    function setExtProtocolPercentAllMarkets(uint256[] memory _extProtPercs) external onlyOwner {
        require(_extProtPercs.length == marketsCounter, "TokenRewards: ext protocol array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarkets[i].extProtocolPercentage = _extProtPercs[i];
        }
    }

    /**
     * @dev set balance factor (asynthotic value for tranche B) for a market
     * @param _idxMarket market index
     * @param _balFactor balance factor (scaled by 1e18)
     */
    function setBalanceFactorSingleMarket(uint256 _idxMarket, uint256 _balFactor) external onlyOwner {
        require(_idxMarket < marketsCounter, "TokenRewards: Market does not exist");
        availableMarkets[_idxMarket].balanceFactor = _balFactor;
    }

    /**
     * @dev set balance factor (asynthotic value for tranche B) for all markets
     * @param _balFactors balance factor array (scaled by 1e18)
     */
    function setBalanceFactorAllMarkets(uint256[] memory _balFactors) external onlyOwner {
        require(_balFactors.length == marketsCounter, "TokenRewards: ext protocol array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarkets[i].balanceFactor = _balFactors[i];
        }
    }

    /**
     * @dev set underlying price in common currency for a market (scaled by 1e18)
     * @param _idxMarket market index
     * @param _price underlying price (scaled by 1e18)
     */
    function setUnderlyingPriceSingleMarket(uint256 _idxMarket, uint256 _price) external onlyOwner {
        require(_idxMarket < marketsCounter, "TokenRewards: Market does not exist");
        availableMarketsRewards[_idxMarket].underlyingPrice = _price;
    }

    /**
     * @dev set underlying price in common currency for all markets (scaled by 1e18)
     * @param _prices underlying prices array (scaled by 1e18)
     */
    function setUnderlyingPriceAllMarkets(uint256[] memory _prices) external onlyOwner {
        require(_prices.length == marketsCounter, "TokenRewards: Prices array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].underlyingPrice = _prices[i];
        }
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
                uint256 tmpMarketVal = getTrancheMarketTVL(i).mul(availableMarketsRewards[i].underlyingPrice).div(1e18);
                uint256 percentTVL = tmpMarketVal.mul(1e18).div(allMarketsEnabledTVL); //percentage scaled 1e18
                availableMarketsRewards[i].marketRewardsPercentage = percentTVL;
            } else {
                availableMarketsRewards[i].marketRewardsPercentage = 0;
            }

            emit SliceSpeedUpdated(i, availableMarketsRewards[i].marketRewardsPercentage);
        }
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
                uint256 tmpMarketVal = (IProtocol(_protocol).getTotalValue(_trNum)).mul(availableMarketsRewards[i].underlyingPrice).div(1e18);
                allMarketTVL = allMarketTVL.add(tmpMarketVal);
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
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheATVL = (IProtocol(_protocol).getTrAValue(_trNum)).mul(availableMarketsRewards[_idxMarket].underlyingPrice).div(1e18);
        return trancheATVL;
    }

    /**
     * @dev return total values locked in a market (tranche B)
     * @param _idxMarket market index
     * @return trancheBTVL market total value locked (tracnhe B)
     */
    function getTrancheBMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheBTVL) {
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        trancheBTVL = (IProtocol(_protocol).getTrBValue(_trNum)).mul(availableMarketsRewards[_idxMarket].underlyingPrice).div(1e18);
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

            emit FundsDistributed(_idxMarket, trAAmount, trBAmount, block.number);
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

        emit FundsDistributed(_idxMarket, trAAmount, trBAmount, block.number);
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

            availableMarkets[_idxMarket].updateBlock = block.number;

            emit RewardsDistributedAPY(_idxMarket, availableMarketsRewards[_idxMarket].rewardsTrAAPY, availableMarketsRewards[_idxMarket].rewardsTrBAPY, block.number);
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
        rewardsAPY = availableMarketsRewards[_idxMarket].rewardsTrAAPY;
        return rewardsAPY;
    }

    function getRewardsAPYSingleMarketTrancheB(uint256 _idxMarket) external view returns(uint256 rewardsAPY) {
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