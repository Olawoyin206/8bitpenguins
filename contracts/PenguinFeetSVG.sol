// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinFeetSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        return string(
            abi.encodePacked(
                EightBitPenguinsRendererLayers.feetLayer(p.feet, p.feetHighlight, p.feetShadow)
            )
        );
    }
}
