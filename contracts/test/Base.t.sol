// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {DN404Mirror} from "dn404/DN404Mirror.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";
import {AsterismRenderer} from "../src/AsterismRenderer.sol";
import {AsterismToken} from "../src/AsterismToken.sol";
import {AsterismConfig} from "../script/AsterismConfig.sol";
import {MockUniswapV2Factory, MockUniswapV2Pair} from "./mocks/MockUniswapV2.sol";
import {MockWETH} from "./mocks/MockWETH.sol";

abstract contract Base is Test {
    uint256 internal constant UNIT = 1e18;
    uint256 internal constant PRICE = 0.01 ether;
    uint256 internal constant WALLET_CAP = 10;
    uint256 internal constant TX_CAP = 5;
    bytes32 internal constant SECRET = keccak256("asterism-test-secret");

    AsterismRenderer internal renderer;
    AsterismLauncher internal launcher;
    AsterismToken internal token;
    DN404Mirror internal mirror;
    MockWETH internal weth;
    MockUniswapV2Factory internal factory;

    address internal deployer = makeAddr("deployer");
    address payable internal treasury = payable(makeAddr("treasury"));
    uint256 internal saleStart;
    uint256 internal saleEnd;
    uint256 internal constant FINALIZE_WINDOW = 2 days;
    uint256 internal constant REVEAL_WINDOW = 3 days;

    uint256 private _buyerNonce;

    function setUp() public virtual {
        vm.warp(1_800_000_000);
        weth = new MockWETH();
        factory = new MockUniswapV2Factory();
        renderer = AsterismConfig.deployRenderer();
        saleStart = block.timestamp + 1 days;
        saleEnd = saleStart + 3 days;
        vm.prank(deployer);
        launcher = new AsterismLauncher(params(), renderer);
        token = launcher.token();
        mirror = DN404Mirror(payable(token.mirrorERC721()));
    }

    function params() internal view returns (AsterismLauncher.Params memory p) {
        p = AsterismLauncher.Params({
            name: "Asterism",
            symbol: "ASTERISM",
            maxSupplyTokens: AsterismConfig.MAX_SUPPLY_TOKENS,
            saleBps: AsterismConfig.SALE_BPS,
            liquidityProceedsBps: AsterismConfig.LIQUIDITY_PROCEEDS_BPS,
            treasuryProceedsBps: AsterismConfig.TREASURY_PROCEEDS_BPS,
            mintPrice: PRICE,
            walletCap: WALLET_CAP,
            txCap: TX_CAP,
            saleStart: saleStart,
            saleEnd: saleEnd,
            finalizeWindow: FINALIZE_WINDOW,
            revealWindow: REVEAL_WINDOW,
            treasury: treasury,
            revealCommit: keccak256(abi.encodePacked(SECRET)),
            weth: address(weth),
            v2Factory: address(factory)
        });
    }

    function openSale() internal {
        vm.warp(saleStart);
    }

    function buy(address who, uint256 n) internal {
        vm.deal(who, who.balance + n * PRICE);
        vm.prank(who);
        launcher.buy{value: n * PRICE}(n);
    }

    function newBuyer() internal returns (address who) {
        who = makeAddr(string(abi.encodePacked("buyer", vm.toString(++_buyerNonce))));
    }

    /// Buys `n` tokens spread over fresh wallets, respecting tx and wallet caps.
    function buyMany(uint256 n) internal returns (address[] memory buyers) {
        buyers = new address[]((n + WALLET_CAP - 1) / WALLET_CAP);
        uint256 k;
        while (n > 0) {
            address who = newBuyer();
            buyers[k++] = who;
            uint256 room = WALLET_CAP;
            while (room > 0 && n > 0) {
                uint256 q = n < TX_CAP ? n : TX_CAP;
                if (q > room) q = room;
                buy(who, q);
                n -= q;
                room -= q;
            }
        }
    }

    function sellOut() internal returns (address[] memory) {
        openSale();
        return buyMany(launcher.saleCap());
    }

    function finalize() internal {
        launcher.finalizeLaunch();
    }

    function pairOf() internal view returns (MockUniswapV2Pair) {
        return MockUniswapV2Pair(launcher.pair());
    }

    function reserves() internal view returns (uint256 tokenReserve, uint256 wethReserve) {
        MockUniswapV2Pair p = pairOf();
        (uint112 r0, uint112 r1,) = p.getReserves();
        (tokenReserve, wethReserve) = p.token0() == address(token) ? (uint256(r0), uint256(r1)) : (uint256(r1), uint256(r0));
    }
}
