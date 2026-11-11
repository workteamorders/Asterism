// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base} from "./Base.t.sol";
import {AsterismLauncher} from "../src/AsterismLauncher.sol";

contract ParamsTest is Base {
    uint256 internal checked;

    /// try/catch instead of vm.expectRevert: with contract creation, expectRevert ended the test early
    /// (observed with forge 1.8.7), which would hide every later case.
    function _expectInvalid(AsterismLauncher.Params memory p) internal {
        try new AsterismLauncher(p, renderer) returns (AsterismLauncher) {
            revert("deployment should have failed");
        } catch (bytes memory err) {
            assertEq(bytes4(err), AsterismLauncher.InvalidParams.selector);
        }
        ++checked;
    }

    function test_rejectsBrokenPriceParity() public {
        AsterismLauncher.Params memory p = params();
        p.liquidityProceedsBps = 6000;
        p.treasuryProceedsBps = 4000;
        _expectInvalid(p);
    }

    function test_rejectsBpsThatDoNotSumTo10000() public {
        AsterismLauncher.Params memory p = params();
        p.treasuryProceedsBps = 3000;
        _expectInvalid(p);
    }

    function test_rejectsSupplyThatDiffersFromRenderer() public {
        AsterismLauncher.Params memory p = params();
        p.maxSupplyTokens = 2000;
        _expectInvalid(p);
    }

    function test_rejectsShortWindowsAndBadOrder() public {
        AsterismLauncher.Params memory p = params();
        p.saleEnd = p.saleStart + 59 minutes;
        _expectInvalid(p);
        p = params();
        p.finalizeWindow = 10 minutes;
        _expectInvalid(p);
        p = params();
        p.revealWindow = 0;
        _expectInvalid(p);
        assertEq(checked, 3);
    }

    function test_rejectsZeroAddressesAndMissingCode() public {
        AsterismLauncher.Params memory p = params();
        p.treasury = payable(address(0));
        _expectInvalid(p);
        p = params();
        p.revealCommit = bytes32(0);
        _expectInvalid(p);
        p = params();
        p.weth = makeAddr("eoa");
        _expectInvalid(p);
        p = params();
        p.v2Factory = makeAddr("eoa2");
        _expectInvalid(p);
        assertEq(checked, 4);
    }

    function test_rejectsZeroPriceAndCaps() public {
        AsterismLauncher.Params memory p = params();
        p.mintPrice = 0;
        _expectInvalid(p);
        p = params();
        p.txCap = 0;
        _expectInvalid(p);
        p = params();
        p.walletCap = 0;
        _expectInvalid(p);
        p = params();
        p.txCap = 2000;
        _expectInvalid(p);
        assertEq(checked, 4);
    }

    function test_validParamsDeploy() public {
        AsterismLauncher l = new AsterismLauncher(params(), renderer);
        assertGt(address(l.token()).code.length, 0);
    }

    function test_deployerIsTheOnlyRevealerAndNothingElseIsPrivileged() public view {
        assertEq(launcher.revealer(), deployer);
        assertEq(launcher.treasury(), treasury);
        assertEq(token.launcher(), address(launcher));
    }
}
