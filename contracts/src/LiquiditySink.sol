// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title LiquiditySink
/// @notice Holds the Uniswap V2 liquidity tokens forever. It has no functions, no fallback, and no receive:
///         nothing can ever move tokens out of it, and plain ETH sent to it is rejected.
contract LiquiditySink {}
