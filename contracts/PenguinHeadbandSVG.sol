// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinHeadbandSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        if (p.headType != EightBitPenguinsRendererData.HEAD_HEADBAND) return "";
        return string(
            abi.encodePacked(
                EightBitPenguinsRendererLayers.headbandLayer(p),
                EightBitPenguinsRendererLayers.headAccessoryShadowLayer(p.headType)
            )
        );
    }
}
