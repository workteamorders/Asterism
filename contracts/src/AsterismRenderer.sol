// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Base64} from "solady/utils/Base64.sol";
import {LibString} from "solady/utils/LibString.sol";

/// @title AsterismRenderer
/// @notice Pure, view-only renderer for Asterism. Draws each asterism as an SVG from (seed, id) and wraps it
///         in base64 JSON metadata. No storage writes, no owner, no external calls.
/// @dev    Byte-for-byte equal to the TypeScript reference renderer in web/src/lib/asterism. Integer math only.
///         Tier assignment is a keyed Feistel permutation over [0, maxSupply), so tier counts are exact.
contract AsterismRenderer {
    using LibString for uint256;

    error InvalidDistribution();

    /*//////////////////////////////////////////////////////////////
                               PARAMETERS
    //////////////////////////////////////////////////////////////*/

    uint256 public immutable maxSupply;
    /// @dev Five cumulative tier bounds, 16 bits each (bound for tier t at bits 16t..16t+15).
    uint256 private immutable _bounds;
    /// @dev Five (min, max) star counts, 8 bits each (min at 16t, max at 16t+8).
    uint256 private immutable _stars;

    uint256 public constant NAME_MAX_BYTES = 48;

    // Canvas and field (inclusive bounds), see spec.ts.
    uint256 private constant FIELD_X0 = 44;
    uint256 private constant FIELD_Y0 = 60;
    uint256 private constant FIELD_W = 313; // 356 - 44 + 1
    uint256 private constant FIELD_H = 273; // 332 - 60 + 1
    uint256 private constant MIN_DIST_SQ = 34 * 34;
    uint256 private constant ATTEMPTS = 24;
    uint256 private constant LATTICE_SLOTS = 95;
    uint256 private constant MAX_STARS = 16;

    constructor(uint256 maxSupply_, uint256[5] memory counts_, uint256[5] memory minStars_, uint256[5] memory maxStars_) {
        if (maxSupply_ == 0 || maxSupply_ > 4096) revert InvalidDistribution();
        uint256 sum;
        uint256 bounds;
        uint256 stars;
        for (uint256 t; t < 5; ++t) {
            if (counts_[t] == 0) revert InvalidDistribution();
            if (minStars_[t] < 2 || minStars_[t] > maxStars_[t] || maxStars_[t] > MAX_STARS) revert InvalidDistribution();
            sum += counts_[t];
            bounds |= sum << (16 * t);
            stars |= (minStars_[t] << (16 * t)) | (maxStars_[t] << (16 * t + 8));
        }
        if (sum != maxSupply_) revert InvalidDistribution();
        maxSupply = maxSupply_;
        _bounds = bounds;
        _stars = stars;
    }

    /*//////////////////////////////////////////////////////////////
                              PUBLIC VIEWS
    //////////////////////////////////////////////////////////////*/

    function tierCounts() external view returns (uint256[5] memory counts) {
        uint256 prev;
        for (uint256 t; t < 5; ++t) {
            uint256 b = _bound(t);
            counts[t] = b - prev;
            prev = b;
        }
    }

    function starRange(uint256 tier) public view returns (uint256 lo, uint256 hi) {
        lo = (_stars >> (16 * tier)) & 0xff;
        hi = (_stars >> (16 * tier + 8)) & 0xff;
    }

    /// @notice Tier (0 Dust, 1 Ember, 2 Star, 3 Giant, 4 Nova) of a 1-indexed token id.
    function tierOf(uint256 id, bytes32 seed) public view returns (uint256) {
        uint256 position = _permute(id - 1, seed);
        for (uint256 t; t < 5; ++t) {
            if (position < _bound(t)) return t;
        }
        revert InvalidDistribution(); // unreachable: position < maxSupply
    }

    /// @notice Number of stars, primary-mark tier, and guide style for an id.
    function traits(uint256 id, bytes32 seed) external view returns (uint256 tier, uint256 stars, uint256 guide) {
        Asterism memory a = _build(id, seed);
        return (a.tier, a.n, a.guide);
    }

    /// @notice Raw SVG. `name` must already be validated by the caller (the token does); invalid names are dropped.
    function svg(uint256 id, bytes32 seed, string memory name) public view returns (string memory) {
        return _svg(_build(id, seed), validName(name) ? name : "");
    }

    function unrevealedSvg() public pure returns (string memory) {
        return string(
            abi.encodePacked(
                _OPEN,
                _frame(),
                _guide(1),
                '<path d="M184 196H194M206 196H216M200 180V190M200 202V212" stroke="#5A5E66" stroke-width="1"/>',
                _readout("ASTERISM", "UNREVEALED"),
                '<text x="200" y="384" fill="#9A9EA6" font-size="12" letter-spacing="1" text-anchor="middle">NOT YET REVEALED</text></svg>'
            )
        );
    }

    function tokenURI(uint256 id, bytes32 seed, string memory name) external view returns (string memory) {
        Asterism memory a = _build(id, seed);
        bool named = validName(name) && bytes(name).length != 0;
        string memory image = _svg(a, named ? name : "");
        bytes memory json = abi.encodePacked(
            '{"name":"Asterism #',
            id.toString(),
            '","description":"',
            _DESCRIPTION,
            '","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(image)),
            '","attributes":[{"trait_type":"Tier","value":"',
            _tierName(a.tier),
            '"},{"trait_type":"Stars","display_type":"number","value":',
            a.n.toString(),
            '},{"trait_type":"Mark","value":"',
            _markName(a.tier),
            '"},{"trait_type":"Guide","value":"',
            _guideName(a.guide),
            '"},{"trait_type":"Named","value":"',
            named ? "Yes" : "No",
            '"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    function unrevealedURI(uint256 id) external pure returns (string memory) {
        bytes memory json = abi.encodePacked(
            '{"name":"Asterism #',
            id.toString(),
            '","description":"',
            _DESCRIPTION,
            ' Not yet revealed.","image":"data:image/svg+xml;base64,',
            Base64.encode(bytes(unrevealedSvg())),
            '","attributes":[{"trait_type":"Status","value":"Unrevealed"}]}'
        );
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(json)));
    }

    /// @notice A-Z a-z 0-9 space . , ! ? ' - only, at most NAME_MAX_BYTES bytes. Mirrors AsterismToken.setName.
    function validName(string memory name) public pure returns (bool) {
        bytes memory b = bytes(name);
        if (b.length > NAME_MAX_BYTES) return false;
        for (uint256 i; i < b.length; ++i) {
            bytes1 c = b[i];
            bool ok = (c >= 0x41 && c <= 0x5a) || (c >= 0x61 && c <= 0x7a) || (c >= 0x30 && c <= 0x39) || c == 0x20
                || c == 0x2e || c == 0x2c || c == 0x21 || c == 0x3f || c == 0x27 || c == 0x2d;
            if (!ok) return false;
        }
        return true;
    }

    /*//////////////////////////////////////////////////////////////
                              CONSTANTS
    //////////////////////////////////////////////////////////////*/

    string private constant _OPEN =
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400" font-family="monospace">';
    string private constant _DESCRIPTION =
        "An asterism drawn entirely on-chain on Robinhood Chain. One whole Asterism token carries one asterism.";
    string private constant _STAR = "#FFF4E0";

    /*//////////////////////////////////////////////////////////////
                               GEOMETRY
    //////////////////////////////////////////////////////////////*/

    struct Stream {
        bytes32 seed;
        uint32 id;
        uint32 k;
        uint256 word;
        uint256 lane;
    }

    struct Asterism {
        uint256 id;
        uint256 tier;
        uint256 n;
        uint256[16] x;
        uint256[16] y;
        uint256[16] b;
        uint256 primary;
        uint256 guide;
        uint256[15] ea;
        uint256[15] eb;
    }

    function _bound(uint256 t) private view returns (uint256) {
        return (_bounds >> (16 * t)) & 0xffff;
    }

    function _lane(Stream memory s) private pure returns (uint256 v) {
        if (s.lane == 8) {
            s.word = uint256(keccak256(abi.encodePacked(s.seed, s.id, s.k)));
            unchecked {
                ++s.k;
            }
            s.lane = 0;
        }
        v = (s.word >> (32 * s.lane)) & 0xffffffff;
        unchecked {
            ++s.lane;
        }
    }

    function _draw(Stream memory s, uint256 n) private pure returns (uint256) {
        return _lane(s) % n;
    }

    function _roundFn(bytes32 key, uint256 r, uint256 half) private pure returns (uint256) {
        // r < 4 and half < 64, so both fit in uint8 (matches the uint8 packing of the reference renderer).
        // forge-lint: disable-next-line(unsafe-typecast)
        return uint256(keccak256(abi.encodePacked(key, uint8(r), uint8(half)))) & 63;
    }

    function _feistel(uint256 x, bytes32 key) private pure returns (uint256) {
        uint256 left = x >> 6;
        uint256 right = x & 63;
        for (uint256 r; r < 4; ++r) {
            uint256 next = left ^ _roundFn(key, r, right);
            left = right;
            right = next;
        }
        return (left << 6) | right;
    }

    function _permute(uint256 index, bytes32 key) private view returns (uint256 y) {
        uint256 n = maxSupply;
        if (index >= n) revert InvalidDistribution();
        y = _feistel(index, key);
        while (y >= n) y = _feistel(y, key);
    }

    function _slot(uint256 k) private pure returns (uint256 x, uint256 y) {
        // Integer division is intended: 19 slots per pair of lattice rows.
        // forge-lint: disable-next-line(divide-before-multiply)
        uint256 pair = k / 19;
        uint256 rem = k % 19;
        if (rem < 10) {
            x = 44 + 34 * rem;
            // forge-lint: disable-next-line(divide-before-multiply)
            y = 60 + 60 * pair;
        } else {
            x = 61 + 34 * (rem - 10);
            // forge-lint: disable-next-line(divide-before-multiply)
            y = 90 + 60 * pair;
        }
    }

    function _free(Asterism memory a, uint256 count, uint256 x, uint256 y) private pure returns (bool) {
        for (uint256 j; j < count; ++j) {
            uint256 dx = x > a.x[j] ? x - a.x[j] : a.x[j] - x;
            uint256 dy = y > a.y[j] ? y - a.y[j] : a.y[j] - y;
            if (dx * dx + dy * dy < MIN_DIST_SQ) return false;
        }
        return true;
    }

    function _build(uint256 id, bytes32 seed) private view returns (Asterism memory a) {
        a.id = id;
        a.tier = tierOf(id, seed);
        // id <= maxSupply <= 4096, so it fits in uint32.
        // forge-lint: disable-next-line(unsafe-typecast)
        Stream memory s = Stream({seed: seed, id: uint32(id), k: 0, word: 0, lane: 8});
        (uint256 lo, uint256 hi) = starRange(a.tier);
        a.n = lo + _draw(s, hi - lo + 1);
        for (uint256 i; i < a.n; ++i) {
            bool placed;
            uint256 px;
            uint256 py;
            for (uint256 t; t < ATTEMPTS && !placed; ++t) {
                px = FIELD_X0 + _draw(s, FIELD_W);
                py = FIELD_Y0 + _draw(s, FIELD_H);
                placed = _free(a, i, px, py);
            }
            if (!placed) {
                uint256 start = _draw(s, LATTICE_SLOTS);
                for (uint256 k; k < LATTICE_SLOTS && !placed; ++k) {
                    (px, py) = _slot((start + k) % LATTICE_SLOTS);
                    placed = _free(a, i, px, py);
                }
                // Always succeeds (see spec.ts); keep a hard stop rather than silently overlapping.
                if (!placed) revert InvalidDistribution();
            }
            a.x[i] = px;
            a.y[i] = py;
            uint256 r = _draw(s, 6);
            a.b[i] = r < 3 ? 0 : (r < 5 ? 1 : 2);
        }
        a.primary = _draw(s, a.n);
        a.guide = _draw(s, 3);
        _mst(a);
    }

    /// @dev Prim's algorithm with squared integer distances; ties go to the lower index.
    function _mst(Asterism memory a) private pure {
        uint256 n = a.n;
        bool[16] memory inTree;
        uint256[16] memory best;
        uint256[16] memory parent;
        for (uint256 v; v < n; ++v) {
            best[v] = type(uint256).max;
            parent[v] = type(uint256).max;
        }
        best[0] = 0;
        uint256 e;
        for (uint256 step; step < n; ++step) {
            uint256 u = type(uint256).max;
            for (uint256 v; v < n; ++v) {
                if (!inTree[v] && (u == type(uint256).max || best[v] < best[u])) u = v;
            }
            inTree[u] = true;
            if (parent[u] != type(uint256).max) {
                a.ea[e] = parent[u];
                a.eb[e] = u;
                ++e;
            }
            for (uint256 v; v < n; ++v) {
                if (inTree[v]) continue;
                uint256 dx = a.x[u] > a.x[v] ? a.x[u] - a.x[v] : a.x[v] - a.x[u];
                uint256 dy = a.y[u] > a.y[v] ? a.y[u] - a.y[v] : a.y[v] - a.y[u];
                uint256 d = dx * dx + dy * dy;
                if (d < best[v]) {
                    best[v] = d;
                    parent[v] = u;
                }
            }
        }
    }

    /*//////////////////////////////////////////////////////////////
                                 SVG
    //////////////////////////////////////////////////////////////*/

    function _svg(Asterism memory a, string memory name) private pure returns (string memory) {
        bytes memory lines;
        for (uint256 e; e + 1 < a.n; ++e) {
            uint256 i = a.ea[e];
            uint256 j = a.eb[e];
            lines = abi.encodePacked(
                lines, "M", a.x[i].toString(), " ", a.y[i].toString(), "L", a.x[j].toString(), " ", a.y[j].toString()
            );
        }
        bytes memory stars;
        for (uint256 i; i < a.n; ++i) {
            if (i == a.primary) continue;
            stars = abi.encodePacked(stars, _circle(a.x[i], a.y[i], a.b[i] + 2));
        }
        bytes memory out = abi.encodePacked(
            _OPEN,
            _frame(),
            _guide(a.guide),
            '<path d="',
            lines,
            '" stroke="#4B4E55" stroke-width="1" fill="none"/>',
            stars,
            _mark(a.tier, a.x[a.primary], a.y[a.primary]),
            _readout(string(abi.encodePacked("ASTERISM ", _pad4(a.id))), string(abi.encodePacked(a.n.toString(), " STARS")))
        );
        if (bytes(name).length != 0) {
            out = abi.encodePacked(
                out,
                '<text x="200" y="384" fill="#ECEDEE" font-size="',
                bytes(name).length <= 34 ? "15" : "12",
                '" text-anchor="middle">',
                name,
                "</text>"
            );
        }
        return string(abi.encodePacked(out, "</svg>"));
    }

    function _frame() private pure returns (string memory) {
        return
        '<rect width="400" height="400" fill="#121315"/><path d="M200 0V8M200 392V400M0 200H8M392 200H400" stroke="#5A5E66" stroke-width="1"/>';
    }

    function _guide(uint256 kind) private pure returns (bytes memory) {
        if (kind == 1) {
            return abi.encodePacked(
                '<circle cx="200" cy="196" r="56" fill="none" stroke="#24262B" stroke-width="1"/>',
                '<circle cx="200" cy="196" r="112" fill="none" stroke="#24262B" stroke-width="1"/>',
                '<circle cx="200" cy="196" r="160" fill="none" stroke="#24262B" stroke-width="1"/>'
            );
        }
        if (kind == 2) {
            return abi.encodePacked(
                '<path d="M40 56V336M80 56V336M120 56V336M160 56V336M200 56V336M240 56V336M280 56V336M320 56V336M360 56V336',
                "M40 56H360M40 96H360M40 136H360M40 176H360M40 216H360M40 256H360M40 296H360M40 336H360",
                '" stroke="#24262B" stroke-width="1"/>'
            );
        }
        return "";
    }

    function _readout(string memory left, string memory right) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<text x="20" y="24" fill="#9A9EA6" font-size="12" letter-spacing="1">',
            left,
            '</text><text x="380" y="24" fill="#9A9EA6" font-size="12" letter-spacing="1" text-anchor="end">',
            right,
            "</text>"
        );
    }

    function _circle(uint256 x, uint256 y, uint256 r) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<circle cx="', x.toString(), '" cy="', y.toString(), '" r="', r.toString(), '" fill="', _STAR, '"/>'
        );
    }

    /// @dev Offsets are stored as signed pairs; all results are positive because stars sit at least 44 units in.
    function _polygon(uint256 cx, uint256 cy, int256[] memory pts) private pure returns (bytes memory d) {
        for (uint256 i; i < pts.length; i += 2) {
            d = abi.encodePacked(
                d,
                i == 0 ? "M" : "L",
                // cx, cy >= 44 and every offset is >= -20, so the sums are positive.
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256(int256(cx) + pts[i]).toString(),
                " ",
                // forge-lint: disable-next-line(unsafe-typecast)
                uint256(int256(cy) + pts[i + 1]).toString()
            );
        }
        d = abi.encodePacked('<path d="', d, 'Z" fill="', _STAR, '"/>');
    }

    function _fourPoint() private pure returns (int256[] memory p) {
        p = new int256[](16);
        int16[16] memory v = [int16(0), -18, 3, -3, 18, 0, 3, 3, 0, 18, -3, 3, -18, 0, -3, -3];
        for (uint256 i; i < 16; ++i) p[i] = v[i];
    }

    function _eightPoint() private pure returns (int256[] memory p) {
        p = new int256[](32);
        int16[32] memory v = [
            int16(0), -20, 2, -4, 9, -9, 4, -2, 20, 0, 4, 2, 9, 9, 2, 4,
            0, 20, -2, 4, -9, 9, -4, 2, -20, 0, -4, -2, -9, -9, -2, -4
        ];
        for (uint256 i; i < 32; ++i) p[i] = v[i];
    }

    function _ring(uint256 cx, uint256 cy, uint256 r, string memory extra) private pure returns (bytes memory) {
        return abi.encodePacked(
            '<circle cx="', cx.toString(), '" cy="', cy.toString(), '" r="', r.toString(), '" fill="none" stroke="', _STAR, extra
        );
    }

    function _mark(uint256 tier, uint256 cx, uint256 cy) private pure returns (bytes memory) {
        if (tier == 0) return _circle(cx, cy, 8);
        if (tier == 1) return abi.encodePacked(_ring(cx, cy, 11, '" stroke-width="2"/>'), _circle(cx, cy, 4));
        if (tier == 2) return _polygon(cx, cy, _fourPoint());
        if (tier == 3) return _polygon(cx, cy, _eightPoint());
        return abi.encodePacked(
            _ring(cx, cy, 33, '" stroke-width="1" stroke-dasharray="2 4"/>'),
            _ring(cx, cy, 25, '" stroke-width="2"/>'),
            _polygon(cx, cy, _eightPoint())
        );
    }

    function _pad4(uint256 id) private pure returns (string memory) {
        string memory s = id.toString();
        uint256 len = bytes(s).length;
        if (len >= 4) return s;
        if (len == 3) return string(abi.encodePacked("0", s));
        if (len == 2) return string(abi.encodePacked("00", s));
        return string(abi.encodePacked("000", s));
    }

    function _tierName(uint256 t) private pure returns (string memory) {
        if (t == 0) return "Dust";
        if (t == 1) return "Ember";
        if (t == 2) return "Star";
        if (t == 3) return "Giant";
        return "Nova";
    }

    function _markName(uint256 t) private pure returns (string memory) {
        if (t == 0) return "Dot";
        if (t == 1) return "Ring";
        if (t == 2) return "Four-point";
        if (t == 3) return "Eight-point";
        return "Eight-point with halo";
    }

    function _guideName(uint256 g) private pure returns (string memory) {
        if (g == 0) return "None";
        if (g == 1) return "Focus rings";
        return "Sensor grid";
    }
}
