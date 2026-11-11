// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {DN404} from "dn404/DN404.sol";
import {DN404Mirror} from "dn404/DN404Mirror.sol";
import {AsterismRenderer} from "./AsterismRenderer.sol";

interface IAsterismReveal {
    function revealed() external view returns (bool);
    function seed() external view returns (bytes32);
}

/// @title AsterismToken
/// @notice Hybrid ERC-20 / ERC-721 (DN404). One whole token (1e18 units) carries one asterism NFT.
///         No owner, no admin, no fee, no tax, no blacklist, no pause. Only the launcher (set at deployment and
///         never changed) may mint, burn for refunds, mark pool addresses as skipNFT, and open trading once.
contract AsterismToken is DN404 {
    error NotLauncher();
    error TradingClosed();
    error SupplyCapExceeded();
    error NotNftOwner();
    error InvalidName();

    event TradingOpened();
    event Named(uint256 indexed id, address indexed by, string name);

    address public immutable launcher;
    AsterismRenderer public immutable renderer;
    /// @notice Hard cap in token units (maxSupplyTokens * 1e18).
    uint256 public immutable maxSupply;

    bool public tradingOpen;

    string private _name;
    string private _symbol;
    mapping(uint256 => string) private _names;
    /// @notice Address that set the current name of `id`. The name is shown only while this address holds `id`.
    mapping(uint256 => address) public namedBy;

    modifier onlyLauncher() {
        if (msg.sender != launcher) revert NotLauncher();
        _;
    }

    /// @dev Deployed by the launcher's constructor. msg.sender is therefore the launcher.
    constructor(string memory name_, string memory symbol_, AsterismRenderer renderer_, uint256 maxSupplyTokens) {
        launcher = msg.sender;
        renderer = renderer_;
        maxSupply = maxSupplyTokens * _unit();
        _name = name_;
        _symbol = symbol_;
        // The mirror only accepts a link from its deployer argument, which DN404 passes as caller() (the launcher).
        address mirror = address(new DN404Mirror(msg.sender));
        _initializeDN404(0, address(0), mirror);
    }

    /*//////////////////////////////////////////////////////////////
                          LAUNCHER-ONLY ACTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Mints sale tokens. The buyer receives NFTs unless they explicitly opted out of NFTs before.
    function mintSale(address to, uint256 amount) external onlyLauncher {
        _checkCap(amount);
        // Smart wallets and EIP-7702 accounts have code, and DN404 would skip their NFTs by default.
        // A buyer of this collection wants the asterisms, so initialise the flag to "receive NFTs" if unset.
        if (_getDN404Storage().addressData[to].flags & _ADDRESS_DATA_SKIP_NFT_INITIALIZED_FLAG == 0) {
            _setSkipNFT(to, false);
        }
        _mint(to, amount);
    }

    /// @notice Mints liquidity tokens straight into the pool. The pool is marked skipNFT first.
    function mintToPool(address pool, uint256 amount) external onlyLauncher {
        _checkCap(amount);
        _setSkipNFT(pool, true);
        _mint(pool, amount);
    }

    /// @notice Burns a buyer's tokens during a refund.
    function burnForRefund(address from, uint256 amount) external onlyLauncher {
        _burn(from, amount);
    }

    /// @notice Marks a token-holding contract (pool, sink, launcher) as skipNFT.
    function markSkipNFT(address account) external onlyLauncher {
        _setSkipNFT(account, true);
    }

    function openTrading() external onlyLauncher {
        if (!tradingOpen) {
            tradingOpen = true;
            emit TradingOpened();
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 NAMES
    //////////////////////////////////////////////////////////////*/

    /// @notice Name your asterism. Public and permanent in chain history. Empty string clears it.
    function setName(uint256 id, string calldata newName) external {
        if (_ownerOf(id) != msg.sender) revert NotNftOwner();
        if (!renderer.validName(newName)) revert InvalidName();
        _names[id] = newName;
        namedBy[id] = bytes(newName).length == 0 ? address(0) : msg.sender;
        // The only external call above is a view on the immutable renderer.
        // forge-lint: disable-next-line(reentrancy-events)
        emit Named(id, msg.sender, newName);
    }

    /// @notice The name shown for `id`: empty unless the address that named it still holds it.
    function nameOf(uint256 id) public view returns (string memory) {
        address by = namedBy[id];
        if (by == address(0) || !_exists(id) || _ownerOf(id) != by) return "";
        return _names[id];
    }

    /*//////////////////////////////////////////////////////////////
                                 VIEWS
    //////////////////////////////////////////////////////////////*/

    function name() public view override returns (string memory) {
        return _name;
    }

    function symbol() public view override returns (string memory) {
        return _symbol;
    }

    /// @notice NFT ids held by `owner`, indices [begin, end) of the owner's list. For off-chain reads.
    function ownedIds(address owner, uint256 begin, uint256 end) external view returns (uint256[] memory) {
        return _ownedIds(owner, begin, end);
    }

    function nftBalanceOf(address owner) external view returns (uint256) {
        return _balanceOfNFT(owner);
    }

    function totalNFTSupply() external view returns (uint256) {
        return _totalNFTSupply();
    }

    function exists(uint256 id) external view returns (bool) {
        return _exists(id);
    }

    /// @notice Owner of `id`, or address(0) if it does not exist (no revert, for batch reads).
    function ownerAt(uint256 id) external view returns (address) {
        return _ownerAt(id);
    }

    function _tokenURI(uint256 id) internal view override returns (string memory) {
        if (!_exists(id)) revert TokenDoesNotExist();
        IAsterismReveal reveal = IAsterismReveal(launcher);
        if (!reveal.revealed()) return renderer.unrevealedURI(id);
        return renderer.tokenURI(id, reveal.seed(), nameOf(id));
    }

    /*//////////////////////////////////////////////////////////////
                            TRANSFER LOCK
    //////////////////////////////////////////////////////////////*/

    function _transfer(address from, address to, uint256 amount) internal override {
        if (!tradingOpen && from != launcher) revert TradingClosed();
        super._transfer(from, to, amount);
    }

    function _transferFromNFT(address from, address to, uint256 id, address msgSender) internal override {
        if (!tradingOpen && from != launcher) revert TradingClosed();
        super._transferFromNFT(from, to, id, msgSender);
    }

    /// @dev No implicit infinite Permit2 allowance; holders approve explicitly.
    function _givePermit2DefaultInfiniteAllowance() internal pure override returns (bool) {
        return false;
    }

    function _checkCap(uint256 amount) private view {
        if (totalSupply() + amount > maxSupply) revert SupplyCapExceeded();
    }
}
