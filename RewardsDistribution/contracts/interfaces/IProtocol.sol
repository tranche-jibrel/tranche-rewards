// SPDX-License-Identifier: MIT
/**
 * Created on 2021-04-06
 * @summary: Protocol Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IProtocol {
    function getTrA(uint256 _trancheNum) external view returns (address);
    function getTrB(uint256 _trancheNum) external view returns (address);
    function getTrAValue(uint256 _trancheNum) external view returns (uint256);
    function getTrBValue(uint256 _trancheNum) external view returns (uint256);
    function getTotalValue(uint256 _trancheNum) external view returns (uint256);
    function getTrancheAExchangeRate(uint256 _trancheNum) external view returns (uint256);
    function getTrancheBExchangeRate(uint256 _trancheNum, uint256 _newAmount) external view returns (uint256);
    function trancheAddresses(uint256 _trNum) external view returns (address, address, address, address);
    //function getExtProtRPB(uint256 _trancheNum) external view returns (uint256);
    function getTrancheACurrentRPB(uint256 _trancheNum) external view returns (uint256);
    function totalBlocksPerYear() external view returns (uint256);
}