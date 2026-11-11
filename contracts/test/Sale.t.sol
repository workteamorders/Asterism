// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";

contract SaleTest is Base {
    function test_statusBeforeStartIsNotStarted() public view {
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.NotStarted));
    }

    function test_buyRevertsBeforeStartAndAfterEnd() public {
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.SaleNotOpen.selector);
        launcher.buy{value: PRICE}(1);
        vm.warp(saleEnd + 1);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.SaleNotOpen.selector);
        launcher.buy{value: PRICE}(1);
    }

    function test_buyMintsWholeTokensAndNfts() public {
        openSale();
        address b = newBuyer();
        buy(b, 3);
        assertEq(token.balanceOf(b), 3 * UNIT);
        assertEq(mirror.balanceOf(b), 3);
        assertEq(launcher.sold(), 3);
        assertEq(launcher.raised(), 3 * PRICE);
        assertEq(launcher.purchased(b), 3);
        assertEq(launcher.paid(b), 3 * PRICE);
        assertEq(address(launcher).balance, 3 * PRICE);
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.Sale));
    }

    function test_buyReturnsExcessEth() public {
        openSale();
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        launcher.buy{value: 1 ether}(2);
        assertEq(b.balance, 1 ether - 2 * PRICE);
        assertEq(address(launcher).balance, 2 * PRICE);
    }

    function test_buyRejectsUnderpaymentZeroAndCaps() public {
        openSale();
        address b = newBuyer();
        vm.deal(b, 10 ether);
        vm.startPrank(b);
        vm.expectRevert(AsterismLauncher.InsufficientPayment.selector);
        launcher.buy{value: PRICE - 1}(1);
        vm.expectRevert(AsterismLauncher.InvalidAmount.selector);
        launcher.buy{value: PRICE}(0);
        vm.expectRevert(AsterismLauncher.TxCapExceeded.selector);
        launcher.buy{value: 6 * PRICE}(6);
        launcher.buy{value: 5 * PRICE}(5);
        launcher.buy{value: 5 * PRICE}(5);
        vm.expectRevert(AsterismLauncher.WalletCapExceeded.selector);
        launcher.buy{value: PRICE}(1);
        vm.stopPrank();
    }

    function test_saleCapIsFloorOfSaleShare() public view {
        assertEq(launcher.saleCap(), 1333); // floor(2222 * 0.6)
    }

    function test_cannotBuyPastSaleCap() public {
        openSale();
        buyMany(1330);
        address b = newBuyer();
        vm.deal(b, 1 ether);
        vm.prank(b);
        vm.expectRevert(AsterismLauncher.SoldOut.selector);
        launcher.buy{value: 4 * PRICE}(4);
        buy(b, 3);
        assertEq(launcher.sold(), launcher.saleCap());
        assertEq(uint256(launcher.status()), uint256(AsterismLauncher.Status.AwaitingFinalization));
    }

    function test_entropyChangesWithEveryPurchase() public {
        openSale();
        bytes32 e0 = launcher.entropy();
        address b = newBuyer();
        buy(b, 1);
        bytes32 e1 = launcher.entropy();
        assertEq(e1, keccak256(abi.encodePacked(e0, b, uint256(1), uint256(0))));
        buy(b, 2);
        assertEq(launcher.entropy(), keccak256(abi.encodePacked(e1, b, uint256(2), uint256(1))));
        assertEq(launcher.purchaseCount(), 2);
    }

    function test_remainingForRespectsAllCaps() public {
        openSale();
        address b = newBuyer();
        assertEq(launcher.remainingFor(b), TX_CAP);
        buy(b, 5);
        buy(b, 3);
        assertEq(launcher.remainingFor(b), 2);
    }

    /// A smart-contract buyer (or an EIP-7702 account) still receives its NFTs.
    function test_contractBuyerReceivesNfts() public {
        openSale();
        ContractBuyer c = new ContractBuyer(launcher);
        vm.deal(address(c), 1 ether);
        c.buy(2, 2 * PRICE);
        assertEq(mirror.balanceOf(address(c)), 2);
        assertFalse(token.getSkipNFT(address(c)));
    }

    function test_explicitSkipNftChoiceIsRespected() public {
        openSale();
        address b = newBuyer();
        vm.prank(b);
        token.setSkipNFT(true);
        buy(b, 2);
        assertEq(token.balanceOf(b), 2 * UNIT);
        assertEq(mirror.balanceOf(b), 0);
    }

    function testFuzz_buyAccounting(uint8 a, uint8 c) public {
        openSale();
        uint256 x = bound(a, 1, TX_CAP);
        uint256 y = bound(c, 1, TX_CAP);
        address b1 = newBuyer();
        address b2 = newBuyer();
        buy(b1, x);
        buy(b2, y);
        assertEq(launcher.sold(), x + y);
        assertEq(launcher.raised(), (x + y) * PRICE);
        assertEq(address(launcher).balance, (x + y) * PRICE);
        assertEq(token.totalSupply(), (x + y) * UNIT);
        assertEq(mirror.totalSupply(), x + y);
    }
}

contract ContractBuyer {
    AsterismLauncher internal immutable launcher;

    constructor(AsterismLauncher l) {
        launcher = l;
    }

    function buy(uint256 n, uint256 value) external {
        launcher.buy{value: value}(n);
    }

    receive() external payable {}
}
