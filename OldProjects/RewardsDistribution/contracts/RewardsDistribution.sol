// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Slice Rewards contract
 * @author: Jibrel Team
 */
pragma solidity 0.8.7;


import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./RewardsDistributionStorage.sol";
import "./interfaces/IProtocol.sol";
import "./interfaces/IRewardsDistribution.sol";
import "./interfaces/IJTrancheTokens.sol";
import "./interfaces/IMarketHelper.sol";
import "./interfaces/IPriceHelper.sol";
import "./math/SafeMathInt.sol";

contract RewardsDistribution is OwnableUpgradeable, RewardsDistributionStorage, IRewardsDistribution {
    using SafeMath for uint256;
    using SafeMathInt for int256;

    /**
     * @dev initialize contract
     * @param _token reward token address (SLICE or others)
     * @param _mktHelper Address of markets helper contract
     * @param _priceHelper Address of price helper contract
     */
    function initialize (address _token, address _mktHelper, address _priceHelper) public initializer() {
        OwnableUpgradeable.__Ownable_init();
        rewardToken = _token;
        mktHelperAddress = _mktHelper;
        priceHelperAddress = _priceHelper;
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
     * @dev set the address of the market helper contract
     * @param _mktHelper market helper contract address
     */
    function setMarketHelperAddress(address _mktHelper) external onlyOwner {
        require(_mktHelper != address(0), "IncentiveController: address not allowed");
        mktHelperAddress = _mktHelper;
    }

    /**
     * @dev set the address of the market helper contract
     * @param _prcHelper market helper contract address
     */
    function setPriceHelperAddress(address _prcHelper) external onlyOwner {
        require(_prcHelper != address(0), "IncentiveController: address not allowed");
        priceHelperAddress = _prcHelper;
    }

    /**
     * @dev add a new market to this contract
     * @param _protocol protocol address
     * @param _protocolTrNumber protocol tranche number
     * @param _balFactor balance factor, meaning percentage on tranche B for asintotic values (scaled by 1e18)
     * @param _marketPercentage initial percantage for this market (scaled by 1e18)
     * @param _extProtReturn external protocol returns (compound, aave, and so on) (scaled by 1e18)
     * @param _rewardsFreq rewards frequency in days
     * @param _underlyingDecs underlying decimals
     * @param _underlyingPrice underlying price
     * @param _chainAggrInterface,chainlink price address
     * @param _reciprocPrice,is reciprocal price or not
     */
    function addTrancheMarket(address _protocol, 
            uint256 _protocolTrNumber,
            uint256 _balFactor,
            uint256 _marketPercentage,
            uint256 _extProtReturn,
            uint256 _rewardsFreq,
            uint256 _underlyingDecs,
            uint256 _underlyingPrice,
            address _chainAggrInterface,
            bool _reciprocPrice) external onlyOwner{
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
        availableMarketsRewards[marketsCounter].underlyingDecimals = _underlyingDecs;

        IPriceHelper(priceHelperAddress).setExternalProviderParameters(marketsCounter, _chainAggrInterface, _reciprocPrice);

        if (_underlyingPrice > 0)
            availableMarketsRewards[marketsCounter].underlyingPrice = _underlyingPrice;
        else
            availableMarketsRewards[marketsCounter].underlyingPrice = IPriceHelper(priceHelperAddress).getNormalizedChainlinkPrice(marketsCounter);
        
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
    function setUnderlyingPriceManuallySingleMarket(uint256 _idxMarket, uint256 _price) external onlyOwner {
        require(_idxMarket < marketsCounter, "IncentiveController: Market does not exist");
        availableMarketsRewards[_idxMarket].underlyingPrice = _price;
    }

    /**
     * @dev set underlying price in common currency for a market (scaled by 1e18)
     * @param _idxMarket market index
     */
    function setUnderlyingPriceFromChainlinkSingleMarket(uint256 _idxMarket) public onlyOwner {
        require(_idxMarket < marketsCounter, "IncentiveController: Market does not exist");
        availableMarketsRewards[_idxMarket].underlyingPrice = IPriceHelper(priceHelperAddress).getNormalizedChainlinkPrice(_idxMarket);
    }

    /**
     * @dev set underlying price in common currency for all markets (scaled by 1e18)
     * @param _prices underlying prices array (scaled by 1e18)
     */
    function setUnderlyingPriceManuallyAllMarkets(uint256[] memory _prices) external onlyOwner {
        require(_prices.length == marketsCounter, "IncentiveController: Prices array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].underlyingPrice = _prices[i];
        }
    }

    /**
     * @dev set underlying price in common currency for all markets (scaled by 1e18)
     */
    function setUnderlyingPriceFromChainlinkAllMarkets() external onlyOwner {
        for (uint256 i = 0; i < marketsCounter; i++) {
            setUnderlyingPriceFromChainlinkSingleMarket(i);
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
        address _protocol;
        uint256 _trNum;
        uint256 _underPrice;
        uint256 _underDecs;
        uint256 _mktTVL;

        for (uint i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled && allMarketsEnabledTVL > 0) {
                _protocol = availableMarkets[i].protocol;
                _trNum = availableMarkets[i].protocolTrNumber;
                _underPrice = availableMarketsRewards[i].underlyingPrice;
                _underDecs = availableMarketsRewards[i].underlyingDecimals;
                _mktTVL = IMarketHelper(mktHelperAddress).getTrancheMarketTVL(_protocol, _trNum, _underPrice, _underDecs);
                // uint256 _mktTVLtmpMarketVal = _mktTVL.mul(availableMarketsRewards[i].underlyingPrice).div(1e18);
                uint256 percentTVL = _mktTVL.mul(1e18).div(allMarketsEnabledTVL); //percentage scaled 1e18
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
        uint256 _underPrice;
        uint256 _underDecs;
        uint256 tmpMarketVal;

        for (uint256 i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled) {
                _protocol = availableMarkets[i].protocol;
                _trNum = availableMarkets[i].protocolTrNumber;
                _underPrice = availableMarketsRewards[i].underlyingPrice;
                _underDecs = availableMarketsRewards[i].underlyingDecimals;
                tmpMarketVal = IMarketHelper(mktHelperAddress).getTrancheMarketTVL(_protocol, _trNum, _underPrice, _underDecs);
                allMarketTVL = allMarketTVL.add(tmpMarketVal);
            }
        }

        return allMarketTVL;
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
            address _protocol = availableMarkets[_idxMarket].protocol;
            uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
            uint256 _underPrice = availableMarketsRewards[_idxMarket].underlyingPrice;
            uint256 _underDecs = availableMarketsRewards[_idxMarket].underlyingDecimals;
            uint256 trancheVal = IMarketHelper(mktHelperAddress).getTrancheMarketTVL(_protocol, _trNum, _underPrice, _underDecs);
            marketShare = trancheVal.mul(1e18).div(totalValue);
        } else 
            marketShare = 0;
        return marketShare;
    }

    /**
     * @dev distribute an amount of rewards tokens to all available and enabled markets, splitting the amount between all markets and tranches
     * @param _amount amount of tokens to distribute to this market (tranche A + tranche B)
     */
    function distributeAllMarketsFunds(uint256 _amount) public {
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
            address _protocol = availableMarkets[_idxMarket].protocol;
            uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
            uint256 _underlyingPrice = availableMarketsRewards[_idxMarket].underlyingPrice; 
            uint256 _underlyingDecs = availableMarketsRewards[_idxMarket].underlyingDecimals; 
            uint256 _extProtRet = availableMarkets[_idxMarket].extProtocolPercentage;
            uint256 _balFactor = availableMarkets[_idxMarket].balanceFactor;
            uint256 trBPercent = 
                uint256(IMarketHelper(mktHelperAddress).getTrancheBRewardsPercentage(_protocol, _trNum, _underlyingPrice, _underlyingDecs, _extProtRet, _balFactor));
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
    function distributeSingleMarketsFunds(uint256 _idxMarket, uint256 _amount) public {
        require(_amount > 0, "TokenRewards: no tokens");
        require(marketsCounter > _idxMarket, "TokenRewards: market not found");
        require(availableMarkets[_idxMarket].enabled, "TokenRewards: market disabled");

        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);

        distributeSingleMarketsFundsInternal(_idxMarket, _amount);
    }

    /**
     * @dev distribute rewards tokens to users in a single market
     * @param _idxMarket market index
     */
    function distributeRewardsTokenSingleMarket(uint256 _idxMarket) public {
        require(marketsCounter > _idxMarket, "TokenRewards: market not found");
        address _protocol = availableMarkets[_idxMarket].protocol;
        uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
        uint256 _underlyingPrice = availableMarketsRewards[_idxMarket].underlyingPrice;
        uint256 _underlyingDecs = availableMarketsRewards[_idxMarket].underlyingDecimals;
        if (availableMarkets[_idxMarket].enabled){
            if (availableMarketsRewards[_idxMarket].trancheARewardsAmount > 0) {
                IJTrancheTokens(availableMarkets[_idxMarket].aTranche).updateFundsReceived();
                uint256 trATVL = IMarketHelper(mktHelperAddress).getTrancheAMarketTVL(_protocol, _trNum, _underlyingPrice, _underlyingDecs);
                uint256 distribTimes = 365 days / availableMarketsRewards[_idxMarket].rewardsFrequency;
                availableMarketsRewards[_idxMarket].rewardsTrAAPY = 
                        availableMarketsRewards[_idxMarket].trancheARewardsAmount.mul(distribTimes).mul(1e18).div(trATVL); // scaled by 1e18
                availableMarketsRewards[_idxMarket].trancheARewardsAmount = 0;
            }
            if (availableMarketsRewards[_idxMarket].trancheBRewardsAmount > 0) {
                IJTrancheTokens(availableMarkets[_idxMarket].bTranche).updateFundsReceived();
                uint256 trBTVL = IMarketHelper(mktHelperAddress).getTrancheBMarketTVL(_protocol, _trNum, _underlyingPrice, _underlyingDecs);
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
    function distributeRewardsTokenAllMarkets() public {
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

    function setAndDistributeSingleMarket(uint256 _idxMarket, uint256 _amount) external onlyOwner {
        distributeSingleMarketsFunds(_idxMarket, _amount);
        distributeRewardsTokenSingleMarket(_idxMarket);
    }

    function setAndDistributeAllMarkets(uint256 _amount) external onlyOwner {
        distributeAllMarketsFunds(_amount);
        distributeRewardsTokenAllMarkets();
    }

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