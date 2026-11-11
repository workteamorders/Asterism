// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {MockUniswapV2Factory} from "../test/mocks/MockUniswapV2.sol";
import {MockWETH} from "../test/mocks/MockWETH.sol";

/// REHEARSAL ONLY. Robinhood Chain testnet has no official Uniswap V2 deployment, so a launch rehearsal there needs
/// a stand-in. This deploys a wrapped-ether token and a minimal Uniswap-V2-compatible factory and pair from this
/// repository's test mocks. They are NOT Uniswap's contracts and must never be used on mainnet (this script refuses to).
///
///   scripts/deploy.sh dex-testnet --account <keystore> [--broadcast]
///
/// Put the printed WETH and FACTORY addresses in deployments/config/46630.json (weth, uniswapV2Factory).
contract DeployTestnetDex is Script {
    function run() external returns (MockWETH weth, MockUniswapV2Factory factory) {
        require(block.chainid == 46630 || block.chainid == 31337, "rehearsal DEX: testnet or anvil only");
        vm.startBroadcast();
        weth = new MockWETH();
        factory = new MockUniswapV2Factory();
        vm.stopBroadcast();
        console.log("WETH (rehearsal stand-in, not official)", address(weth));
        console.log("FACTORY (rehearsal stand-in, not Uniswap)", address(factory));
        console.log("Put these in deployments/config/<chainId>.json as weth and uniswapV2Factory.");
    }
}
