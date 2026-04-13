// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract EightBitPenguinsRandomnessHelper {
    function packedTraitsFromEntropy(bytes32 entropy) external pure returns (uint256 packedTraits) {
        uint8 backgroundIndex = _weightedIndex(
            abi.encodePacked(
                uint8(32), uint8(32), uint8(32), uint8(16), uint8(32), uint8(32), uint8(32),
                uint8(7), uint8(32), uint8(16), uint8(32), uint8(32), uint8(7), uint8(16),
                uint8(7), uint8(16), uint8(16), uint8(7), uint8(7), uint8(2), uint8(16)
            ),
            uint256(keccak256(abi.encodePacked(entropy, uint256(0))))
        );

        uint8 bodyIndex = _rerollBodyIndex(entropy, backgroundIndex);
        uint8 bellyIndex = _rerollBellyIndex(entropy, backgroundIndex, bodyIndex);
        uint8 beakIndex = _weightedIndex(
            abi.encodePacked(uint8(32), uint8(32), uint8(16), uint8(16), uint8(7), uint8(2)),
            uint256(keccak256(abi.encodePacked(entropy, uint256(3))))
        );
        uint8 eyesIndex = _weightedIndex(
            abi.encodePacked(uint8(32), uint8(32), uint8(32), uint8(16), uint8(32), uint8(16), uint8(16), uint8(7), uint8(7), uint8(2)),
            uint256(keccak256(abi.encodePacked(entropy, uint256(4))))
        );
        uint8 headIndex = _rerollHeadIndex(entropy, bodyIndex);
        uint8 feetIndex = 0;

        packedTraits =
            uint256(backgroundIndex) |
            (uint256(bodyIndex) << 5) |
            (uint256(bellyIndex) << 10) |
            (uint256(beakIndex) << 13) |
            (uint256(eyesIndex) << 16) |
            (uint256(headIndex) << 20) |
            (uint256(feetIndex) << 25);
    }

    function _rerollBodyIndex(bytes32 entropy, uint8 backgroundIndex) internal pure returns (uint8 selected) {
        selected = _weightedIndex(
            abi.encodePacked(
                uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32),
                uint8(16), uint8(16), uint8(16), uint8(16), uint8(16), uint8(7), uint8(7), uint8(7), uint8(7), uint8(2)
            ),
            uint256(keccak256(abi.encodePacked(entropy, uint256(1))))
        );

        uint24 backgroundColor = _backgroundColor(backgroundIndex);
        for (uint256 attempt = 0; attempt < 24; attempt++) {
            if (_colorDiff(backgroundColor, _bodyColor(selected)) >= 80) {
                return selected;
            }
            selected = _weightedIndex(
                abi.encodePacked(
                    uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32),
                    uint8(16), uint8(16), uint8(16), uint8(16), uint8(16), uint8(7), uint8(7), uint8(7), uint8(7), uint8(2)
                ),
                uint256(keccak256(abi.encodePacked(entropy, uint256(100 + attempt))))
            );
        }
    }

    function _rerollBellyIndex(bytes32 entropy, uint8 backgroundIndex, uint8 bodyIndex) internal pure returns (uint8 selected) {
        selected = _weightedIndex(
            abi.encodePacked(uint8(32), uint8(32), uint8(16), uint8(7), uint8(2)),
            uint256(keccak256(abi.encodePacked(entropy, uint256(2))))
        );

        uint24 bodyColor = _bodyColor(bodyIndex);
        for (uint256 attempt = 0; attempt < 24; attempt++) {
            if (_colorDiff(bodyColor, _bellyColor(selected)) >= 80) {
                break;
            }
            selected = _weightedIndex(
                abi.encodePacked(uint8(32), uint8(32), uint8(16), uint8(7), uint8(2)),
                uint256(keccak256(abi.encodePacked(entropy, uint256(200 + attempt))))
            );
        }

        uint24 backgroundColor = _backgroundColor(backgroundIndex);
        for (uint256 attempt = 0; attempt < 24; attempt++) {
            if (_colorDiff(backgroundColor, _bellyColor(selected)) >= 80) {
                return selected;
            }
            selected = _weightedIndex(
                abi.encodePacked(uint8(32), uint8(32), uint8(16), uint8(7), uint8(2)),
                uint256(keccak256(abi.encodePacked(entropy, uint256(300 + attempt))))
            );
        }
    }

    function _rerollHeadIndex(bytes32 entropy, uint8 bodyIndex) internal pure returns (uint8 selected) {
        bytes memory weights = abi.encodePacked(
            uint8(32), uint8(32), uint8(32), uint8(32), uint8(32), uint8(32),
            uint8(16), uint8(16), uint8(16), uint8(16), uint8(16), uint8(16), uint8(16), uint8(16),
            uint8(7), uint8(7), uint8(7), uint8(7), uint8(7), uint8(7), uint8(7),
            uint8(2), uint8(2), uint8(2)
        );
        selected = _weightedIndex(weights, uint256(keccak256(abi.encodePacked(entropy, uint256(5)))));

        uint24 bodyColor = _bodyColor(bodyIndex);
        for (uint256 attempt = 0; attempt < 24; attempt++) {
            if (!_headNeedsContrast(selected) || _colorDiff(_headColor(selected), bodyColor) >= 80) {
                return selected;
            }
            selected = _weightedIndex(weights, uint256(keccak256(abi.encodePacked(entropy, uint256(400 + attempt)))));
        }
    }

    function _weightedIndex(bytes memory weights, uint256 roll) internal pure returns (uint8) {
        uint256 totalWeight = 0;
        for (uint256 i = 0; i < weights.length; i++) {
            totalWeight += uint8(weights[i]);
        }

        uint256 cursor = totalWeight == 0 ? 0 : roll % totalWeight;
        for (uint8 i = 0; i < weights.length; i++) {
            uint256 weight = uint8(weights[i]);
            if (cursor < weight) {
                return i;
            }
            cursor -= weight;
        }
        return 0;
    }

    function _headNeedsContrast(uint8 headIndex) internal pure returns (bool) {
        return headIndex > 0 && headIndex < 21;
    }

    function _colorDiff(uint24 a, uint24 b) internal pure returns (uint256) {
        uint256 ar = uint8(a >> 16);
        uint256 ag = uint8(a >> 8);
        uint256 ab = uint8(a);
        uint256 br = uint8(b >> 16);
        uint256 bg = uint8(b >> 8);
        uint256 bb = uint8(b);

        return _absDiff(ar, br) + _absDiff(ag, bg) + _absDiff(ab, bb);
    }

    function _absDiff(uint256 a, uint256 b) internal pure returns (uint256) {
        return a >= b ? a - b : b - a;
    }

    function _backgroundColor(uint8 index) internal pure returns (uint24) {
        if (index == 0) return 0xADD8E6;
        if (index == 1) return 0xF4A6B8;
        if (index == 2) return 0x87CEEB;
        if (index == 3) return 0xDDE8F8;
        if (index == 4) return 0xC8B6FF;
        if (index == 5) return 0x98FFCC;
        if (index == 6) return 0xFFD1DC;
        if (index == 7) return 0x4169E1;
        if (index == 8) return 0xFFE5B4;
        if (index == 9) return 0xD8B4F8;
        if (index == 10) return 0xF5F5DC;
        if (index == 11) return 0xFF6B6B;
        if (index == 12) return 0x1A1A2E;
        if (index == 13) return 0xFF7A18;
        if (index == 14) return 0x0F4C5C;
        if (index == 15) return 0x2E8B57;
        if (index == 16) return 0x36454F;
        if (index == 17) return 0xF5FF3B;
        if (index == 18) return 0x00FFFF;
        if (index == 19) return 0xFFD700;
        return 0xDC143C;
    }

    function _bodyColor(uint8 index) internal pure returns (uint24) {
        if (index == 0) return 0xD6CCB8;
        if (index == 1) return 0xF5F5F5;
        if (index == 2) return 0x1C1C1C;
        if (index == 3) return 0xB2B2B2;
        if (index == 4) return 0xFFF3D6;
        if (index == 5) return 0xC68642;
        if (index == 6) return 0x5C3A21;
        if (index == 7) return 0xD2A679;
        if (index == 8) return 0xCFE9FF;
        if (index == 9) return 0xA7C7E7;
        if (index == 10) return 0x2B6CB0;
        if (index == 11) return 0xF4A6B8;
        if (index == 12) return 0xFF77AA;
        if (index == 13) return 0xBFA2DB;
        if (index == 14) return 0x6B3FA0;
        if (index == 15) return 0xA8E6CF;
        if (index == 16) return 0x708238;
        if (index == 17) return 0xFF8C69;
        if (index == 18) return 0xE6B422;
        return 0xE0FFFF;
    }

    function _bellyColor(uint8 index) internal pure returns (uint24) {
        if (index == 0) return 0xFDF5E6;
        if (index == 1) return 0xFFDAB9;
        if (index == 2) return 0xD6EAF8;
        if (index == 3) return 0xD5F5E3;
        return 0xE8DAEF;
    }

    function _headColor(uint8 index) internal pure returns (uint24) {
        if (index == 1 || index == 6 || index == 11 || index == 16) return 0xFFD700;
        if (index == 2 || index == 7 || index == 12 || index == 17) return 0x2B2B2B;
        if (index == 3 || index == 8 || index == 13 || index == 18) return 0x0F52BA;
        if (index == 4 || index == 9 || index == 14 || index == 19) return 0xDC143C;
        if (index == 5 || index == 10 || index == 15 || index == 20) return 0xFAD02E;
        return 0;
    }
}
