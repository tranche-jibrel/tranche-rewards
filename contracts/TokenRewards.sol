// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Slice Rewards contract
 * @author: Jibrel Team
 */
pragma solidity ^0.8.0;


import "@openzeppelin/contracts-upgradeable/token/ERC20/utils/SafeERC20Upgradeable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./TokenRewardsStorage.sol";
import "./interfaces/IProtocol.sol";
import "./interfaces/ITokenRewards.sol";
import "./math/SafeMathInt.sol";

contract TokenRewards is OwnableUpgradeable, TokenRewardsStorage, ITokenRewards {
  using SafeMath for uint256;
  using SafeMathInt for int256;
  //using WadRayMath for uint256;

  function initialize (address _token) public initializer() {
    OwnableUpgradeable.__Ownable_init();
    rewardToken = _token;
  }

  function transferReward(uint256 _amount) external onlyOwner {
    require(_amount > 0, "TokenRewards: no tokens");
    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);
  }
/*
  function _addTokenInternal(address _trToken) internal {
    for (uint i = 0; i < allTrancheTokens.length; i++) {
      require(allTrancheTokens[i] != IERC20Upgradeable(_trToken), "token already added");
    }

    allTrancheTokens.push(IERC20Upgradeable(_trToken));
  }
*/
  function addTrancheMarket(address _protocol, 
      uint256 _protocolTrNumber,
      address _aMarketAddress, 
      address _bMarketAddress, 
      uint256 _aSharePercentage,
      uint256 _tranchePercentage) public {
    availableMarkets[marketsCounter].protocol = _protocol;
    availableMarkets[marketsCounter].protocolTrNumber = _protocolTrNumber;
    //availableMarkets[marketsCounter].aTranche = IProtocol(_protocol).trancheAddresses[_protocolTrNumber].ATrancheAddress;
    availableMarkets[marketsCounter].aTranche = _aMarketAddress;
    //_addTokenInternal(availableMarkets[marketsCounter].aTranche);
    //availableMarkets[marketsCounter].aTranche = IProtocol(_protocol).trancheAddresses[_protocolTrNumber].BTrancheAddress;
    availableMarkets[marketsCounter].bTranche = _bMarketAddress;
    //_addTokenInternal(availableMarkets[marketsCounter].bTranche);
    availableMarkets[marketsCounter].aSharesPercentage = _aSharePercentage;
    availableMarkets[marketsCounter].updateBlock = block.number;
    availableMarkets[marketsCounter].enabled = true;
    availableMarkets[marketsCounter].trancheRewardsPercentage = _tranchePercentage;  //5000 --> 50% (divider = 10000)
    availableMarkets[marketsCounter].deadlineBlock = 0;
    marketsCounter = marketsCounter.add(1);
  }

  function enableTrancheMarket(uint256 _idxMarket) public {
    availableMarkets[_idxMarket].enabled = true;
  }

  function disableTrancheMarket(uint256 _idxMarket) public {
    availableMarkets[_idxMarket].enabled = false;
  }

  function changeSingleTrancheRewardsPercentage(uint256 _idxMarket, uint256 _percentage) public onlyOwner {
    require(_percentage < 10000, "percentage too high!");
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

  function getAllMarketsTVL() public returns(uint256) {
    allMarketTVL = 0;
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
    require(availableMarkets[_idxMarket].enabled, "Market not enabled");
    address _protocol = availableMarkets[_idxMarket].protocol;
    uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
    trancheATVL = IProtocol(_protocol).getTrAValue(_trNum);
    return trancheATVL;
  }

  function getTrancheBMarketTVL(uint256 _idxMarket) public view returns(uint256 trancheBTVL) {
    require(availableMarkets[_idxMarket].enabled, "Market not enabled");
    address _protocol = availableMarkets[_idxMarket].protocol;
    uint256 _trNum = availableMarkets[_idxMarket].protocolTrNumber;
    trancheBTVL = IProtocol(_protocol).getTrBValue(_trNum);
    return trancheBTVL;
  }

  //marketShare = getTrancheValue / sumAllMarketsValueLocked
  function getMarketSharePerTranche(uint256 _idxMarket) public returns(uint256 marketShare) {
    uint256 totalValue = getAllMarketsTVL();

    if (totalValue > 0) {
      uint256 trancheVal = getTrancheAMarketTVL(_idxMarket).add(getTrancheBMarketTVL(_idxMarket));
      marketShare = trancheVal.mul(1e18).div(totalValue);
    } else 
      marketShare = 0;
    return marketShare;
  }
/*
  function getMarketRatePerTranche(uint256 _idxMarket) public returns(uint256 marketRate) {
    uint256 trancheMarketShare = getMarketSharePerTranche(_idxMarket);

    if (trancheMarketShare > 0) {
      uint256 sliceAmount = getTotalReward();
      marketRate = sliceAmount.mul(1e18).div(trancheMarketShare);
    } else 
      marketRate = 0;
    return marketRate;
  }
*/
  function getTrATotalSupply(uint256 _idxMarket) public view returns(uint256 totalBalance) {
    return IERC20Upgradeable(availableMarkets[_idxMarket].aTranche).totalSupply();
  }

  function getTrBTotalSupply(uint256 _idxMarket) public view returns(uint256 totalBalance) {
    return IERC20Upgradeable(availableMarkets[_idxMarket].bTranche).totalSupply();
  }

  function getTrAUserBalance(uint256 _idxMarket, address _user) public view returns(uint256 userBalance) {
    return IERC20Upgradeable(availableMarkets[_idxMarket].aTranche).balanceOf(_user);
  }

  function getTrBUserBalance(uint256 _idxMarket, address _user) public view returns(uint256 userBalance) {
    return IERC20Upgradeable(availableMarkets[_idxMarket].bTranche).balanceOf(_user);
  }

  function getTrAUserRate(uint256 _idxMarket, address _user) public view returns(uint256 userRate) {
    uint256 userBal = getTrAUserBalance(_idxMarket, _user);
    uint256 totSupply = getTrATotalSupply(_idxMarket);
    userRate = userBal.mul(1e18).div(totSupply); // from 0 to 1e18 --> 0 - 100%
    return userRate;
  }

  function getTrBUserRate(uint256 _idxMarket, address _user) public view returns(uint256 userRate) {
    uint256 userBal = getTrBUserBalance(_idxMarket, _user);
    uint256 totSupply = getTrBTotalSupply(_idxMarket);
    userRate = userBal.mul(1e18).div(totSupply); // from 0 to 1e18 --> 0 - 100%
    return userRate;
  }

  function distributeAllMarketsFunds(uint256 _amount, uint256 _duration) external onlyOwner {
		require(_amount > 0, "TokenRewards: no tokens");
    require(_duration > 0, "TokenRewards: no duration");
    require(marketsCounter > 0, "TokenRewards: no markets");
    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);
    for(uint256 i = 0; i < marketsCounter; i++) {
      if (availableMarkets[i].enabled) {
        //uint256 trAmount = _amount.mul(getMarketSharePerTranche(i));
        uint256 trRewardsAmount = _amount.mul(availableMarkets[i].trancheRewardsPercentage).div(PERCENT_DIVIDER);
        availableMarkets[i].trancheARewardsAmount = trRewardsAmount.mul(availableMarkets[i].aSharesPercentage).div(PERCENT_DIVIDER);
        availableMarkets[i].trancheBRewardsAmount = trRewardsAmount.sub(availableMarkets[i].trancheARewardsAmount);
        availableMarkets[i].updateBlock = block.number;
        availableMarkets[i].deadlineBlock = block.number.add(_duration);
      }
		}
	}

  function distributeSingleMarketsFunds(uint256 _idxMarket, uint256 _amount, uint256 _duration) external onlyOwner {
		require(_amount > 0, "TokenRewards: no tokens");
    require(_duration > 0, "TokenRewards: no duration");
    require(marketsCounter > _idxMarket, "TokenRewards: no markets");
    require(availableMarkets[_idxMarket].enabled, "TokenRewards: market disabled");
    SafeERC20Upgradeable.safeTransferFrom(IERC20Upgradeable(rewardToken), msg.sender, address(this), _amount);
    availableMarkets[_idxMarket].trancheARewardsAmount = _amount.mul(availableMarkets[_idxMarket].aSharesPercentage).div(PERCENT_DIVIDER);
    availableMarkets[_idxMarket].trancheBRewardsAmount = _amount.sub(availableMarkets[_idxMarket].trancheARewardsAmount);
    availableMarkets[_idxMarket].updateBlock = block.number;
    availableMarkets[_idxMarket].deadlineBlock = block.number.add(_duration);
	}

  /**
	 * @notice Withdraws all available funds for a token holder in single market
	 */
	function withdrawFundsSingleMarket(uint256 _idxMarket) external {
		uint256 withdrawableFunds = _prepareWithdrawSingleMarket(_idxMarket);
		require(IERC20Upgradeable(rewardToken).transfer(msg.sender, withdrawableFunds), "JTrancheERC20: WITHDRAW_FUNDS_TRANSFER_FAILED");
		_updateTrancheAFundsTokenBalance(_idxMarket);
    _updateTrancheBFundsTokenBalance(_idxMarket);
	}

	/**
	 * @dev Updates the current funds token balance 
	 * and returns the difference of new and previous funds token balances
	 * @return A int256 representing the difference of the new and previous funds token balance
	 */
	function _updateTrancheAFundsTokenBalance(uint256 _idxMarket) internal returns (int256) {
		uint256 prevFundsTokenBalance = fundsATokenBalance[_idxMarket]; //available[_idxMarket].trancheARewardsAmount
		fundsATokenBalance[_idxMarket] = availableMarkets[_idxMarket].trancheARewardsAmount;
		return int256(fundsATokenBalance[_idxMarket]).sub(int256(prevFundsTokenBalance));
	}

  /**
	 * @dev Updates the current funds token balance 
	 * and returns the difference of new and previous funds token balances
	 * @return A int256 representing the difference of the new and previous funds token balance
	 */
	function _updateTrancheBFundsTokenBalance(uint256 _idxMarket) internal returns (int256) {
		uint256 prevFundsTokenBalance = fundsBTokenBalance[_idxMarket]; //available[_idxMarket].trancheBRewardsAmount
		fundsBTokenBalance[_idxMarket] = availableMarkets[_idxMarket].trancheBRewardsAmount;
		return int256(fundsBTokenBalance[_idxMarket]).sub(int256(prevFundsTokenBalance));
	}

	/**
	 * @notice Register a payment of funds in tokens. May be called directly after a deposit is made.
	 * @dev Calls _updateFundsTokenBalance(), whereby the contract computes the delta of the previous and the new 
	 * funds token balance and increments the total received funds (cumulative) by delta by calling _registerFunds()
	 */
	function updateFundsReceivedAllMarket() external {
    int256 newFunds;
    for(uint256 i = 0; i < marketsCounter; i++) {
      if (availableMarkets[i].enabled) {
        newFunds = _updateTrancheAFundsTokenBalance(i);
        if (newFunds > 0) {
          _distributeFundsTrancheA(newFunds.toUint256Safe(), i);
        }
        newFunds = _updateTrancheBFundsTokenBalance(i);
        if (newFunds > 0) {
          _distributeFundsTrancheB(newFunds.toUint256Safe(), i);
        }
      }
    }
	}

  /**
	 * @notice Register a payment of funds in tokens. May be called directly after a deposit is made.
	 * @dev Calls _updateFundsTokenBalance(), whereby the contract computes the delta of the previous and the new 
	 * funds token balance and increments the total received funds (cumulative) by delta by calling _registerFunds()
	 */
	function updateFundsReceivedSingleMarket(uint256 _idxMarket) external {
    require(availableMarkets[_idxMarket].enabled, "Market not enabled");
		int256 newFunds = _updateTrancheAFundsTokenBalance(_idxMarket);
		if (newFunds > 0) {
			_distributeFundsTrancheA(newFunds.toUint256Safe(), _idxMarket);
		}
    newFunds = _updateTrancheBFundsTokenBalance(_idxMarket);
		if (newFunds > 0) {
			_distributeFundsTrancheB(newFunds.toUint256Safe(), _idxMarket);
		}
	}

  /** 
	 * prev. distributeDividends
	 * @notice Distributes funds to token holders.
	 * @dev It reverts if the total supply of tokens is 0.
	 * It emits the `FundsDistributed` event if the amount of received ether is greater than 0.
	 * About undistributed funds:
	 *   In each distribution, there is a small amount of funds which does not get distributed,
	 *     which is `(msg.value * pointsMultiplier) % totalSupply()`.
	 *   With a well-chosen `pointsMultiplier`, the amount funds that are not getting distributed
	 *     in a distribution can be less than 1 (base unit).
	 *   We can actually keep track of the undistributed ether in a distribution
	 *     and try to distribute it in the next distribution ....... todo implement  
	 */
	function _distributeFundsTrancheA(uint256 _value, uint256 _idxMarket) internal {
    uint256 totSupply = getTrATotalSupply(_idxMarket);
		require(totSupply > 0, "FundsDistributionToken._distributeFunds: SUPPLY_IS_ZERO");
		if (_value > 0) {
			//pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier) / totSupply);
      availableMarkets[_idxMarket].trancheARewardsAmount = _value;
			emit FundsDistributed(msg.sender, _value);
		}
	}

  function _distributeFundsTrancheB(uint256 _value, uint256 _idxMarket) internal {
    uint256 totSupply = getTrBTotalSupply(_idxMarket);
		require(totSupply > 0, "FundsDistributionToken._distributeFunds: SUPPLY_IS_ZERO");
		if (_value > 0) {
			//pointsPerShare = pointsPerShare.add(value.mul(pointsMultiplier) / totSupply);
      availableMarkets[_idxMarket].trancheBRewardsAmount = _value;
			emit FundsDistributed(msg.sender, _value);
		}
	}

	/**
	 * prev. withdrawDividend
	 * @notice Prepares funds withdrawal
	 * @dev It emits a `FundsWithdrawn` event if the amount of withdrawn ether is greater than 0.
	 */
	function _prepareWithdrawSingleMarket(uint256 _idxMarket) internal returns (uint256) {
		uint256 _withdrawableDividend = withdrawableSingleMarketFundsOf(_idxMarket, msg.sender);
		withdrawnFunds[msg.sender] = withdrawnFunds[msg.sender].add(_withdrawableDividend);
		emit FundsWithdrawn(msg.sender, _withdrawableDividend);
		return _withdrawableDividend;
	}

  function _prepareWithdrawAllMarkets() internal returns (uint256) {
		uint256 _withdrawableDividend = withdrawableAllMarketsFundsOf(msg.sender);
		withdrawnFunds[msg.sender] = withdrawnFunds[msg.sender].add(_withdrawableDividend);
		emit FundsWithdrawn(msg.sender, _withdrawableDividend);
		return _withdrawableDividend;
	}

	/** 
	 * prev. withdrawableDividendOf
	 * @notice View the amount of funds that an address can withdraw.
	 * @return The amount funds that `_owner` can withdraw.
	 */
	function withdrawableSingleMarketFundsOf(uint256 _idxMarket, address _user) public view returns(uint256) {
    uint256 trancheAPart = accumulativeFundsOfSingleMarketTrA(_idxMarket, _user);
    uint256 trancheBPart = accumulativeFundsOfSingleMarketTrA(_idxMarket, _user);
		return trancheAPart.add(trancheBPart).sub(withdrawnFunds[_user]);
	}

  function withdrawableAllMarketsFundsOf(address _user) public view returns(uint256) {
    uint256 totalWithdrawable;
    for(uint256 i = 0; i < marketsCounter; i++) {
      uint256 trancheAPart = accumulativeFundsOfSingleMarketTrA(i, _user);
      uint256 trancheBPart = accumulativeFundsOfSingleMarketTrA(i, _user);
      totalWithdrawable = totalWithdrawable.add(trancheAPart).add(trancheBPart);
    }
		return totalWithdrawable.sub(withdrawnFunds[_user]);
	}
	
	/**
	 * prev. withdrawnDividendOf
	 * @notice View the amount of funds that an address has withdrawn.
	 * @param _owner The address of a token holder.
	 * @return The amount of funds that `_owner` has withdrawn.
	 */
	function withdrawnFundsOf(address _owner) public view returns(uint256) {
		return withdrawnFunds[_owner];
	}

	/**
	 * prev. accumulativeDividendOf
	 * @notice View the amount of funds that an address has earned in total.
	 * @dev accumulativeFundsOf(_owner) = withdrawableFundsOf(_owner) + withdrawnFundsOf(_owner)
	 * = (pointsPerShare * balanceOf(_owner) + pointsCorrection[_owner]) / pointsMultiplier
	 * @return The amount of funds that `_owner` has earned in total.
	 */
	function accumulativeFundsOfSingleMarketTrA(uint256 _idxMarket, address _user) public view returns(uint256) {
    //uint256 userBalance = getTrAUserBalance(_idxMarket, _user);
    uint256 userRate = getTrAUserRate(_idxMarket, _user);
    return availableMarkets[_idxMarket].trancheARewardsAmount.mul(userRate).div(1e18);
		//return pointsPerShare.mul(userBalance).toInt256Safe().add(pointsCorrection[_user]).toUint256Safe() / pointsMultiplier;
	}

  function accumulativeFundsOfSingleMarketTrB(uint256 _idxMarket, address _user) public view returns(uint256) {
    //uint256 userBalance = getTrBUserBalance(_idxMarket, _user);
    uint256 userRate = getTrBUserRate(_idxMarket, _user);
    return availableMarkets[_idxMarket].trancheBRewardsAmount.mul(userRate).div(1e18);
		//return pointsPerShare.mul(userBalance).toInt256Safe().add(pointsCorrection[_user]).toUint256Safe() / pointsMultiplier;
	}

  function accumulativeFundsOfAlleMarkets(address _user) public view returns(uint256) {
    uint256 totalAccrued;
    for(uint256 i = 0; i < marketsCounter; i++) {
      totalAccrued = totalAccrued.add(accumulativeFundsOfSingleMarketTrA(i, _user));
      totalAccrued = totalAccrued.add(accumulativeFundsOfSingleMarketTrB(i, _user));
    }
    return totalAccrued;
  }

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
   * @notice Return the address of the COMP token
   * @return The address of COMP
   */
  function getRewardTokenAddress() public view returns(address) {
    return rewardToken;
  }

}