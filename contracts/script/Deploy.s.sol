// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";
import {AsterismRenderer} from "../src/AsterismRenderer.sol";
import {AsterismConfig} from "./AsterismConfig.sol";

/// Deploys AsterismRenderer and AsterismLauncher (which deploys the token, its mirror and the liquidity sink).
///
/// The owner runs this MANUALLY with a Foundry keystore or a hardware wallet. Never with a private key in env.
///
///   Local anvil (this repo's tests):   see script/LocalDemo.s.sol
///   Testnet:   forge script script/Deploy.s.sol --rpc-url $RH_TESTNET_RPC --account <keystore> --broadcast
///   Mainnet:   forge script script/Deploy.s.sol --rpc-url $RH_MAINNET_RPC --ledger --broadcast
///
/// Config is read from ../deployments/config/<chainId>.json. The deployer becomes the revealer.
/// Mainnet additionally requires ASTERISM_MAINNET_ACK to equal the exact acknowledgement string below.
contract Deploy is Script {
    uint256 internal constant ROBINHOOD_MAINNET = 4663;
    uint256 internal constant ROBINHOOD_TESTNET = 46630;
    uint256 internal constant ANVIL = 31337;

    // Verified on 2026-11-10 against developers.uniswap.org and on-chain code (docs/DECISIONS.md).
    address internal constant MAINNET_WETH = 0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73;
    address internal constant MAINNET_UNISWAP_V2_FACTORY = 0x8bcEaA40B9AcdfAedF85AdF4FF01F5Ad6517937f;

    string internal constant MAINNET_ACK =
        "I have an external audit, a legal review, and I understand every parameter is permanent";

    function run() external returns (AsterismRenderer renderer, AsterismLauncher launcher) {
        uint256 chainId = block.chainid;
        require(chainId == ANVIL || chainId == ROBINHOOD_TESTNET || chainId == ROBINHOOD_MAINNET, "unsupported chain");
        string memory path = string.concat("../deployments/config/", vm.toString(chainId), ".json");
        string memory cfg = vm.readFile(path);

        AsterismLauncher.Params memory p = AsterismLauncher.Params({
            name: vm.parseJsonString(cfg, ".name"),
            symbol: vm.parseJsonString(cfg, ".symbol"),
            maxSupplyTokens: AsterismConfig.MAX_SUPPLY_TOKENS,
            saleBps: AsterismConfig.SALE_BPS,
            liquidityProceedsBps: AsterismConfig.LIQUIDITY_PROCEEDS_BPS,
            treasuryProceedsBps: AsterismConfig.TREASURY_PROCEEDS_BPS,
            mintPrice: vm.parseJsonUint(cfg, ".mintPriceWei"),
            walletCap: vm.parseJsonUint(cfg, ".walletCap"),
            txCap: vm.parseJsonUint(cfg, ".txCap"),
            saleStart: vm.parseJsonUint(cfg, ".saleStart"),
            saleEnd: vm.parseJsonUint(cfg, ".saleEnd"),
            finalizeWindow: vm.parseJsonUint(cfg, ".finalizeWindowSeconds"),
            revealWindow: vm.parseJsonUint(cfg, ".revealWindowSeconds"),
            treasury: payable(vm.parseJsonAddress(cfg, ".treasury")),
            revealCommit: vm.parseJsonBytes32(cfg, ".revealCommit"),
            weth: vm.parseJsonAddress(cfg, ".weth"),
            v2Factory: vm.parseJsonAddress(cfg, ".uniswapV2Factory")
        });

        if (chainId == ROBINHOOD_MAINNET) {
            require(keccak256(bytes(vm.envOr("ASTERISM_MAINNET_ACK", string("")))) == keccak256(bytes(MAINNET_ACK)), "mainnet not acknowledged");
            require(p.weth == MAINNET_WETH && p.v2Factory == MAINNET_UNISWAP_V2_FACTORY, "unexpected mainnet DEX addresses");
        }
        require(p.saleStart > block.timestamp + 1 hours, "saleStart must leave time to publish parameters");

        console.log("chain", chainId);
        console.log("deployer (becomes revealer)", msg.sender);
        console.log("mint price (wei)", p.mintPrice);
        console.log("sale window", p.saleStart, p.saleEnd);

        vm.startBroadcast();
        renderer = AsterismConfig.deployRenderer();
        launcher = new AsterismLauncher(p, renderer);
        vm.stopBroadcast();

        console.log("RENDERER", address(renderer));
        console.log("LAUNCHER", address(launcher));
        console.log("TOKEN", address(launcher.token()));
        console.log("MIRROR", launcher.token().mirrorERC721());
        console.log("SINK", address(launcher.sink()));
        console.log("Next: fill ../deployments/<chainId>.json with these addresses and run pnpm verify:deployment.");
    }
}
