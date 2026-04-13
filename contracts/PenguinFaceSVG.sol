// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinFaceSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        return string(
            abi.encodePacked(
                EightBitPenguinsRendererLayers.eyesLayer(p.eyeType),
                EightBitPenguinsRendererLayers.browsLayer(p.bodyShadow),
                EightBitPenguinsRendererLayers.beakLayer(p),
                EightBitPenguinsRendererLayers.cheeksLayer(p.cheeks, p.cheeksHighlight)
            )
        );
    }
}
