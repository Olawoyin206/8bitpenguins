// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinBackgroundSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        return string(EightBitPenguinsRendererLayers.backgroundLayer(p.background));
    }
}
