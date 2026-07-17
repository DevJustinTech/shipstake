// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ShipStake — an onchain commitment device
/// @notice You stake MON against a goal (e.g. "ship this GitHub repo by Friday").
///         A trusted verifier (this project's backend, which checks your GitHub
///         activity) confirms whether you followed through. Miss the deadline
///         with no check-in and anyone can pull the trigger: your stake is
///         swept to the beneficiary you named when you made the bet.
/// @dev The verifier is a single trusted address for hackathon scope. A real
///      production version would replace this with a decentralized oracle
///      (e.g. Chainlink Functions calling the GitHub API) so no single party
///      is trusted to attest completion.
contract CommitmentDevice {
    enum Status {
        Active,
        Fulfilled,
        Failed,
        Withdrawn
    }

    struct Commitment {
        address creator;
        address beneficiary;
        uint256 amount;
        uint64 deadline;
        string description;
        Status status;
    }

    address public verifier;
    address public owner;
    uint256 public nextId;

    mapping(uint256 => Commitment) public commitments;

    event CommitmentCreated(
        uint256 indexed id,
        address indexed creator,
        address indexed beneficiary,
        uint256 amount,
        uint64 deadline,
        string description
    );
    event CheckedIn(uint256 indexed id);
    event StakeReclaimed(uint256 indexed id, address indexed creator, uint256 amount);
    event StakeSlashed(uint256 indexed id, address indexed beneficiary, uint256 amount);
    event VerifierUpdated(address indexed newVerifier);

    error NotVerifier();
    error NotOwner();
    error NotFound();
    error NotActive();
    error DeadlinePassed();
    error DeadlineNotPassed();
    error NoStake();
    error TransferFailed();

    modifier onlyVerifier() {
        if (msg.sender != verifier) revert NotVerifier();
        _;
    }

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    constructor(address _verifier) {
        owner = msg.sender;
        verifier = _verifier;
    }

    /// @notice Stake MON against a goal. Funds are locked until the verifier
    ///         checks you in (success) or the deadline passes unfulfilled
    ///         (failure — beneficiary can claim).
    function createCommitment(
        address beneficiary,
        uint64 deadline,
        string calldata description
    ) external payable returns (uint256 id) {
        if (msg.value == 0) revert NoStake();
        if (deadline <= block.timestamp) revert DeadlinePassed();

        id = nextId++;
        commitments[id] = Commitment({
            creator: msg.sender,
            beneficiary: beneficiary,
            amount: msg.value,
            deadline: deadline,
            description: description,
            status: Status.Active
        });

        emit CommitmentCreated(id, msg.sender, beneficiary, msg.value, deadline, description);
    }

    /// @notice Called by the backend verifier once it has confirmed the
    ///         creator's GitHub activity satisfies the commitment.
    function checkIn(uint256 id) external onlyVerifier {
        Commitment storage c = commitments[id];
        if (c.creator == address(0)) revert NotFound();
        if (c.status != Status.Active) revert NotActive();
        if (block.timestamp > c.deadline) revert DeadlinePassed();

        c.status = Status.Fulfilled;
        emit CheckedIn(id);
    }

    /// @notice Creator withdraws their stake back after a successful check-in.
    function withdrawFulfilled(uint256 id) external {
        Commitment storage c = commitments[id];
        if (c.creator == address(0)) revert NotFound();
        if (msg.sender != c.creator) revert NotOwner();
        if (c.status != Status.Fulfilled) revert NotActive();

        uint256 amount = c.amount;
        c.status = Status.Withdrawn;
        c.amount = 0;

        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit StakeReclaimed(id, msg.sender, amount);
    }

    /// @notice Anyone can trigger this once the deadline has passed with no
    ///         check-in — sweeps the stake to the beneficiary. Permissionless
    ///         so the creator can't just avoid calling it themselves.
    function claimFailedStake(uint256 id) external {
        Commitment storage c = commitments[id];
        if (c.creator == address(0)) revert NotFound();
        if (c.status != Status.Active) revert NotActive();
        if (block.timestamp <= c.deadline) revert DeadlineNotPassed();

        uint256 amount = c.amount;
        c.status = Status.Failed;
        c.amount = 0;

        (bool ok, ) = payable(c.beneficiary).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit StakeSlashed(id, c.beneficiary, amount);
    }

    function getCommitment(uint256 id) external view returns (Commitment memory) {
        return commitments[id];
    }

    /// @notice Owner can rotate the verifier address (e.g. if the backend's
    ///         signing key is rotated).
    function setVerifier(address newVerifier) external onlyOwner {
        verifier = newVerifier;
        emit VerifierUpdated(newVerifier);
    }
}
