// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC4906Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/introspection/IERC165Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/interfaces/IERC2981Upgradeable.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
interface IEightBitPenguinsOnchainRenderer {
    function renderSVG(uint256 packedTraits) external view returns (string memory);
    function packedAttributesJson(uint256 packedTraits) external pure returns (string memory);
    function packedName(uint256 packedTraits) external pure returns (string memory);
    function rarityScoreFromPacked(uint256 packedTraits) external pure returns (uint256);
}

interface IEightBitPenguinsMetadataBuilder {
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

    function isBase64ImageDataUri(string calldata data) external pure returns (bool);
    function isAllowedEvolveImageUri(string calldata imageUri) external pure returns (bool);
    function isAllowedModelUri(string calldata modelUri) external pure returns (bool);
    function unrevealedMetadataJson(uint256 tokenId, string calldata placeholderImage) external pure returns (string memory);
    function revealedMetadataJson(RevealedMetadataInput calldata input) external pure returns (string memory);
}

interface IEightBitPenguinsRandomnessHelper {
    function packedTraitsFromEntropy(bytes32 entropy) external pure returns (uint256 packedTraits);
}

contract EightBitPenguinsUpgradeable is Initializable, ERC721Upgradeable, IERC4906Upgradeable, OwnableUpgradeable, ReentrancyGuardUpgradeable {
    using Strings for uint256;

    uint8 private constant DISPLAY_MODE_DEFAULT_3D = 0;
    uint8 private constant DISPLAY_MODE_TEMP_2D = 1;
    uint256 private constant DEFAULT_PUBLIC_DISPLAY_TOGGLE_DURATION = 15 minutes;

    error MintingNotActive();
    error MustMintAtLeastOne();
    error MissingImageCount();
    error MissingNameCount();
    error MissingAttributesCount();
    error MissingRarityScoreCount();
    error ExceedsMaxSupply();
    error ExceedsGlobalMaxPerWallet();
    error PhaseDisabled();
    error NotWhitelistedForPhase();
    error ExceedsPhaseMaxSupply();
    error ExceedsPhaseMaxPerWallet();
    error InsufficientPayment();
    error InvalidImageData();
    error AttributesRequired();
    error AttributesMustBeJsonArray();
    error PlaceholderImageRequired();
    error MaxSupplyBelowMinted();
    error MaxSupplyMustBePositive();
    error MaxPerWalletMustBePositive();
    error RarityAlreadyFinalized();
    error NoIds();
    error BadScoreLen();
    error BadRankLen();
    error InvalidToken();
    error NoTokensMinted();
    error SellOutOrCloseMintFirst();
    error PhaseNameRequired();
    error InvalidPhaseWindow();
    error PhaseDoesNotExist();
    error NoPhaseToDelete();
    error OnlyLastPhaseCanBeDeleted();
    error InvalidWhitelistAddress();
    error NotTokenOwner();
    error InvalidEvolveImageUri();
    error InvalidModelUri();
    error TokenNotEvolved();
    error Missing2DImage();
    error InvalidDisplayToggleDuration();
    error NoActiveMintPhase();
    error TokenUnrevealed();
    error RendererAddressRequired();
    error DirectMintDisabled();
    error MetadataBuilderAddressRequired();
    error RandomnessHelperAddressRequired();
    error InvalidRoyaltyReceiver();
    error InvalidRoyaltyFeeBps();
    error InvalidEvolveFeeReceiver();
    error EvolveFeeTokenAddressRequired();
    error NativeValueNotAcceptedForTokenFee();
    error InsufficientEvolveFee(uint256 required, uint256 provided);
    error EvolveFeeTransferFailed();
    error RefundTransferFailed();
    error WithdrawTransferFailed();

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

    // Legacy reserved struct kept for storage compatibility only.
    struct LegacyMintReservation {
        bytes32 entropyTag;
        uint64 blockTag;
        uint64 unlockBlock;
        uint64 expiryBlock;
        uint32 quantity;
        uint32 phaseIdPlusOne;
        uint256 reservedValue;
    }

    uint256 public MAX_SUPPLY;
    uint256 public MAX_PER_WALLET;
    uint256 public mintPrice;

    bool public mintActive;
    bool public revealed;
    string public placeholderImage;

    uint256 private _currentTokenId;
    mapping(uint256 => uint256) private tokenSeeds;
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
    mapping(uint256 => string) public tokenOriginalImage;
    mapping(uint256 => string) public tokenEvolvedImage;
    mapping(uint256 => string) public tokenInteractiveModel;
    mapping(uint256 => uint8) private tokenDisplayMode;
    mapping(uint256 => uint256) public tokenFinalRarityRank;
    bool public rarityFinalized;
    // Reserved to preserve upgradeable storage layout from older deployments.
    mapping(uint256 => uint256) private tokenTraitsPacked;
    address private onchainRenderer;
    // Legacy reserved storage slots kept for upgrade compatibility.
    mapping(address => LegacyMintReservation) private _legacyMintReservations;
    mapping(uint256 => uint256) private _legacyReservedPhaseSupply;
    mapping(uint256 => mapping(address => uint256)) private _legacyReservedPhasePerWallet;
    uint256 private _legacyReservedSupply;
    bool public mintModeConfigured;
    bool public directMintEnabled;
    bool private _legacyMintModeFlag;
    uint256 private _legacyMintModeDelayBlocks;
    uint256 private _legacyMintModeExpiryBlocks;
    address private metadataBuilder;
    address private randomnessHelper;
    mapping(uint256 => uint64) private tokenDisplayModeExpiresAt;
    uint256 public publicDisplayToggleDuration;
    address public royaltyReceiver;
    uint96 public royaltyFeeBps;
    mapping(uint256 => string) public tokenEvolvedImageCid;
    uint256 public evolveFee;
    address public evolveFeeReceiver;
    address public evolveFeeToken;
    uint256 public evolveFeeTokenAmount;

    event MintStatusChanged(bool status);
    event RevealStatusChanged(bool status);
    event PlaceholderImageChanged(string image);
    event TokenEvolved3D(uint256 indexed tokenId, address indexed owner);
    event MintPriceChanged(uint256 price);
    event MaxSupplyChanged(uint256 maxSupply);
    event MaxPerWalletChanged(uint256 maxPerWallet);
    event TokenInteractiveModelUpdated(uint256 indexed tokenId, string modelUri);
    event RarityFinalized(uint256 supply);
    event PhaseUpserted(uint256 indexed phaseId, string name, uint256 price, uint256 startTime, uint256 endTime, uint256 maxSupply, uint256 maxPerWallet, bool enabled);
    event PhaseRemoved(uint256 indexed phaseId);
    event PhaseWhitelistUpdated(uint256 indexed phaseId, address indexed account, bool allowed);
    event OnchainRendererUpdated(address indexed renderer);
    event MetadataBuilderUpdated(address indexed metadataBuilder);
    event RandomnessHelperUpdated(address indexed randomnessHelper);
    event MintModeConfigured(bool directMintEnabled);
    event TokenDisplayModeChanged(uint256 indexed tokenId, uint8 indexed mode, uint256 expiresAt, address indexed triggeredBy);
    event DisplayToggleDurationChanged(uint256 durationSeconds);
    event RoyaltyInfoUpdated(address indexed receiver, uint96 feeBps);
    event EvolveFeeChanged(uint256 fee);
    event EvolveFeeReceiverChanged(address indexed receiver);
    event EvolveFeeTokenInfoUpdated(address indexed token, uint256 amount);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __ERC721_init("8bit Penguins", "8BITP");
        __Ownable_init();
        __ReentrancyGuard_init();

        MAX_SUPPLY = 8888;
        MAX_PER_WALLET = 50;
        mintPrice = 0;
        mintActive = false;
        revealed = false;
        mintModeConfigured = true;
        directMintEnabled = true;
        _legacyMintModeFlag = false;
        _legacyMintModeDelayBlocks = 1;
        _legacyMintModeExpiryBlocks = 200;
        evolveFee = 0;
        evolveFeeReceiver = _msgSender();
        evolveFeeToken = address(0);
        evolveFeeTokenAmount = 0;

        placeholderImage = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 400'><rect width='400' height='400' fill='%23111927'/><circle cx='200' cy='190' r='88' fill='%23f59e0b'/><text x='200' y='340' fill='%23fff' font-size='26' text-anchor='middle'>8bit Penguin</text></svg>";
    }

    function mint(uint256 quantity) external payable nonReentrant {
        if (!_directMintAllowed()) revert DirectMintDisabled();
        (bool phaseConfigured, uint256 phaseId, uint256 phasePrice, uint256 phaseMaxPerWallet) = _activePhaseConfig();
        if (!mintActive) revert MintingNotActive();
        if (quantity == 0) revert MustMintAtLeastOne();
        if (_currentTokenId + quantity > MAX_SUPPLY) revert ExceedsMaxSupply();
        if (mintedPerWallet[msg.sender] + quantity > MAX_PER_WALLET) revert ExceedsGlobalMaxPerWallet();
        if (onchainRenderer == address(0)) revert RendererAddressRequired();
        uint256 firstMintedTokenId = _currentTokenId + 1;

        if (phaseConfigured) {
            MintPhase storage phase = _mintPhases[phaseId];
            if (!phase.enabled) revert PhaseDisabled();
            if (phaseWhitelistCount[phaseId] > 0) {
                if (!_phaseWhitelist[phaseId][msg.sender]) revert NotWhitelistedForPhase();
            }
            if (phase.maxSupply > 0) {
                if (phase.minted + quantity > phase.maxSupply) revert ExceedsPhaseMaxSupply();
            }
            if (phaseMaxPerWallet > 0) {
                if (phaseMintedPerWallet[phaseId][msg.sender] + quantity > phaseMaxPerWallet) revert ExceedsPhaseMaxPerWallet();
            }
        }

        uint256 requiredValue = phasePrice * quantity;
        if (msg.value < requiredValue) revert InsufficientPayment();

        address randomnessHelperAddress = randomnessHelper;
        if (randomnessHelperAddress == address(0)) revert RandomnessHelperAddressRequired();
        IEightBitPenguinsRandomnessHelper randomHelper = IEightBitPenguinsRandomnessHelper(randomnessHelperAddress);
        bytes32 mintEntropy = keccak256(
            abi.encodePacked(
                address(this),
                block.chainid,
                msg.sender,
                blockhash(block.number - 1),
                block.prevrandao,
                _currentTokenId,
                quantity
            )
        );

        for (uint256 i = 0; i < quantity; ) {
            uint256 nextPackedTraits = randomHelper.packedTraitsFromEntropy(
                keccak256(abi.encodePacked(mintEntropy, i))
            );
            _mintTokenOnchain(msg.sender, nextPackedTraits);
            unchecked {
                ++i;
            }
        }

        unchecked {
            mintedPerWallet[msg.sender] += quantity;
        }
        emit BatchMetadataUpdate(firstMintedTokenId, _currentTokenId);

        if (phaseConfigured) {
            _mintPhases[phaseId].minted += quantity;
            phaseMintedPerWallet[phaseId][msg.sender] += quantity;
        }

        if (msg.value > requiredValue) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - requiredValue}("");
            if (!refunded) revert RefundTransferFailed();
        }
    }

    function configureMintMode(bool directMintEnabled_) external onlyOwner {
        mintModeConfigured = true;
        directMintEnabled = directMintEnabled_;
        emit MintModeConfigured(directMintEnabled_);
    }

    function _mintTokenOnchain(
        address recipient,
        uint256 packedTraits
    ) internal {
        _currentTokenId++;
        uint256 tokenId = _currentTokenId;
        tokenTraitsPacked[tokenId] = packedTraits + 1;
        _safeMint(recipient, tokenId);
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
        if (bytes(image).length == 0) revert PlaceholderImageRequired();
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

    function setEvolveFee(uint256 fee) external onlyOwner {
        evolveFee = fee;
        emit EvolveFeeChanged(fee);
    }

    function setEvolveFeeReceiver(address receiver) external onlyOwner {
        if (receiver == address(0)) revert InvalidEvolveFeeReceiver();
        evolveFeeReceiver = receiver;
        emit EvolveFeeReceiverChanged(receiver);
    }

    function setEvolveFeeInfo(address receiver, uint256 fee) external onlyOwner {
        if (fee > 0 && receiver == address(0)) revert InvalidEvolveFeeReceiver();
        evolveFeeReceiver = receiver;
        evolveFee = fee;
        emit EvolveFeeReceiverChanged(receiver);
        emit EvolveFeeChanged(fee);
    }

    function setEvolveFeeTokenInfo(address token, uint256 amount) external onlyOwner {
        if (amount > 0 && token == address(0)) revert EvolveFeeTokenAddressRequired();
        if (amount > 0 && evolveFeeReceiver == address(0)) revert InvalidEvolveFeeReceiver();
        evolveFeeToken = token;
        evolveFeeTokenAmount = amount;
        emit EvolveFeeTokenInfoUpdated(token, amount);
    }

    function setRoyaltyInfo(address receiver, uint96 feeBps) external onlyOwner {
        if (feeBps > 10000) revert InvalidRoyaltyFeeBps();
        if (feeBps > 0 && receiver == address(0)) revert InvalidRoyaltyReceiver();

        royaltyReceiver = receiver;
        royaltyFeeBps = feeBps;
        emit RoyaltyInfoUpdated(receiver, feeBps);
    }

    function setMetadataBuilder(address metadataBuilder_) external onlyOwner {
        if (metadataBuilder_ == address(0)) revert MetadataBuilderAddressRequired();
        metadataBuilder = metadataBuilder_;
        emit MetadataBuilderUpdated(metadataBuilder_);
        if (_currentTokenId > 0) {
            emit BatchMetadataUpdate(1, _currentTokenId);
        }
    }

    function setRandomnessHelper(address randomnessHelper_) external onlyOwner {
        if (randomnessHelper_ == address(0)) revert RandomnessHelperAddressRequired();
        randomnessHelper = randomnessHelper_;
        emit RandomnessHelperUpdated(randomnessHelper_);
    }

    function setMaxSupply(uint256 maxSupply_) external onlyOwner {
        if (maxSupply_ < _currentTokenId) revert MaxSupplyBelowMinted();
        if (maxSupply_ == 0) revert MaxSupplyMustBePositive();
        MAX_SUPPLY = maxSupply_;
        emit MaxSupplyChanged(maxSupply_);
    }

    function setMaxPerWallet(uint256 maxPerWallet_) external onlyOwner {
        if (maxPerWallet_ == 0) revert MaxPerWalletMustBePositive();
        MAX_PER_WALLET = maxPerWallet_;
        emit MaxPerWalletChanged(maxPerWallet_);
    }

    function setOnchainRenderer(address renderer) external onlyOwner {
        if (renderer == address(0)) revert RendererAddressRequired();
        onchainRenderer = renderer;
        emit OnchainRendererUpdated(renderer);
        if (_currentTokenId > 0) {
            emit BatchMetadataUpdate(1, _currentTokenId);
        }
    }

    function getOnchainRenderer() external view returns (address) {
        return onchainRenderer;
    }

    function setFinalRarityData(
        uint256[] calldata tokenIds,
        uint256[] calldata scores,
        uint256[] calldata ranks
    ) external onlyOwner {
        if (rarityFinalized) revert RarityAlreadyFinalized();
        if (tokenIds.length == 0) revert NoIds();
        if (tokenIds.length != scores.length) revert BadScoreLen();
        if (tokenIds.length != ranks.length) revert BadRankLen();

        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            if (tokenId == 0 || tokenId > _currentTokenId) revert InvalidToken();

            tokenRarityScore[tokenId] = scores[i];
            tokenFinalRarityRank[tokenId] = ranks[i];
            emit MetadataUpdate(tokenId);
        }
    }

    function finalizeRarity() external onlyOwner {
        if (rarityFinalized) revert RarityAlreadyFinalized();
        if (_currentTokenId == 0) revert NoTokensMinted();
        if (!(_currentTokenId == MAX_SUPPLY || !mintActive)) revert SellOutOrCloseMintFirst();

        rarityFinalized = true;

        emit RarityFinalized(_currentTokenId);
        emit BatchMetadataUpdate(1, _currentTokenId);
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
        if (bytes(name_).length == 0) revert PhaseNameRequired();
        if (!(endTime == 0 || startTime == 0 || endTime > startTime)) revert InvalidPhaseWindow();

        if (phaseId == _mintPhases.length) {
            _mintPhases.push();
        } else {
            if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();
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
        if (_mintPhases.length == 0) revert NoPhaseToDelete();
        if (phaseId != _mintPhases.length - 1) revert OnlyLastPhaseCanBeDeleted();
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
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();

        for (uint256 i = 0; i < accounts.length; i++) {
            address account = accounts[i];
            if (account == address(0)) revert InvalidWhitelistAddress();

            bool exists = _phaseWhitelist[phaseId][account];
            if (allowed && !exists) {
                _phaseWhitelist[phaseId][account] = true;
                _phaseWhitelistMembers[phaseId].push(account);
                phaseWhitelistCount[phaseId] += 1;
                emit PhaseWhitelistUpdated(phaseId, account, true);
            } else if (!allowed && exists) {
                _phaseWhitelist[phaseId][account] = false;
                phaseWhitelistCount[phaseId] -= 1;
                emit PhaseWhitelistUpdated(phaseId, account, false);
            }
        }
    }

    function isPhaseWhitelisted(uint256 phaseId, address account) external view returns (bool) {
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();
        return _phaseWhitelist[phaseId][account];
    }

    function getPhaseWhitelist(uint256 phaseId) external view returns (address[] memory) {
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();
        return _phaseWhitelistMembers[phaseId];
    }

    function phaseWhitelistMemberCount(uint256 phaseId) external view returns (uint256) {
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();
        return _phaseWhitelistMembers[phaseId].length;
    }

    function getPhaseWhitelistSlice(
        uint256 phaseId,
        uint256 offset,
        uint256 limit
    )
        external
        view
        returns (
            address[] memory accounts,
            bool[] memory active,
            uint256 nextOffset,
            uint256 totalMembers
        )
    {
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();

        address[] storage members = _phaseWhitelistMembers[phaseId];
        totalMembers = members.length;
        if (offset >= totalMembers || limit == 0) {
            return (new address[](0), new bool[](0), totalMembers, totalMembers);
        }

        uint256 end = offset + limit;
        if (end > totalMembers) {
            end = totalMembers;
        }
        uint256 len = end - offset;

        accounts = new address[](len);
        active = new bool[](len);

        for (uint256 i = 0; i < len; i++) {
            address account = members[offset + i];
            accounts[i] = account;
            active[i] = _phaseWhitelist[phaseId][account];
        }

        nextOffset = end;
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
        if (phaseId >= _mintPhases.length) revert PhaseDoesNotExist();
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
        string calldata imageUri,
        string calldata attributesJson
    ) external payable nonReentrant {
        _validateEvolveRequest(tokenId, imageUri);
        if (bytes(attributesJson).length == 0) revert AttributesRequired();
        _collectEvolveFee();

        _applyEvolveTo3D(tokenId, imageUri, "");
        tokenAttributes[tokenId] = attributesJson;

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DImageOnly(
        uint256 tokenId,
        string calldata imageUri
    ) external payable nonReentrant {
        _validateEvolveRequest(tokenId, imageUri);
        _collectEvolveFee();

        _applyEvolveTo3D(tokenId, imageUri, "");

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DWithModel(
        uint256 tokenId,
        string calldata imageUri,
        string calldata modelUri,
        string calldata attributesJson
    ) external payable nonReentrant {
        _validateEvolveRequestWithModel(tokenId, imageUri, modelUri);
        if (bytes(attributesJson).length == 0) revert AttributesRequired();
        _collectEvolveFee();

        _applyEvolveTo3D(tokenId, imageUri, modelUri);
        tokenAttributes[tokenId] = attributesJson;

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DImageOnlyWithModel(
        uint256 tokenId,
        string calldata imageUri,
        string calldata modelUri
    ) external payable nonReentrant {
        _validateEvolveRequestWithModel(tokenId, imageUri, modelUri);
        _collectEvolveFee();

        _applyEvolveTo3D(tokenId, imageUri, modelUri);

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DImageOnlyWithCid(
        uint256 tokenId,
        string calldata imageCid
    ) external payable nonReentrant {
        _validateEvolveCidRequest(tokenId, imageCid);
        _collectEvolveFee();

        _applyEvolveTo3DCid(tokenId, imageCid, "");

        emit MetadataUpdate(tokenId);
    }

    function evolveTo3DImageOnlyWithCidAndModel(
        uint256 tokenId,
        string calldata imageCid,
        string calldata modelUri
    ) external payable nonReentrant {
        _validateEvolveCidRequest(tokenId, imageCid);
        IEightBitPenguinsMetadataBuilder builder = _metadataBuilderOrRevert();
        if (!builder.isAllowedModelUri(modelUri)) revert InvalidModelUri();
        _collectEvolveFee();

        _applyEvolveTo3DCid(tokenId, imageCid, modelUri);

        emit MetadataUpdate(tokenId);
    }

    function toggleEvolvedDisplayMode(uint256 tokenId) external {
        if (tokenId == 0 || tokenId > _currentTokenId) revert InvalidToken();
        if (!tokenEvolved3D[tokenId]) revert TokenNotEvolved();

        string memory image2D = _resolved2DImage(tokenId);
        if (bytes(image2D).length == 0) revert Missing2DImage();

        uint8 nextMode = DISPLAY_MODE_TEMP_2D;
        uint64 nextExpiry = uint64(block.timestamp + _displayToggleDuration());

        if (_isTemp2DActive(tokenId)) {
            nextMode = DISPLAY_MODE_DEFAULT_3D;
            nextExpiry = 0;
        }

        tokenDisplayMode[tokenId] = nextMode;
        tokenDisplayModeExpiresAt[tokenId] = nextExpiry;

        emit TokenDisplayModeChanged(tokenId, nextMode, uint256(nextExpiry), msg.sender);
        emit MetadataUpdate(tokenId);
    }

    function refreshExpiredDisplayMode(uint256 tokenId) external {
        if (tokenId == 0 || tokenId > _currentTokenId) revert InvalidToken();
        uint64 expiresAt = tokenDisplayModeExpiresAt[tokenId];
        if (tokenDisplayMode[tokenId] != DISPLAY_MODE_TEMP_2D || expiresAt == 0 || expiresAt > block.timestamp) {
            return;
        }

        tokenDisplayMode[tokenId] = DISPLAY_MODE_DEFAULT_3D;
        tokenDisplayModeExpiresAt[tokenId] = 0;

        emit TokenDisplayModeChanged(tokenId, DISPLAY_MODE_DEFAULT_3D, 0, msg.sender);
        emit MetadataUpdate(tokenId);
    }

    function setPublicDisplayToggleDuration(uint256 durationSeconds) external onlyOwner {
        if (durationSeconds == 0 || durationSeconds > 7 days) revert InvalidDisplayToggleDuration();
        publicDisplayToggleDuration = durationSeconds;
        emit DisplayToggleDurationChanged(durationSeconds);
    }

    function getTokenDisplayModeState(
        uint256 tokenId
    ) external view returns (uint8 configuredMode, uint8 effectiveMode, uint256 expiresAt, uint256 secondsRemaining) {
        if (tokenId == 0 || tokenId > _currentTokenId) revert InvalidToken();
        configuredMode = tokenDisplayMode[tokenId];
        uint64 configuredExpiry = tokenDisplayModeExpiresAt[tokenId];
        expiresAt = uint256(configuredExpiry);

        if (_isTemp2DActive(tokenId)) {
            effectiveMode = DISPLAY_MODE_TEMP_2D;
            secondsRemaining = uint256(configuredExpiry - uint64(block.timestamp));
            return (configuredMode, effectiveMode, expiresAt, secondsRemaining);
        }

        return (configuredMode, DISPLAY_MODE_DEFAULT_3D, expiresAt, 0);
    }

    function _applyEvolveTo3D(uint256 tokenId, string calldata imageUri, string memory modelUri) internal {
        _ensureEvolveHas2DSource(tokenId);
        if (bytes(tokenEvolvedImageCid[tokenId]).length > 0) {
            delete tokenEvolvedImageCid[tokenId];
        }
        tokenEvolvedImage[tokenId] = imageUri;
        _applyEvolveModelAndFlag(tokenId, modelUri);
    }

    function _applyEvolveTo3DCid(uint256 tokenId, string calldata imageCid, string memory modelUri) internal {
        _ensureEvolveHas2DSource(tokenId);
        if (bytes(tokenEvolvedImage[tokenId]).length > 0) {
            delete tokenEvolvedImage[tokenId];
        }
        tokenEvolvedImageCid[tokenId] = imageCid;
        _applyEvolveModelAndFlag(tokenId, modelUri);
    }

    function _validateEvolveRequest(
        uint256 tokenId,
        string calldata imageUri
    ) internal view {
        IEightBitPenguinsMetadataBuilder builder = _metadataBuilderOrRevert();
        _validateEvolveRequestWithBuilder(tokenId, imageUri, builder);
    }

    function _validateEvolveRequestWithModel(
        uint256 tokenId,
        string calldata imageUri,
        string calldata modelUri
    ) internal view {
        IEightBitPenguinsMetadataBuilder builder = _metadataBuilderOrRevert();
        _validateEvolveRequestWithBuilder(tokenId, imageUri, builder);
        if (!builder.isAllowedModelUri(modelUri)) revert InvalidModelUri();
    }

    function _validateEvolveRequestWithBuilder(
        uint256 tokenId,
        string calldata imageUri,
        IEightBitPenguinsMetadataBuilder builder
    ) internal view {
        _validateEvolveOwnershipAndState(tokenId);
        if (!builder.isAllowedEvolveImageUri(imageUri)) revert InvalidEvolveImageUri();
    }

    function _validateEvolveCidRequest(
        uint256 tokenId,
        string calldata imageCid
    ) internal view {
        _validateEvolveOwnershipAndState(tokenId);
        if (metadataBuilder == address(0)) revert MetadataBuilderAddressRequired();
        if (!_isLikelyIpfsCid(imageCid)) revert InvalidEvolveImageUri();
    }

    function _validateEvolveOwnershipAndState(uint256 tokenId) internal view {
        if (tokenId == 0 || tokenId > _currentTokenId) revert InvalidToken();
        if (ownerOf(tokenId) != msg.sender) revert NotTokenOwner();
        if (!revealed && !tokenEvolved3D[tokenId]) revert TokenUnrevealed();
    }

    function _isLikelyIpfsCid(string calldata value) internal pure returns (bool) {
        bytes calldata source = bytes(value);
        if (source.length < 20 || source.length > 90) return false;
        for (uint256 i = 0; i < source.length; i++) {
            bytes1 ch = source[i];
            bool isNum = ch >= "0" && ch <= "9";
            bool isUpper = ch >= "A" && ch <= "Z";
            bool isLower = ch >= "a" && ch <= "z";
            if (!(isNum || isUpper || isLower)) {
                return false;
            }
        }
        return true;
    }

    function _ensureEvolveHas2DSource(uint256 tokenId) internal {
        uint256 packedTraits = tokenTraitsPacked[tokenId];
        if (packedTraits == 0) {
            string memory original2D = _resolved2DImage(tokenId);
            if (bytes(original2D).length == 0) revert Missing2DImage();
            if (bytes(tokenOriginalImage[tokenId]).length == 0) {
                tokenOriginalImage[tokenId] = original2D;
            }
            return;
        }
        if (onchainRenderer == address(0)) revert Missing2DImage();
    }

    function _applyEvolveModelAndFlag(uint256 tokenId, string memory modelUri) internal {
        if (bytes(modelUri).length > 0) {
            tokenInteractiveModel[tokenId] = modelUri;
            emit TokenInteractiveModelUpdated(tokenId, modelUri);
        } else if (bytes(tokenInteractiveModel[tokenId]).length > 0) {
            delete tokenInteractiveModel[tokenId];
        }
        tokenEvolved3D[tokenId] = true;
        emit TokenEvolved3D(tokenId, msg.sender);
    }

    function _metadataBuilderOrRevert() internal view returns (IEightBitPenguinsMetadataBuilder builder) {
        address builderAddress = metadataBuilder;
        if (builderAddress == address(0)) revert MetadataBuilderAddressRequired();
        return IEightBitPenguinsMetadataBuilder(builderAddress);
    }

    function withdraw() external onlyOwner {
        (bool withdrawn, ) = payable(owner()).call{value: address(this).balance}("");
        if (!withdrawn) revert WithdrawTransferFailed();
    }

    function totalSupply() public view returns (uint256) {
        return _currentTokenId;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        string memory metadata = tokenMetadataJson(tokenId);
        return string(abi.encodePacked("data:application/json;base64,", Base64.encode(bytes(metadata))));
    }

    function tokenMetadataJson(uint256 tokenId) public view returns (string memory) {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");
        if (metadataBuilder == address(0)) revert MetadataBuilderAddressRequired();

        if (!revealed && !tokenEvolved3D[tokenId]) {
            return IEightBitPenguinsMetadataBuilder(metadataBuilder).unrevealedMetadataJson(tokenId, placeholderImage);
        }

        string memory image2D = _resolved2DImage(tokenId);
        string memory image3D = _resolved3DImage(tokenId);
        string memory attrs = tokenAttributes[tokenId];
        string memory rawName = tokenName[tokenId];
        bool evolved = tokenEvolved3D[tokenId];
        if (bytes(attrs).length == 0) {
            if (tokenTraitsPacked[tokenId] != 0) {
                attrs = IEightBitPenguinsOnchainRenderer(onchainRenderer).packedAttributesJson(tokenTraitsPacked[tokenId] - 1);
            } else {
                attrs = '[{"trait_type":"Property","value":"Metadata Missing"}]';
            }
        }
        if (bytes(rawName).length == 0 && tokenTraitsPacked[tokenId] != 0) {
            rawName = _tryPackedNameFromRenderer(tokenTraitsPacked[tokenId] - 1);
        }

        string memory activeImage = _resolvedActiveImage(tokenId, image2D, image3D, evolved);
        return _buildRevealedMetadata(tokenId, rawName, attrs, activeImage, image2D, image3D, evolved);
    }

    function _isLikelyJsonArray(string calldata value) internal pure returns (bool) {
        bytes calldata source = bytes(value);
        if (source.length < 2) return false;

        uint256 start = 0;
        while (start < source.length) {
            bytes1 ch = source[start];
            if (ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D) {
                start++;
            } else {
                break;
            }
        }

        if (start >= source.length || source[start] != "[") return false;

        uint256 end = source.length;
        while (end > start) {
            bytes1 ch = source[end - 1];
            if (ch == 0x20 || ch == 0x09 || ch == 0x0A || ch == 0x0D) {
                end--;
            } else {
                break;
            }
        }

        return end > start && source[end - 1] == "]";
    }

    function _resolved2DImage(uint256 tokenId) internal view returns (string memory) {
        if (bytes(tokenOriginalImage[tokenId]).length > 0) {
            return tokenOriginalImage[tokenId];
        }
        if (tokenTraitsPacked[tokenId] != 0 && onchainRenderer != address(0)) {
            string memory svg = IEightBitPenguinsOnchainRenderer(onchainRenderer).renderSVG(tokenTraitsPacked[tokenId] - 1);
            return string(abi.encodePacked("data:image/svg+xml;base64,", Base64.encode(bytes(svg))));
        }
        if (!tokenEvolved3D[tokenId]) {
            return tokenImage[tokenId];
        }
        return "";
    }

    function _resolved3DImage(uint256 tokenId) internal view returns (string memory) {
        if (bytes(tokenEvolvedImageCid[tokenId]).length > 0) {
            return string(abi.encodePacked("ipfs://", tokenEvolvedImageCid[tokenId]));
        }
        if (bytes(tokenEvolvedImage[tokenId]).length > 0) {
            return tokenEvolvedImage[tokenId];
        }
        if (tokenEvolved3D[tokenId]) {
            return tokenImage[tokenId];
        }
        return "";
    }

    function _buildRevealedMetadata(
        uint256 tokenId,
        string memory rawName,
        string memory attrs,
        string memory activeImage,
        string memory image2D,
        string memory image3D,
        bool evolved
    ) internal view returns (string memory) {
        IEightBitPenguinsMetadataBuilder.RevealedMetadataInput memory input =
            IEightBitPenguinsMetadataBuilder.RevealedMetadataInput({
                tokenId: tokenId,
                rawName: rawName,
                activeImage: activeImage,
                image2D: image2D,
                image3D: image3D,
                animationUrl: tokenInteractiveModel[tokenId],
                rawAttributes: attrs,
                score: _resolvedRarityScore(tokenId),
                rank: rarityRank(tokenId),
                evolved: evolved
            });
        return IEightBitPenguinsMetadataBuilder(metadataBuilder).revealedMetadataJson(input);
    }

    function _resolvedRarityScore(uint256 tokenId) internal view returns (uint256) {
        uint256 cached = tokenRarityScore[tokenId];
        if (cached > 0) {
            return cached;
        }

        uint256 packed = tokenTraitsPacked[tokenId];
        if (packed == 0) {
            return 0;
        }

        return IEightBitPenguinsOnchainRenderer(onchainRenderer).rarityScoreFromPacked(packed - 1);
    }

    function _resolvedActiveImage(
        uint256 tokenId,
        string memory image2D,
        string memory image3D,
        bool evolved
    ) internal view returns (string memory) {
        if (!evolved || bytes(image3D).length == 0) {
            return image2D;
        }

        if (_isTemp2DActive(tokenId) && bytes(image2D).length > 0) {
            return image2D;
        }

        return image3D;
    }

    function _isTemp2DActive(uint256 tokenId) internal view returns (bool) {
        uint64 expiresAt = tokenDisplayModeExpiresAt[tokenId];
        return tokenDisplayMode[tokenId] == DISPLAY_MODE_TEMP_2D && expiresAt > block.timestamp;
    }

    function _tryPackedNameFromRenderer(uint256 packedTraits) internal view returns (string memory) {
        address renderer = onchainRenderer;
        if (renderer == address(0)) return "";

        (bool ok, bytes memory result) = renderer.staticcall(
            abi.encodeWithSelector(
                IEightBitPenguinsOnchainRenderer.packedName.selector,
                packedTraits
            )
        );
        if (!ok || result.length == 0) return "";

        return abi.decode(result, (string));
    }

    function _displayToggleDuration() internal view returns (uint256) {
        uint256 configured = publicDisplayToggleDuration;
        if (configured == 0) {
            return DEFAULT_PUBLIC_DISPLAY_TOGGLE_DURATION;
        }
        return configured;
    }

    function rarityRank(uint256 tokenId) public view returns (uint256) {
        require(tokenId > 0 && tokenId <= _currentTokenId, "Invalid token");

        if (rarityFinalized) {
            uint256 frozenRank = tokenFinalRarityRank[tokenId];
            if (frozenRank > 0) {
                return frozenRank;
            }
        } else {
            // Rank is finalized post-mint to avoid expensive on-chain ranking work during active mint.
            return 0;
        }

        uint256 target = _resolvedRarityScore(tokenId);
        uint256 rank = 1;

        for (uint256 i = 1; i <= _currentTokenId; i++) {
            if (i == tokenId) continue;
            uint256 other = _resolvedRarityScore(i);
            if (other > target || (other == target && i < tokenId)) {
                rank++;
            }
        }

        return rank;
    }

    function royaltyInfo(uint256, uint256 salePrice) external view returns (address receiver, uint256 royaltyAmount) {
        receiver = royaltyReceiver;
        uint96 feeBps = royaltyFeeBps;
        if (receiver == address(0) || feeBps == 0) {
            return (address(0), 0);
        }
        royaltyAmount = (salePrice * uint256(feeBps)) / 10000;
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721Upgradeable, IERC165Upgradeable) returns (bool) {
        return
            interfaceId == type(IERC4906Upgradeable).interfaceId ||
            interfaceId == type(IERC2981Upgradeable).interfaceId ||
            super.supportsInterface(interfaceId);
    }

    function _directMintAllowed() internal view returns (bool) {
        if (!mintModeConfigured) {
            return true;
        }
        return directMintEnabled;
    }

    function _activePhaseConfig() internal view returns (bool configured, uint256 phaseId, uint256 price, uint256 maxPerWallet_) {
        (bool exists, uint256 id) = currentPhaseId();
        if (!exists) {
            if (_mintPhases.length != 0) revert NoActiveMintPhase();
            return (false, 0, mintPrice, 0);
        }

        MintPhase storage phase = _mintPhases[id];
        return (true, id, phase.price, phase.maxPerWallet);
    }

    function _collectEvolveFee() internal {
        address token = evolveFeeToken;
        if (token != address(0)) {
            if (msg.value != 0) revert NativeValueNotAcceptedForTokenFee();
            uint256 tokenAmount = evolveFeeTokenAmount;
            if (tokenAmount == 0) {
                return;
            }

            address receiverForToken = evolveFeeReceiver;
            if (receiverForToken == address(0)) revert InvalidEvolveFeeReceiver();
            bool transferred = IERC20(token).transferFrom(msg.sender, receiverForToken, tokenAmount);
            if (!transferred) revert EvolveFeeTransferFailed();
            return;
        }

        uint256 fee = evolveFee;
        if (msg.value < fee) revert InsufficientEvolveFee(fee, msg.value);
        if (fee > 0) {
            address receiver = evolveFeeReceiver;
            if (receiver == address(0)) revert InvalidEvolveFeeReceiver();
            (bool sent, ) = payable(receiver).call{value: fee}("");
            if (!sent) revert EvolveFeeTransferFailed();
        }
        if (msg.value > fee) {
            (bool refunded, ) = payable(msg.sender).call{value: msg.value - fee}("");
            if (!refunded) revert RefundTransferFailed();
        }
    }

}
