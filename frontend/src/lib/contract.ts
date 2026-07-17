export const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS as `0x${string}`;
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

// Mirrors contracts/contracts/CommitmentDevice.sol — keep in sync if the
// contract changes.
export const COMMITMENT_DEVICE_ABI = [
  {
    type: "function",
    name: "createCommitment",
    stateMutability: "payable",
    inputs: [
      { name: "beneficiary", type: "address" },
      { name: "deadline", type: "uint64" },
      { name: "description", type: "string" },
    ],
    outputs: [{ name: "id", type: "uint256" }],
  },
  {
    type: "function",
    name: "checkIn",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "withdrawFulfilled",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimFailedStake",
    stateMutability: "nonpayable",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "getCommitment",
    stateMutability: "view",
    inputs: [{ name: "id", type: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        components: [
          { name: "creator", type: "address" },
          { name: "beneficiary", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "deadline", type: "uint64" },
          { name: "description", type: "string" },
          { name: "status", type: "uint8" },
        ],
      },
    ],
  },
  {
    type: "function",
    name: "nextId",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "event",
    name: "CommitmentCreated",
    inputs: [
      { name: "id", type: "uint256", indexed: true },
      { name: "creator", type: "address", indexed: true },
      { name: "beneficiary", type: "address", indexed: true },
      { name: "amount", type: "uint256", indexed: false },
      { name: "deadline", type: "uint64", indexed: false },
      { name: "description", type: "string", indexed: false },
    ],
  },
] as const;

export const STATUS_LABEL = ["active", "fulfilled", "failed", "withdrawn"] as const;
