// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinCapSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        if (p.headType != EightBitPenguinsRendererData.HEAD_CAP) return "";
        return string(
            abi.encodePacked(
                EightBitPenguinsRendererLayers.capLayer(p),
                EightBitPenguinsRendererLayers.headAccessoryShadowLayer(p.headType)
            )
        );
    }
}
