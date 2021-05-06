// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Protocol Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "../interfaces/IProtocol.sol";

contract Protocol is IProtocol {

    struct Tranche {
        uint256 trAValue;
        uint256 trBValue;
        uint256 totalTrValue;
        uint256 trancheACurrentRPB;
        uint256 extProtRPB;
    }

    struct TrancheAddresses {
        address buyerCoinAddress;       // ETH (ZERO_ADDRESS) or DAI
        address cTokenAddress;          // cETH or cDAI
        address ATrancheAddress;
        address BTrancheAddress;
    }

    mapping(uint256 => TrancheAddresses) public override trancheAddresses;
    mapping(uint256 => Tranche) public tranchesMocks;

    uint256 public trCounter;

    function createTranche(address _trA,
            address _trB,
            uint256 _trAVal,
            uint256 _trBVal,
            uint256 _trARBP,
            uint256 _extRPB) external {
        trancheAddresses[trCounter].ATrancheAddress = _trA;
        trancheAddresses[trCounter].BTrancheAddress = _trB;
        tranchesMocks[trCounter].trAValue = _trAVal;
        tranchesMocks[trCounter].trBValue = _trBVal;
        tranchesMocks[trCounter].totalTrValue = _trAVal + _trBVal;
        tranchesMocks[trCounter].trancheACurrentRPB = _trARBP;
        tranchesMocks[trCounter].extProtRPB = _extRPB;
        trCounter = trCounter + 1;
    }

    function setTrA(uint256 _trancheNum, address _trA) external {
        trancheAddresses[_trancheNum].ATrancheAddress = _trA;
    }

    function setTrB(uint256 _trancheNum, address _trB) external {
        trancheAddresses[_trancheNum].BTrancheAddress = _trB;

    }
    function setTrAValue(uint256 _trancheNum, uint256 _trAVal) external {
        tranchesMocks[_trancheNum].trAValue = _trAVal;
    }
    function setTrBValue(uint256 _trancheNum, uint256 _trBVal) external {
        tranchesMocks[_trancheNum].trBValue = _trBVal;
    }
    function setTotalValue(uint256 _trancheNum) external {
        tranchesMocks[_trancheNum].totalTrValue = tranchesMocks[_trancheNum].trAValue + tranchesMocks[_trancheNum].trBValue;
    }

    function getTrAValue(uint256 _trancheNum) external view override returns (uint256){
        return tranchesMocks[_trancheNum].trAValue;
    }
    function getTrBValue(uint256 _trancheNum) external view override returns (uint256){
        return tranchesMocks[_trancheNum].trBValue;
    }
    function getTotalValue(uint256 _trancheNum) external view override returns (uint256){
        return tranchesMocks[_trancheNum].totalTrValue;
    }

    function getTrancheAExchangeRate(uint256 _trancheNum) external view override returns (uint256) {}
    function getTrancheBExchangeRate(uint256 _trancheNum, uint256 _newAmount) external view override returns (uint256){}

    function setExtProtRPB(uint256 _trancheNum, uint256 _newRPB) external {
        tranchesMocks[_trancheNum].extProtRPB = _newRPB;
    }

    function getExtProtRPB(uint256 _trancheNum) external view override returns (uint256) {
        return tranchesMocks[_trancheNum].extProtRPB;
    }

    function setTrancheACurrentRPB(uint256 _trancheNum, uint256 _newRPB) external {
        tranchesMocks[_trancheNum].trancheACurrentRPB = _newRPB;
    }

    function getTrancheACurrentRPB(uint256 _trancheNum) external view override returns (uint256) {
        return tranchesMocks[_trancheNum].trancheACurrentRPB;
    }


}