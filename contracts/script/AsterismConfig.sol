// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AsterismRenderer} from "../src/AsterismRenderer.sol";

/// Published launch distribution. Changing these changes the art; the golden fixtures are generated from them.
library AsterismConfig {
    uint256 internal constant MAX_SUPPLY_TOKENS = 2222;
    uint256 internal constant SALE_BPS = 6000;
    uint256 internal constant LIQUIDITY_PROCEEDS_BPS = 6667;
    uint256 internal constant TREASURY_PROCEEDS_BPS = 3333;
    uint256 internal constant NAME_MAX_BYTES = 48;

    function tierCounts() internal pure returns (uint256[5] memory c) {
        c = [uint256(1200), 600, 300, 100, 22];
    }

    function minStars() internal pure returns (uint256[5] memory m) {
        m = [uint256(5), 7, 9, 11, 14];
    }

    function maxStars() internal pure returns (uint256[5] memory m) {
        m = [uint256(6), 8, 10, 13, 16];
    }

    function deployRenderer() internal returns (AsterismRenderer) {
        return new AsterismRenderer(MAX_SUPPLY_TOKENS, tierCounts(), minStars(), maxStars());
    }
}
