// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IAgentRegistry {
    function isRegistered(address agentAddress) external view returns (bool);
    function getReputation(address agentAddress) external view returns (uint256);
    function updateReputation(address agentAddress, bool isCorrect) external;
}

contract SynodVoting {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    enum ProposalStatus { Pending, Approved, Rejected, Executed }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 amount;
        address target;
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 quorumThreshold; // minimum total reputation weight needed
        ProposalStatus status;
        uint256 yesWeight;       // reputation-weighted yes
        uint256 noWeight;        // reputation-weighted no
        uint256 yesCount;        // raw count (for display)
        uint256 noCount;         // raw count (for display)
        bool tallied;
    }

    struct VoteCommit {
        bytes32 commitHash;
        bool revealed;
        bool choice;
        uint256 weight;          // reputation at commit time
        string rationale;        // templated rationale string
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    IAgentRegistry public immutable registry;

    uint256 public proposalCount;
    mapping(uint256 => Proposal) public proposals;

    // proposalId => voter => VoteCommit
    mapping(uint256 => mapping(address => VoteCommit)) public votes;

    // proposalId => list of voters (for iteration during tally)
    mapping(uint256 => address[]) public proposalVoters;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event ProposalCreated(
        uint256 indexed proposalId,
        address indexed proposer,
        string description,
        uint256 amount,
        address target,
        uint256 commitDeadline,
        uint256 revealDeadline,
        uint256 quorumThreshold
    );

    event VoteCommitted(
        uint256 indexed proposalId,
        address indexed voter,
        uint256 weight
    );

    event VoteRevealed(
        uint256 indexed proposalId,
        address indexed voter,
        bool choice,
        uint256 weight,
        string rationale
    );

    event ProposalResolved(
        uint256 indexed proposalId,
        ProposalStatus status,
        uint256 yesWeight,
        uint256 noWeight,
        uint256 yesCount,
        uint256 noCount
    );

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _registry) {
        require(_registry != address(0), "Invalid registry address");
        registry = IAgentRegistry(_registry);
    }

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyRegisteredAgent() {
        require(registry.isRegistered(msg.sender), "Caller is not a registered agent");
        _;
    }

    // ──────────────────────────────────────────────
    //  Proposal Submission
    // ──────────────────────────────────────────────

    function submitProposal(
        string calldata description,
        uint256 amount,
        address target,
        uint256 commitWindow,
        uint256 revealWindow,
        uint256 quorumThreshold
    ) external returns (uint256) {
        require(commitWindow > 0, "Commit window must be > 0");
        require(revealWindow > 0, "Reveal window must be > 0");
        require(quorumThreshold > 0, "Quorum must be > 0");

        proposalCount++;
        uint256 proposalId = proposalCount;

        proposals[proposalId] = Proposal({
            id: proposalId,
            proposer: msg.sender,
            description: description,
            amount: amount,
            target: target,
            commitDeadline: block.timestamp + commitWindow,
            revealDeadline: block.timestamp + commitWindow + revealWindow,
            quorumThreshold: quorumThreshold,
            status: ProposalStatus.Pending,
            yesWeight: 0,
            noWeight: 0,
            yesCount: 0,
            noCount: 0,
            tallied: false
        });

        emit ProposalCreated(
            proposalId,
            msg.sender,
            description,
            amount,
            target,
            block.timestamp + commitWindow,
            block.timestamp + commitWindow + revealWindow,
            quorumThreshold
        );

        return proposalId;
    }

    // ──────────────────────────────────────────────
    //  Commit Phase
    // ──────────────────────────────────────────────

    /**
     * @dev Commit a vote hash. Captures the agent's reputation at commit time
     *      as the vote weight.
     *      hash = keccak256(abi.encodePacked(choice, salt, msg.sender))
     */
    function commitVote(uint256 proposalId, bytes32 hash) external onlyRegisteredAgent {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(block.timestamp <= p.commitDeadline, "Commit window closed");
        require(p.status == ProposalStatus.Pending, "Proposal not pending");
        require(votes[proposalId][msg.sender].commitHash == bytes32(0), "Already committed");

        uint256 weight = registry.getReputation(msg.sender);

        votes[proposalId][msg.sender].commitHash = hash;
        votes[proposalId][msg.sender].weight = weight;
        proposalVoters[proposalId].push(msg.sender);

        emit VoteCommitted(proposalId, msg.sender, weight);
    }

    // ──────────────────────────────────────────────
    //  Reveal Phase
    // ──────────────────────────────────────────────

    /**
     * @dev Reveal a vote with a templated rationale string.
     */
    function revealVote(
        uint256 proposalId,
        bool choice,
        bytes32 salt,
        string calldata rationale
    ) external onlyRegisteredAgent {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(block.timestamp > p.commitDeadline, "Commit window still open");
        require(block.timestamp <= p.revealDeadline, "Reveal window closed");
        require(p.status == ProposalStatus.Pending, "Proposal not pending");

        VoteCommit storage vc = votes[proposalId][msg.sender];
        require(vc.commitHash != bytes32(0), "No commit found");
        require(!vc.revealed, "Already revealed");

        // Verify the hash
        bytes32 expectedHash = keccak256(abi.encodePacked(choice, salt, msg.sender));
        require(expectedHash == vc.commitHash, "Hash mismatch");

        vc.revealed = true;
        vc.choice = choice;
        vc.rationale = rationale;

        if (choice) {
            p.yesWeight += vc.weight;
            p.yesCount++;
        } else {
            p.noWeight += vc.weight;
            p.noCount++;
        }

        emit VoteRevealed(proposalId, msg.sender, choice, vc.weight, rationale);
    }

    /**
     * @dev Backward-compatible revealVote without rationale (uses empty string).
     */
    function revealVote(
        uint256 proposalId,
        bool choice,
        bytes32 salt
    ) external onlyRegisteredAgent {
        _revealVoteInternal(proposalId, choice, salt, "");
    }

    function _revealVoteInternal(
        uint256 proposalId,
        bool choice,
        bytes32 salt,
        string memory rationale
    ) internal {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(block.timestamp > p.commitDeadline, "Commit window still open");
        require(block.timestamp <= p.revealDeadline, "Reveal window closed");
        require(p.status == ProposalStatus.Pending, "Proposal not pending");

        VoteCommit storage vc = votes[proposalId][msg.sender];
        require(vc.commitHash != bytes32(0), "No commit found");
        require(!vc.revealed, "Already revealed");

        bytes32 expectedHash = keccak256(abi.encodePacked(choice, salt, msg.sender));
        require(expectedHash == vc.commitHash, "Hash mismatch");

        vc.revealed = true;
        vc.choice = choice;
        vc.rationale = rationale;

        if (choice) {
            p.yesWeight += vc.weight;
            p.yesCount++;
        } else {
            p.noWeight += vc.weight;
            p.noCount++;
        }

        emit VoteRevealed(proposalId, msg.sender, choice, vc.weight, rationale);
    }

    // ──────────────────────────────────────────────
    //  Tally (reputation-weighted)
    // ──────────────────────────────────────────────

    /**
     * @dev Tally using reputation-weighted votes.
     *      Approved if yesWeight > noWeight AND totalWeight >= quorumThreshold.
     *      After tallying, updates each voter's reputation in AgentRegistry.
     */
    function tallyVotes(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        require(p.id != 0, "Proposal does not exist");
        require(block.timestamp > p.revealDeadline, "Reveal window still open");
        require(!p.tallied, "Already tallied");
        require(p.status == ProposalStatus.Pending, "Proposal not pending");

        p.tallied = true;

        uint256 totalWeight = p.yesWeight + p.noWeight;

        if (totalWeight >= p.quorumThreshold && p.yesWeight > p.noWeight) {
            p.status = ProposalStatus.Approved;
        } else {
            p.status = ProposalStatus.Rejected;
        }

        // Update reputation for each voter
        bool approvedOutcome = (p.status == ProposalStatus.Approved);
        address[] storage voters = proposalVoters[proposalId];
        for (uint256 i = 0; i < voters.length; i++) {
            VoteCommit storage vc = votes[proposalId][voters[i]];
            if (vc.revealed) {
                // Correct = voted with the winning side
                bool isCorrect = (vc.choice == approvedOutcome);
                registry.updateReputation(voters[i], isCorrect);
            }
        }

        emit ProposalResolved(proposalId, p.status, p.yesWeight, p.noWeight, p.yesCount, p.noCount);
    }

    // ──────────────────────────────────────────────
    //  View Helpers
    // ──────────────────────────────────────────────

    function getProposal(uint256 proposalId) external view returns (Proposal memory) {
        require(proposals[proposalId].id != 0, "Proposal does not exist");
        return proposals[proposalId];
    }

    function getVoterCount(uint256 proposalId) external view returns (uint256) {
        return proposalVoters[proposalId].length;
    }

    function getVote(uint256 proposalId, address voter) external view returns (VoteCommit memory) {
        return votes[proposalId][voter];
    }

    function getVoters(uint256 proposalId) external view returns (address[] memory) {
        return proposalVoters[proposalId];
    }

    function computeVoteHash(bool choice, bytes32 salt, address voter) external pure returns (bytes32) {
        return keccak256(abi.encodePacked(choice, salt, voter));
    }
}
