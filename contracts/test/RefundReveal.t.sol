// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";

contract RefundTest is Base {
    function test_refundReturnsExactlyWhatWasPaidAndBurnsTokens() public {
        openSale();
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        launcher.buy{value: 0.5 ether}(3); // pays 3 * PRICE, excess returned
        uint256 before = b.balance;
        vm.warp(saleEnd + FINALIZE_WINDOW + 1);
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.Refunding));
        vm.prank(b);
        launcher.refund();
        assertEq(b.balance, before + 3 * PRICE);
        assertEq(token.balanceOf(b), 0);
        assertEq(mirror.balanceOf(b), 0);
        assertEq(launcher.refundedTotal(), 3 * PRICE);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.NothingToRefund.selector);
        launcher.refund();
    }

    function test_refundClosedBeforeDeadline() public {
        openSale();
        address b = newBuyer();
        buy(b, 2);
        vm.warp(saleEnd + FINALIZE_WINDOW);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.RefundNotOpen.selector);
        launcher.refund();
    }

    function test_refundAlwaysRevertsAfterFinalize() public {
        address[] memory buyers = sellOut();
        finalize();
        vm.warp(saleEnd + FINALIZE_WINDOW + 365 days);
        vm.prank(buyers[0]);
        vm.expectRevert(AsterismLauncher.RefundNotOpen.selector);
        launcher.refund();
    }

    function test_everyoneCanBeRefundedAndLauncherEndsEmpty() public {
        openSale();
        address[] memory buyers = buyMany(97);
        vm.warp(saleEnd + FINALIZE_WINDOW + 1);
        for (uint256 i; i < buyers.length; ++i) {
            vm.prank(buyers[i]);
            launcher.refund();
        }
        assertEq(address(launcher).balance, 0);
        assertEq(launcher.refundedTotal(), 97 * PRICE);
        assertEq(token.totalSupply(), 0);
        assertEq(mirror.totalSupply(), 0);
    }

    function testFuzz_refundNeverExceedsBalance(uint8 a, uint8 c, uint8 d) public {
        openSale();
        address b1 = newBuyer();
        address b2 = newBuyer();
        buy(b1, bound(a, 1, 5));
        buy(b2, bound(c, 1, 5));
        buy(b1, bound(d, 1, 5));
        vm.warp(saleEnd + FINALIZE_WINDOW + 1);
        uint256 total = launcher.raised();
        vm.prank(b1);
        launcher.refund();
        assertEq(address(launcher).balance, total - launcher.refundedTotal());
        vm.prank(b2);
        launcher.refund();
        assertEq(address(launcher).balance, 0);
    }
}

contract RevealTest is Base {
    function _finalized() internal {
        sellOut();
        finalize();
    }

    function test_onlyRevealerWithMatchingSecretAfterFinalize() public {
        vm.prank(deployer);
        vm.expectRevert(AsterismLauncher.NotRevealable.selector);
        launcher.reveal(SECRET);
        _finalized();
        vm.expectRevert(AsterismLauncher.NotRevealer.selector);
        launcher.reveal(SECRET);
        vm.prank(deployer);
        vm.expectRevert(AsterismLauncher.BadSecret.selector);
        launcher.reveal(bytes32(uint256(SECRET) ^ 1));
        bytes32 e = launcher.entropy();
        vm.prank(deployer);
        launcher.reveal(SECRET);
        assertTrue(launcher.revealed());
        assertEq(launcher.seed(), keccak256(abi.encodePacked(SECRET, e)));
    }

    function test_revealOnlyOnceAndSeedNeverChanges() public {
        _finalized();
        vm.prank(deployer);
        launcher.reveal(SECRET);
        bytes32 s = launcher.seed();
        vm.prank(deployer);
        vm.expectRevert(AsterismLauncher.NotRevealable.selector);
        launcher.reveal(SECRET);
        vm.warp(block.timestamp + REVEAL_WINDOW + 1);
        vm.expectRevert(AsterismLauncher.NotRevealable.selector);
        launcher.revealFallback();
        assertEq(launcher.seed(), s);
    }

    function test_fallbackOnlyAfterDeadlineAndRevealerLocksOut() public {
        _finalized();
        vm.expectRevert(AsterismLauncher.NotRevealable.selector);
        launcher.revealFallback();
        vm.warp(launcher.revealDeadline() + 1);
        vm.prank(deployer);
        vm.expectRevert(AsterismLauncher.NotRevealable.selector);
        launcher.reveal(SECRET);
        address anyone = newBuyer();
        vm.prank(anyone);
        launcher.revealFallback();
        assertEq(launcher.seed(), keccak256(abi.encodePacked(launcher.entropy(), launcher.revealCommit())));
    }

    function test_tokenUriSwitchesFromUnrevealedToRevealed() public {
        _finalized();
        string memory before = mirror.tokenURI(1);
        assertEq(before, renderer.unrevealedURI(1));
        vm.prank(deployer);
        launcher.reveal(SECRET);
        string memory afterReveal = mirror.tokenURI(1);
        assertEq(afterReveal, renderer.tokenURI(1, launcher.seed(), ""));
        assertTrue(keccak256(bytes(before)) != keccak256(bytes(afterReveal)));
    }

    function test_noChainRandomnessUsed() public {
        // The seed depends only on the secret and the purchase entropy, not on prevrandao or block data.
        _finalized();
        bytes32 e = launcher.entropy();
        vm.prevrandao(bytes32(uint256(12345)));
        vm.roll(block.number + 1000);
        vm.prank(deployer);
        launcher.reveal(SECRET);
        assertEq(launcher.seed(), keccak256(abi.encodePacked(SECRET, e)));
    }
}
