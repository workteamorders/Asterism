// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";
import {AsterismRenderer} from "../src/AsterismRenderer.sol";
import {AsterismConfig} from "./AsterismConfig.sol";
import {MockUniswapV2Factory} from "../test/mocks/MockUniswapV2.sol";
import {MockWETH} from "../test/mocks/MockWETH.sol";

/// Local anvil only (chain id 31337). Deploys mock WETH and a mock Uniswap V2 factory, then the full Asterism stack
/// with short windows, so the site and end-to-end tests can run against a real chain on this machine.
///
///   anvil --port 8545 &
///   forge script script/LocalDemo.s.sol --rpc-url http://127.0.0.1:8545 --broadcast --unlocked --sender 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
///
/// The sender is anvil's first default test account. Nothing here touches a public network.
contract LocalDemo is Script {
    bytes32 internal constant TEST_SECRET = keccak256("asterism-local-demo-secret");

    function run() external {
        require(block.chainid == 31337, "LocalDemo is for anvil only");
        vm.startBroadcast();
        MockWETH weth = new MockWETH();
        MockUniswapV2Factory factory = new MockUniswapV2Factory();
        AsterismRenderer renderer = AsterismConfig.deployRenderer();
        // LOCAL_START_DELAY (seconds) lets end-to-end tests see the not-started state before warping forward.
        uint256 start = block.timestamp + vm.envOr("LOCAL_START_DELAY", uint256(60));
        AsterismLauncher.Params memory p = AsterismLauncher.Params({
            name: "Asterism",
            symbol: "ASTERISM",
            maxSupplyTokens: AsterismConfig.MAX_SUPPLY_TOKENS,
            saleBps: AsterismConfig.SALE_BPS,
            liquidityProceedsBps: AsterismConfig.LIQUIDITY_PROCEEDS_BPS,
            treasuryProceedsBps: AsterismConfig.TREASURY_PROCEEDS_BPS,
            mintPrice: 0.002 ether,
            walletCap: 10,
            txCap: 5,
            saleStart: start,
            saleEnd: start + 1 days,
            finalizeWindow: 1 days,
            revealWindow: 1 days,
            treasury: payable(0x70997970C51812dc3A010C7d01b50e0d17dc79C8),
            revealCommit: keccak256(abi.encodePacked(TEST_SECRET)),
            weth: address(weth),
            v2Factory: address(factory)
        });
        AsterismLauncher launcher = new AsterismLauncher(p, renderer);
        vm.stopBroadcast();

        string memory o = "local";
        vm.serializeUint(o, "chainId", 31337);
        vm.serializeAddress(o, "weth", address(weth));
        vm.serializeAddress(o, "uniswapV2Factory", address(factory));
        vm.serializeAddress(o, "renderer", address(renderer));
        vm.serializeAddress(o, "launcher", address(launcher));
        vm.serializeAddress(o, "token", address(launcher.token()));
        vm.serializeAddress(o, "mirror", launcher.token().mirrorERC721());
        vm.serializeAddress(o, "sink", address(launcher.sink()));
        vm.serializeBytes32(o, "testSecret", TEST_SECRET);
        string memory json = vm.serializeUint(o, "saleStart", start);
        vm.writeJson(json, "../deployments/local-31337.json");
        console.log(json);
    }
}
