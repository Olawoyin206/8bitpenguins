// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract EightBitPenguinsMetadataBuilder {
    using Strings for uint256;

    struct RevealedMetadataInput {
        uint256 tokenId;
        string rawName;
        string activeImage;
        string image2D;
        string image3D;
        string animationUrl;
        string rawAttributes;
        uint256 score;
        uint256 rank;
        bool evolved;
    }

    function isBase64ImageDataUri(string calldata data) external pure returns (bool) {
        bytes calldata b = bytes(data);
        bytes memory prefix = bytes("data:image/");
        bytes memory marker = bytes(";base64,");

        if (b.length <= prefix.length + marker.length) return false;

        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return false;
        }

        bool foundMarker = false;
        for (uint256 i = prefix.length; i + marker.length <= b.length; i++) {
            bool matchMarker = true;
            for (uint256 j = 0; j < marker.length; j++) {
                if (b[i + j] != marker[j]) {
                    matchMarker = false;
                    break;
                }
            }
            if (matchMarker) {
                foundMarker = true;
                break;
            }
        }

        return foundMarker;
    }

    function isAllowedEvolveImageUri(string calldata imageUri) external pure returns (bool) {
        if (_isBase64ImageDataUri(imageUri)) return true;
        return _startsWith(imageUri, "ipfs://") || _startsWith(imageUri, "https://") || _startsWith(imageUri, "http://");
    }

    function isAllowedModelUri(string calldata modelUri) external pure returns (bool) {
        return _startsWith(modelUri, "ipfs://") || _startsWith(modelUri, "https://") || _startsWith(modelUri, "http://");
    }

    function unrevealedMetadataJson(
        uint256 tokenId,
        string calldata placeholderImage
    ) external pure returns (string memory) {
        return string(
            abi.encodePacked(
                '{"name":"8bit Penguins #',
                tokenId.toString(),
                '","description":"Unrevealed 8bit Penguins","image":"',
                _escapeJsonString(placeholderImage),
                '","revealed":false,"attributes":[{"trait_type":"Status","value":"Unrevealed"}]}'
            )
        );
    }

    function revealedMetadataJson(RevealedMetadataInput calldata input) external pure returns (string memory) {
        return _revealedMetadataJson(input);
    }

    function _revealedMetadataJson(RevealedMetadataInput memory input) internal pure returns (string memory) {
        string memory name = bytes(input.rawName).length == 0 ? _defaultTokenName(input.tokenId) : input.rawName;
        string memory attrsWithName = _attributesWithName(input.rawAttributes, name);
        string memory attrs = _attributesWithEvolution(attrsWithName, input.evolved);
        bool base64Image = _isBase64ImageDataUriMemory(input.activeImage);
        string memory header = string(
            abi.encodePacked(
                '{"name":"',
                _escapeJsonString(name),
                '","description":"',
                input.evolved ? "8bit Penguins (Evolved 3D)" : "8bit Penguins",
                '","revealed":true,"evolved_3d":',
                input.evolved ? "true" : "false",
                ',"attributes":',
                attrs,
                ',"rarity_score":',
                input.score.toString(),
                ',"rarity_rank":',
                input.rank.toString(),
                ',"image_is_base64":',
                base64Image ? "true" : "false",
                ',"image":"',
                _escapeJsonString(input.activeImage),
                '"'
            )
        );

        string memory imageDataField = base64Image ? _optionalField("image_data", input.activeImage) : "";
        string memory image2DField = _optionalField("image_2d", input.image2D);
        string memory image3DField = _optionalField("image_3d", input.image3D);
        string memory animationUrl = _resolvedAnimationUrl(input);
        string memory animationField = _optionalField("animation_url", animationUrl);
        string memory tail = string(abi.encodePacked(imageDataField, image2DField, image3DField, animationField, "}"));

        return string(abi.encodePacked(header, tail));
    }

    function _resolvedAnimationUrl(RevealedMetadataInput memory input) internal pure returns (string memory) {
        if (bytes(input.animationUrl).length > 0) {
            return input.animationUrl;
        }
        if (!input.evolved || bytes(input.image2D).length == 0 || bytes(input.image3D).length == 0) {
            return "";
        }
        return _toggleHtmlDataUri(input.image2D, input.image3D);
    }

    function _toggleHtmlDataUri(string memory image2D, string memory image3D) internal pure returns (string memory) {
        string memory safe2D = _escapeHtmlAttribute(_browserMediaUrl(image2D));
        string memory safe3D = _escapeHtmlAttribute(_browserMediaUrl(image3D));
        string memory htmlPrefix = string(
            abi.encodePacked(
                "<!doctype html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
                "<style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:radial-gradient(circle at 18% 14%,rgba(23,39,66,.65),rgba(8,12,20,1) 56%,rgba(3,5,10,1))}body{font-family:Inter,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;position:relative}.i{display:none}.v{position:relative;width:100vw;height:100vh;overflow:hidden}.v img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;image-rendering:pixelated;display:block;transition:opacity .18s ease}.img2{opacity:0}.img3{opacity:1}#m2:checked~.v .img2{opacity:1}#m2:checked~.v .img3{opacity:0}.c{position:absolute;top:10px;right:10px;z-index:20;display:inline-flex;align-items:center;gap:0;padding:0;border:1px solid rgba(255,255,255,.16);background:rgba(9,14,24,.34);box-shadow:0 6px 16px rgba(0,0,0,.26);overflow:hidden}.c label{margin:0;min-width:40px;padding:7px 11px;border:0;background:rgba(255,255,255,.08);color:#e7effa;font-size:10px;line-height:1;font-weight:700;letter-spacing:.08em;text-transform:uppercase;text-align:center;cursor:pointer;user-select:none;transition:background .16s ease,color .16s ease}.c label+label{border-left:1px solid rgba(255,255,255,.16)}#m2:checked~.c label[for='m2'],#m3:checked~.c label[for='m3']{background:rgba(244,247,251,.9);color:#0b1220}</style>",
                "</head><body data-onchain-toggle-topright=\"1\"><input class=\"i\" type=\"radio\" name=\"m\" id=\"m2\"><input class=\"i\" type=\"radio\" name=\"m\" id=\"m3\" checked><div class=\"v\"><img class=\"img2\" src=\""
            )
        );
        string memory htmlMid = string(abi.encodePacked("\" alt=\"8bit penguin 2D\"><img class=\"img3\" src=\"", safe3D));
        string memory htmlSuffix = "\" alt=\"8bit penguin 3D\"></div><div class=\"c\"><label for=\"m2\">2D</label><label for=\"m3\">3D</label></div></body></html>";
        string memory html = string(abi.encodePacked(htmlPrefix, safe2D, htmlMid, htmlSuffix));
        return string(abi.encodePacked("data:text/html;base64,", Base64.encode(bytes(html))));
    }

    function _browserMediaUrl(string memory value) internal pure returns (string memory) {
        if (_startsWithMemory(value, "ipfs://")) {
            return string(abi.encodePacked("https://ipfs.io/ipfs/", _sliceFrom(value, 7)));
        }
        return value;
    }

    function _sliceFrom(string memory s, uint256 start) internal pure returns (string memory) {
        bytes memory src = bytes(s);
        if (start >= src.length) return "";

        uint256 outLen = src.length - start;
        bytes memory out = new bytes(outLen);
        for (uint256 i = 0; i < outLen; i++) {
            out[i] = src[start + i];
        }
        return string(out);
    }

    function _startsWithMemory(string memory value, string memory prefix) internal pure returns (bool) {
        bytes memory source = bytes(value);
        bytes memory target = bytes(prefix);
        if (source.length < target.length) return false;
        for (uint256 i = 0; i < target.length; i++) {
            if (source[i] != target[i]) return false;
        }
        return true;
    }

    function _escapeHtmlAttribute(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        bytes memory buffer = new bytes(input.length * 6 + 2);
        uint256 out = 0;

        for (uint256 i = 0; i < input.length; i++) {
            bytes1 ch = input[i];

            if (ch == "&") {
                buffer[out++] = "&";
                buffer[out++] = "a";
                buffer[out++] = "m";
                buffer[out++] = "p";
                buffer[out++] = ";";
            } else if (ch == "<") {
                buffer[out++] = "&";
                buffer[out++] = "l";
                buffer[out++] = "t";
                buffer[out++] = ";";
            } else if (ch == ">") {
                buffer[out++] = "&";
                buffer[out++] = "g";
                buffer[out++] = "t";
                buffer[out++] = ";";
            } else if (ch == '"') {
                buffer[out++] = "&";
                buffer[out++] = "q";
                buffer[out++] = "u";
                buffer[out++] = "o";
                buffer[out++] = "t";
                buffer[out++] = ";";
            } else {
                buffer[out++] = ch;
            }
        }

        bytes memory output = new bytes(out);
        for (uint256 i = 0; i < out; i++) {
            output[i] = buffer[i];
        }
        return string(output);
    }

    function _defaultTokenName(uint256 tokenId) internal pure returns (string memory) {
        return string(abi.encodePacked("8bit Penguins #", tokenId.toString()));
    }

    function _attributesWithName(string memory attrs, string memory name) internal pure returns (string memory) {
        if (_contains(attrs, '"trait_type":"Name"')) return attrs;

        bytes memory b = bytes(attrs);
        if (b.length == 0 || _contains(attrs, "[]")) {
            return string(
                abi.encodePacked(
                    '[{"trait_type":"Name","value":"',
                    _escapeJsonString(name),
                    '"}]'
                )
            );
        }

        uint256 end = b.length;
        while (end > 0) {
            bytes1 ch = b[end - 1];
            if (ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D) {
                end--;
            } else {
                break;
            }
        }
        if (end == 0 || b[end - 1] != "]") {
            return attrs;
        }

        return string(
            abi.encodePacked(
                _sliceTo(attrs, end - 1),
                ',{"trait_type":"Name","value":"',
                _escapeJsonString(name),
                '"}]'
            )
        );
    }

    function _attributesWithEvolution(string memory attrs, bool evolved) internal pure returns (string memory) {
        if (!evolved) return attrs;
        if (_contains(attrs, '"trait_type":"Evolution"')) return attrs;

        bytes memory b = bytes(attrs);
        if (b.length == 0 || _contains(attrs, "[]")) {
            return '[{"trait_type":"Evolution","value":"Evolved 3D"}]';
        }

        uint256 end = b.length;
        while (end > 0) {
            bytes1 ch = b[end - 1];
            if (ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D) {
                end--;
            } else {
                break;
            }
        }
        if (end == 0 || b[end - 1] != "]") {
            return attrs;
        }

        return string(abi.encodePacked(_sliceTo(attrs, end - 1), ',{"trait_type":"Evolution","value":"Evolved 3D"}]'));
    }

    function _sliceTo(string memory s, uint256 endExclusive) internal pure returns (string memory) {
        bytes memory src = bytes(s);
        if (endExclusive > src.length) endExclusive = src.length;
        bytes memory out = new bytes(endExclusive);
        for (uint256 i = 0; i < endExclusive; i++) {
            out[i] = src[i];
        }
        return string(out);
    }

    function _contains(string memory haystack, string memory needle) internal pure returns (bool) {
        bytes memory h = bytes(haystack);
        bytes memory n = bytes(needle);
        if (n.length == 0) return true;
        if (n.length > h.length) return false;

        for (uint256 i = 0; i <= h.length - n.length; i++) {
            bool matchNeedle = true;
            for (uint256 j = 0; j < n.length; j++) {
                if (h[i + j] != n[j]) {
                    matchNeedle = false;
                    break;
                }
            }
            if (matchNeedle) return true;
        }
        return false;
    }

    function _optionalField(string memory key, string memory value) internal pure returns (string memory) {
        if (bytes(value).length == 0) return "";
        return string(abi.encodePacked(',"', key, '":"', _escapeJsonString(value), '"'));
    }

    function _escapeJsonString(string memory value) internal pure returns (string memory) {
        bytes memory input = bytes(value);
        bytes memory buffer = new bytes(input.length * 6 + 2);
        uint256 out = 0;

        for (uint256 i = 0; i < input.length; i++) {
            bytes1 ch = input[i];

            if (ch == 0x22) {
                buffer[out++] = "\\";
                buffer[out++] = '"';
            } else if (ch == 0x5C) {
                buffer[out++] = "\\";
                buffer[out++] = "\\";
            } else if (ch == 0x08) {
                buffer[out++] = "\\";
                buffer[out++] = "b";
            } else if (ch == 0x0C) {
                buffer[out++] = "\\";
                buffer[out++] = "f";
            } else if (ch == 0x0A) {
                buffer[out++] = "\\";
                buffer[out++] = "n";
            } else if (ch == 0x0D) {
                buffer[out++] = "\\";
                buffer[out++] = "r";
            } else if (ch == 0x09) {
                buffer[out++] = "\\";
                buffer[out++] = "t";
            } else if (uint8(ch) < 0x20) {
                buffer[out++] = "\\";
                buffer[out++] = "u";
                buffer[out++] = "0";
                buffer[out++] = "0";
                buffer[out++] = _hexChar(uint8(ch) >> 4);
                buffer[out++] = _hexChar(uint8(ch) & 0x0f);
            } else {
                buffer[out++] = ch;
            }
        }

        bytes memory output = new bytes(out);
        for (uint256 i = 0; i < out; i++) {
            output[i] = buffer[i];
        }
        return string(output);
    }

    function _hexChar(uint8 value) internal pure returns (bytes1) {
        return value < 10 ? bytes1(value + 48) : bytes1(value + 87);
    }

    function _startsWith(string calldata value, string memory prefix) internal pure returns (bool) {
        bytes calldata source = bytes(value);
        bytes memory target = bytes(prefix);
        if (source.length < target.length) return false;
        for (uint256 i = 0; i < target.length; i++) {
            if (source[i] != target[i]) return false;
        }
        return true;
    }

    function _isBase64ImageDataUri(string calldata data) internal pure returns (bool) {
        bytes calldata b = bytes(data);
        bytes memory prefix = bytes("data:image/");
        bytes memory marker = bytes(";base64,");

        if (b.length <= prefix.length + marker.length) return false;

        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return false;
        }

        bool foundMarker = false;
        for (uint256 i = prefix.length; i + marker.length <= b.length; i++) {
            bool matchMarker = true;
            for (uint256 j = 0; j < marker.length; j++) {
                if (b[i + j] != marker[j]) {
                    matchMarker = false;
                    break;
                }
            }
            if (matchMarker) {
                foundMarker = true;
                break;
            }
        }

        return foundMarker;
    }

    function _isBase64ImageDataUriMemory(string memory data) internal pure returns (bool) {
        bytes memory b = bytes(data);
        bytes memory prefix = bytes("data:image/");
        bytes memory marker = bytes(";base64,");

        if (b.length <= prefix.length + marker.length) return false;

        for (uint256 i = 0; i < prefix.length; i++) {
            if (b[i] != prefix[i]) return false;
        }

        bool foundMarker = false;
        for (uint256 i = prefix.length; i + marker.length <= b.length; i++) {
            bool matchMarker = true;
            for (uint256 j = 0; j < marker.length; j++) {
                if (b[i + j] != marker[j]) {
                    matchMarker = false;
                    break;
                }
            }
            if (matchMarker) {
                foundMarker = true;
                break;
            }
        }

        return foundMarker;
    }
}
