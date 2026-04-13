// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EightBitPenguinsRendererLayers.sol";

interface IPenguinSVGPart {
    function render(uint256 packedTraits) external view returns (string memory);
}

contract EightBitPenguinsOnchainRenderer {
    address public immutable backgroundRenderer;
    address public immutable snowFxRenderer;
    address public immutable dotsFxRenderer;
    address public immutable torsoRenderer;
    address public immutable torsoBellyRenderer;
    address public immutable wingsRenderer;
    address public immutable headBaseRenderer;
    address public immutable capRenderer;
    address public immutable beanieRenderer;
    address public immutable scarfRenderer;
    address public immutable headbandRenderer;
    address public immutable crownRenderer;
    address public immutable haloRenderer;
    address public immutable faceRenderer;
    address public immutable feetRenderer;
    address public immutable bodyOutlineRenderer;
    address public immutable accessoryOutlineRenderer;
    address public immutable faceDetailsOutlineRenderer;
    address public immutable feetOutlineRenderer;

    constructor(
        address backgroundRenderer_,
        address snowFxRenderer_,
        address dotsFxRenderer_,
        address torsoRenderer_,
        address torsoBellyRenderer_,
        address wingsRenderer_,
        address headBaseRenderer_,
        address capRenderer_,
        address beanieRenderer_,
        address scarfRenderer_,
        address headbandRenderer_,
        address crownRenderer_,
        address haloRenderer_,
        address faceRenderer_,
        address feetRenderer_,
        address bodyOutlineRenderer_,
        address accessoryOutlineRenderer_,
        address faceDetailsOutlineRenderer_,
        address feetOutlineRenderer_
    ) {
        backgroundRenderer = backgroundRenderer_;
        snowFxRenderer = snowFxRenderer_;
        dotsFxRenderer = dotsFxRenderer_;
        torsoRenderer = torsoRenderer_;
        torsoBellyRenderer = torsoBellyRenderer_;
        wingsRenderer = wingsRenderer_;
        headBaseRenderer = headBaseRenderer_;
        capRenderer = capRenderer_;
        beanieRenderer = beanieRenderer_;
        scarfRenderer = scarfRenderer_;
        headbandRenderer = headbandRenderer_;
        crownRenderer = crownRenderer_;
        haloRenderer = haloRenderer_;
        faceRenderer = faceRenderer_;
        feetRenderer = feetRenderer_;
        bodyOutlineRenderer = bodyOutlineRenderer_;
        accessoryOutlineRenderer = accessoryOutlineRenderer_;
        faceDetailsOutlineRenderer = faceDetailsOutlineRenderer_;
        feetOutlineRenderer = feetOutlineRenderer_;
    }

    function renderSVG(uint256 packedTraits) external view returns (string memory) {
        return string(
            abi.encodePacked(
                '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" shape-rendering="crispEdges">',
                '<g transform="scale(6.4)">',
                renderBackgroundPass(packedTraits),
                "</g>",
                '<g transform="translate(32 32) scale(4.8)">',
                renderSpritePass(packedTraits),
                "</g>",
                renderOverlayPass(packedTraits),
                "</svg>"
            )
        );
    }

    function renderBackgroundPass(uint256 packedTraits) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                IPenguinSVGPart(backgroundRenderer).render(packedTraits),
                IPenguinSVGPart(snowFxRenderer).render(packedTraits),
                IPenguinSVGPart(dotsFxRenderer).render(packedTraits)
            )
        );
    }

    function renderBasePass(uint256 packedTraits) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                IPenguinSVGPart(wingsRenderer).render(packedTraits),
                IPenguinSVGPart(torsoRenderer).render(packedTraits),
                IPenguinSVGPart(torsoBellyRenderer).render(packedTraits),
                IPenguinSVGPart(headBaseRenderer).render(packedTraits)
            )
        );
    }

    function renderAccessoryPass(uint256 packedTraits) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                IPenguinSVGPart(capRenderer).render(packedTraits),
                IPenguinSVGPart(beanieRenderer).render(packedTraits),
                IPenguinSVGPart(scarfRenderer).render(packedTraits),
                IPenguinSVGPart(headbandRenderer).render(packedTraits),
                IPenguinSVGPart(crownRenderer).render(packedTraits),
                IPenguinSVGPart(haloRenderer).render(packedTraits)
            )
        );
    }

    function renderSpritePass(uint256 packedTraits) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                renderBasePass(packedTraits),
                renderAccessoryPass(packedTraits),
                IPenguinSVGPart(faceRenderer).render(packedTraits),
                IPenguinSVGPart(feetRenderer).render(packedTraits),
                EightBitPenguinsRendererLayers.groundShadowLayer()
            )
        );
    }

    function renderOverlayPass(uint256 packedTraits) internal view returns (string memory) {
        return string(
            abi.encodePacked(
                IPenguinSVGPart(bodyOutlineRenderer).render(packedTraits),
                IPenguinSVGPart(accessoryOutlineRenderer).render(packedTraits),
                IPenguinSVGPart(faceDetailsOutlineRenderer).render(packedTraits),
                IPenguinSVGPart(feetOutlineRenderer).render(packedTraits)
            )
        );
    }

    function packedAttributesJson(uint256 packedTraits) external pure returns (string memory) {
        return EightBitPenguinsRendererData.packedAttributesJson(packedTraits);
    }

    function packedName(uint256 packedTraits) external pure returns (string memory) {
        return EightBitPenguinsRendererData.packedName(packedTraits);
    }

    function rarityScoreFromPacked(uint256 packedTraits) external pure returns (uint256) {
        return EightBitPenguinsRendererData.rarityScoreFromPacked(packedTraits);
    }
}
