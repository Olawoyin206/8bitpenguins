// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererData.sol";
import "./EightBitPenguinsRendererLayers.sol";

contract PenguinSnowFxSVG {
    function render(uint256 packedTraits) external pure returns (string memory) {
        EightBitPenguinsRendererData.Palette memory p = EightBitPenguinsRendererData.paletteFromPacked(packedTraits);
        if (keccak256(bytes(p.backgroundFx)) != keccak256(bytes("snow"))) return "";
        return string(EightBitPenguinsRendererLayers.snowFxLayer());
    }
}
