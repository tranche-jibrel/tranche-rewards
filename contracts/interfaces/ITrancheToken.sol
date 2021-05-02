// SPDX-License-Identifier: MIT
/**
 * Created on 2021-01-16
 * @summary: JTranches Interface
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

import "@openzeppelin/contracts-upgradeable/token/ERC20/IERC20Upgradeable.sol";

interface ITrancheToken is IERC20Upgradeable {
    function mint(address account, uint256 value) external;
    function burn(uint256 value) external;
}