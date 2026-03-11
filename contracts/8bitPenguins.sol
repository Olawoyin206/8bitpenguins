// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC4906Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract EightBitPenguinsUpgradeable is Initializable, ERC721Upgradeable, IERC4906Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using Strings for uint256;

    struct MintPhase {
        string name;
        uint256 price;
        uint256 startTime;
        uint256 endTime;
        uint256 maxSupply;
        uint256 maxPerWallet;
        uint256 minted;
        bool enabled;
    }

    uint256 public MAX_SUPPLY;
    uint256 public MAX_PER_WALLET;
    uint256 public mintPrice;

    bool public mintActive;
    bool public revealed;
    string public placeholderImage;

    uint256 private _currentTokenId;
    mapping(uint256 => uint256) public tokenSeeds;
    mapping(address => uint256) public mintedPerWallet;
    mapping(uint256 => string) public tokenImage;
    mapping(uint256 => string) public tokenName;
    mapping(uint256 => string) public tokenAttributes;
    mapping(uint256 => uint256) public tokenRarityScore;
    mapping(uint256 => bool) public tokenEvolved3D;
    MintPhase[] private _mintPhases;
    mapping(uint256 => mapping(address => uint256)) public phaseMintedPerWallet;
    mapping(uint256 => mapping(address => bool)) private _phaseWhitelist;
    mapping(uint256 => address[]) private _phaseWhitelistMembers;
    mapping(uint256 => mapping(address => uint256)) private _phaseWhitelistMemberIndex;
    mapping(uint256 => uint256) public phaseWhitelistCount;

    event MintStatusChanged(bool status);
    event RevealStatusChanged(bool status);
    event PlaceholderImageChanged(string image);
    event TokenEvolved3D(uint256 indexed tokenId, address indexed owner);
    event MintPriceChanged(uint256 price);
    event MaxSupplyChanged(uint256 maxSupply);
    event MaxPerWalletChanged(uint256 maxPerWallet);
    event PhaseUpserted(uint256 indexed phaseId, string name, uint256 price, uint256 startTime, uint256 endTime, uint256 maxSupply, uint256 maxPerWallet, bool enabled);
    event PhaseRemoved(uint256 indexed phaseId);
    event PhaseWhitelistUpdated(uint256 indexed phaseId, address indexed account, bool allowed);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("8bit Penguins", "8BITP");
        __Ownable_init();
        __ReentrancyGuard_init();

        MAX_SUPPLY = 50;
        MAX_PER_WALLET = 50;
        mintPrice = 0;
        mintActive = false;
        revealed = false;

        placeholderImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='%238B0E2A'/><ellipse cx='200' cy='208' rx='98' ry='122' fill='%23C88F1F'/><ellipse cx='186' cy='182' rx='52' ry='70' fill='%23EFBF45'/><ellipse cx='212' cy='228' rx='76' ry='84' fill='%238F5B12' opacity='0.55'/><text x='200' y='352' fill='%23FFFFFF' font-size='28' font-family='JetBrains Mono,monospace' font-weight='700' text-anchor='middle'>8bit Penguin</text></svg>";
    }

    function initializeV2() public reinitializer(2) {}

    function mint(
        uint256 quantity,
        string[] calldata imageBase64s,
        string[] calldata names,
        string[] calldata attributesJson,
        uint256[] calldata rarityScores
    ) external payable nonReentrant {
        (bool phaseConfigured, uint256 phaseId, uint256 phasePrice, uint256 phaseMaxPerWallet) = _activePhaseConfig();
        require(mintActive, "Minting not active");
        require(quantity > 0, "Must mint at least 1");
        require(quantity == imageBase64s.length, "Must provide image for each NFT");
        require(quantity == names.length, "Must provide name for each NFT");
        require(quantity == attributesJson.length, "Must provide attributes for each NFT");
        require(quantity == rarityScores.length, "Must provide rarity score for each NFT");
        require(_currentTokenId + quantity <= MAX_SUPPLY, "Exceeds max supply");
        require(mintedPerWallet[msg.sender] + quantity <= MAX_PER_WALLET, "Exceeds global max per wallet");

        if (phaseConfigured) {
            MintPhase storage phase = _mintPhases[phaseId];
            require(phase.enabled, "Phase disabled");
            if (phaseWhitelistCount[phaseId] > 0) {
                require(_phaseWhitelist[phaseId][msg.sender], "Not whitelisted for phase");
            }
            if (phase.maxSupply > 0) {
                require(phase.minted + quantity <= phase.maxSupply, "Exceeds phase max supply");
            }
            if (phaseMaxPerWallet > 0) {
                require(phaseMintedPerWallet[phaseId][msg.sender] + quantity <= phaseMaxPerWallet, "Exceeds phase max per wallet");
            }
        }

        require(msg.value >= phasePrice * quantity, "Insufficient payment");

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

        if (phaseConfigured) {
            _mintPhases[phaseId].minted += quantity;
            phaseMintedPerWallet[phaseId][msg.sender] += quantity;
        }

        uint256 requiredValue = phasePrice * quantity;
        if (msg.value > requiredValue) {
            payable(msg.sender).transfer(msg.value - requiredValue);
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

    function setMintPrice(uint256 price) external onlyOwner {
        mintPrice = price;
        emit MintPriceChanged(price);
    }

    function setMaxSupply(uint256 maxSupply_) external onlyOwner {
        require(maxSupply_ >= _currentTokenId, "Max supply below minted");
        require(maxSupply_ > 0, "Max supply must be > 0");
        MAX_SUPPLY = maxSupply_;
        emit MaxSupplyChanged(maxSupply_);
    }

    function setMaxPerWallet(uint256 maxPerWallet_) external onlyOwner {
        require(maxPerWallet_ > 0, "Max per wallet must be > 0");
        MAX_PER_WALLET = maxPerWallet_;
        emit MaxPerWalletChanged(maxPerWallet_);
    }

    function upsertPhase(
        uint256 phaseId,
        string calldata name_,
        uint256 price,
        uint256 startTime,
        uint256 endTime,
        uint256 maxSupply_,
        uint256 maxPerWallet_,
        bool enabled
    ) external onlyOwner {
        require(bytes(name_).length > 0, "Phase name required");
        require(endTime == 0 || startTime == 0 || endTime > startTime, "Invalid phase window");

        if (phaseId == _mintPhases.length) {
            _mintPhases.push();
        } else {
            require(phaseId < _mintPhases.length, "Phase does not exist");
        }

        MintPhase storage phase = _mintPhases[phaseId];
        phase.name = name_;
        phase.price = price;
        phase.startTime = startTime;
        phase.endTime = endTime;
        phase.maxSupply = maxSupply_;
        phase.maxPerWallet = maxPerWallet_;
        phase.enabled = enabled;

        emit PhaseUpserted(phaseId, name_, price, startTime, endTime, maxSupply_, maxPerWallet_, enabled);
    }

    function deletePhase(uint256 phaseId) external onlyOwner {
        require(_mintPhases.length > 0, "No phase to delete");
        require(phaseId == _mintPhases.length - 1, "Only last phase can be deleted");
        delete phaseWhitelistCount[phaseId];
        delete _phaseWhitelistMembers[phaseId];
        delete _mintPhases[phaseId];
        _mintPhases.pop();
        emit PhaseRemoved(phaseId);
    }

    function setPhaseWhitelist(
        uint256 phaseId,
        address[] calldata accounts,
        bool allowed
    ) external onlyOwner {
        require(phaseId < _mintPhases.length, "Phase does not exist");

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            require(account != address(0), "Invalid whitelist address");

            bool exists = _phaseWhitelist[phaseId][account];
            if (allowed && !exists) {
                _phaseWhitelist[phaseId][account] = true;
                _phaseWhitelistMembers[phaseId].push(account);
                _phaseWhitelistMemberIndex[phaseId][account] = _phaseWhitelistMembers[phaseId].length;
                phaseWhitelistCount[phaseId] += 1;
                emit PhaseWhitelistUpdated(phaseId, account, true);
            } else if (!allowed && exists) {
                _phaseWhitelist[phaseId][account] = false;
                uint256 memberIndex = _phaseWhitelistMemberIndex[phaseId][account];
                if (memberIndex > 0) {
                    uint256 lastIndex = _phaseWhitelistMembers[phaseId].length;
                    if (memberIndex != lastIndex) {
                        address moved = _phaseWhitelistMembers[phaseId][lastIndex - 1];
                        _phaseWhitelistMembers[phaseId][memberIndex - 1] = moved;
                        _phaseWhitelistMemberIndex[phaseId][moved] = memberIndex;
                    }
                    _phaseWhitelistMembers[phaseId].pop();
                    delete _phaseWhitelistMemberIndex[phaseId][account];
                }
                phaseWhitelistCount[phaseId] -= 1;
                emit PhaseWhitelistUpdated(phaseId, account, false);
            }
        }
    }

    function isPhaseWhitelisted(uint256 phaseId, address account) external view returns (bool) {
        require(phaseId < _mintPhases.length, "Phase does not exist");
        return _phaseWhitelist[phaseId][account];
    }

    function getPhaseWhitelist(uint256 phaseId) external view returns (address[] memory) {
        require(phaseId < _mintPhases.length, "Phase does not exist");
        return _phaseWhitelistMembers[phaseId];
    }

    function phaseCount() external view returns (uint256) {
        return _mintPhases.length;
    }

    function getPhase(uint256 phaseId) external view returns (
        string memory name_,
        uint256 price,
        uint256 startTime,
        uint256 endTime,
        uint256 maxSupply_,
        uint256 maxPerWallet_,
        uint256 minted,
        bool enabled
    ) {
        require(phaseId < _mintPhases.length, "Phase does not exist");
        MintPhase storage phase = _mintPhases[phaseId];
        return (phase.name, phase.price, phase.startTime, phase.endTime, phase.maxSupply, phase.maxPerWallet, phase.minted, phase.enabled);
    }

    function currentPhaseId() public view returns (bool exists, uint256 phaseId) {
        for (uint256 i = 0; i < _mintPhases.length; i++) {
            MintPhase storage phase = _mintPhases[i];
            if (!phase.enabled) continue;
            if (phase.startTime != 0 && block.timestamp < phase.startTime) continue;
            if (phase.endTime != 0 && block.timestamp > phase.endTime) continue;
            return (true, i);
        }
        return (false, 0);
    }

    function evolveTo3D(
        uint256 tokenId,
        string calldata imageBase64,
        string calldata attributesJson
    ) external nonReentrant {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(_isBase64ImageDataUri(imageBase64), "Image must be data:image/*;base64,...");
        require(bytes(attributesJson).length > 0, "Attributes required");

        _applyEvolveTo3D(tokenId, imageBase64);
        tokenAttributes[tokenId] = attributesJson;

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DImageOnly(
        uint256 tokenId,
        string calldata imageBase64
    ) external nonReentrant {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");
        require(ownerOf(tokenId) == msg.sender, "Not token owner");
        require(_isBase64ImageDataUri(imageBase64), "Image must be data:image/*;base64,...");

        _applyEvolveTo3D(tokenId, imageBase64);

        emit MetadataUpdate(tokenId);
    }

    function _applyEvolveTo3D(uint256 tokenId, string calldata imageBase64) internal {
        tokenImage[tokenId] = imageBase64;
        tokenEvolved3D[tokenId] = true;

        emit TokenEvolved3D(tokenId, msg.sender);
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
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(metadata))));
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
                    '","revealed":false,"attributes":[{"trait_type":"Property","value":"No Property untill Reveal"}]}'
                )
            );
        }

        string memory image = tokenImage[tokenId];
        string memory name = tokenName[tokenId];
        string memory attrs = tokenAttributes[tokenId];
        uint256 score = tokenRarityScore[tokenId];
        uint256 rank = rarityRank(tokenId);

        if (bytes(attrs).length == 0) {
            attrs = '[{"trait_type":"Property","value":"Metadata Missing"}]';
        }
        attrs = _attributesWithEvolution(attrs, tokenEvolved3D[tokenId]);

        string memory description = tokenEvolved3D[tokenId]
            ? "Unique 8bit Penguins on Base (Evolved 3D)"
            : "Unique 8bit Penguins on Base";

        return string(
            abi.encodePacked(
                '{"name":"',
                name,
                '","description":"',
                description,
                '","image":"',
                image,
                '","revealed":true',
                ',"evolved_3d":',
                tokenEvolved3D[tokenId] ? "true" : "false",
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

        return string(
            abi.encodePacked(
                _sliceTo(attrs, end - 1),
                ',{"trait_type":"Evolution","value":"Evolved 3D"}]'
            )
        );
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

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, IERC165Upgradeable) returns (bool) {
        return interfaceId == type(IERC4906Upgradeable).interfaceId || super.supportsInterface(interfaceId);
    }

    function _activePhaseConfig() internal view returns (bool configured, uint256 phaseId, uint256 price, uint256 maxPerWallet_) {
        (bool exists, uint256 id) = currentPhaseId();
        if (!exists) {
            require(_mintPhases.length == 0, "No active mint phase");
            return (false, 0, mintPrice, 0);
        }

        MintPhase storage phase = _mintPhases[id];
        return (true, id, phase.price, phase.maxPerWallet);
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
