// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";
import {AsterismToken} from "../src/AsterismToken.sol";
import {MockUniswapV2Pair} from "./mocks/MockUniswapV2.sol";

contract FinalizeTest is Base {
    function test_finalizeAfterSellOutOpensPoolAtExactlyMintPrice() public {
        sellOut();
        finalize();
        (uint256 rt, uint256 rw) = reserves();
        assertEq(launcher.tokenLP(), 888);
        assertEq(rt, 888 * UNIT);
        assertEq(rw, 888 * PRICE);
        // price per whole token in the pool equals mintPrice exactly
        assertEq((rw * UNIT) / rt, PRICE);
        assertEq(launcher.ethLP() + launcher.treasuryAmount(), launcher.raised());
        assertEq(token.totalSupply(), (1333 + 888) * UNIT);
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.Trading));
        assertTrue(token.tradingOpen());
    }

    function test_lpTokensAreLockedInSinkForever() public {
        sellOut();
        finalize();
        MockUniswapV2Pair p = pairOf();
        uint256 lp = p.balanceOf(address(launcher.sink()));
        assertGt(lp, 0);
        assertEq(p.totalSupply(), lp + p.MINIMUM_LIQUIDITY());
        assertEq(address(launcher.sink()).code.length > 0, true);
        // The sink has no functions: any call, including an LP transfer attempt, reverts.
        (bool ok,) = address(launcher.sink()).call(abi.encodeWithSignature("transfer(address,uint256)", address(this), lp));
        assertFalse(ok);
        (ok,) = address(launcher.sink()).call{value: 1}("");
        assertFalse(ok);
        // The launcher holds no LP and has no function that could move LP.
        assertEq(p.balanceOf(address(launcher)), 0);
    }

    function test_poolAndSinkHoldNoNfts() public {
        sellOut();
        finalize();
        address p = launcher.pair();
        assertTrue(token.getSkipNFT(p));
        assertEq(mirror.balanceOf(p), 0);
        assertTrue(token.getSkipNFT(address(launcher)));
        assertTrue(token.getSkipNFT(address(launcher.sink())));
        assertEq(mirror.totalSupply(), 1333);
    }

    function test_finalizeBeforeSellOutAndBeforeEndReverts() public {
        openSale();
        buyMany(100);
        vm.expectRevert(AsterismLauncher.NotFinalizable.selector);
        finalize();
    }

    function test_finalizeAfterEndWithPartialSale() public {
        openSale();
        buyMany(500);
        vm.warp(saleEnd + 1);
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.AwaitingFinalization));
        finalize();
        // 500 * 0.6667 = 333.35 -> 333 tokens, 333 * price wei
        assertEq(launcher.tokenLP(), 333);
        (uint256 rt, uint256 rw) = reserves();
        assertEq(rt, 333 * UNIT);
        assertEq(rw, 333 * PRICE);
        assertEq(launcher.treasuryAmount(), 500 * PRICE - 333 * PRICE);
        assertEq(token.totalSupply(), 833 * UNIT);
    }

    function test_finalizeNeedsAtLeastOneLiquidityToken() public {
        openSale();
        buy(newBuyer(), 1); // 0.6667 of one token -> 0 whole tokens of liquidity
        vm.warp(saleEnd + 1);
        vm.expectRevert(AsterismLauncher.NotFinalizable.selector);
        finalize();
    }

    function test_finalizeWithNoSalesReverts() public {
        vm.warp(saleEnd + 1);
        vm.expectRevert(AsterismLauncher.NotFinalizable.selector);
        finalize();
    }

    function test_finalizeClosesAfterWindow() public {
        openSale();
        buyMany(50);
        vm.warp(saleEnd + FINALIZE_WINDOW + 1);
        vm.expectRevert(AsterismLauncher.NotFinalizable.selector);
        finalize();
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.Refunding));
    }

    function test_finalizeOnlyOnce() public {
        sellOut();
        finalize();
        vm.expectRevert(AsterismLauncher.AlreadyFinalized.selector);
        finalize();
    }

    function test_buyRevertsAfterFinalize() public {
        sellOut();
        finalize();
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.SaleNotOpen.selector);
        launcher.buy{value: PRICE}(1);
    }

    function test_treasuryWithdrawIsPullOnlyToTreasury() public {
        sellOut();
        vm.expectRevert(AsterismLauncher.NotFinalizable.selector);
        launcher.withdrawTreasury();
        finalize();
        uint256 expected = launcher.raised() - launcher.ethLP();
        address anyone = newBuyer();
        vm.prank(anyone);
        launcher.withdrawTreasury();
        assertEq(treasury.balance, expected);
        assertEq(address(launcher).balance, 0);
        vm.expectRevert(AsterismLauncher.NothingToWithdraw.selector);
        launcher.withdrawTreasury();
    }

    function test_unsyncedWethDonationIsSkimmedToTreasury() public {
        openSale();
        buyMany(600);
        vm.warp(saleEnd + 1);
        address p = factory.createPair(address(token), address(weth));
        address attacker = newBuyer();
        vm.deal(attacker, 5 ether);
        vm.startPrank(attacker);
        weth.deposit{value: 5 ether}();
        weth.transfer(p, 5 ether);
        vm.stopPrank();
        finalize();
        assertEq(launcher.pair(), p);
        assertEq(weth.balanceOf(treasury), 5 ether);
        (uint256 rt, uint256 rw) = reserves();
        assertEq((rw * UNIT) / rt, PRICE);
    }

    function test_syncedWethDonationKeepsPriceWithExtraTokens() public {
        openSale();
        buyMany(600);
        vm.warp(saleEnd + 1);
        address p = factory.createPair(address(token), address(weth));
        address attacker = newBuyer();
        uint256 donation = 1 ether + 3; // not a whole multiple of the price
        vm.deal(attacker, donation);
        vm.startPrank(attacker);
        weth.deposit{value: donation}();
        weth.transfer(p, donation);
        MockUniswapV2Pair(p).sync();
        vm.stopPrank();
        finalize();
        (uint256 rt, uint256 rw) = reserves();
        // Pool opens at mintPrice, rounded in favour of a price at most 1 wei-per-token above it.
        uint256 poolPrice = (rw * UNIT) / rt;
        assertGe(poolPrice, PRICE);
        assertLe(poolPrice, PRICE + 1);
        assertLe(token.totalSupply(), launcher.maxSupplyTokens() * UNIT);
    }

    function test_hugeSyncedDonationCannotExceedSupplyCapOrBlockFinalize() public {
        sellOut();
        address p = factory.createPair(address(token), address(weth));
        address attacker = newBuyer();
        vm.deal(attacker, 1000 ether);
        vm.startPrank(attacker);
        weth.deposit{value: 1000 ether}();
        weth.transfer(p, 1000 ether);
        MockUniswapV2Pair(p).sync();
        vm.stopPrank();
        finalize();
        assertTrue(launcher.finalized());
        assertEq(token.totalSupply(), launcher.maxSupplyTokens() * UNIT);
    }

    function test_rejectingTreasuryDoesNotBlockFinalize() public {
        RejectingTreasury bad = new RejectingTreasury();
        AsterismLauncher.Params memory pr = params();
        pr.treasury = payable(address(bad));
        vm.prank(deployer);
        AsterismLauncher l2 = new AsterismLauncher(pr, renderer);
        vm.warp(saleStart);
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        l2.buy{value: 5 * PRICE}(5);
        vm.warp(saleEnd + 1);
        l2.finalizeLaunch();
        assertTrue(l2.finalized());
        vm.expectRevert(AsterismLauncher.TransferFailed.selector);
        l2.withdrawTreasury();
    }

    function testFuzz_priceParityForAnySaleSize(uint16 n) public {
        uint256 soldN = bound(n, 2, 1333);
        openSale();
        buyMany(soldN);
        if (soldN < 1333) vm.warp(saleEnd + 1);
        finalize();
        (uint256 rt, uint256 rw) = reserves();
        assertEq(rw, launcher.tokenLP() * PRICE);
        assertEq(rt, launcher.tokenLP() * UNIT);
        assertEq(launcher.ethLP() + launcher.treasuryAmount(), launcher.raised());
        // The treasury share deviates from 33.33% only by the rounding of one token.
        assertLe(launcher.treasuryAmount(), (launcher.raised() * 3333) / 10_000 + PRICE + 1);
        assertLe(token.totalSupply(), 2222 * UNIT);
    }
}

contract RejectingTreasury {
    receive() external payable {
        revert("no");
    }
}
