const contractABI = [
    {
        "inputs":  [

                   ],
        "stateMutability":  "nonpayable",
        "type":  "constructor"
    },
    {
        "inputs":  [

                   ],
        "name":  "AttributesMustBeJsonArray",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "AttributesRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "BadRankLen",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "BadScoreLen",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "DirectMintDisabled",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ExceedsGlobalMaxPerWallet",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ExceedsMaxSupply",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ExceedsPhaseMaxPerWallet",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "ExceedsPhaseMaxSupply",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InsufficientPayment",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidDisplayToggleDuration",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidEvolveImageUri",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidImageData",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidModelUri",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidPhaseWindow",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidRoyaltyFeeBps",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidRoyaltyReceiver",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidToken",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "InvalidWhitelistAddress",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MaxPerWalletMustBePositive",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MaxSupplyBelowMinted",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MaxSupplyMustBePositive",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MetadataBuilderAddressRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MintingNotActive",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "Missing2DImage",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MissingAttributesCount",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MissingImageCount",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MissingNameCount",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MissingRarityScoreCount",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "MustMintAtLeastOne",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NoActiveMintPhase",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NoIds",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NoPhaseToDelete",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NoTokensMinted",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NotTokenOwner",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "NotWhitelistedForPhase",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "OnlyLastPhaseCanBeDeleted",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "PhaseDisabled",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "PhaseDoesNotExist",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "PhaseNameRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "PlaceholderImageRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "RandomnessHelperAddressRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "RarityAlreadyFinalized",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "RendererAddressRequired",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "SellOutOrCloseMintFirst",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "TokenNotEvolved",
        "type":  "error"
    },
    {
        "inputs":  [

                   ],
        "name":  "TokenUnrevealed",
        "type":  "error"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "owner",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "approved",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "Approval",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "owner",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "operator",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "approved",
                           "type":  "bool"
                       }
                   ],
        "name":  "ApprovalForAll",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "_fromTokenId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "_toTokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "BatchMetadataUpdate",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "durationSeconds",
                           "type":  "uint256"
                       }
                   ],
        "name":  "DisplayToggleDurationChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint8",
                           "name":  "version",
                           "type":  "uint8"
                       }
                   ],
        "name":  "Initialized",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "maxPerWallet",
                           "type":  "uint256"
                       }
                   ],
        "name":  "MaxPerWalletChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "maxSupply",
                           "type":  "uint256"
                       }
                   ],
        "name":  "MaxSupplyChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "metadataBuilder",
                           "type":  "address"
                       }
                   ],
        "name":  "MetadataBuilderUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "_tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "MetadataUpdate",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "directMintEnabled",
                           "type":  "bool"
                       }
                   ],
        "name":  "MintModeConfigured",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "price",
                           "type":  "uint256"
                       }
                   ],
        "name":  "MintPriceChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "status",
                           "type":  "bool"
                       }
                   ],
        "name":  "MintStatusChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "renderer",
                           "type":  "address"
                       }
                   ],
        "name":  "OnchainRendererUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "previousOwner",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "newOwner",
                           "type":  "address"
                       }
                   ],
        "name":  "OwnershipTransferred",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "PhaseRemoved",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "string",
                           "name":  "name",
                           "type":  "string"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "price",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "startTime",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "endTime",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "maxSupply",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "maxPerWallet",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "enabled",
                           "type":  "bool"
                       }
                   ],
        "name":  "PhaseUpserted",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "allowed",
                           "type":  "bool"
                       }
                   ],
        "name":  "PhaseWhitelistUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "string",
                           "name":  "image",
                           "type":  "string"
                       }
                   ],
        "name":  "PlaceholderImageChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "randomnessHelper",
                           "type":  "address"
                       }
                   ],
        "name":  "RandomnessHelperUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "supply",
                           "type":  "uint256"
                       }
                   ],
        "name":  "RarityFinalized",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  false,
                           "internalType":  "bool",
                           "name":  "status",
                           "type":  "bool"
                       }
                   ],
        "name":  "RevealStatusChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "receiver",
                           "type":  "address"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint96",
                           "name":  "feeBps",
                           "type":  "uint96"
                       }
                   ],
        "name":  "RoyaltyInfoUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "uint8",
                           "name":  "mode",
                           "type":  "uint8"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "uint256",
                           "name":  "expiresAt",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "triggeredBy",
                           "type":  "address"
                       }
                   ],
        "name":  "TokenDisplayModeChanged",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "owner",
                           "type":  "address"
                       }
                   ],
        "name":  "TokenEvolved3D",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "indexed":  false,
                           "internalType":  "string",
                           "name":  "modelUri",
                           "type":  "string"
                       }
                   ],
        "name":  "TokenInteractiveModelUpdated",
        "type":  "event"
    },
    {
        "anonymous":  false,
        "inputs":  [
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "from",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "address",
                           "name":  "to",
                           "type":  "address"
                       },
                       {
                           "indexed":  true,
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "Transfer",
        "type":  "event"
    },
    {
        "inputs":  [

                   ],
        "name":  "MAX_PER_WALLET",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "MAX_SUPPLY",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "to",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "approve",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "owner",
                           "type":  "address"
                       }
                   ],
        "name":  "balanceOf",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "bool",
                           "name":  "directMintEnabled_",
                           "type":  "bool"
                       }
                   ],
        "name":  "configureMintMode",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "currentPhaseId",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "exists",
                            "type":  "bool"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "phaseId",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "deletePhase",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "directMintEnabled",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "string",
                           "name":  "imageUri",
                           "type":  "string"
                       },
                       {
                           "internalType":  "string",
                           "name":  "attributesJson",
                           "type":  "string"
                       }
                   ],
        "name":  "evolveTo3D",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "string",
                           "name":  "imageUri",
                           "type":  "string"
                       }
                   ],
        "name":  "evolveTo3DImageOnly",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "string",
                           "name":  "imageUri",
                           "type":  "string"
                       },
                       {
                           "internalType":  "string",
                           "name":  "modelUri",
                           "type":  "string"
                       }
                   ],
        "name":  "evolveTo3DImageOnlyWithModel",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "string",
                           "name":  "imageUri",
                           "type":  "string"
                       },
                       {
                           "internalType":  "string",
                           "name":  "modelUri",
                           "type":  "string"
                       },
                       {
                           "internalType":  "string",
                           "name":  "attributesJson",
                           "type":  "string"
                       }
                   ],
        "name":  "evolveTo3DWithModel",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "finalizeRarity",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getApproved",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "",
                            "type":  "address"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "getOnchainRenderer",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "",
                            "type":  "address"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getPhase",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "name_",
                            "type":  "string"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "price",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "startTime",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "endTime",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "maxSupply_",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "maxPerWallet_",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "minted",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "bool",
                            "name":  "enabled",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getPhaseWhitelist",
        "outputs":  [
                        {
                            "internalType":  "address[]",
                            "name":  "",
                            "type":  "address[]"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "offset",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "limit",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getPhaseWhitelistSlice",
        "outputs":  [
                        {
                            "internalType":  "address[]",
                            "name":  "accounts",
                            "type":  "address[]"
                        },
                        {
                            "internalType":  "bool[]",
                            "name":  "active",
                            "type":  "bool[]"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "nextOffset",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "totalMembers",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "getTokenDisplayModeState",
        "outputs":  [
                        {
                            "internalType":  "uint8",
                            "name":  "configuredMode",
                            "type":  "uint8"
                        },
                        {
                            "internalType":  "uint8",
                            "name":  "effectiveMode",
                            "type":  "uint8"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "expiresAt",
                            "type":  "uint256"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "secondsRemaining",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "initialize",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "owner",
                           "type":  "address"
                       },
                       {
                           "internalType":  "address",
                           "name":  "operator",
                           "type":  "address"
                       }
                   ],
        "name":  "isApprovedForAll",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "address",
                           "name":  "account",
                           "type":  "address"
                       }
                   ],
        "name":  "isPhaseWhitelisted",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "quantity",
                           "type":  "uint256"
                       }
                   ],
        "name":  "mint",
        "outputs":  [

                    ],
        "stateMutability":  "payable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "mintActive",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "mintModeConfigured",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "mintPrice",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "",
                           "type":  "address"
                       }
                   ],
        "name":  "mintedPerWallet",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "name",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "owner",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "",
                            "type":  "address"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "ownerOf",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "",
                            "type":  "address"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "phaseCount",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "address",
                           "name":  "",
                           "type":  "address"
                       }
                   ],
        "name":  "phaseMintedPerWallet",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "phaseWhitelistCount",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "phaseWhitelistMemberCount",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "placeholderImage",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "publicDisplayToggleDuration",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "rarityFinalized",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "rarityRank",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "refreshExpiredDisplayMode",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "renounceOwnership",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "revealed",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "royaltyFeeBps",
        "outputs":  [
                        {
                            "internalType":  "uint96",
                            "name":  "",
                            "type":  "uint96"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "salePrice",
                           "type":  "uint256"
                       }
                   ],
        "name":  "royaltyInfo",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "receiver",
                            "type":  "address"
                        },
                        {
                            "internalType":  "uint256",
                            "name":  "royaltyAmount",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "royaltyReceiver",
        "outputs":  [
                        {
                            "internalType":  "address",
                            "name":  "",
                            "type":  "address"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "from",
                           "type":  "address"
                       },
                       {
                           "internalType":  "address",
                           "name":  "to",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "safeTransferFrom",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "from",
                           "type":  "address"
                       },
                       {
                           "internalType":  "address",
                           "name":  "to",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "bytes",
                           "name":  "data",
                           "type":  "bytes"
                       }
                   ],
        "name":  "safeTransferFrom",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "operator",
                           "type":  "address"
                       },
                       {
                           "internalType":  "bool",
                           "name":  "approved",
                           "type":  "bool"
                       }
                   ],
        "name":  "setApprovalForAll",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256[]",
                           "name":  "tokenIds",
                           "type":  "uint256[]"
                       },
                       {
                           "internalType":  "uint256[]",
                           "name":  "scores",
                           "type":  "uint256[]"
                       },
                       {
                           "internalType":  "uint256[]",
                           "name":  "ranks",
                           "type":  "uint256[]"
                       }
                   ],
        "name":  "setFinalRarityData",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "maxPerWallet_",
                           "type":  "uint256"
                       }
                   ],
        "name":  "setMaxPerWallet",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "maxSupply_",
                           "type":  "uint256"
                       }
                   ],
        "name":  "setMaxSupply",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "metadataBuilder_",
                           "type":  "address"
                       }
                   ],
        "name":  "setMetadataBuilder",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "price",
                           "type":  "uint256"
                       }
                   ],
        "name":  "setMintPrice",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "renderer",
                           "type":  "address"
                       }
                   ],
        "name":  "setOnchainRenderer",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "address[]",
                           "name":  "accounts",
                           "type":  "address[]"
                       },
                       {
                           "internalType":  "bool",
                           "name":  "allowed",
                           "type":  "bool"
                       }
                   ],
        "name":  "setPhaseWhitelist",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "string",
                           "name":  "image",
                           "type":  "string"
                       }
                   ],
        "name":  "setPlaceholderImage",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "durationSeconds",
                           "type":  "uint256"
                       }
                   ],
        "name":  "setPublicDisplayToggleDuration",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "randomnessHelper_",
                           "type":  "address"
                       }
                   ],
        "name":  "setRandomnessHelper",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "bool",
                           "name":  "status",
                           "type":  "bool"
                       }
                   ],
        "name":  "setRevealed",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "receiver",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint96",
                           "name":  "feeBps",
                           "type":  "uint96"
                       }
                   ],
        "name":  "setRoyaltyInfo",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "bytes4",
                           "name":  "interfaceId",
                           "type":  "bytes4"
                       }
                   ],
        "name":  "supportsInterface",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "symbol",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "toggleEvolvedDisplayMode",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "toggleMint",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenAttributes",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenEvolved3D",
        "outputs":  [
                        {
                            "internalType":  "bool",
                            "name":  "",
                            "type":  "bool"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenEvolvedImage",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenFinalRarityRank",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenImage",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenInteractiveModel",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenMetadataJson",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenName",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenOriginalImage",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenRarityScore",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "tokenURI",
        "outputs":  [
                        {
                            "internalType":  "string",
                            "name":  "",
                            "type":  "string"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "totalSupply",
        "outputs":  [
                        {
                            "internalType":  "uint256",
                            "name":  "",
                            "type":  "uint256"
                        }
                    ],
        "stateMutability":  "view",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "from",
                           "type":  "address"
                       },
                       {
                           "internalType":  "address",
                           "name":  "to",
                           "type":  "address"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "tokenId",
                           "type":  "uint256"
                       }
                   ],
        "name":  "transferFrom",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "address",
                           "name":  "newOwner",
                           "type":  "address"
                       }
                   ],
        "name":  "transferOwnership",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [
                       {
                           "internalType":  "uint256",
                           "name":  "phaseId",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "string",
                           "name":  "name_",
                           "type":  "string"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "price",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "startTime",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "endTime",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "maxSupply_",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "uint256",
                           "name":  "maxPerWallet_",
                           "type":  "uint256"
                       },
                       {
                           "internalType":  "bool",
                           "name":  "enabled",
                           "type":  "bool"
                       }
                   ],
        "name":  "upsertPhase",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    },
    {
        "inputs":  [

                   ],
        "name":  "withdraw",
        "outputs":  [

                    ],
        "stateMutability":  "nonpayable",
        "type":  "function"
    }
]

export default contractABI

