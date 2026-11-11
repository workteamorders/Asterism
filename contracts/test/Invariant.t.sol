// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test, console} from "forge-std/Test.sol";
import {StdInvariant} from "forge-std/StdInvariant.sol";
import {DN404Mirror} from "dn404/DN404Mirror.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";
import {AsterismToken} from "../src/AsterismToken.sol";
import {Base} from "./Base.t.sol";
import {MockUniswapV2Pair} from "./mocks/MockUniswapV2.sol";

contract Handler is Test {
    AsterismLauncher internal launcher;
    AsterismToken internal token;
    DN404Mirror internal mirror;
    address internal revealer;
    bytes32 internal secret;
    uint256 internal price;

    address[] public actors;
    uint256 public transfersBeforeFinalize;
    uint256 public transfersAfterFinalize;
    uint256 public refunds;
    uint256 public refundedAtFinalize;
    bool public sawFinalize;
    bytes32 public firstSeed;
    uint256 public lastSinkLp;
    bool public sinkLpDecreased;

    constructor(AsterismLauncher l, address revealer_, bytes32 secret_) {
        launcher = l;
        token = l.token();
        mirror = DN404Mirror(payable(token.mirrorERC721()));
        revealer = revealer_;
        secret = secret_;
        price = l.mintPrice();
        for (uint256 i; i < 6; ++i) actors.push(makeAddr(string(abi.encodePacked("actor", vm.toString(i)))));
    }

    function actorCount() external view returns (uint256) {
        return actors.length;
    }

    function _actor(uint256 s) internal view returns (address) {
        return actors[s % actors.length];
    }

    function buy(uint256 who, uint256 amount) external {
        address a = _actor(who);
        amount = bound(amount, 1, 5);
        vm.deal(a, a.balance + amount * price);
        vm.prank(a);
        try launcher.buy{value: amount * price}(amount) {} catch {}
    }

    function warp(uint256 dt) external {
        vm.warp(block.timestamp + bound(dt, 1 minutes, 2 days));
    }

    function finalize() external {
        try launcher.finalizeLaunch() {
            sawFinalize = true;
            refundedAtFinalize = launcher.refundedTotal();
        } catch {}
    }

    function refund(uint256 who) external {
        vm.prank(_actor(who));
        try launcher.refund() {
            refunds += 1;
        } catch {}
    }

    function withdrawTreasury() external {
        try launcher.withdrawTreasury() {} catch {}
    }

    function transfer(uint256 from, uint256 to, uint256 amount) external {
        address a = _actor(from);
        uint256 bal = token.balanceOf(a);
        if (bal == 0) return;
        amount = bound(amount, 1, bal);
        bool before = !launcher.finalized();
        vm.prank(a);
        try token.transfer(_actor(to), amount) {
            if (before) transfersBeforeFinalize += 1;
            else transfersAfterFinalize += 1;
        } catch {}
    }

    function transferNft(uint256 from, uint256 to) external {
        address a = _actor(from);
        uint256[] memory ids = token.ownedIds(a, 0, 1);
        if (ids.length == 0) return;
        bool before = !launcher.finalized();
        vm.prank(a);
        try mirror.transferFrom(a, _actor(to), ids[0]) {
            if (before) transfersBeforeFinalize += 1;
        } catch {}
    }

    function reveal(bool useFallback) external {
        if (useFallback) {
            try launcher.revealFallback() {} catch {}
        } else {
            vm.prank(revealer);
            try launcher.reveal(secret) {} catch {}
        }
        if (launcher.revealed() && firstSeed == bytes32(0)) firstSeed = launcher.seed();
    }

    function checkSink() external {
        address p = launcher.pair();
        if (p == address(0)) return;
        uint256 lp = MockUniswapV2Pair(p).balanceOf(address(launcher.sink()));
        if (lp < lastSinkLp) sinkLpDecreased = true;
        lastSinkLp = lp;
    }
}

abstract contract InvariantBase is StdInvariant, Base {
    Handler internal handler;
    address[] internal sellers;

    function _prepare() internal virtual;

    function setUp() public override {
        super.setUp();
        _prepare();
        handler = new Handler(launcher, deployer, SECRET);
        targetContract(address(handler));
    }

    function invariant_supplyNeverExceedsCap() public view {
        assertLe(token.totalSupply(), launcher.maxSupplyTokens() * UNIT);
        assertLe(launcher.sold(), launcher.saleCap());
    }

    function invariant_nftCountEqualsWholeBalancesOfNftHolders() public view {
        uint256 expected;
        for (uint256 i; i < handler.actorCount(); ++i) {
            address a = handler.actors(i);
            if (!token.getSkipNFT(a)) expected += token.balanceOf(a) / UNIT;
        }
        for (uint256 i; i < sellers.length; ++i) expected += token.balanceOf(sellers[i]) / UNIT;
        // Pool, sink and launcher are skipNFT; no one else holds tokens in this model.
        assertEq(mirror.totalSupply(), expected);
    }

    function invariant_ethAccounting() public view {
        if (!launcher.finalized()) {
            assertEq(address(launcher).balance, launcher.raised() - launcher.refundedTotal());
        } else {
            assertEq(launcher.ethLP() + launcher.treasuryAmount(), launcher.raised());
            assertEq(address(launcher).balance, launcher.treasuryAmount() - launcher.treasuryWithdrawn());
        }
    }

    function invariant_noRefundsAfterFinalize() public view {
        if (handler.sawFinalize()) assertEq(launcher.refundedTotal(), handler.refundedAtFinalize());
    }

    function invariant_transfersLockedBeforeFinalize() public view {
        assertEq(handler.transfersBeforeFinalize(), 0);
    }

    function invariant_seedNeverChangesOnceSet() public view {
        if (handler.firstSeed() != bytes32(0)) assertEq(launcher.seed(), handler.firstSeed());
    }

    function invariant_poolOpensAtMintPriceAndLpStaysLocked() public view {
        assertFalse(handler.sinkLpDecreased());
        address p = launcher.pair();
        if (p == address(0)) return;
        assertEq(MockUniswapV2Pair(p).balanceOf(address(launcher)), 0);
        // No swaps happen in this model, so reserves still show the opening price.
        (uint256 rt, uint256 rw) = reserves();
        assertEq(rw, launcher.tokenLP() * PRICE);
        assertEq(rt, launcher.tokenLP() * UNIT);
    }
}

/// Sale, finalisation window and refund window, starting at the sale opening.
contract InvariantSaleTest is InvariantBase {
    function _prepare() internal override {
        vm.warp(saleStart);
    }
}

/// Trading phase: sold out and finalised before the handler starts. Exercises transfers, NFT moves,
/// treasury withdrawal, reveal and fallback, and refund attempts that must all fail.
contract InvariantTradingTest is InvariantBase {
    function _prepare() internal override {
        sellers = sellOut();
        finalize();
        // Give the handler's actors (same deterministic addresses) fractional balances to trade with.
        for (uint256 i; i < 6; ++i) {
            address actor = makeAddr(string(abi.encodePacked("actor", vm.toString(i))));
            vm.prank(sellers[i]);
            token.transfer(actor, 7 * UNIT + UNIT / 2);
        }
    }

    function invariant_tradingPhaseStaysFinalized() public view {
        assertTrue(launcher.finalized());
        assertTrue(token.tradingOpen());
        assertEq(launcher.refundedTotal(), 0);
    }
}
