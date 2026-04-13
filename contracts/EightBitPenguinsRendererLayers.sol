// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Strings.sol";
import "./EightBitPenguinsRendererData.sol";

library EightBitPenguinsRendererLayers {
    using Strings for uint256;

    struct HeadAccessoryShades {
        string highlight;
        string shadow;
        string spec;
        string mid;
        string deep;
        string fold;
    }

    function backgroundLayer(string memory fill) internal pure returns (bytes memory) {
        return abi.encodePacked('<rect width="40" height="40" fill="', fill, '"/>');
    }

    function backgroundFxLayer(string memory fx) internal pure returns (bytes memory) {
        bytes32 fxHash = keccak256(bytes(fx));
        if (fxHash == keccak256(bytes("snow"))) return snowFxLayer();
        if (fxHash == keccak256(bytes("dots"))) return dotsFxLayer();
        return "";
    }

    function snowFxLayer() internal pure returns (bytes memory) {
        bytes memory out = abi.encodePacked(
            softDot(3, 4, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(10, 7, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(32, 5, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)")
        );
        out = abi.encodePacked(
            out,
            softDot(36, 10, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(6, 33, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(14, 35, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)")
        );
        out = abi.encodePacked(
            out,
            softDot(29, 32, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(35, 27, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            softDot(2, 20, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)")
        );
        out = abi.encodePacked(
            out,
            softDot(38, 22, "rgba(255,255,255,0.9)", "rgba(255,255,255,0.35)", "rgba(255,255,255,0.14)"),
            rect(1, 4, 1, 4, "rgba(255,255,255,0.08)"), rect(5, 4, 5, 4, "rgba(255,255,255,0.08)"), rect(3, 2, 3, 2, "rgba(255,255,255,0.08)"), rect(3, 6, 3, 6, "rgba(255,255,255,0.08)")
        );
        out = abi.encodePacked(
            out,
            rect(8, 7, 8, 7, "rgba(255,255,255,0.08)"), rect(12, 7, 12, 7, "rgba(255,255,255,0.08)"), rect(10, 5, 10, 5, "rgba(255,255,255,0.08)"), rect(10, 9, 10, 9, "rgba(255,255,255,0.08)"),
            rect(30, 5, 30, 5, "rgba(255,255,255,0.08)"), rect(34, 5, 34, 5, "rgba(255,255,255,0.08)"), rect(32, 3, 32, 3, "rgba(255,255,255,0.08)"), rect(32, 7, 32, 7, "rgba(255,255,255,0.08)")
        );
        out = abi.encodePacked(
            out,
            rect(34, 10, 34, 10, "rgba(255,255,255,0.08)"), rect(38, 10, 38, 10, "rgba(255,255,255,0.08)"), rect(36, 8, 36, 8, "rgba(255,255,255,0.08)"), rect(36, 12, 36, 12, "rgba(255,255,255,0.08)"),
            rect(4, 33, 4, 33, "rgba(255,255,255,0.08)"), rect(8, 33, 8, 33, "rgba(255,255,255,0.08)"), rect(6, 31, 6, 31, "rgba(255,255,255,0.08)"), rect(6, 35, 6, 35, "rgba(255,255,255,0.08)")
        );
        out = abi.encodePacked(
            out,
            rect(12, 35, 12, 35, "rgba(255,255,255,0.08)"), rect(16, 35, 16, 35, "rgba(255,255,255,0.08)"), rect(14, 33, 14, 33, "rgba(255,255,255,0.08)"), rect(14, 37, 14, 37, "rgba(255,255,255,0.08)"),
            rect(27, 32, 27, 32, "rgba(255,255,255,0.08)"), rect(31, 32, 31, 32, "rgba(255,255,255,0.08)"), rect(29, 30, 29, 30, "rgba(255,255,255,0.08)"), rect(29, 34, 29, 34, "rgba(255,255,255,0.08)")
        );
        out = abi.encodePacked(
            out,
            rect(33, 27, 33, 27, "rgba(255,255,255,0.08)"), rect(37, 27, 37, 27, "rgba(255,255,255,0.08)"), rect(35, 25, 35, 25, "rgba(255,255,255,0.08)"), rect(35, 29, 35, 29, "rgba(255,255,255,0.08)"),
            rect(0, 20, 0, 20, "rgba(255,255,255,0.08)"), rect(4, 20, 4, 20, "rgba(255,255,255,0.08)"), rect(2, 18, 2, 18, "rgba(255,255,255,0.08)"), rect(2, 22, 2, 22, "rgba(255,255,255,0.08)")
        );
        return abi.encodePacked(
            out,
            rect(36, 22, 36, 22, "rgba(255,255,255,0.08)"), rect(40, 22, 40, 22, "rgba(255,255,255,0.08)"), rect(38, 20, 38, 20, "rgba(255,255,255,0.08)"), rect(38, 24, 38, 24, "rgba(255,255,255,0.08)")
        );
    }

    function dotsFxLayer() internal pure returns (bytes memory) {
        return abi.encodePacked(
            softDot(4, 5, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(8, 11, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(13, 4, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(18, 8, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(25, 4, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(30, 9, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(35, 6, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(6, 29, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(12, 34, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(20, 36, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(28, 33, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)"),
            softDot(34, 29, "rgba(255,255,255,0.24)", "rgba(255,255,255,0.11)", "rgba(255,255,255,0.05)")
        );
    }

    function basePenguinLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            torsoLayer(p),
            torsoBellyLayer(p),
            headLayer(p),
            faceLayer(p)
        );
    }

    function torsoLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            torsoShell(p.body),
            torsoHighlights(p.bodyHighlight),
            torsoShadows(p.bodyShadow)
        );
    }

    function torsoShell(string memory body) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(8, 25, 31, 38, body), rect(7, 26, 32, 37, body), rect(6, 27, 33, 36, body), rect(6, 28, 33, 35, body),
            rect(7, 29, 32, 34, body), rect(8, 30, 31, 33, body), rect(9, 31, 30, 32, body), rect(10, 32, 29, 32, body)
        );
    }

    function torsoHighlights(string memory bodyHighlight) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(10, 26, 29, 27, bodyHighlight), rect(9, 28, 30, 28, bodyHighlight), rect(10, 30, 29, 30, bodyHighlight), rect(11, 32, 28, 32, bodyHighlight)
        );
    }

    function torsoShadows(string memory bodyShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(8, 38, 31, 38, bodyShadow), rect(7, 37, 32, 37, bodyShadow), rect(6, 36, 33, 36, bodyShadow),
            rect(12, 27, 12, 27, bodyShadow), rect(28, 27, 28, 27, bodyShadow),
            rect(10, 29, 10, 29, bodyShadow), rect(30, 29, 30, 29, bodyShadow),
            rect(8, 31, 8, 31, bodyShadow), rect(32, 31, 32, 31, bodyShadow)
        );
    }

    function torsoBellyLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(12, 28, 27, 38, p.belly), rect(11, 29, 28, 37, p.belly), rect(11, 30, 28, 36, p.belly), rect(12, 31, 27, 35, p.belly),
            rect(13, 32, 26, 34, p.belly), rect(14, 33, 25, 34, p.belly), rect(15, 34, 24, 35, p.belly),
            rect(14, 29, 25, 30, p.bellyHighlight), rect(14, 31, 25, 32, p.bellyHighlight), rect(15, 33, 24, 34, p.bellyHighlight),
            rect(15, 35, 15, 35, p.bellyHighlight), rect(24, 35, 24, 35, p.bellyHighlight),
            rect(16, 36, 16, 36, p.bellyHighlight), rect(23, 36, 23, 36, p.bellyHighlight)
        );
    }

    function wingsLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(2, 26, 5, 32, p.body),
            rect(1, 27, 6, 31, p.body),
            rect(2, 28, 5, 30, p.bodyHighlight),
            rect(3, 29, 5, 29, p.bodyHighlight),
            rect(2, 30, 4, 31, p.bodyShadow),
            rect(1, 31, 3, 32, p.bodyShadow),
            rect(1, 30, 3, 33, p.body),
            rect(2, 31, 3, 32, p.bodyHighlight),
            rect(5, 31, 7, 33, p.body),
            rect(6, 32, 7, 33, p.bodyHighlight),
            rect(34, 26, 37, 32, p.body),
            rect(33, 27, 38, 31, p.body),
            rect(34, 28, 37, 30, p.bodyHighlight),
            rect(34, 29, 36, 29, p.bodyHighlight),
            rect(35, 30, 37, 31, p.bodyShadow),
            rect(36, 31, 38, 32, p.bodyShadow),
            rect(36, 30, 38, 33, p.body),
            rect(36, 31, 37, 32, p.bodyHighlight),
            rect(32, 31, 34, 33, p.body),
            rect(32, 32, 33, 33, p.bodyHighlight)
        );
    }

    function headLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            headShell(p.body),
            headHighlights(p.bodyHighlight),
            headShadows(p.bodyShadow)
        );
    }

    function headShell(string memory body) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(10, 8, 29, 26, body), rect(9, 9, 30, 25, body), rect(8, 10, 31, 24, body), rect(8, 11, 31, 23, body),
            rect(9, 12, 30, 22, body), rect(10, 13, 29, 21, body), rect(11, 14, 28, 20, body), rect(12, 15, 27, 19, body),
            rect(13, 16, 26, 18, body), rect(14, 17, 25, 18, body)
        );
    }

    function headHighlights(string memory bodyHighlight) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(12, 9, 27, 10, bodyHighlight), rect(11, 11, 28, 12, bodyHighlight), rect(12, 13, 27, 14, bodyHighlight),
            rect(13, 15, 26, 16, bodyHighlight), rect(14, 17, 25, 17, bodyHighlight)
        );
    }

    function headShadows(string memory bodyShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(10, 26, 29, 26, bodyShadow), rect(9, 25, 30, 25, bodyShadow), rect(8, 24, 31, 24, bodyShadow),
            rect(11, 10, 11, 10, bodyShadow), rect(28, 10, 28, 10, bodyShadow),
            rect(10, 12, 10, 12, bodyShadow), rect(29, 12, 29, 12, bodyShadow),
            rect(10, 14, 10, 14, bodyShadow), rect(29, 14, 29, 14, bodyShadow)
        );
    }

    function faceLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(12, 14, 27, 24, p.belly), rect(11, 15, 28, 23, p.belly), rect(12, 16, 27, 22, p.belly), rect(13, 17, 26, 21, p.belly),
            rect(14, 18, 25, 20, p.belly), rect(15, 19, 24, 20, p.belly),
            rect(14, 15, 25, 16, p.bellyHighlight), rect(14, 17, 25, 18, p.bellyHighlight), rect(15, 19, 24, 20, p.bellyHighlight)
        );
    }

    function eyesLayer(uint8 eyeType) internal pure returns (bytes memory) {
        uint256 cx = 20;
        uint256 eyeY = 17;
        if (eyeType == EightBitPenguinsRendererData.EYE_ROUND) {
            return abi.encodePacked(rect(cx - 4, eyeY, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY, cx + 4, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_ANGRY) {
            return abi.encodePacked(rect(cx - 4, eyeY, cx - 3, eyeY, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx - 3, eyeY, cx - 3, eyeY, "#FF0000"), rect(cx + 3, eyeY, cx + 4, eyeY, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"), rect(cx + 4, eyeY, cx + 4, eyeY, "#FF0000"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_SLEEPY) {
            return abi.encodePacked(rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx - 4, eyeY + 2, cx - 3, eyeY + 2, "#0A0A0A"), rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY + 2, cx + 4, eyeY + 2, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_SPARKLE) {
            return abi.encodePacked(rect(cx - 4, eyeY, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY, cx + 4, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_HAPPY) {
            return abi.encodePacked(rect(cx - 5, eyeY, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY, cx + 5, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_WINK) {
            return abi.encodePacked(rect(cx - 4, eyeY, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY + 1, cx + 4, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_SAD) {
            return abi.encodePacked(rect(cx - 4, eyeY, cx - 3, eyeY, "#0A0A0A"), rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY, cx + 4, eyeY, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_SURPRISED) {
            return abi.encodePacked(rect(cx - 5, eyeY, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx - 4, eyeY, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY, cx + 5, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY, cx + 4, eyeY + 1, "#0A0A0A"));
        }
        if (eyeType == EightBitPenguinsRendererData.EYE_SIDEEYE) {
            return abi.encodePacked(rect(cx - 5, eyeY, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx - 4, eyeY + 1, cx - 3, eyeY + 1, "#0A0A0A"), rect(cx + 3, eyeY, cx + 5, eyeY + 1, "#0A0A0A"), rect(cx + 4, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"));
        }
        return abi.encodePacked(rect(cx - 5, eyeY + 1, cx - 2, eyeY + 1, "#0A0A0A"), rect(cx + 2, eyeY + 1, cx + 5, eyeY + 1, "#0A0A0A"));
    }

    function browsLayer(string memory bodyShadow) internal pure returns (bytes memory) {
        uint256 cx = 20;
        return abi.encodePacked(rect(cx - 7, 14, cx - 3, 14, bodyShadow), rect(cx + 3, 14, cx + 7, 14, bodyShadow), rect(cx - 8, 13, cx - 4, 13, bodyShadow), rect(cx + 4, 13, cx + 8, 13, bodyShadow));
    }

    function beakLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint256 cx = 20;
        if (p.beakType == EightBitPenguinsRendererData.BEAK_SMALL) return abi.encodePacked(rect(cx - 2, 21, cx + 1, 23, p.beak), rect(cx - 1, 20, cx, 22, p.beak), rect(cx - 1, 22, cx, 22, p.beakShadow));
        if (p.beakType == EightBitPenguinsRendererData.BEAK_LARGE) return abi.encodePacked(rect(cx - 3, 20, cx + 2, 23, p.beak), rect(cx - 2, 19, cx + 1, 22, p.beak), rect(cx - 1, 18, cx, 20, p.beak), rect(cx - 2, 23, cx + 1, 23, p.beakShadow));
        if (p.beakType == EightBitPenguinsRendererData.BEAK_WIDE) return abi.encodePacked(rect(cx - 4, 21, cx + 3, 23, p.beak), rect(cx - 3, 20, cx + 2, 24, p.beak), rect(cx - 2, 20, cx + 1, 20, p.beak), rect(cx - 2, 24, cx + 1, 24, p.beakShadow));
        if (p.beakType == EightBitPenguinsRendererData.BEAK_POINTY) return abi.encodePacked(rect(cx - 2, 21, cx + 1, 23, p.beak), rect(cx - 1, 19, cx, 22, p.beak), rect(cx, 18, cx, 20, p.beak), rect(cx - 1, 23, cx, 23, p.beakShadow));
        if (p.beakType == EightBitPenguinsRendererData.BEAK_ROUND) return abi.encodePacked(rect(cx - 3, 21, cx + 2, 23, p.beak), rect(cx - 2, 20, cx + 1, 24, p.beak), rect(cx - 1, 20, cx, 20, p.beak), rect(cx - 2, 24, cx + 1, 24, p.beakShadow));
        return abi.encodePacked(rect(cx - 3, 20, cx + 2, 22, p.beak), rect(cx - 2, 19, cx + 1, 21, p.beakHighlight), rect(cx - 1, 18, cx, 20, p.beakHighlight), rect(cx - 2, 22, cx + 1, 22, p.beakShadow), rect(cx + 1, 21, cx + 2, 21, p.beakShadow));
    }

    function cheeksLayer(string memory cheeks, string memory cheeksHighlight) internal pure returns (bytes memory) {
        uint256 cx = 20;
        return abi.encodePacked(rect(cx - 9, 19, cx - 7, 21, cheeks), rect(cx + 7, 19, cx + 9, 21, cheeks), rect(cx - 8, 20, cx - 7, 20, cheeksHighlight), rect(cx + 7, 20, cx + 8, 20, cheeksHighlight));
    }

    function headAccessoryLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        if (p.headType == EightBitPenguinsRendererData.HEAD_CROWN) return crownLayer(p.headStyle);
        if (p.headType == EightBitPenguinsRendererData.HEAD_BEANIE) return beanieLayer(p);
        if (p.headType == EightBitPenguinsRendererData.HEAD_CAP) return capLayer(p);
        if (p.headType == EightBitPenguinsRendererData.HEAD_SCARF) return scarfLayer(p);
        if (p.headType == EightBitPenguinsRendererData.HEAD_HALO) return haloLayer();
        if (p.headType == EightBitPenguinsRendererData.HEAD_HEADBAND) return headbandLayer(p);
        return "";
    }

    function crownLayer(uint8 headStyle) internal pure returns (bytes memory) {
        uint256 cx = 20;
        if (headStyle == 1) {
            return abi.encodePacked(
                rect(cx - 10, 7, cx + 10, 9, "#C69214"), rect(cx - 9, 6, cx + 9, 7, "#F2C94C"), rect(cx - 10, 9, cx + 10, 9, "#7A5200"),
                rect(cx - 8, 3, cx - 6, 7, "#E5B93A"), rect(cx - 5, 4, cx - 3, 7, "#DCAA2D"), rect(cx - 1, 1, cx + 1, 7, "#F7D55C"), rect(cx + 3, 4, cx + 5, 7, "#DCAA2D"), rect(cx + 6, 3, cx + 8, 7, "#E5B93A"),
                rect(cx - 7, 2, cx - 6, 3, "#FFF3B0"), rect(cx, 0, cx, 2, "#FFF3B0"), rect(cx + 6, 2, cx + 7, 3, "#FFF3B0"),
                rect(cx - 9, 6, cx - 9, 8, "#8A6108"), rect(cx + 9, 6, cx + 9, 8, "#8A6108"), rect(cx - 4, 6, cx - 4, 7, "#8A6108"), rect(cx + 4, 6, cx + 4, 7, "#8A6108"),
                rect(cx - 8, 6, cx + 8, 6, "#FFD76A"), rect(cx - 7, 7, cx - 6, 8, "#B80F2E"), rect(cx - 1, 7, cx, 8, "#0E7EEA"), rect(cx + 5, 7, cx + 6, 8, "#23A455"),
                rect(cx - 2, 5, cx + 2, 6, "#BF8F1A")
            );
        }
        return abi.encodePacked(
            rect(cx - 9, 7, cx + 9, 9, "#CDA349"), rect(cx - 8, 6, cx + 8, 7, "#F6D98A"), rect(cx - 9, 9, cx + 9, 9, "#775314"),
            rect(cx - 7, 4, cx - 5, 7, "#E8C86E"), rect(cx - 3, 3, cx - 1, 7, "#F1D786"), rect(cx + 1, 3, cx + 3, 7, "#F1D786"), rect(cx + 5, 4, cx + 7, 7, "#E8C86E"),
            rect(cx - 6, 2, cx - 5, 3, "#FFF5C8"), rect(cx - 1, 1, cx, 2, "#FFF5C8"), rect(cx + 5, 2, cx + 6, 3, "#FFF5C8"),
            rect(cx - 8, 7, cx - 8, 8, "#8A651F"), rect(cx + 8, 7, cx + 8, 8, "#8A651F"), rect(cx - 4, 6, cx - 4, 8, "#8A651F"), rect(cx + 4, 6, cx + 4, 8, "#8A651F"),
            rect(cx - 8, 6, cx + 8, 6, "#FFE4A0"), rect(cx - 6, 7, cx - 5, 8, "#B80F2E"), rect(cx - 1, 7, cx, 8, "#0E7EEA"), rect(cx + 4, 7, cx + 5, 8, "#23A455"),
            rect(cx - 2, 5, cx + 1, 6, "#B78A2C")
        );
    }

    function beanieLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint256 cx = 20;
        HeadAccessoryShades memory s = headAccessoryShades(p);
        return abi.encodePacked(
            rect(cx - 10, 7, cx + 9, 10, p.head), rect(cx - 9, 5, cx + 8, 7, s.highlight), rect(cx - 7, 3, cx + 6, 6, p.head),
            rect(cx - 4, 2, cx + 3, 3, s.spec), rect(cx - 10, 10, cx + 9, 10, s.shadow), rect(cx - 9, 9, cx + 8, 9, s.fold),
            rect(cx - 8, 8, cx + 7, 8, s.mid), rect(cx - 6, 4, cx - 6, 10, s.mid), rect(cx - 3, 4, cx - 3, 10, s.shadow),
            rect(cx, 4, cx, 10, s.mid), rect(cx + 3, 4, cx + 3, 10, s.shadow), rect(cx + 6, 4, cx + 6, 10, s.mid),
            rect(cx - 5, 6, cx - 5, 8, s.spec), rect(cx + 1, 6, cx + 1, 8, s.spec), rect(cx - 2, 10, cx + 1, 10, s.deep),
            rect(cx - 7, 3, cx - 6, 3, s.spec), rect(cx + 4, 3, cx + 5, 3, s.spec)
        );
    }

    function capLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint256 cx = 20;
        HeadAccessoryShades memory s = headAccessoryShades(p);
        return abi.encodePacked(
            rect(cx - 11, 7, cx + 9, 9, p.head), rect(cx - 10, 6, cx + 8, 7, s.highlight), rect(cx - 8, 5, cx + 5, 6, s.spec),
            rect(cx - 10, 8, cx + 8, 8, s.mid), rect(cx - 10, 9, cx + 8, 9, s.shadow), rect(cx - 2, 8, cx + 5, 8, s.deep),
            rect(cx - 1, 7, cx + 3, 7, s.highlight), rect(cx + 8, 8, cx + 12, 11, s.shadow), rect(cx + 9, 9, cx + 12, 10, p.head),
            rect(cx + 10, 10, cx + 11, 11, s.deep), rect(cx - 12, 8, cx - 8, 9, s.shadow), rect(cx - 11, 9, cx - 10, 10, s.deep),
            rect(cx + 9, 11, cx + 11, 11, "#111111"), rect(cx - 8, 9, cx + 3, 9, s.deep), rect(cx - 7, 6, cx - 6, 7, s.spec),
            rect(cx + 4, 6, cx + 5, 7, s.mid), rect(cx + 8, 10, cx + 10, 11, "#121212")
        );
    }

    function scarfLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint256 cx = 20;
        HeadAccessoryShades memory s = headAccessoryShades(p);
        return abi.encodePacked(
            rect(cx - 10, 25, cx + 10, 28, p.head), rect(cx - 9, 24, cx + 9, 26, s.highlight), rect(cx + 8, 25, cx + 11, 33, p.head),
            rect(cx + 9, 26, cx + 10, 32, s.highlight), rect(cx - 3, 26, cx + 2, 27, s.fold), rect(cx - 2, 27, cx + 1, 28, s.shadow)
        );
    }

    function haloLayer() internal pure returns (bytes memory) {
        uint256 cx = 20;
        return abi.encodePacked(
            rect(cx - 4, 3, cx + 3, 4, "#E8BF2F"), rect(cx - 5, 4, cx + 4, 5, "#D1A91E"), rect(cx - 3, 2, cx + 2, 3, "#FFE27A"),
            rect(cx - 5, 5, cx + 4, 5, "#AD8614"), rect(cx - 2, 2, cx - 1, 2, "#FFF1A3"), rect(cx + 1, 2, cx + 2, 2, "#FFF1A3")
        );
    }

    function headbandLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        HeadAccessoryShades memory s = headAccessoryShades(p);
        return abi.encodePacked(
            path(p.head, "M30 6h1v3h-1zM9 6h1v1H9zM10 7h1v1h-1z"),
            path(s.spec, "M10 5h20v1H10zM10 6h2v1h-2zM14 6h2v1h-2zM18 6h2v1h-2zM22 6h2v1h-2zM26 6h2v1h-2z"),
            path(s.shadow, "M9 9h1v1H9zM11 9h3v1h-3zM15 9h4v1h-4zM21 9h5v1h-5zM27 9h2v1h-2z"),
            path(s.mid, "M10 8h2v1h-2zM15 8h1v1h-1zM18 8h2v1h-2zM27 8h1v1h-1z"),
            path(s.fold, "M11 7h1v1h-1zM14 7h2v1h-2zM18 7h2v1h-2zM26 7h2v1h-2z"),
            path(s.highlight, "M12 6h2v3h-2zM16 6h2v3h-2zM20 6h2v3h-2zM24 6h2v3h-2zM28 6h1v3h-1zM29 6h1v1h-1z"),
            path(s.deep, "M9 7h1v2H9zM22 7h2v2h-2zM29 7h1v2h-1zM14 8h1v2h-1zM26 8h1v2h-1zM10 9h1v1h-1zM19 9h2v1h-2zM29 9h2v1h-2z"),
            path("rgba(0,0,0,0.16)", "M17 10h6v1h-6z")
        );
    }

    function headAccessoryShadowLayer(uint8 headType) internal pure returns (bytes memory) {
        if (headType == EightBitPenguinsRendererData.HEAD_NONE || headType == EightBitPenguinsRendererData.HEAD_SCARF) {
            return "";
        }
        return rect(12, 10, 28, 10, "rgba(0,0,0,0.12)");
    }

    function torsoOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        string memory bodyEdge = deepenHex(p.body);
        string memory bodyShadowEdge = deepenHex(p.bodyShadow);
        return abi.encodePacked(
            rect(10, 8, 29, 8, bodyEdge),
            rect(9, 9, 9, 25, bodyEdge),
            rect(30, 9, 30, 25, bodyEdge),
            rect(8, 10, 8, 24, bodyEdge),
            rect(31, 10, 31, 24, bodyEdge),
            rect(7, 25, 7, 35, bodyEdge),
            rect(32, 25, 32, 35, bodyEdge),
            rect(7, 36, 7, 38, bodyShadowEdge),
            rect(32, 36, 32, 38, bodyShadowEdge),
            rect(8, 38, 31, 38, bodyShadowEdge),
            rect(2, 26, 2, 29, bodyEdge),
            rect(34, 26, 34, 29, bodyEdge),
            rect(1, 27, 1, 30, bodyEdge),
            rect(38, 27, 38, 30, bodyEdge),
            rect(1, 31, 1, 31, bodyShadowEdge),
            rect(38, 31, 38, 31, bodyShadowEdge),
            rect(2, 32, 2, 32, bodyShadowEdge),
            rect(34, 32, 34, 32, bodyShadowEdge)
        );
    }

    function wingsOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        string memory bodyEdge = deepenHex(p.body);
        string memory bodyHighlightEdge = deepenHex(p.bodyHighlight);
        string memory bodyShadowEdge = deepenHex(p.bodyShadow);
        return abi.encodePacked(
            rect(3, 26, 5, 26, bodyEdge),
            rect(2, 27, 2, 29, bodyHighlightEdge),
            rect(1, 27, 1, 30, bodyEdge),
            rect(1, 31, 3, 31, bodyShadowEdge),
            rect(2, 32, 3, 32, bodyHighlightEdge),
            rect(4, 32, 4, 32, bodyShadowEdge),
            rect(5, 31, 7, 31, bodyEdge),
            rect(6, 32, 7, 33, bodyHighlightEdge),
            rect(34, 26, 36, 26, bodyEdge),
            rect(37, 27, 37, 29, bodyHighlightEdge),
            rect(38, 27, 38, 30, bodyEdge),
            rect(35, 31, 37, 31, bodyShadowEdge),
            rect(36, 32, 37, 32, bodyHighlightEdge),
            rect(35, 32, 35, 32, bodyShadowEdge),
            rect(32, 31, 34, 31, bodyEdge),
            rect(32, 32, 33, 33, bodyHighlightEdge)
        );
    }

    function beakCheeksOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        return abi.encodePacked(
            beakOutlineLayer(p),
            cheeksOutlineLayer(p)
        );
    }

    function bellyOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        string memory bellyEdge = deepenHex(p.belly);
        return abi.encodePacked(
            rect(12, 14, 27, 14, bellyEdge),
            rect(11, 15, 11, 23, bellyEdge),
            rect(28, 15, 28, 23, bellyEdge),
            rect(12, 24, 27, 24, bellyEdge),
            rect(12, 25, 27, 25, bellyEdge),
            rect(12, 26, 12, 38, bellyEdge),
            rect(27, 26, 27, 38, bellyEdge),
            rect(13, 38, 26, 38, bellyEdge)
        );
    }

    function beakOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint256 cx = 20;
        string memory beakEdge = deepenHex(p.beak);
        string memory beakHighlightEdge = deepenHex(p.beakHighlight);
        string memory beakShadowEdge = deepenHex(p.beakShadow);
        if (p.beakType == EightBitPenguinsRendererData.BEAK_SMALL) {
            return abi.encodePacked(
                rect(cx - 1, 20, cx, 20, beakEdge),
                rect(cx - 2, 21, cx - 2, 23, beakEdge),
                rect(cx + 1, 21, cx + 1, 23, beakEdge),
                rect(cx - 1, 23, cx, 23, beakShadowEdge)
            );
        }
        if (p.beakType == EightBitPenguinsRendererData.BEAK_LARGE) {
            return abi.encodePacked(
                rect(cx - 1, 18, cx, 18, beakEdge),
                rect(cx - 2, 19, cx - 2, 23, beakEdge),
                rect(cx + 1, 19, cx + 1, 23, beakEdge),
                rect(cx - 1, 23, cx, 23, beakShadowEdge)
            );
        }
        if (p.beakType == EightBitPenguinsRendererData.BEAK_WIDE) {
            return abi.encodePacked(
                rect(cx - 2, 20, cx + 1, 20, beakEdge),
                rect(cx - 3, 21, cx - 3, 23, beakEdge),
                rect(cx + 3, 21, cx + 3, 23, beakEdge),
                rect(cx - 2, 24, cx + 1, 24, beakShadowEdge)
            );
        }
        if (p.beakType == EightBitPenguinsRendererData.BEAK_POINTY) {
            return abi.encodePacked(
                rect(cx, 18, cx, 18, beakEdge),
                rect(cx - 1, 19, cx - 1, 23, beakEdge),
                rect(cx + 1, 21, cx + 1, 23, beakEdge),
                rect(cx, 23, cx, 23, beakShadowEdge)
            );
        }
        if (p.beakType == EightBitPenguinsRendererData.BEAK_ROUND) {
            return abi.encodePacked(
                rect(cx - 1, 20, cx, 20, beakEdge),
                rect(cx - 2, 21, cx - 2, 24, beakEdge),
                rect(cx + 1, 21, cx + 1, 24, beakEdge),
                rect(cx - 1, 24, cx, 24, beakShadowEdge)
            );
        }
        return abi.encodePacked(
            rect(cx - 1, 18, cx, 18, beakHighlightEdge),
            rect(cx - 2, 19, cx - 2, 22, beakHighlightEdge),
            rect(cx + 1, 20, cx + 2, 20, beakShadowEdge),
            rect(cx + 2, 21, cx + 2, 21, beakShadowEdge),
            rect(cx - 1, 22, cx, 22, beakShadowEdge)
        );
    }

    function cheeksOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        string memory cheeksEdge = deepenHex(p.cheeks);
        uint256 cx = 20;
        return abi.encodePacked(
            rect(cx - 9, 19, cx - 7, 19, cheeksEdge),
            rect(cx - 9, 20, cx - 9, 21, cheeksEdge),
            rect(cx - 7, 20, cx - 7, 21, cheeksEdge),
            rect(cx - 8, 21, cx - 8, 21, cheeksEdge),
            rect(cx + 7, 19, cx + 9, 19, cheeksEdge),
            rect(cx + 7, 20, cx + 7, 21, cheeksEdge),
            rect(cx + 9, 20, cx + 9, 21, cheeksEdge),
            rect(cx + 8, 21, cx + 8, 21, cheeksEdge)
        );
    }

    function headAccessoryOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        uint8 headType = p.headType;
        uint256 cx = 20;
        string memory headEdge = deepenHex(p.head);
        string memory headHighlightEdge = deepenHex(p.headHighlight);
        string memory headShadowEdge = deepenHex(p.headShadow);
        if (headType == EightBitPenguinsRendererData.HEAD_SCARF) {
            return abi.encodePacked(
                rect(cx - 10, 25, cx + 7, 25, headEdge),
                rect(cx + 8, 25, cx + 10, 25, headHighlightEdge),
                rect(cx - 10, 26, cx - 10, 28, headEdge),
                rect(cx + 10, 26, cx + 10, 32, headHighlightEdge),
                rect(cx + 8, 33, cx + 11, 33, headEdge),
                rect(cx + 11, 25, cx + 11, 33, headEdge),
                rect(cx - 2, 27, cx + 1, 28, headShadowEdge)
            );
        }
        if (headType == EightBitPenguinsRendererData.HEAD_CAP) {
            return abi.encodePacked(
                rect(cx - 11, 7, cx - 2, 7, headEdge),
                rect(cx - 1, 7, cx + 3, 7, headHighlightEdge),
                rect(cx + 4, 7, cx + 9, 7, headEdge),
                rect(cx - 11, 8, cx - 11, 9, headEdge),
                rect(cx + 9, 8, cx + 9, 9, headEdge),
                rect(cx + 12, 8, cx + 12, 11, headShadowEdge),
                rect(cx - 12, 8, cx - 12, 9, headShadowEdge)
            );
        }
        if (headType == EightBitPenguinsRendererData.HEAD_BEANIE) {
            return abi.encodePacked(
                rect(cx - 7, 3, cx - 5, 3, headHighlightEdge),
                rect(cx - 4, 3, cx + 3, 3, deepenHex("#FFFFFF")),
                rect(cx + 4, 3, cx + 6, 3, headHighlightEdge),
                rect(cx - 9, 5, cx - 9, 10, headHighlightEdge),
                rect(cx + 8, 5, cx + 8, 10, headHighlightEdge),
                rect(cx - 10, 10, cx - 3, 10, headShadowEdge),
                rect(cx - 2, 10, cx + 1, 10, headShadowEdge),
                rect(cx + 2, 10, cx + 9, 10, headShadowEdge)
            );
        }
        if (headType == EightBitPenguinsRendererData.HEAD_HEADBAND) {
            return abi.encodePacked(
                rect(cx - 11, 6, cx - 3, 6, headEdge),
                rect(cx - 2, 6, cx + 1, 6, headHighlightEdge),
                rect(cx + 2, 6, cx + 10, 6, headEdge),
                rect(cx - 11, 7, cx - 11, 9, headShadowEdge),
                rect(cx + 10, 7, cx + 10, 9, headShadowEdge),
                rect(cx - 11, 9, cx + 10, 9, headShadowEdge)
            );
        }
        return "";
    }

    function feetOutlineLayer(EightBitPenguinsRendererData.Palette memory p) internal pure returns (bytes memory) {
        string memory feetEdge = deepenHex(p.feet);
        string memory feetHighlightEdge = deepenHex(p.feetHighlight);
        string memory feetShadowEdge = deepenHex(p.feetShadow);
        return abi.encodePacked(
            rect(11, 35, 13, 35, feetHighlightEdge),
            rect(10, 36, 10, 36, feetEdge),
            rect(14, 36, 14, 36, feetEdge),
            rect(9, 37, 9, 37, feetEdge),
            rect(15, 37, 15, 37, feetEdge),
            rect(8, 38, 8, 38, feetEdge),
            rect(9, 38, 10, 38, feetHighlightEdge),
            rect(12, 38, 13, 38, feetHighlightEdge),
            rect(14, 38, 14, 38, feetEdge),
            rect(26, 35, 28, 35, feetHighlightEdge),
            rect(25, 36, 25, 36, feetEdge),
            rect(29, 36, 29, 36, feetEdge),
            rect(24, 37, 24, 37, feetEdge),
            rect(30, 37, 30, 37, feetEdge),
            rect(25, 38, 25, 38, feetEdge),
            rect(26, 38, 27, 38, feetHighlightEdge),
            rect(29, 38, 30, 38, feetHighlightEdge),
            rect(31, 38, 31, 38, feetEdge),
            rect(11, 37, 14, 37, feetShadowEdge),
            rect(25, 37, 28, 37, feetShadowEdge)
        );
    }

    function feetLayer(string memory feet, string memory feetHighlight, string memory feetShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            leftFootLayer(feet, feetHighlight, feetShadow),
            rightFootLayer(feet, feetHighlight, feetShadow)
        );
    }

    function leftFootLayer(string memory feet, string memory feetHighlight, string memory feetShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(10, 36, 14, 37, feet), rect(9, 37, 15, 37, feet), rect(11, 35, 13, 36, feetHighlight), rect(11, 37, 14, 37, feetShadow),
            rect(12, 37, 14, 38, feet), rect(12, 37, 13, 38, feetHighlight), rect(8, 37, 10, 38, feet), rect(9, 38, 10, 38, feetHighlight)
        );
    }

    function rightFootLayer(string memory feet, string memory feetHighlight, string memory feetShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rightFootUpper(feet, feetHighlight, feetShadow),
            rightFootLower(feet, feetHighlight)
        );
    }

    function rightFootUpper(string memory feet, string memory feetHighlight, string memory feetShadow) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(25, 36, 29, 37, feet), rect(24, 37, 30, 37, feet), rect(26, 35, 28, 36, feetHighlight), rect(25, 37, 28, 37, feetShadow),
            rect(25, 37, 27, 38, feet), rect(26, 37, 27, 38, feetHighlight), rect(29, 37, 31, 38, feet)
        );
    }

    function rightFootLower(string memory /* feet */, string memory feetHighlight) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(29, 38, 30, 38, feetHighlight)
        );
    }

    function groundShadowLayer() internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(7, 39, 32, 39, "rgba(0,0,0,0.08)"),
            rect(9, 39, 30, 39, "rgba(0,0,0,0.14)"),
            rect(11, 39, 28, 39, "rgba(0,0,0,0.20)"),
            rect(14, 39, 25, 39, "rgba(0,0,0,0.12)")
        );
    }

    function rect(uint256 x1, uint256 y1, uint256 x2, uint256 y2, string memory fill) internal pure returns (bytes memory) {
        return abi.encodePacked('<rect x="', x1.toString(), '" y="', y1.toString(), '" width="', (x2 - x1 + 1).toString(), '" height="', (y2 - y1 + 1).toString(), '" fill="', fill, '"/>');
    }

    function path(string memory fill, string memory d) internal pure returns (bytes memory) {
        return abi.encodePacked('<path fill="', fill, '" d="', d, '"/>');
    }

    function softDot(uint256 x, uint256 y, string memory core, string memory mid, string memory outer) internal pure returns (bytes memory) {
        return abi.encodePacked(
            rect(x, y, x, y, core),
            rect(x - 1, y, x - 1, y, mid),
            rect(x + 1, y, x + 1, y, mid),
            rect(x, y - 1, x, y - 1, mid),
            rect(x, y + 1, x, y + 1, mid),
            rect(x - 1, y - 1, x - 1, y - 1, outer),
            rect(x + 1, y - 1, x + 1, y - 1, outer),
            rect(x - 1, y + 1, x - 1, y + 1, outer),
            rect(x + 1, y + 1, x + 1, y + 1, outer)
        );
    }

    function headAccessoryShades(EightBitPenguinsRendererData.Palette memory p) internal pure returns (HeadAccessoryShades memory s) {
        s.highlight = p.headHighlight;
        s.shadow = p.headShadow;

        if (p.headType == EightBitPenguinsRendererData.HEAD_BEANIE) {
            s.spec = mixHex(p.headHighlight, "#FFFFFF", 40);
            s.mid = mixHex(p.head, p.headShadow, 24);
            s.deep = mixHex(p.headShadow, "#000000", 8);
            s.fold = mixHex(p.head, p.headShadow, 10);
            return s;
        }

        if (p.headType == EightBitPenguinsRendererData.HEAD_CAP) {
            s.spec = mixHex(p.headHighlight, "#FFFFFF", 36);
            s.mid = mixHex(p.head, p.headShadow, 26);
            s.deep = mixHex(p.headShadow, "#000000", 10);
            s.fold = mixHex(p.head, p.headShadow, 12);
            return s;
        }

        if (p.headType == EightBitPenguinsRendererData.HEAD_SCARF) {
            s.spec = mixHex(p.headHighlight, "#FFFFFF", 32);
            s.mid = mixHex(p.head, p.headShadow, 20);
            s.deep = mixHex(p.headShadow, "#000000", 6);
            s.fold = mixHex(p.head, p.headShadow, 8);
            return s;
        }

        if (p.headType == EightBitPenguinsRendererData.HEAD_HEADBAND) {
            s.spec = mixHex(p.headHighlight, "#FFFFFF", 38);
            s.mid = mixHex(p.head, p.headShadow, 20);
            s.deep = mixHex(p.headShadow, "#000000", 7);
            s.fold = mixHex(p.head, p.headShadow, 8);
            return s;
        }

        s.spec = mixHex(p.headHighlight, "#FFFFFF", 40);
        s.mid = mixHex(p.head, p.headShadow, 28);
        s.deep = mixHex(p.headShadow, "#000000", 12);
        s.fold = mixHex(p.head, p.headShadow, 12);
    }

    function mixHex(string memory a, string memory b, uint256 percentB) internal pure returns (string memory) {
        bytes memory valueA = bytes(a);
        bytes memory valueB = bytes(b);
        if (valueA.length != 7 || valueB.length != 7 || valueA[0] != "#" || valueB[0] != "#") {
            return a;
        }

        uint8 ar = (fromHexChar(uint8(valueA[1])) * 16 + fromHexChar(uint8(valueA[2])));
        uint8 ag = (fromHexChar(uint8(valueA[3])) * 16 + fromHexChar(uint8(valueA[4])));
        uint8 ab = (fromHexChar(uint8(valueA[5])) * 16 + fromHexChar(uint8(valueA[6])));
        uint8 br = (fromHexChar(uint8(valueB[1])) * 16 + fromHexChar(uint8(valueB[2])));
        uint8 bg = (fromHexChar(uint8(valueB[3])) * 16 + fromHexChar(uint8(valueB[4])));
        uint8 bb = (fromHexChar(uint8(valueB[5])) * 16 + fromHexChar(uint8(valueB[6])));

        bytes memory out = new bytes(7);
        out[0] = "#";
        writeHexByte(out, 1, uint8((uint256(ar) * (100 - percentB) + uint256(br) * percentB + 50) / 100));
        writeHexByte(out, 3, uint8((uint256(ag) * (100 - percentB) + uint256(bg) * percentB + 50) / 100));
        writeHexByte(out, 5, uint8((uint256(ab) * (100 - percentB) + uint256(bb) * percentB + 50) / 100));
        return string(out);
    }

    function deepenHex(string memory color) internal pure returns (string memory) {
        bytes memory value = bytes(color);
        if (value.length != 7 || value[0] != "#") {
            return color;
        }

        uint8 r = (fromHexChar(uint8(value[1])) * 16 + fromHexChar(uint8(value[2])));
        uint8 g = (fromHexChar(uint8(value[3])) * 16 + fromHexChar(uint8(value[4])));
        uint8 b = (fromHexChar(uint8(value[5])) * 16 + fromHexChar(uint8(value[6])));

        bytes memory out = new bytes(7);
        out[0] = "#";
        writeHexByte(out, 1, uint8((uint16(r) * 9) / 10));
        writeHexByte(out, 3, uint8((uint16(g) * 9) / 10));
        writeHexByte(out, 5, uint8((uint16(b) * 9) / 10));
        return string(out);
    }

    function fromHexChar(uint8 c) private pure returns (uint8) {
        if (c >= 48 && c <= 57) return c - 48;
        if (c >= 65 && c <= 70) return c - 55;
        if (c >= 97 && c <= 102) return c - 87;
        revert();
    }

    function writeHexByte(bytes memory out, uint256 offset, uint8 value) private pure {
        out[offset] = toHexChar(value >> 4);
        out[offset + 1] = toHexChar(value & 0x0f);
    }

    function toHexChar(uint8 nibble) private pure returns (bytes1) {
        return bytes1(nibble + (nibble < 10 ? 48 : 87));
    }

}
