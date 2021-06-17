// SPDX-License-Identifier: MIT
/**
 * Created on 2021-06-17
 * @summary: IUniswapV2ERC20
 * @author: Jibrel Team
 */
pragma solidity 0.8.0;

interface IUniswapV2ERC20 {
    function permit(address owner, address spender, uint value, uint deadline, uint8 v, bytes32 r, bytes32 s) external;
}