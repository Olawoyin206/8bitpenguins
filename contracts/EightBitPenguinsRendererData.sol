// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

library EightBitPenguinsRendererData {
    struct Palette {
        string background;
        string backgroundFx;
        string body;
        string bodyHighlight;
        string bodyShadow;
        string belly;
        string bellyHighlight;
        string bellyShadow;
        string beak;
        string beakHighlight;
        string beakShadow;
        string head;
        string headHighlight;
        string headShadow;
        string feet;
        string feetHighlight;
        string feetShadow;
        string cheeks;
        string cheeksHighlight;
        uint8 beakType;
        uint8 eyeType;
        uint8 headType;
        uint8 headStyle;
    }

    uint8 internal constant EYE_ROUND = 0;
    uint8 internal constant EYE_HAPPY = 1;
    uint8 internal constant EYE_SAD = 2;
    uint8 internal constant EYE_ANGRY = 3;
    uint8 internal constant EYE_SLEEPY = 4;
    uint8 internal constant EYE_SURPRISED = 5;
    uint8 internal constant EYE_WINK = 6;
    uint8 internal constant EYE_SIDEEYE = 7;
    uint8 internal constant EYE_CLOSED = 8;
    uint8 internal constant EYE_SPARKLE = 9;

    uint8 internal constant BEAK_SMALL = 0;
    uint8 internal constant BEAK_LARGE = 1;
    uint8 internal constant BEAK_WIDE = 2;
    uint8 internal constant BEAK_POINTY = 3;
    uint8 internal constant BEAK_ROUND = 4;
    uint8 internal constant BEAK_PUFFY = 5;

    uint8 internal constant HEAD_NONE = 0;
    uint8 internal constant HEAD_CAP = 1;
    uint8 internal constant HEAD_BEANIE = 2;
    uint8 internal constant HEAD_SCARF = 3;
    uint8 internal constant HEAD_HEADBAND = 4;
    uint8 internal constant HEAD_CROWN = 5;
    uint8 internal constant HEAD_HALO = 6;

    uint8 internal constant FX_NONE = 0;
    uint8 internal constant FX_SNOW = 1;
    uint8 internal constant FX_DOTS = 2;

    function packedAttributesJson(uint256 packed) internal pure returns (string memory) {
        uint8 backgroundIndex = uint8(packed & 31);
        uint8 bodyIndex = uint8((packed >> 5) & 31);
        uint8 bellyIndex = uint8((packed >> 10) & 7);
        uint8 beakIndex = uint8((packed >> 13) & 7);
        uint8 eyesIndex = uint8((packed >> 16) & 15);
        uint8 headIndex = uint8((packed >> 20) & 31);
        uint8 feetIndex = uint8((packed >> 25) & 3);
        string memory generatedName = packedName(packed);
        string memory effect = effectValueFromBackground(backgroundIndex);

        if (bytes(effect).length > 0) {
            return string(
                abi.encodePacked(
                    '[{"trait_type":"Name","value":"', generatedName,
                    '"},{"trait_type":"Background","value":"', backgroundName(backgroundIndex),
                    '"},{"trait_type":"Effect","value":"', effect,
                    '"},{"trait_type":"Body","value":"', bodyName(bodyIndex),
                    '"},{"trait_type":"Belly","value":"', bellyName(bellyIndex),
                    '"},{"trait_type":"Beak","value":"', beakName(beakIndex),
                    '"},{"trait_type":"Eyes","value":"', eyesName(eyesIndex),
                    '"},{"trait_type":"Head","value":"', headName(headIndex),
                    '"},{"trait_type":"Feet","value":"', feetName(feetIndex),
                    '"}]'
                )
            );
        }

        return string(
            abi.encodePacked(
                '[{"trait_type":"Name","value":"', generatedName,
                '"},{"trait_type":"Background","value":"', backgroundName(backgroundIndex),
                '"},{"trait_type":"Body","value":"', bodyName(bodyIndex),
                '"},{"trait_type":"Belly","value":"', bellyName(bellyIndex),
                '"},{"trait_type":"Beak","value":"', beakName(beakIndex),
                '"},{"trait_type":"Eyes","value":"', eyesName(eyesIndex),
                '"},{"trait_type":"Head","value":"', headName(headIndex),
                '"},{"trait_type":"Feet","value":"', feetName(feetIndex),
                '"}]'
            )
        );
    }

    function packedName(uint256 packed) internal pure returns (string memory) {
        uint256 roll = uint256(keccak256(abi.encodePacked("8BIT_PENGUIN_NAME", packed))) % 208;
        if (roll < 32) return "Frosty";
        if (roll < 64) return "Waddles";
        if (roll < 96) return "Pebble";
        if (roll < 128) return "Chilly";
        if (roll < 160) return "Snowy";
        if (roll < 176) return "Flurry";
        if (roll < 192) return "Icee";
        if (roll < 199) return "Bubbles";
        if (roll < 206) return "Nippy";
        return "Tuxy";
    }

    function rarityScoreFromPacked(uint256 packed) internal pure returns (uint256) {
        uint8 backgroundIndex = uint8(packed & 31);
        uint8 bodyIndex = uint8((packed >> 5) & 31);
        uint8 bellyIndex = uint8((packed >> 10) & 7);
        uint8 beakIndex = uint8((packed >> 13) & 7);
        uint8 eyesIndex = uint8((packed >> 16) & 15);
        uint8 headIndex = uint8((packed >> 20) & 31);
        uint8 feetIndex = uint8((packed >> 25) & 3);

        return
            backgroundScore(backgroundIndex) +
            bodyScore(bodyIndex) +
            bellyScore(bellyIndex) +
            beakScore(beakIndex) +
            eyesScore(eyesIndex) +
            headScore(headIndex) +
            feetScore(feetIndex);
    }

    function paletteFromPacked(uint256 packed) internal pure returns (Palette memory p) {
        uint8 backgroundIndex = uint8(packed & 31);
        uint8 bodyIndex = uint8((packed >> 5) & 31);
        uint8 bellyIndex = uint8((packed >> 10) & 7);
        uint8 beakIndex = uint8((packed >> 13) & 7);
        uint8 eyesIndex = uint8((packed >> 16) & 15);
        uint8 headIndex = uint8((packed >> 20) & 31);
        uint8 feetIndex = uint8((packed >> 25) & 3);

        _applyBackground(p, backgroundIndex);
        _applyBody(p, bodyIndex);
        _applyBelly(p, bellyIndex);
        _applyBeak(p, beakIndex);
        p.eyeType = eyes(eyesIndex);
        _applyHead(p, headIndex);
        _applyFeet(p, feetIndex);
        p.cheeks = "#FFB6C1";
        p.cheeksHighlight = "#FFC5CD";
    }

    function _applyBackground(Palette memory p, uint8 index) private pure {
        (p.background, p.backgroundFx) = background(index);
    }

    function _applyBody(Palette memory p, uint8 index) private pure {
        (p.body, p.bodyHighlight, p.bodyShadow) = body(index);
    }

    function _applyBelly(Palette memory p, uint8 index) private pure {
        (p.belly, p.bellyHighlight, p.bellyShadow) = belly(index);
    }

    function _applyBeak(Palette memory p, uint8 index) private pure {
        (p.beak, p.beakHighlight, p.beakShadow, p.beakType) = beak(index);
    }

    function _applyHead(Palette memory p, uint8 index) private pure {
        (p.head, p.headHighlight, p.headShadow, p.headType, p.headStyle) = head(index);
    }

    function _applyFeet(Palette memory p, uint8 index) private pure {
        (p.feet, p.feetHighlight, p.feetShadow) = feet(index);
    }

    function background(uint8 index) internal pure returns (string memory fill, string memory fx) {
        if (index == 0) return ("#ADD8E6", fxName(FX_NONE));
        if (index == 1) return ("#F4A6B8", fxName(FX_NONE));
        if (index == 2) return ("#87CEEB", fxName(FX_NONE));
        if (index == 3) return ("#DDE8F8", fxName(FX_SNOW));
        if (index == 4) return ("#C8B6FF", fxName(FX_NONE));
        if (index == 5) return ("#98FFCC", fxName(FX_NONE));
        if (index == 6) return ("#FFD1DC", fxName(FX_NONE));
        if (index == 7) return ("#4169E1", fxName(FX_DOTS));
        if (index == 8) return ("#FFE5B4", fxName(FX_NONE));
        if (index == 9) return ("#D8B4F8", fxName(FX_NONE));
        if (index == 10) return ("#F5F5DC", fxName(FX_NONE));
        if (index == 11) return ("#FF6B6B", fxName(FX_NONE));
        if (index == 12) return ("#1A1A2E", fxName(FX_SNOW));
        if (index == 13) return ("#FF7A18", fxName(FX_NONE));
        if (index == 14) return ("#0F4C5C", fxName(FX_DOTS));
        if (index == 15) return ("#2E8B57", fxName(FX_NONE));
        if (index == 16) return ("#36454F", fxName(FX_NONE));
        if (index == 17) return ("#F5FF3B", fxName(FX_NONE));
        if (index == 18) return ("#00FFFF", fxName(FX_NONE));
        if (index == 19) return ("#FFD700", fxName(FX_DOTS));
        return ("#DC143C", fxName(FX_NONE));
    }

    function body(uint8 index) internal pure returns (string memory base, string memory highlight, string memory shadow) {
        if (index == 0) return ("#D6CCB8", "#E8E2D4", "#9F8B7D");
        if (index == 1) return ("#F5F5F5", "#FFFFFF", "#C2C2C2");
        if (index == 2) return ("#1C1C1C", "#484848", "#000000");
        if (index == 3) return ("#B2B2B2", "#D9D9D9", "#858585");
        if (index == 4) return ("#FFF3D6", "#FFFFEB", "#CCC2A3");
        if (index == 5) return ("#C68642", "#E0A86A", "#8E5C2B");
        if (index == 6) return ("#5C3A21", "#8A6145", "#3A2514");
        if (index == 7) return ("#D2A679", "#E8C9A4", "#9E7856");
        if (index == 8) return ("#CFE9FF", "#F0F8FF", "#9FBFCD");
        if (index == 9) return ("#A7C7E7", "#D4E9F5", "#7A96B0");
        if (index == 10) return ("#2B6CB0", "#5A9AD4", "#1D4D7E");
        if (index == 11) return ("#F4A6B8", "#FAD2DD", "#B77A8B");
        if (index == 12) return ("#FF77AA", "#FFA5CC", "#CC4F7D");
        if (index == 13) return ("#BFA2DB", "#D9C9EB", "#8F76A4");
        if (index == 14) return ("#6B3FA0", "#9670BF", "#4D2A75");
        if (index == 15) return ("#A8E6CF", "#D4F5E8", "#7DB39C");
        if (index == 16) return ("#708238", "#96A65C", "#515D27");
        if (index == 17) return ("#FF8C69", "#FFB49B", "#CC634A");
        if (index == 18) return ("#E6B422", "#F0CC57", "#B38618");
        return ("#E0FFFF", "#F0FFFF", "#A8C8C8");
    }

    function belly(uint8 index) internal pure returns (string memory base, string memory highlight, string memory shadow) {
        if (index == 0) return ("#FDF5E6", "#FFFAF0", "#F5E6D3");
        if (index == 1) return ("#FFDAB9", "#FFE4C4", "#F5CBA7");
        if (index == 2) return ("#D6EAF8", "#EBF5FB", "#AED6F1");
        if (index == 3) return ("#D5F5E3", "#E8F8F5", "#ABEBC6");
        return ("#E8DAEF", "#F4ECF7", "#D2B4DE");
    }

    function beak(uint8 index) internal pure returns (string memory base, string memory highlight, string memory shadow, uint8 beakType) {
        if (index == 0) return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_SMALL);
        if (index == 1) return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_LARGE);
        if (index == 2) return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_WIDE);
        if (index == 3) return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_POINTY);
        if (index == 4) return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_ROUND);
        return ("#FF9F43", "#FFBE76", "#E67E22", BEAK_PUFFY);
    }

    function eyes(uint8 index) internal pure returns (uint8 eyeType) {
        if (index <= EYE_SPARKLE) return index;
        return EYE_ROUND;
    }

    function head(uint8 index) internal pure returns (string memory color, string memory highlight, string memory shadow, uint8 headType, uint8 headStyle) {
        if (index == 0) return ("#404040", "#6E6E6E", "#202020", HEAD_NONE, 0);
        if (index == 1) return ("#FFD700", "#FFE44D", "#CCAC00", HEAD_CAP, 0);
        if (index == 2) return ("#2B2B2B", "#545454", "#141414", HEAD_CAP, 0);
        if (index == 3) return ("#0F52BA", "#3D71D1", "#0A3A8C", HEAD_CAP, 0);
        if (index == 4) return ("#DC143C", "#E54767", "#A00F2C", HEAD_CAP, 0);
        if (index == 5) return ("#FAD02E", "#FFE170", "#C9A823", HEAD_CAP, 0);
        if (index == 6) return ("#FFD700", "#FFE44D", "#CCAC00", HEAD_BEANIE, 0);
        if (index == 7) return ("#2B2B2B", "#545454", "#141414", HEAD_BEANIE, 0);
        if (index == 8) return ("#0F52BA", "#3D71D1", "#0A3A8C", HEAD_BEANIE, 0);
        if (index == 9) return ("#DC143C", "#E54767", "#A00F2C", HEAD_BEANIE, 0);
        if (index == 10) return ("#FAD02E", "#FFE170", "#C9A823", HEAD_BEANIE, 0);
        if (index == 11) return ("#FFD700", "#FFE44D", "#CCAC00", HEAD_SCARF, 0);
        if (index == 12) return ("#2B2B2B", "#545454", "#141414", HEAD_SCARF, 0);
        if (index == 13) return ("#0F52BA", "#3D71D1", "#0A3A8C", HEAD_SCARF, 0);
        if (index == 14) return ("#DC143C", "#E54767", "#A00F2C", HEAD_SCARF, 0);
        if (index == 15) return ("#FAD02E", "#FFE170", "#C9A823", HEAD_SCARF, 0);
        if (index == 16) return ("#FFD700", "#FFE44D", "#CCAC00", HEAD_HEADBAND, 0);
        if (index == 17) return ("#2B2B2B", "#545454", "#141414", HEAD_HEADBAND, 0);
        if (index == 18) return ("#0F52BA", "#3D71D1", "#0A3A8C", HEAD_HEADBAND, 0);
        if (index == 19) return ("#DC143C", "#E54767", "#A00F2C", HEAD_HEADBAND, 0);
        if (index == 20) return ("#FAD02E", "#FFE170", "#C9A823", HEAD_HEADBAND, 0);
        if (index == 21) return ("#C69214", "#F2C94C", "#7A5200", HEAD_CROWN, 0);
        if (index == 22) return ("#CDA349", "#F6D98A", "#775314", HEAD_CROWN, 1);
        return ("#E8BF2F", "#FFE27A", "#D1A91E", HEAD_HALO, 0);
    }

    function feet(uint8 index) internal pure returns (string memory base, string memory highlight, string memory shadow) {
        if (index == 0) return ("#FF9F43", "#FFBE76", "#E67E22");
        if (index == 1) return ("#FD79A8", "#FDCBDF", "#E84393");
        if (index == 2) return ("#2D3436", "#636E72", "#0D1318");
        return ("#DFE6E9", "#FFFFFF", "#B2BEC3");
    }

    function fxName(uint8 fxType) internal pure returns (string memory) {
        if (fxType == FX_SNOW) return "snow";
        if (fxType == FX_DOTS) return "dots";
        return "";
    }

    function effectValueFromBackground(uint8 index) internal pure returns (string memory) {
        if (index == 3 || index == 12) return "Snow (White)";
        if (index == 7 || index == 14 || index == 19) return "Stone (White)";
        return "";
    }

    function backgroundName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Light Blue";
        if (index == 1) return "Baby Pink";
        if (index == 2) return "Sky Blue";
        if (index == 3) return "Arctic White";
        if (index == 4) return "Soft Lavender";
        if (index == 5) return "Mint Green";
        if (index == 6) return "Pastel Pink";
        if (index == 7) return "Royal Blue";
        if (index == 8) return "Peach Cream";
        if (index == 9) return "Lilac Purple";
        if (index == 10) return "Warm Beige";
        if (index == 11) return "Coral Red";
        if (index == 12) return "Midnight Blue";
        if (index == 13) return "Sunset Orange";
        if (index == 14) return "Deep Teal";
        if (index == 15) return "Forest Green";
        if (index == 16) return "Charcoal Gray";
        if (index == 17) return "Neon Yellow";
        if (index == 18) return "Electric Cyan";
        if (index == 19) return "Golden Glow";
        return "Crimson Red";
    }

    function bodyName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Skeleton Dark Bone";
        if (index == 1) return "Snow White";
        if (index == 2) return "Jet Black";
        if (index == 3) return "Ash Gray";
        if (index == 4) return "Cream";
        if (index == 5) return "Light Brown";
        if (index == 6) return "Chocolate Brown";
        if (index == 7) return "Golden Tan";
        if (index == 8) return "Ice Blue";
        if (index == 9) return "Baby Blue";
        if (index == 10) return "Ocean Blue";
        if (index == 11) return "Soft Pink";
        if (index == 12) return "Bubblegum Pink";
        if (index == 13) return "Lavender Body";
        if (index == 14) return "Royal Purple";
        if (index == 15) return "Mint Body";
        if (index == 16) return "Olive Green";
        if (index == 17) return "Coral Body";
        if (index == 18) return "Sunset Gold";
        return "Glass Style";
    }

    function bellyName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Cream";
        if (index == 1) return "Peach";
        if (index == 2) return "Light Blue";
        if (index == 3) return "Mint";
        return "Lavender";
    }

    function beakName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Small";
        if (index == 1) return "Large";
        if (index == 2) return "Wide";
        if (index == 3) return "Pointy";
        if (index == 4) return "Round";
        return "Puffy";
    }

    function eyesName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Normal";
        if (index == 1) return "Happy";
        if (index == 2) return "Sad";
        if (index == 3) return "Angry";
        if (index == 4) return "Sleepy";
        if (index == 5) return "Surprised";
        if (index == 6) return "Wink";
        if (index == 7) return "Side-eye";
        if (index == 8) return "Closed";
        return "Sparkle";
    }

    function headName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "None";
        if (index == 1) return "Cap Gold";
        if (index == 2) return "Cap Matte Black";
        if (index == 3) return "Cap Sapphire Blue";
        if (index == 4) return "Cap Crimson";
        if (index == 5) return "Cap Royal Gold";
        if (index == 6) return "Beanie Gold";
        if (index == 7) return "Beanie Matte Black";
        if (index == 8) return "Beanie Sapphire Blue";
        if (index == 9) return "Beanie Crimson";
        if (index == 10) return "Beanie Royal Gold";
        if (index == 11) return "Scarf Gold";
        if (index == 12) return "Scarf Matte Black";
        if (index == 13) return "Scarf Sapphire Blue";
        if (index == 14) return "Scarf Crimson";
        if (index == 15) return "Scarf Royal Gold";
        if (index == 16) return "Headband Gold";
        if (index == 17) return "Headband Matte Black";
        if (index == 18) return "Headband Sapphire Blue";
        if (index == 19) return "Headband Crimson";
        if (index == 20) return "Headband Royal Gold";
        if (index == 21) return "Crown Imperial";
        if (index == 22) return "Crown Elegant";
        return "Halo";
    }

    function feetName(uint8 index) internal pure returns (string memory) {
        if (index == 0) return "Default Orange";
        if (index == 1) return "Default Pink";
        if (index == 2) return "Default Black";
        return "Default White";
    }

    function backgroundScore(uint8 index) internal pure returns (uint256) {
        if (index == 3 || index == 9 || index == 13 || index == 15 || index == 16 || index == 20) return 3270;
        if (index == 7 || index == 12 || index == 14 || index == 17 || index == 18) return 4097;
        if (index == 19) return 5349;
        return 2577;
    }

    function bodyScore(uint8 index) internal pure returns (uint256) {
        if (index >= 10 && index <= 14) return 3291;
        if (index >= 15 && index <= 18) return 4118;
        if (index == 19) return 5371;
        return 2598;
    }

    function bellyScore(uint8 index) internal pure returns (uint256) {
        if (index == 2) return 1716;
        if (index == 3) return 2543;
        if (index == 4) return 3795;
        return 1023;
    }

    function beakScore(uint8 index) internal pure returns (uint256) {
        if (index == 2 || index == 3) return 1881;
        if (index == 4) return 2708;
        if (index == 5) return 3961;
        return 1188;
    }

    function eyesScore(uint8 index) internal pure returns (uint256) {
        if (index == 3 || index == 5 || index == 6) return 2485;
        if (index == 7 || index == 8) return 3312;
        if (index == 9) return 4564;
        return 1792;
    }

    function headScore(uint8 index) internal pure returns (uint256) {
        if (index >= 6 && index <= 13) return 3154;
        if (index >= 14 && index <= 20) return 3981;
        if (index >= 21) return 5234;
        return 2461;
    }

    function feetScore(uint8 index) internal pure returns (uint256) {
        if (index == 1) return 1270;
        if (index == 2) return 2097;
        if (index == 3) return 3350;
        return 577;
    }
}
