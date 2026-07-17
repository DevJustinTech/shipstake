# Minimal ABI — only the pieces the backend actually calls/reads.
# Regenerate the full ABI from contracts/artifacts/ after compiling if you
# add functions the backend needs to touch.
COMMITMENT_DEVICE_ABI = [
    {
        "inputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "name": "checkIn",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [{"internalType": "uint256", "name": "id", "type": "uint256"}],
        "name": "getCommitment",
        "outputs": [
            {
                "components": [
                    {"internalType": "address", "name": "creator", "type": "address"},
                    {"internalType": "address", "name": "beneficiary", "type": "address"},
                    {"internalType": "uint256", "name": "amount", "type": "uint256"},
                    {"internalType": "uint64", "name": "deadline", "type": "uint64"},
                    {"internalType": "string", "name": "description", "type": "string"},
                    {"internalType": "uint8", "name": "status", "type": "uint8"},
                ],
                "internalType": "struct CommitmentDevice.Commitment",
                "name": "",
                "type": "tuple",
            }
        ],
        "stateMutability": "view",
        "type": "function",
    },
]
