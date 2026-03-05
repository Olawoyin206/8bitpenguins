// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract PixelPenguins is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    uint256 public MAX_SUPPLY = 50;
    uint256 public MAX_PER_WALLET = 50;
    uint256 public mintPrice = 0;

    bool public mintActive = false;
    bool public revealed = false;
    string public placeholderImage;

    uint256 private _currentTokenId = 0;
    mapping(uint256 => uint256) public tokenSeeds;
    mapping(address => uint256) public mintedPerWallet;
    mapping(uint256 => string) public tokenImage;
    mapping(uint256 => string) public tokenName;
    mapping(uint256 => string) public tokenAttributes;
    mapping(uint256 => uint256) public tokenRarityScore;

    event MintStatusChanged(bool status);
    event RevealStatusChanged(bool status);
    event PlaceholderImageChanged(string image);
    event MetadataUpdate(uint256 _tokenId);
    event BatchMetadataUpdate(uint256 _fromTokenId, uint256 _toTokenId);

    constructor() ERC721("8bit Penguins", "8BITP") Ownable() {
        placeholderImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23111827'/><text x='200' y='190' fill='%2393C5FD' font-size='24' text-anchor='middle' font-family='monospace'>8BIT PENGUINS</text><text x='200' y='225' fill='%23E5E7EB' font-size='20' text-anchor='middle' font-family='monospace'>UNREVEALED</text></svg>";
    }

    function mint(
        uint256 quantity,
        string[] calldata imageBase64s,
        string[] calldata names,
        string[] calldata attributesJson,
        uint256[] calldata rarityScores
    ) external payable {
        require(mintActive, "Minting not active");
        require(quantity > 0, "Must mint at least 1");
        require(quantity == imageBase64s.length, "Must provide image for each NFT");
        require(quantity == names.length, "Must provide name for each NFT");
        require(quantity == attributesJson.length, "Must provide attributes for each NFT");
        require(quantity == rarityScores.length, "Must provide rarity score for each NFT");
        require(_currentTokenId + quantity <= MAX_SUPPLY, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= MAX_PER_WALLET, "Exceeds max per wallet");
        require(msg.value >= mintPrice * quantity, "Insufficient payment");

        for (uint256 i = 0; i < quantity; i++) {
            require(_isBase64ImageDataUri(imageBase64s[i]), "Image must be data:image/*;base64,...");
            require(bytes(attributesJson[i]).length > 0, "Attributes required");
            _currentTokenId++;
            uint256 tokenId = _currentTokenId;
            uint256 seed = uint256(keccak256(abi.encodePacked(tokenId, msg.sender, block.prevrandao, block.timestamp, i)));
            tokenSeeds[tokenId] = seed;
            tokenImage[tokenId] = imageBase64s[i];
            tokenName[tokenId] = names[i];
            tokenAttributes[tokenId] = attributesJson[i];
            tokenRarityScore[tokenId] = rarityScores[i];
            
            mintedPerWallet[msg.sender]++;
            _safeMint(msg.sender, tokenId);
            emit MetadataUpdate(tokenId);
        }

        if (msg.value > mintPrice * quantity) {
            payable(msg.sender).transfer(msg.value - (mintPrice * quantity));
        }
    }

    function toggleMint() external onlyOwner {
        mintActive = !mintActive;
        emit MintStatusChanged(mintActive);
    }

    function setRevealed(bool status) external onlyOwner {
        revealed = status;
        emit RevealStatusChanged(status);
        if (_currentTokenId > 0) {
            emit BatchMetadataUpdate(1, _currentTokenId);
        }
    }

    function setPlaceholderImage(string calldata image) external onlyOwner {
        require(bytes(image).length > 0, "Placeholder image required");
        placeholderImage = image;
        emit PlaceholderImageChanged(image);
        if (!revealed && _currentTokenId > 0) {
            emit BatchMetadataUpdate(1, _currentTokenId);
        }
    }

    function withdraw() external onlyOwner {
        payable(owner()).transfer(address(this).balance);
    }

    function totalSupply() public view returns (uint256) {
        return _currentTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");
        
        string memory metadata = tokenMetadataJson(tokenId);
        
        return string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(metadata))
        ));
    }

    function tokenMetadataJson(uint256 tokenId) public view returns (string memory) {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");

        if (!revealed) {
            return string(
                abi.encodePacked(
                    '{"name":"8bit Penguins #',
                    tokenId.toString(),
                    '","description":"Unrevealed 8bit Penguins on Base","image":"',
                    placeholderImage,
                    '","revealed":false,"attributes":[]}'
                )
            );
        }

        string memory image = tokenImage[tokenId];
        string memory name = tokenName[tokenId];
        string memory attrs = tokenAttributes[tokenId];
        uint256 score = tokenRarityScore[tokenId];
        uint256 rank = rarityRank(tokenId);
        if (bytes(attrs).length == 0) {
            attrs = "[]";
        }

        return string(
            abi.encodePacked(
                '{"name":"',
                name,
                '","description":"Unique 8bit Penguins on Base","image":"',
                image,
                '","revealed":true',
                ',"attributes":',
                attrs,
                ',"rarity_score":',
                score.toString(),
                ',"rarity_rank":',
                rank.toString(),
                "}"
            )
        );
    }

    function rarityRank(uint256 tokenId) public view returns (uint256) {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");

        uint256 target = tokenRarityScore[tokenId];
        uint256 rank = 1;

        for (uint256 i = 1; i <= _currentTokenId; i++) {
            if (i == tokenId) continue;
            uint256 other = tokenRarityScore[i];
            if (other > target || (other == target && i < tokenId)) {
                rank++;
            }
        }

        return rank;
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
}
