// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AsterismToken} from "../src/AsterismToken.sol";
import {DN404} from "dn404/DN404.sol";

contract TokenLockTest is Base {
    function test_transfersLockedBeforeFinalize() public {
        openSale();
        address a = newBuyer();
        address b = newBuyer();
        buy(a, 2);
        vm.startPrank(a);
        vm.expectRevert(AsterismToken.TradingClosed.selector);
        token.transfer(b, 1e17);
        vm.expectRevert(AsterismToken.TradingClosed.selector);
        token.transfer(address(launcher), UNIT);
        token.approve(b, type(uint256).max);
        uint256 id = token.ownedIds(a, 0, 1)[0];
        vm.expectRevert(AsterismToken.TradingClosed.selector);
        mirror.transferFrom(a, b, id);
        vm.stopPrank();
        vm.prank(b);
        vm.expectRevert(AsterismToken.TradingClosed.selector);
        token.transferFrom(a, b, UNIT);
    }

    function test_onlyLauncherCanMintBurnMarkAndOpen() public {
        vm.startPrank(makeAddr("stranger"));
        vm.expectRevert(AsterismToken.NotLauncher.selector);
        token.mintSale(address(this), UNIT);
        vm.expectRevert(AsterismToken.NotLauncher.selector);
        token.mintToPool(address(this), UNIT);
        vm.expectRevert(AsterismToken.NotLauncher.selector);
        token.burnForRefund(address(this), UNIT);
        vm.expectRevert(AsterismToken.NotLauncher.selector);
        token.markSkipNFT(address(this));
        vm.expectRevert(AsterismToken.NotLauncher.selector);
        token.openTrading();
        vm.stopPrank();
    }

    function test_supplyCapEnforcedAtTokenLevel() public {
        vm.prank(address(launcher));
        vm.expectRevert(AsterismToken.SupplyCapExceeded.selector);
        token.mintSale(address(this), 2223 * UNIT);
    }

    function test_noPermit2DefaultAllowance() public view {
        assertEq(token.allowance(address(this), 0x000000000022D473030F116dDEE9F6B43aC78BA3), 0);
    }

    function test_mirrorHasNoOwner() public view {
        assertEq(mirror.owner(), address(0));
    }
}

contract TokenTradingTest is Base {
    address[] internal buyers;

    function setUp() public override {
        super.setUp();
        buyers = sellOut();
        finalize();
        vm.prank(deployer);
        launcher.reveal(SECRET);
    }

    function test_fractionalTransferBurnsAndMints() public {
        address a = buyers[0]; // holds 10 tokens and 10 NFTs
        address b = makeAddr("receiver");
        assertEq(mirror.balanceOf(a), 10);
        vm.prank(a);
        token.transfer(b, UNIT / 2);
        assertEq(mirror.balanceOf(a), 9); // 9.5 tokens -> 9 NFTs
        assertEq(mirror.balanceOf(b), 0); // 0.5 tokens -> 0 NFTs
        vm.prank(a);
        token.transfer(b, UNIT / 2);
        assertEq(mirror.balanceOf(a), 9);
        assertEq(mirror.balanceOf(b), 1);
        assertEq(token.balanceOf(b), UNIT);
    }

    function test_wholeNftTransferMovesExactlyOneToken() public {
        address a = buyers[0];
        address b = makeAddr("receiver");
        uint256 id = token.ownedIds(a, 0, 1)[0];
        uint256 before = token.balanceOf(a);
        vm.prank(a);
        mirror.transferFrom(a, b, id);
        assertEq(token.balanceOf(a), before - UNIT);
        assertEq(token.balanceOf(b), UNIT);
        assertEq(mirror.ownerOf(id), b);
    }

    function test_nftCountMatchesWholeBalancesAfterManyTransfers() public {
        address a = buyers[0];
        address b = buyers[1];
        address c = makeAddr("c");
        uint256[6] memory amounts = [uint256(3e17), 17e17, 1e18, 25e16, 2e18, 75e16];
        for (uint256 i; i < amounts.length; ++i) {
            vm.prank(i % 2 == 0 ? a : b);
            token.transfer(c, amounts[i]);
            vm.prank(c);
            token.transfer(i % 2 == 0 ? b : a, amounts[i] / 3);
        }
        _assertNftConsistency(a);
        _assertNftConsistency(b);
        _assertNftConsistency(c);
    }

    function _assertNftConsistency(address who) internal view {
        assertEq(mirror.balanceOf(who), token.balanceOf(who) / UNIT);
        uint256[] memory ids = token.ownedIds(who, 0, type(uint256).max);
        assertEq(ids.length, mirror.balanceOf(who));
        for (uint256 i; i < ids.length; ++i) {
            assertEq(mirror.ownerOf(ids[i]), who);
            for (uint256 j = i + 1; j < ids.length; ++j) assertTrue(ids[i] != ids[j]);
        }
    }

    /// Guardian H-01/H-02: ids must never be handed out while owned. Burn and re-mint repeatedly, then check every id.
    function test_guardianMintNeverReassignsOwnedIds() public {
        address a = buyers[0];
        address b = buyers[1];
        for (uint256 i; i < 20; ++i) {
            vm.prank(a);
            token.transfer(b, UNIT / 2 + i);
            vm.prank(b);
            token.transfer(a, UNIT / 2);
        }
        uint256 total = mirror.totalSupply();
        uint256 counted;
        for (uint256 id = 1; id <= 2221; ++id) {
            address o = token.ownerAt(id);
            if (o != address(0)) {
                ++counted;
                assertGt(token.balanceOf(o) / UNIT, 0);
            }
        }
        assertEq(counted, total);
    }

    /// Guardian M-01 (documented, not fixed upstream): an ERC-20 send moves the most recently received NFT.
    function test_guardianLifoSendMovesNewestNft() public {
        address a = buyers[0];
        address b = buyers[1];
        uint256 incoming = token.ownedIds(b, 0, 1)[0];
        vm.prank(b);
        mirror.transferFrom(b, a, incoming);
        vm.prank(a);
        token.transfer(makeAddr("dex"), UNIT);
        assertTrue(mirror.ownerOf(incoming) != a, "the NFT just received is the one that left");
    }

    /// Guardian M-03: dust sent to a future contract address must not make that contract receive NFTs later.
    function test_guardianAddressStainingFixed() public {
        bytes32 salt = keccak256("pool");
        address future = vm.computeCreate2Address(salt, keccak256(type(Holder).creationCode), address(this));
        vm.prank(buyers[0]);
        token.transfer(future, 1);
        Holder h = new Holder{salt: salt}();
        assertEq(address(h), future);
        vm.prank(buyers[0]);
        token.transfer(future, 2 * UNIT);
        assertEq(mirror.balanceOf(future), 0);
        assertTrue(token.getSkipNFT(future));
    }

    function test_poolSwapBuyerGetsWholeNft() public {
        // Buy just over one whole token from the pool; the buyer receives one NFT, the pool none.
        address trader = makeAddr("trader");
        (uint256 rt, uint256 rw) = reserves();
        uint256 out = UNIT + 1;
        uint256 inWeth = (rw * out * 1000) / ((rt - out) * 997) + 1;
        vm.deal(trader, inWeth);
        vm.startPrank(trader);
        weth.deposit{value: inWeth}();
        weth.transfer(address(pairOf()), inWeth);
        bool tokenIs0 = pairOf().token0() == address(token);
        pairOf().swap(tokenIs0 ? out : 0, tokenIs0 ? 0 : out, trader);
        vm.stopPrank();
        assertEq(mirror.balanceOf(trader), 1);
        assertEq(mirror.balanceOf(address(pairOf())), 0);
    }

    function test_setNameOwnerOnlyAndShownWhileHeld() public {
        address a = buyers[0];
        uint256 id = token.ownedIds(a, 0, 1)[0];
        vm.prank(buyers[1]);
        vm.expectRevert(AsterismToken.NotNftOwner.selector);
        token.setName(id, "Not mine");
        vm.prank(a);
        token.setName(id, "Quiet field");
        assertEq(token.nameOf(id), "Quiet field");
        assertEq(token.namedBy(id), a);
        string memory svgNamed = renderer.svg(id, launcher.seed(), token.nameOf(id));
        assertTrue(_contains(svgNamed, "Quiet field"));
        address b = makeAddr("newHolder");
        vm.prank(a);
        mirror.transferFrom(a, b, id);
        assertEq(token.nameOf(id), "");
        assertFalse(_contains(mirror.tokenURI(id), "UXVpZXQgZmllbGQ")); // base64 of the name never appears
    }

    function test_setNameRejectsUnsafeCharactersAndLength() public {
        address a = buyers[0];
        uint256 id = token.ownedIds(a, 0, 1)[0];
        string[7] memory bad = [
            "<script>",
            "a\"b",
            "x&y",
            "line\nbreak",
            "semi;colon",
            "slash/",
            "this name is definitely longer than forty-eight bytes"
        ];
        for (uint256 i; i < bad.length; ++i) {
            vm.prank(a);
            vm.expectRevert(AsterismToken.InvalidName.selector);
            token.setName(id, bad[i]);
        }
        vm.prank(a);
        token.setName(id, "Ok, fine! Who's there? A-1.");
        vm.prank(a);
        token.setName(id, "");
        assertEq(token.namedBy(id), address(0));
    }

    function test_tokenUriOfMissingIdReverts() public {
        vm.expectRevert();
        mirror.tokenURI(2222);
    }

    function _contains(string memory hay, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(hay);
        bytes memory n = bytes(needle);
        if (n.length > h.length) return false;
        for (uint256 i; i + n.length <= h.length; ++i) {
            bool m = true;
            for (uint256 j; j < n.length && m; ++j) m = h[i + j] == n[j];
            if (m) return true;
        }
        return false;
    }
}

contract Holder {}
