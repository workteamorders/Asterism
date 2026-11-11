// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// Minimal Uniswap V2 replica for local tests only. Mirrors UniswapV2Pair math for mint, skim, sync, swap,
/// including MINIMUM_LIQUIDITY and the 0.3% fee check. Not deployed anywhere.

interface IERC20Like {
    function balanceOf(address) external view returns (uint256);
    function transfer(address, uint256) external returns (bool);
}

contract MockUniswapV2Pair {
    uint256 public constant MINIMUM_LIQUIDITY = 1000;
    address public factory;
    address public token0;
    address public token1;
    uint112 private reserve0;
    uint112 private reserve1;
    uint32 private blockTimestampLast;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;

    event Transfer(address indexed from, address indexed to, uint256 value);

    constructor() {
        factory = msg.sender;
    }

    function initialize(address t0, address t1) external {
        require(msg.sender == factory, "FORBIDDEN");
        token0 = t0;
        token1 = t1;
    }

    function getReserves() public view returns (uint112, uint112, uint32) {
        return (reserve0, reserve1, blockTimestampLast);
    }

    function transfer(address to, uint256 value) external returns (bool) {
        balanceOf[msg.sender] -= value;
        balanceOf[to] += value;
        emit Transfer(msg.sender, to, value);
        return true;
    }

    function _update(uint256 b0, uint256 b1) private {
        require(b0 <= type(uint112).max && b1 <= type(uint112).max, "OVERFLOW");
        reserve0 = uint112(b0);
        reserve1 = uint112(b1);
        blockTimestampLast = uint32(block.timestamp);
    }

    function _mintLp(address to, uint256 value) private {
        totalSupply += value;
        balanceOf[to] += value;
        emit Transfer(address(0), to, value);
    }

    function mint(address to) external returns (uint256 liquidity) {
        (uint112 r0, uint112 r1,) = getReserves();
        uint256 b0 = IERC20Like(token0).balanceOf(address(this));
        uint256 b1 = IERC20Like(token1).balanceOf(address(this));
        uint256 a0 = b0 - r0;
        uint256 a1 = b1 - r1;
        if (totalSupply == 0) {
            liquidity = _sqrt(a0 * a1) - MINIMUM_LIQUIDITY;
            _mintLp(address(0), MINIMUM_LIQUIDITY);
        } else {
            uint256 l0 = (a0 * totalSupply) / r0;
            uint256 l1 = (a1 * totalSupply) / r1;
            liquidity = l0 < l1 ? l0 : l1;
        }
        require(liquidity > 0, "INSUFFICIENT_LIQUIDITY_MINTED");
        _mintLp(to, liquidity);
        _update(b0, b1);
    }

    function swap(uint256 out0, uint256 out1, address to) external {
        require(out0 > 0 || out1 > 0, "INSUFFICIENT_OUTPUT_AMOUNT");
        (uint112 r0, uint112 r1,) = getReserves();
        require(out0 < r0 && out1 < r1, "INSUFFICIENT_LIQUIDITY");
        if (out0 > 0) IERC20Like(token0).transfer(to, out0);
        if (out1 > 0) IERC20Like(token1).transfer(to, out1);
        uint256 b0 = IERC20Like(token0).balanceOf(address(this));
        uint256 b1 = IERC20Like(token1).balanceOf(address(this));
        uint256 in0 = b0 > r0 - out0 ? b0 - (r0 - out0) : 0;
        uint256 in1 = b1 > r1 - out1 ? b1 - (r1 - out1) : 0;
        require(in0 > 0 || in1 > 0, "INSUFFICIENT_INPUT_AMOUNT");
        uint256 adj0 = b0 * 1000 - in0 * 3;
        uint256 adj1 = b1 * 1000 - in1 * 3;
        require(adj0 * adj1 >= uint256(r0) * uint256(r1) * 1000 ** 2, "K");
        _update(b0, b1);
    }

    function skim(address to) external {
        IERC20Like(token0).transfer(to, IERC20Like(token0).balanceOf(address(this)) - reserve0);
        IERC20Like(token1).transfer(to, IERC20Like(token1).balanceOf(address(this)) - reserve1);
    }

    function sync() external {
        _update(IERC20Like(token0).balanceOf(address(this)), IERC20Like(token1).balanceOf(address(this)));
    }

    function _sqrt(uint256 y) private pure returns (uint256 z) {
        if (y > 3) {
            z = y;
            uint256 x = y / 2 + 1;
            while (x < z) {
                z = x;
                x = (y / x + x) / 2;
            }
        } else if (y != 0) {
            z = 1;
        }
    }
}

contract MockUniswapV2Factory {
    mapping(address => mapping(address => address)) public getPair;
    address[] public allPairs;

    function createPair(address tokenA, address tokenB) external returns (address pair) {
        require(tokenA != tokenB, "IDENTICAL_ADDRESSES");
        (address t0, address t1) = tokenA < tokenB ? (tokenA, tokenB) : (tokenB, tokenA);
        require(getPair[t0][t1] == address(0), "PAIR_EXISTS");
        pair = address(new MockUniswapV2Pair{salt: keccak256(abi.encodePacked(t0, t1))}());
        MockUniswapV2Pair(pair).initialize(t0, t1);
        getPair[t0][t1] = pair;
        getPair[t1][t0] = pair;
        allPairs.push(pair);
    }

    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
}
