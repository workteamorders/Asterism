// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AsterismToken} from "./AsterismToken.sol";
import {AsterismRenderer} from "./AsterismRenderer.sol";
import {LiquiditySink} from "./LiquiditySink.sol";
import {IUniswapV2Factory, IUniswapV2Pair, IWETH} from "./interfaces/IUniswapV2.sol";
import {ReentrancyGuardTransient} from "solady/utils/ReentrancyGuardTransient.sol";

/// @title AsterismLauncher
/// @notice Fair launch for Asterism: a fixed-price sale, a permissionless finalisation that seeds a Uniswap V2 pool
///         at exactly the sale price and locks the liquidity forever, a pull payment to a fixed treasury, a full
///         refund path if finalisation never happens, and a commit-reveal seed for the art.
/// @dev    No owner and no admin. Every parameter is immutable. The only privileged role is the revealer (the
///         deployer), who can call reveal() once, with the secret matching the commitment fixed at deployment.
contract AsterismLauncher is ReentrancyGuardTransient {
    /*//////////////////////////////////////////////////////////////
                                 ERRORS
    //////////////////////////////////////////////////////////////*/

    error InvalidParams();
    error SaleNotOpen();
    error InvalidAmount();
    error TxCapExceeded();
    error WalletCapExceeded();
    error SoldOut();
    error InsufficientPayment();
    error AlreadyFinalized();
    error NotFinalizable();
    error NothingToWithdraw();
    error RefundNotOpen();
    error NothingToRefund();
    error NotRevealer();
    error NotRevealable();
    error BadSecret();
    error TransferFailed();

    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/

    event Purchased(address indexed buyer, uint256 tokens, uint256 paid, uint256 purchaseIndex, bytes32 entropy);
    event Finalized(address indexed pair, uint256 tokenLP, uint256 ethLP, uint256 liquidity, uint256 treasuryAmount);
    event DonationSkimmed(address indexed pair, address indexed to);
    event TreasuryWithdrawn(address indexed treasury, uint256 amount);
    event Refunded(address indexed buyer, uint256 tokens, uint256 amount);
    event Revealed(bytes32 seed, bool fallbackUsed);

    /*//////////////////////////////////////////////////////////////
                               PARAMETERS
    //////////////////////////////////////////////////////////////*/

    struct Params {
        string name;
        string symbol;
        uint256 maxSupplyTokens;
        uint256 saleBps;
        uint256 liquidityProceedsBps;
        uint256 treasuryProceedsBps;
        uint256 mintPrice;
        uint256 walletCap;
        uint256 txCap;
        uint256 saleStart;
        uint256 saleEnd;
        uint256 finalizeWindow;
        uint256 revealWindow;
        address payable treasury;
        bytes32 revealCommit;
        address weth;
        address v2Factory;
    }

    enum Status {
        NotStarted,
        Sale,
        AwaitingFinalization,
        Trading,
        Refunding
    }

    uint256 private constant BPS = 10_000;
    uint256 private constant UNIT = 1e18;
    uint256 public constant MIN_WINDOW = 1 hours;

    AsterismToken public immutable token;
    AsterismRenderer public immutable renderer;
    LiquiditySink public immutable sink;
    address public immutable revealer;
    address payable public immutable treasury;
    bytes32 public immutable revealCommit;
    IWETH public immutable weth;
    IUniswapV2Factory public immutable factory;

    uint256 public immutable maxSupplyTokens;
    uint256 public immutable saleCap;
    uint256 public immutable saleBps;
    uint256 public immutable liquidityProceedsBps;
    uint256 public immutable treasuryProceedsBps;
    uint256 public immutable mintPrice;
    uint256 public immutable walletCap;
    uint256 public immutable txCap;
    uint256 public immutable saleStart;
    uint256 public immutable saleEnd;
    uint256 public immutable finalizeWindow;
    uint256 public immutable revealWindow;

    /*//////////////////////////////////////////////////////////////
                                 STATE
    //////////////////////////////////////////////////////////////*/

    uint256 public sold;
    uint256 public raised;
    uint256 public refundedTotal;
    uint256 public purchaseCount;
    bytes32 public entropy;
    mapping(address => uint256) public purchased;
    mapping(address => uint256) public paid;

    bool public finalized;
    uint256 public finalizedAt;
    address public pair;
    uint256 public tokenLP;
    uint256 public ethLP;
    uint256 public treasuryAmount;
    uint256 public treasuryWithdrawn;

    bool public revealed;
    bytes32 public seed;

    constructor(Params memory p, AsterismRenderer renderer_) {
        if (p.maxSupplyTokens == 0 || p.maxSupplyTokens != renderer_.maxSupply()) revert InvalidParams();
        if (p.saleBps == 0 || p.saleBps >= BPS) revert InvalidParams();
        if (p.liquidityProceedsBps == 0 || p.liquidityProceedsBps + p.treasuryProceedsBps != BPS) revert InvalidParams();
        // Price parity: liquidity share of proceeds must buy the unsold share of supply at the sale price.
        // liquidityProceedsBps * saleBps == (BPS - saleBps) * BPS, within 1 bps of liquidityProceedsBps.
        uint256 lhs = p.liquidityProceedsBps * p.saleBps;
        uint256 rhs = (BPS - p.saleBps) * BPS;
        if ((lhs > rhs ? lhs - rhs : rhs - lhs) > p.saleBps) revert InvalidParams();
        uint256 cap = (p.maxSupplyTokens * p.saleBps) / BPS;
        if (cap == 0 || p.mintPrice == 0 || p.txCap == 0 || p.walletCap == 0 || p.txCap > cap) revert InvalidParams();
        if (p.saleEnd < p.saleStart + MIN_WINDOW) revert InvalidParams();
        if (p.finalizeWindow < MIN_WINDOW || p.revealWindow < MIN_WINDOW) revert InvalidParams();
        if (p.treasury == address(0) || p.revealCommit == bytes32(0)) revert InvalidParams();
        if (p.weth.code.length == 0 || p.v2Factory.code.length == 0) revert InvalidParams();

        renderer = renderer_;
        revealer = msg.sender;
        treasury = p.treasury;
        revealCommit = p.revealCommit;
        weth = IWETH(p.weth);
        factory = IUniswapV2Factory(p.v2Factory);
        maxSupplyTokens = p.maxSupplyTokens;
        saleCap = cap;
        saleBps = p.saleBps;
        liquidityProceedsBps = p.liquidityProceedsBps;
        treasuryProceedsBps = p.treasuryProceedsBps;
        mintPrice = p.mintPrice;
        walletCap = p.walletCap;
        txCap = p.txCap;
        saleStart = p.saleStart;
        saleEnd = p.saleEnd;
        finalizeWindow = p.finalizeWindow;
        revealWindow = p.revealWindow;

        AsterismToken t = new AsterismToken(p.name, p.symbol, renderer_, p.maxSupplyTokens);
        token = t;
        LiquiditySink s = new LiquiditySink();
        sink = s;
        t.markSkipNFT(address(this));
        t.markSkipNFT(address(s));
    }

    /*//////////////////////////////////////////////////////////////
                                  SALE
    //////////////////////////////////////////////////////////////*/

    /// @notice Buy `amount` whole tokens at mintPrice each. Any ETH above the exact cost is returned.
    /// @dev    The wallet cap is per address and can be bypassed with several addresses.
    function buy(uint256 amount) external payable nonReentrant {
        if (finalized || block.timestamp < saleStart || block.timestamp > saleEnd) revert SaleNotOpen();
        if (amount == 0) revert InvalidAmount();
        if (amount > txCap) revert TxCapExceeded();
        if (purchased[msg.sender] + amount > walletCap) revert WalletCapExceeded();
        if (sold + amount > saleCap) revert SoldOut();
        uint256 cost = amount * mintPrice;
        if (msg.value < cost) revert InsufficientPayment();

        uint256 index = purchaseCount;
        bytes32 e = keccak256(abi.encodePacked(entropy, msg.sender, amount, index));
        entropy = e;
        purchaseCount = index + 1;
        sold += amount;
        raised += cost;
        purchased[msg.sender] += amount;
        paid[msg.sender] += cost;

        // Emitted before the external calls that follow (lint false positive through the guard modifier).
        // forge-lint: disable-next-line(reentrancy-events)
        emit Purchased(msg.sender, amount, cost, index, e);
        // Trusted call: the token was deployed by this contract's constructor. Guarded by nonReentrant.
        // forge-lint: disable-next-line(reentrancy-no-eth)
        token.mintSale(msg.sender, amount * UNIT);

        uint256 excess = msg.value - cost;
        if (excess != 0) _send(payable(msg.sender), excess);
    }

    /*//////////////////////////////////////////////////////////////
                              FINALISATION
    //////////////////////////////////////////////////////////////*/

    /// @notice Anyone can finalise once the sale has sold out or ended, until the finalisation window closes.
    function finalizeLaunch() external nonReentrant {
        if (finalized) revert AlreadyFinalized();
        if (sold == 0) revert NotFinalizable();
        if (sold < saleCap && block.timestamp <= saleEnd) revert NotFinalizable();
        if (block.timestamp > saleEnd + finalizeWindow) revert NotFinalizable();

        (uint256 tLP, uint256 eLP) = liquiditySplit();
        if (tLP == 0) revert NotFinalizable();

        // Effects first. Trading opens inside this same transaction, before the pool calls below, because the pool's
        // skim() transfers zero tokens and would otherwise hit the transfer lock. No one else can act in between.
        finalized = true;
        finalizedAt = block.timestamp;
        tokenLP = tLP;
        ethLP = eLP;
        treasuryAmount = raised - eLP;

        address t = address(token);
        address p = factory.getPair(t, address(weth));
        if (p == address(0)) p = factory.createPair(t, address(weth));
        pair = p;
        if (IUniswapV2Pair(p).totalSupply() != 0) revert NotFinalizable(); // unreachable: no tokens could reach it
        token.openTrading();

        uint256 extra = _clearDonations(p, tLP);
        token.mintToPool(p, tLP * UNIT + extra);
        weth.deposit{value: eLP}();
        if (!weth.transfer(p, eLP)) revert TransferFailed();
        uint256 liquidity = IUniswapV2Pair(p).mint(address(sink));

        // The event carries the minted liquidity, so it follows the pool call. All callees are fixed at deployment.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Finalized(p, tLP, eLP, liquidity, raised - eLP);
    }

    /// @dev Anyone can create the pair early and send WETH to it. Unsynced WETH is skimmed to the treasury.
    ///      WETH already synced into the reserve stays in the pool; extra tokens from the unsold remainder are added
    ///      so the opening price stays at mintPrice (rounded down), as far as the remainder allows.
    function _clearDonations(address p, uint256 tLP) private returns (uint256 extra) {
        IUniswapV2Pair pool = IUniswapV2Pair(p);
        // Emitted before the external calls that follow (lint false positive through the guard modifier).
        // forge-lint: disable-next-line(reentrancy-events)
        emit DonationSkimmed(p, treasury);
        pool.skim(treasury);
        // The third return value (last block timestamp) is not needed.
        // forge-lint: disable-next-line(unused-return)
        (uint112 r0, uint112 r1,) = pool.getReserves();
        bool tokenIs0 = pool.token0() == address(token);
        if ((tokenIs0 ? r0 : r1) != 0) revert NotFinalizable(); // unreachable: tokens were locked
        uint256 reserveWeth = tokenIs0 ? r1 : r0;
        if (reserveWeth != 0) {
            extra = (reserveWeth * UNIT) / mintPrice;
            uint256 room = (maxSupplyTokens - sold - tLP) * UNIT;
            if (extra > room) extra = room;
        }
    }

    /// @notice Whole tokens and wei that finalisation puts into the pool at the current sale totals.
    /// @dev    tokenLP is rounded down to whole tokens and ethLP is exactly tokenLP * mintPrice, so the pool opens at
    ///         exactly mintPrice. Rounding goes to the treasury. tokenLP never exceeds the unsold supply.
    function liquiditySplit() public view returns (uint256 tLP, uint256 eLP) {
        // Rounding down to whole tokens before multiplying back is the point: it makes the pool price exact.
        // forge-lint: disable-next-line(divide-before-multiply)
        tLP = (raised * liquidityProceedsBps) / BPS / mintPrice;
        uint256 room = maxSupplyTokens - sold;
        if (tLP > room) tLP = room;
        // forge-lint: disable-next-line(divide-before-multiply)
        eLP = tLP * mintPrice;
    }

    /// @notice Sends the treasury share to the fixed treasury address. Callable by anyone, after finalisation.
    function withdrawTreasury() external nonReentrant {
        if (!finalized) revert NotFinalizable();
        uint256 amount = treasuryAmount - treasuryWithdrawn;
        if (amount == 0) revert NothingToWithdraw();
        treasuryWithdrawn = treasuryAmount;
        // Emitted before the external calls that follow (lint false positive through the guard modifier).
        // forge-lint: disable-next-line(reentrancy-events)
        emit TreasuryWithdrawn(treasury, amount);
        _send(treasury, amount);
    }

    /*//////////////////////////////////////////////////////////////
                                 REFUND
    //////////////////////////////////////////////////////////////*/

    /// @notice If the launch was not finalised in time, burn your purchased tokens and get back exactly what you paid.
    function refund() external nonReentrant {
        if (finalized || block.timestamp <= saleEnd + finalizeWindow) revert RefundNotOpen();
        uint256 tokens = purchased[msg.sender];
        uint256 amount = paid[msg.sender];
        if (tokens == 0) revert NothingToRefund();
        purchased[msg.sender] = 0;
        paid[msg.sender] = 0;
        refundedTotal += amount;
        // Emitted before the external calls that follow (lint false positive through the guard modifier).
        // forge-lint: disable-next-line(reentrancy-events)
        emit Refunded(msg.sender, tokens, amount);
        token.burnForRefund(msg.sender, tokens * UNIT);
        _send(payable(msg.sender), amount);
    }

    /*//////////////////////////////////////////////////////////////
                                 REVEAL
    //////////////////////////////////////////////////////////////*/

    /// @notice The revealer publishes the secret behind revealCommit. Only once, only after finalisation, and only
    ///         before the reveal deadline. seed = keccak256(secret, entropy).
    function reveal(bytes32 secret) external {
        if (msg.sender != revealer) revert NotRevealer();
        if (!finalized || revealed || block.timestamp > revealDeadline()) revert NotRevealable();
        if (keccak256(abi.encodePacked(secret)) != revealCommit) revert BadSecret();
        revealed = true;
        seed = keccak256(abi.encodePacked(secret, entropy));
        emit Revealed(seed, false);
    }

    /// @notice If the revealer never reveals, anyone can fix the seed after the deadline: keccak256(entropy, commit).
    function revealFallback() external {
        if (!finalized || revealed || block.timestamp <= revealDeadline()) revert NotRevealable();
        revealed = true;
        seed = keccak256(abi.encodePacked(entropy, revealCommit));
        emit Revealed(seed, true);
    }

    function revealDeadline() public view returns (uint256) {
        return finalized ? finalizedAt + revealWindow : type(uint256).max;
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function status() public view returns (Status) {
        if (finalized) return Status.Trading;
        if (block.timestamp < saleStart) return Status.NotStarted;
        if (block.timestamp <= saleEnd && sold < saleCap) return Status.Sale;
        if (block.timestamp <= saleEnd + finalizeWindow && sold > 0) return Status.AwaitingFinalization;
        return Status.Refunding;
    }

    struct State {
        Status status;
        uint256 now_;
        uint256 sold;
        uint256 saleCap;
        uint256 raised;
        uint256 refundedTotal;
        uint256 purchaseCount;
        bool finalized;
        uint256 finalizedAt;
        address pair;
        uint256 tokenLP;
        uint256 ethLP;
        uint256 treasuryAmount;
        uint256 treasuryWithdrawn;
        bool revealed;
        bytes32 seed;
        uint256 revealDeadline;
        bytes32 entropy;
    }

    /// @notice Everything the site needs in one call.
    function state() external view returns (State memory s) {
        s.status = status();
        s.now_ = block.timestamp;
        s.sold = sold;
        s.saleCap = saleCap;
        s.raised = raised;
        s.refundedTotal = refundedTotal;
        s.purchaseCount = purchaseCount;
        s.finalized = finalized;
        s.finalizedAt = finalizedAt;
        s.pair = pair;
        s.tokenLP = tokenLP;
        s.ethLP = ethLP;
        s.treasuryAmount = treasuryAmount;
        s.treasuryWithdrawn = treasuryWithdrawn;
        s.revealed = revealed;
        s.seed = seed;
        s.revealDeadline = revealDeadline();
        s.entropy = entropy;
    }

    /// @notice How many whole tokens `account` can still buy right now.
    function remainingFor(address account) external view returns (uint256) {
        if (status() != Status.Sale) return 0;
        uint256 byWallet = walletCap - purchased[account];
        uint256 bySupply = saleCap - sold;
        uint256 r = byWallet < bySupply ? byWallet : bySupply;
        return r < txCap ? r : txCap;
    }

    /*//////////////////////////////////////////////////////////////
                                INTERNAL
    //////////////////////////////////////////////////////////////*/

    /// @dev Robinhood Chain supports TSTORE/TLOAD (measured, docs/DECISIONS.md), so the guard uses transient storage.
    function _useTransientReentrancyGuardOnlyOnMainnet() internal pure override returns (bool) {
        return false;
    }

    /// @dev Destinations are msg.sender (excess or refund of their own payment) or the immutable treasury.
    function _send(address payable to, uint256 amount) private {
        // forge-lint: disable-next-line(arbitrary-send-eth)
        (bool ok,) = to.call{value: amount}("");
        if (!ok) revert TransferFailed();
    }
}
