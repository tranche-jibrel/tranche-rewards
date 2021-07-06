// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Incentive Controller contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;


import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/MathUpgradeable.sol";
import "./IncentivesControllerStorage.sol";
import "./interfaces/IProtocol.sol";
import "./interfaces/IIncentivesController.sol";
import "./interfaces/IMarketHelper.sol";
import "./interfaces/IPriceHelper.sol";
import "./math/SafeMathInt.sol";

contract IncentivesController is OwnableUpgradeable, IncentivesControllerStorage, IIncentivesController, ReentrancyGuardUpgradeable {
    using SafeMathUpgradeable for uint256;
    using SafeMathInt for int256;

    /**
     * @dev initialize contract
     * @param _token reward token address (SLICE or others)
     * @param _mktHelper Address of markets helper contract
     * @param _priceHelper Address of price helper contract
     */
    function initialize (address _token, address _mktHelper, address _priceHelper) public initializer() {
        OwnableUpgradeable.__Ownable_init();
        rewardsTokenAddress = _token;
        mktHelperAddress = _mktHelper;
        priceHelperAddress = _priceHelper;
    }

    /* ========== MODIFIERS ========== */

    modifier updateRewardsPerMarketTrancheA(uint256 _idxMarket, address account) {
        trancheARewardsInfo[_idxMarket].rewardPerTokenStored = rewardPerTrAToken(_idxMarket);
        trancheARewardsInfo[_idxMarket].lastUpdateTime = lastTimeTrARewardApplicable(_idxMarket);
        if (account != address(0)) {
            trARewards[_idxMarket][account] = trAEarned(_idxMarket, account);
            userRewardPerTokenTrAPaid[_idxMarket][account] = trancheARewardsInfo[_idxMarket].rewardPerTokenStored;
        }
        _;
    }

    modifier updateRewardsPerMarketTrancheB(uint256 _idxMarket, address account) {
        trancheBRewardsInfo[_idxMarket].rewardPerTokenStored = rewardPerTrBToken(_idxMarket);
        trancheBRewardsInfo[_idxMarket].lastUpdateTime = lastTimeTrBRewardApplicable(_idxMarket);
        if (account != address(0)) {
            trBRewards[_idxMarket][account] = trBEarned(_idxMarket, account);
            userRewardPerTokenTrBPaid[_idxMarket][account] = trancheBRewardsInfo[_idxMarket].rewardPerTokenStored;
        }
        _;
    }

    /* ========== VIEWS ========== */
    /**
    * @dev get minimum between actual time and finish time for tranche A
    * @param _idxMarket market index
    * @return minimum between times
    */
    function lastTimeTrARewardApplicable(uint256 _idxMarket) public view returns (uint256) {
        return MathUpgradeable.min(block.timestamp, trancheARewardsInfo[_idxMarket].periodFinish);
    }

    /**
    * @dev get minimum between actual time and finish time for tranche B
    * @param _idxMarket market index
    * @return minimum between times
    */
    function lastTimeTrBRewardApplicable(uint256 _idxMarket) public view returns (uint256) {
        return MathUpgradeable.min(block.timestamp, trancheBRewardsInfo[_idxMarket].periodFinish);
    }

    /**
    * @dev get return per tranche A token
    * @param _idxMarket market index
    * @return return per token
    */
    function rewardPerTrAToken(uint256 _idxMarket) public view returns (uint256) {
        uint256 _totalSupply = IERC20Upgradeable(availableMarkets[_idxMarket].aTranche).totalSupply();
        return trancheARewardsInfo[_idxMarket].rewardPerTokenStored.add(lastTimeTrARewardApplicable(_idxMarket)
            .sub(trancheARewardsInfo[_idxMarket].lastUpdateTime).mul(trancheARewardsInfo[_idxMarket].rewardRate).mul(1e18).div(_totalSupply));
    }

    /**
    * @dev get return per tranche B token
    * @param _idxMarket market index
    * @return return per token
    */
    function rewardPerTrBToken(uint256 _idxMarket) public view returns (uint256) {
        uint256 _totalSupply = IERC20Upgradeable(availableMarkets[_idxMarket].bTranche).totalSupply();
        return trancheBRewardsInfo[_idxMarket].rewardPerTokenStored.add(lastTimeTrBRewardApplicable(_idxMarket)
            .sub(trancheBRewardsInfo[_idxMarket].lastUpdateTime).mul(trancheBRewardsInfo[_idxMarket].rewardRate).mul(1e18).div(_totalSupply));
    }

    /**
    * @dev get return per tranche A token
    * @param _idxMarket market index
    * @param _account account address
    * @return return per token
    */
    function trAEarned(uint256 _idxMarket, address _account) public view returns (uint256) {
        uint256 userBal = IERC20Upgradeable(availableMarkets[_idxMarket].aTranche).balanceOf(_account);
        return userBal.mul(rewardPerTrAToken(_idxMarket).sub(userRewardPerTokenTrAPaid[_idxMarket][_account]))
            .div(1e18).add(trARewards[_idxMarket][_account]);
    }

    /**
    * @dev get return per tranche B token
    * @param _idxMarket market index
    * @param _account account address
    * @return return per token
    */
    function trBEarned(uint256 _idxMarket, address _account) public view returns (uint256) {
        uint256 userBal = IERC20Upgradeable(availableMarkets[_idxMarket].bTranche).balanceOf(_account);
        return userBal.mul(rewardPerTrBToken(_idxMarket).sub(userRewardPerTokenTrBPaid[_idxMarket][_account]))
            .div(1e18).add(trBRewards[_idxMarket][_account]);  
    }

    /**
    * @dev get tranche A token address
    * @param _idxMarket market index
    * @return token address
    */  
    function getATrancheMarket(uint256 _idxMarket) external view override returns(address) {
        return availableMarkets[_idxMarket].aTranche;
    }

    /**
    * @dev get tranche B token address
    * @param _idxMarket market index
    * @return token address
    */
    function getBTrancheMarket(uint256 _idxMarket) external view override returns(address) {
        return availableMarkets[_idxMarket].bTranche;
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
     * @dev return total values locked in all available and enabled markets
     * @return markets total value locked 
     */
    function getAllMarketsTVL(/*bool _useChainlink*/) public view returns(uint256) {
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
                // if (_useChainlink)
                //     setUnderlyingPriceFromChainlinkSingleMarket(i);
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
     * marketShare = getTrancheValue / sumAllMarketsValueLocked
     * @param _idxMarket market index
     * @return marketShare market share
     */
    function getMarketSharePerTranche(uint256 _idxMarket/*, bool _useChainlink*/) external view returns(uint256 marketShare) {
        uint256 totalValue = getAllMarketsTVL(/*_useChainlink*/);

        if (totalValue > 0 && availableMarkets[_idxMarket].enabled) {
            address _protocol = availableMarkets[_idxMarket].protocol;
            uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
            // if (_useChainlink)
            //     setUnderlyingPriceFromChainlinkSingleMarket(_idxMarket);
            uint256 _underPrice = availableMarketsRewards[_idxMarket].underlyingPrice;
            uint256 _underDecs = availableMarketsRewards[_idxMarket].underlyingDecimals;
            uint256 trancheVal = IMarketHelper(mktHelperAddress).getTrancheMarketTVL(_protocol, _trNum, _underPrice, _underDecs);
            marketShare = trancheVal.mul(1e18).div(totalValue);
        } else 
            marketShare = 0;
        return marketShare;
    }

    /**
     * @dev return rewards APY for market tranche A 
     * @param _idxMarket market index
     * @return rewards APY 
     */
    function getRewardsAPYSingleMarketTrancheA(uint256 _idxMarket) external view returns(uint256) {
        uint256 secondsInYear = 60*60*24*365;
        uint256 rewardsAPY = trancheARewardsInfo[_idxMarket].rewardRate.mul(secondsInYear);
        return rewardsAPY;
    }

    /**
     * @dev return rewards APY for market tranche A 
     * @param _idxMarket market index
     * @return rewards APY 
     */
    function getRewardsAPYSingleMarketTrancheB(uint256 _idxMarket) external view returns(uint256) {
        uint256 secondsInYear = 60*60*24*365;
        // availableMarketsRewards[_idxMarket].rewardsTrBAPY = trancheBRewardsInfo[_idxMarket].rewardRate.mul(secondsInYear);
        uint256 rewardsAPY = trancheBRewardsInfo[_idxMarket].rewardRate.mul(secondsInYear);
        return rewardsAPY;
    }

    /**
     * @dev get the balance of a token in this contract
     * @param _token token address
     * @return token balance
     */
    function getTokenBalance(address _token) external view returns(uint256) {
        return IERC20Upgradeable(_token).balanceOf(address(this));
    }

    /* ========== INTERNAL, MUTATIVE AND RESTRICTED FUNCTIONS ========== */

    /**
     * @dev set the address of the reward token
     * @param _token rewards token address (SLICE or other)
     */
    function setRewardTokenAddress(address _token) external onlyOwner {
        require(_token != address(0), "IncentiveController: address not allowed");
        rewardsTokenAddress = _token;
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
     * @dev add a new market to this contract
     * @param _protocol protocol address
     * @param _protocolTrNumber protocol tranche number
     * @param _balFactor balance factor, meaning percentage on tranche B for asintotic values (scaled by 1e18)
     * @param _marketPercentage initial percantage for this market (scaled by 1e18)
     * @param _extProtReturn external protocol returns (compound, aave, and so on) (scaled by 1e18)
     * @param _rewardsDuration rewards duration (in seconds)
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
            uint256 _rewardsDuration,
            uint256 _underlyingDecs,
            uint256 _underlyingPrice,
            address _chainAggrInterface,
            bool _reciprocPrice) external onlyOwner{
        require(_balFactor <= uint256(1e18), "IncentiveController: balance factor too high");
        require(_marketPercentage <= uint256(1e18), "IncentiveController: market percentage too high");
        require(_rewardsDuration > 0, "IncentiveController: rewards duration cannot be zero");
        availableMarkets[marketsCounter].protocol = _protocol;
        availableMarkets[marketsCounter].protocolTrNumber = _protocolTrNumber;
        ( , , address trAAddress, address trBAddress) = IProtocol(_protocol).trancheAddresses(_protocolTrNumber);
        require(trAAddress != address(0) && trBAddress != address(0), "IncentiveController: tranches not found");
        availableMarkets[marketsCounter].aTranche = trAAddress;
        availableMarkets[marketsCounter].bTranche = trBAddress;
        availableMarkets[marketsCounter].balanceFactor = _balFactor; // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        trancheARewardsInfo[marketsCounter].lastUpdateTime = block.timestamp;
        trancheARewardsInfo[marketsCounter].lastUpdateTime = block.timestamp;
        availableMarkets[marketsCounter].enabled = true;
        availableMarkets[marketsCounter].extProtocolPercentage = _extProtReturn;  // percentage scaled by 10^18: 0 - 1e18 (i.e. 30000000000000000 = 0.03 * 1e18 = 3%)
        availableMarketsRewards[marketsCounter].marketRewardsPercentage = _marketPercentage;  // percentage scaled by 10^18: 0-18 (i.e. 500000000000000000 = 0.5 * 1e18 = 50%)
        availableMarketsRewards[marketsCounter].rewardsDuration = _rewardsDuration; // in seconds
        availableMarketsRewards[marketsCounter].underlyingDecimals = _underlyingDecs;

        IPriceHelper(priceHelperAddress).setExternalProviderParameters(marketsCounter, _chainAggrInterface, _reciprocPrice);

        if (_underlyingPrice > 0)
            availableMarketsRewards[marketsCounter].underlyingPrice = _underlyingPrice;
        else
            availableMarketsRewards[marketsCounter].underlyingPrice = IPriceHelper(priceHelperAddress).getNormalizedChainlinkPrice(marketsCounter);

        initRewardsSingleMarket(marketsCounter);
        
        emit NewMarketAdded(marketsCounter, availableMarkets[marketsCounter].protocol, availableMarkets[marketsCounter].protocolTrNumber,
            availableMarkets[marketsCounter].balanceFactor, availableMarkets[marketsCounter].extProtocolPercentage,
            availableMarketsRewards[marketsCounter].marketRewardsPercentage, availableMarketsRewards[marketsCounter].rewardsDuration, block.timestamp);

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
        require(_enables.length == marketsCounter, "IncentiveController: enable array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarkets[i].enabled = _enables[i];
        }
    }

    /**
     * @dev set reward frequency for a single market
     * @param _idxMarket market index
     * @param _rewardsDuration rewards frequency (in seconds)
     */
    function setRewardsFrequencySingleMarket(uint256 _idxMarket, uint256 _rewardsDuration) external onlyOwner {
        require(_rewardsDuration > 0, "IncentiveController: rewards frequency cannot be zero");
        availableMarketsRewards[_idxMarket].rewardsDuration = _rewardsDuration;
    }

    /**
     * @dev set reward frequency for all markets
     * @param _rewardsFreqs rewards frequency array (in seconds)
     */
    function setRewardsFrequencyAllMarkets(uint256[] memory _rewardsFreqs) external onlyOwner {
        require(_rewardsFreqs.length ==  marketsCounter, "IncentiveController: rewards frequency array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].rewardsDuration = _rewardsFreqs[i];
        }
    }

    /**
     * @dev set single market rewards percentage
     * @param _idxMarket market index
     * @param _percentage rewards percentage (scaled by 1e18)
     */
    function setRewardsPercentageSingleMarket(uint256 _idxMarket, uint256 _percentage) external onlyOwner {
        require(_idxMarket < marketsCounter, "IncentiveController: Market does not exist");
        availableMarketsRewards[_idxMarket].marketRewardsPercentage = _percentage;
    }

    /**
     * @dev set single market rewards percentage
     * @param _percentages rewards percentage array (scaled by 1e18)
     */
    function setRewardsPercentageAllMarkets(uint256[] memory _percentages) external onlyOwner {
        require(_percentages.length == marketsCounter, "IncentiveController: ext protocol array not correct length");
        for (uint256 i = 0; i < marketsCounter; i++) {
            availableMarketsRewards[i].marketRewardsPercentage = _percentages[i];
        }
    }

    /**
     * @dev set external returns for a market
     * @param _idxMarket market index
     * @param _extProtPerc external protocol rewards percentage (scaled by 1e18)
     */
    function setExtProtocolPercentSingleMarket(uint256 _idxMarket, uint256 _extProtPerc) external onlyOwner {
        require(_idxMarket < marketsCounter, "IncentiveController: Market does not exist");
        availableMarkets[_idxMarket].extProtocolPercentage = _extProtPerc;
    }

    /**
     * @dev set external returns for all markets
     * @param _extProtPercs external protocol rewards percentage array (scaled by 1e18)
     */
    function setExtProtocolPercentAllMarkets(uint256[] memory _extProtPercs) external onlyOwner {
        require(_extProtPercs.length == marketsCounter, "IncentiveController: ext protocol array not correct length");
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
        require(_idxMarket < marketsCounter, "IncentiveController: Market does not exist");
        availableMarkets[_idxMarket].balanceFactor = _balFactor;
    }

    /**
     * @dev set balance factor (asynthotic value for tranche B) for all markets
     * @param _balFactors balance factor array (scaled by 1e18)
     */
    function setBalanceFactorAllMarkets(uint256[] memory _balFactors) external onlyOwner {
        require(_balFactors.length == marketsCounter, "IncentiveController: ext protocol array not correct length");
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
    
    /* REWARDS DISTRIBUTION */
    /**
     * @dev update rewards amount for all enabled markets, splitting the amount between each market via market percentage
     * @param _totalAmount total rewards amount
     * @param _rewardsDuration rewards duration (in seconds)
     */
    function updateRewardAmountsAllMarkets(uint256 _totalAmount, uint256 _rewardsDuration) external onlyOwner {
        require(marketsCounter > 0, 'IncentiveController: no markets');
        require(_totalAmount > 0, "IncentiveController: _totalAmount has to be greater than zero ");
        require(_rewardsDuration > 0, "IncentiveController: _rewardsDuration has to be greater than zero ");

        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardsTokenAddress), msg.sender, address(this), _totalAmount);

        for (uint i = 0; i < marketsCounter; i++) {
            if (availableMarketsRewards[i].marketRewardsPercentage > 0) {
                uint256 trRewardsAmount = _totalAmount.mul(availableMarketsRewards[i].marketRewardsPercentage).div(1e18);
                updateRewardsSingleMarketInternal(i, trRewardsAmount, _rewardsDuration);
            }
        }
    }

    /**
     * @dev internal function
     * @dev update rewards amount for an enabled market, splitting the amount between tranche A & B
     * @param _idxMarket market index
     * @param _rewardAmount amount of tokens to distribute to this market (tranche A + tranche B)
     * @param _rewardsDuration rewards duration (in seconds)
     */
    function updateRewardsSingleMarketInternal(uint256 _idxMarket, uint256 _rewardAmount, uint256 _rewardsDuration) internal {
        if (_rewardAmount > 0 && _idxMarket < marketsCounter && availableMarkets[_idxMarket].enabled){
            address _protocol = availableMarkets[_idxMarket].protocol;
            uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
            uint256 _underlyingPrice = availableMarketsRewards[_idxMarket].underlyingPrice; 
            uint256 _underlyingDecs = availableMarketsRewards[_idxMarket].underlyingDecimals; 
            uint256 _extProtRet = availableMarkets[_idxMarket].extProtocolPercentage;
            uint256 _balFactor = availableMarkets[_idxMarket].balanceFactor;
            uint256 trBPercent = 
                uint256(IMarketHelper(mktHelperAddress).getTrancheBRewardsPercentage(_protocol, _trNum, _underlyingPrice, _underlyingDecs, _extProtRet, _balFactor));
            uint256 trBAmount = _rewardAmount.mul(trBPercent).div(1e18);
            uint256 trAAmount = _rewardAmount.sub(trBAmount);

            availableMarketsRewards[_idxMarket].rewardsDuration = _rewardsDuration;

            availableMarketsRewards[_idxMarket].trancheARewardsAmount = trAAmount;
            notifyRewardAmountTrancheA(_idxMarket, trAAmount, _rewardsDuration);
            
            availableMarketsRewards[_idxMarket].trancheBRewardsAmount = trBAmount;
            notifyRewardAmountTrancheB(_idxMarket, trBAmount, _rewardsDuration);

            trancheARewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;
            trancheBRewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;

            emit FundsDistributed(_idxMarket, trAAmount, trBAmount, block.timestamp);
        }
    }

    /**
     * @dev update rewards amount for an enabled market, splitting the amount between tranche A & B
     * @param _idxMarket market index
     * @param _rewardAmount amount of tokens to distribute to this market (tranche A + tranche B)
     * @param _rewardsDuration rewards duration (in seconds)
     */
    function updateRewardsSingleMarket(uint256 _idxMarket, uint256 _rewardAmount, uint256 _rewardsDuration) external onlyOwner {
        require(_rewardAmount > 0, "IncentiveController: _rewardAmount has to be greater than zero ");
        require(_idxMarket < marketsCounter, 'IncentiveController: market does not exist');
        require(availableMarkets[_idxMarket].enabled, "IncentiveController: market not enabled");

        SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardsTokenAddress), msg.sender, address(this), _rewardAmount);

        updateRewardsSingleMarketInternal(_idxMarket, _rewardAmount, _rewardsDuration);
    }

    /**
     * @dev internal function
     * @dev initiate rewards for an single market
     * @param _idxMarket market index
     */
    function initRewardsSingleMarket(uint256 _idxMarket) internal {
        availableMarketsRewards[_idxMarket].trancheARewardsAmount = 1e18;
        availableMarketsRewards[_idxMarket].trancheBRewardsAmount = 1e18;
        availableMarketsRewards[_idxMarket].rewardsDuration = 2;
        trancheARewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;
        trancheBRewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;
        trancheARewardsInfo[_idxMarket].periodFinish = block.timestamp + 2;
        trancheBRewardsInfo[_idxMarket].periodFinish = block.timestamp + 2;
    }

    /**
     * @dev internal function
     * @dev notify rewards amount for a market tranche A
     * @param _idxMarket market index
     * @param _rewardAmount amount of tokens to distribute to this tranche A
     * @param _rewardsDuration rewards duration (in seconds)
     */
    function notifyRewardAmountTrancheA(uint256 _idxMarket, 
            uint256 _rewardAmount, 
            uint256 _rewardsDuration) internal updateRewardsPerMarketTrancheA(_idxMarket, address(0)) {
        require(block.timestamp.add(_rewardsDuration) >= trancheARewardsInfo[_idxMarket].periodFinish, "IncentiveController: Cannot reduce existing period");
        
        if (block.timestamp >= trancheARewardsInfo[_idxMarket].periodFinish) {
            availableMarketsRewards[_idxMarket].trancheARewardsAmount = _rewardAmount;
            trancheARewardsInfo[_idxMarket].rewardRate = _rewardAmount.div(_rewardsDuration);
        } else {
            uint256 remaining = trancheARewardsInfo[_idxMarket].periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(trancheARewardsInfo[_idxMarket].rewardRate);
            trancheARewardsInfo[_idxMarket].rewardRate = _rewardAmount.add(leftover).div(_rewardsDuration);
            availableMarketsRewards[_idxMarket].trancheARewardsAmount = leftover.add(_rewardAmount);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = IERC20Upgradeable(rewardsTokenAddress).balanceOf(address(this));
        require(trancheARewardsInfo[_idxMarket].rewardRate <= balance.div(_rewardsDuration), "IncentiveController: Provided reward too high");

        trancheARewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;
        trancheARewardsInfo[_idxMarket].periodFinish = block.timestamp.add(_rewardsDuration);
        emit RewardAdded(_rewardAmount, trancheARewardsInfo[_idxMarket].periodFinish);
    }

    /**
     * @dev internal function
     * @dev notify rewards amount for a market tranche B
     * @param _idxMarket market index
     * @param _rewardAmount amount of tokens to distribute to this tranche B
     * @param _rewardsDuration rewards duration (in seconds)
     */
    function notifyRewardAmountTrancheB(uint256 _idxMarket, 
            uint256 _rewardAmount, 
            uint256 _rewardsDuration) internal updateRewardsPerMarketTrancheB(_idxMarket, address(0)) {
        require(block.timestamp.add(_rewardsDuration) >= trancheBRewardsInfo[_idxMarket].periodFinish, "IncentiveController: Cannot reduce existing period");
        
        if (block.timestamp >= trancheBRewardsInfo[_idxMarket].periodFinish) {
            availableMarketsRewards[_idxMarket].trancheBRewardsAmount = _rewardAmount;
            trancheBRewardsInfo[_idxMarket].rewardRate = _rewardAmount.div(_rewardsDuration);
        } else {
            uint256 remaining = trancheBRewardsInfo[_idxMarket].periodFinish.sub(block.timestamp);
            uint256 leftover = remaining.mul(trancheBRewardsInfo[_idxMarket].rewardRate);
            trancheBRewardsInfo[_idxMarket].rewardRate = _rewardAmount.add(leftover).div(_rewardsDuration);
            availableMarketsRewards[_idxMarket].trancheBRewardsAmount = leftover.add(_rewardAmount);
        }

        // Ensure the provided reward amount is not more than the balance in the contract.
        // This keeps the reward rate in the right range, preventing overflows due to
        // very high values of rewardRate in the earned and rewardsPerToken functions;
        // Reward + leftover must be less than 2^256 / 10^18 to avoid overflow.
        uint256 balance = IERC20Upgradeable(rewardsTokenAddress).balanceOf(address(this));
        require(trancheBRewardsInfo[_idxMarket].rewardRate <= balance.div(_rewardsDuration), "IncentiveController: Provided reward too high");

        trancheBRewardsInfo[_idxMarket].lastUpdateTime = block.timestamp;
        trancheBRewardsInfo[_idxMarket].periodFinish = block.timestamp.add(_rewardsDuration);
        emit RewardAdded(_rewardAmount, trancheBRewardsInfo[_idxMarket].periodFinish);
    }

    /* USER CLAIM REWARDS */
    /**
     * @dev claim all rewards from all markets for a single user
     */
    function claimRewardsAllMarkets() external {
        for (uint i = 0; i < marketsCounter; i++) {
            claimRewardSingleMarketTrA(i);
            claimRewardSingleMarketTrB(i);
        }
    }

    /**
     * @dev claim all rewards from a market tranche A for a single user
     * @param _idxMarket market index
     */
    function claimRewardSingleMarketTrA(uint256 _idxMarket) public nonReentrant updateRewardsPerMarketTrancheA(_idxMarket, msg.sender) {
        uint256 reward = trARewards[_idxMarket][msg.sender];
        if (reward > 0) {
            trARewards[_idxMarket][msg.sender] = 0;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardsTokenAddress), msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    /**
     * @dev claim all rewards from a market tranche B for a single user
     * @param _idxMarket market index
     */
    function claimRewardSingleMarketTrB(uint256 _idxMarket) public nonReentrant updateRewardsPerMarketTrancheB(_idxMarket, msg.sender) {
        uint256 reward = trBRewards[_idxMarket][msg.sender];
        if (reward > 0) {
            trBRewards[_idxMarket][msg.sender] = 0;
            SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(rewardsTokenAddress), msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }
    
    /**
     * @dev Recalculate and update Slice speeds for all markets
     */
    function refreshSliceSpeeds(/*bool _useChainlink*/) external onlyOwner {
        require(msg.sender == tx.origin, "IncentiveController: only externally owned accounts may refresh speeds");
        refreshSliceSpeedsInternal(/*_useChainlink*/);
    }

    /**
     * @dev internal function - refresh rewards percentage of available and enabled markets
     */
    function refreshSliceSpeedsInternal(/*bool _useChainlink*/) internal {
        uint256 allMarketsEnabledTVL = getAllMarketsTVL(/*_useChainlink*/);
        address _protocol;
        uint256 _trNum;
        uint256 _underPrice;
        uint256 _underDecs;
        uint256 _mktTVL;

        for (uint i = 0; i < marketsCounter; i++) {
            if (availableMarkets[i].enabled && allMarketsEnabledTVL > 0) {
                _protocol = availableMarkets[i].protocol;
                _trNum = availableMarkets[i].protocolTrNumber;
                // if (_useChainlink)
                //     setUnderlyingPriceFromChainlinkSingleMarket(i);
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
     * @dev transfer tokens from here to a destination address (emergency only)
     * @param _token token address to transfer
     * @param _to recipient address
     * @param _amount token amount to transfer
     */
    function emergencyTokenTransfer(address _token, address _to, uint256 _amount) external onlyOwner {
        SafeERC20Upgradeable.safeTransfer(IERC20Upgradeable(_token), _to, _amount);
    }

}