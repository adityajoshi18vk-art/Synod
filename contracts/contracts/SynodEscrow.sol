// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/governance/TimelockController.sol";

interface ISynodVoting {
    enum ProposalStatus { Pending, Approved, Rejected, Executed }

    struct Proposal {
        uint256 id;
        address proposer;
        string description;
        uint256 amount;
        address target;
        uint256 commitDeadline;
        uint256 revealDeadline;
        uint256 quorumThreshold;
        ProposalStatus status;
        uint256 yesWeight;
        uint256 noWeight;
        uint256 yesCount;
        uint256 noCount;
        bool tallied;
    }

    function getProposal(uint256 proposalId) external view returns (Proposal memory);
}

/**
 * @title SynodEscrow
 * @notice Holds proposal funds. Releases to the target once a proposal is
 *         Approved in SynodVoting. Refunds the depositor if Rejected or
 *         if the reveal deadline passes without tally.
 *
 *         The guardian (a TimelockController) can pause releases in an emergency.
 */
contract SynodEscrow is ReentrancyGuard {
    // ──────────────────────────────────────────────
    //  Types
    // ──────────────────────────────────────────────

    struct EscrowDeposit {
        address depositor;
        uint256 amount;
        uint256 proposalId;
        bool released;
        bool refunded;
    }

    // ──────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────

    ISynodVoting public immutable voting;
    address public guardian; // TimelockController address
    bool public paused;

    uint256 public depositCount;
    mapping(uint256 => EscrowDeposit) public deposits;

    // proposalId => depositId (one deposit per proposal for simplicity)
    mapping(uint256 => uint256) public proposalDeposit;

    // ──────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────

    event EscrowFunded(uint256 indexed depositId, uint256 indexed proposalId, address depositor, uint256 amount);
    event EscrowReleased(uint256 indexed depositId, uint256 indexed proposalId, address target, uint256 amount);
    event EscrowRefunded(uint256 indexed depositId, uint256 indexed proposalId, address depositor, uint256 amount);
    event EscrowPaused(address indexed by);
    event EscrowUnpaused(address indexed by);
    event GuardianUpdated(address indexed oldGuardian, address indexed newGuardian);

    // ──────────────────────────────────────────────
    //  Modifiers
    // ──────────────────────────────────────────────

    modifier onlyGuardian() {
        require(msg.sender == guardian, "Only guardian");
        _;
    }

    modifier whenNotPaused() {
        require(!paused, "Escrow is paused");
        _;
    }

    // ──────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────

    constructor(address _voting, address _guardian) {
        require(_voting != address(0), "Invalid voting address");
        require(_guardian != address(0), "Invalid guardian address");
        voting = ISynodVoting(_voting);
        guardian = _guardian;
    }

    // ──────────────────────────────────────────────
    //  Deposit
    // ──────────────────────────────────────────────

    /**
     * @dev Deposit MON into escrow for a specific proposal.
     */
    function deposit(uint256 proposalId) external payable {
        require(msg.value > 0, "Must send MON");
        require(proposalDeposit[proposalId] == 0, "Already funded");

        // Verify proposal exists and is pending
        ISynodVoting.Proposal memory p = voting.getProposal(proposalId);
        require(p.status == ISynodVoting.ProposalStatus.Pending, "Proposal not pending");

        depositCount++;
        deposits[depositCount] = EscrowDeposit({
            depositor: msg.sender,
            amount: msg.value,
            proposalId: proposalId,
            released: false,
            refunded: false
        });
        proposalDeposit[proposalId] = depositCount;

        emit EscrowFunded(depositCount, proposalId, msg.sender, msg.value);
    }

    // ──────────────────────────────────────────────
    //  Release (on Approved)
    // ──────────────────────────────────────────────

    /**
     * @dev Release funds to the proposal's target address.
     *      Only if the proposal is Approved. Protected by ReentrancyGuard.
     */
    function release(uint256 proposalId) external nonReentrant whenNotPaused {
        uint256 depositId = proposalDeposit[proposalId];
        require(depositId != 0, "No deposit for this proposal");

        EscrowDeposit storage d = deposits[depositId];
        require(!d.released, "Already released");
        require(!d.refunded, "Already refunded");

        ISynodVoting.Proposal memory p = voting.getProposal(proposalId);
        require(p.status == ISynodVoting.ProposalStatus.Approved, "Proposal not approved");

        d.released = true;

        (bool success, ) = payable(p.target).call{value: d.amount}("");
        require(success, "Transfer failed");

        emit EscrowReleased(depositId, proposalId, p.target, d.amount);
    }

    // ──────────────────────────────────────────────
    //  Refund (on Rejected or deadline passed)
    // ──────────────────────────────────────────────

    /**
     * @dev Refund funds to the depositor if proposal was rejected
     *      or the reveal deadline has passed without a tally.
     */
    function refund(uint256 proposalId) external nonReentrant {
        uint256 depositId = proposalDeposit[proposalId];
        require(depositId != 0, "No deposit for this proposal");

        EscrowDeposit storage d = deposits[depositId];
        require(!d.released, "Already released");
        require(!d.refunded, "Already refunded");

        ISynodVoting.Proposal memory p = voting.getProposal(proposalId);

        // Allow refund if rejected OR if reveal deadline passed without tally
        bool isRejected = (p.status == ISynodVoting.ProposalStatus.Rejected);
        bool deadlinePassed = (block.timestamp > p.revealDeadline && !p.tallied);
        require(isRejected || deadlinePassed, "Cannot refund yet");

        d.refunded = true;

        (bool success, ) = payable(d.depositor).call{value: d.amount}("");
        require(success, "Transfer failed");

        emit EscrowRefunded(depositId, proposalId, d.depositor, d.amount);
    }

    // ──────────────────────────────────────────────
    //  Guardian Controls (TimelockController)
    // ──────────────────────────────────────────────

    function pause() external onlyGuardian {
        paused = true;
        emit EscrowPaused(msg.sender);
    }

    function unpause() external onlyGuardian {
        paused = false;
        emit EscrowUnpaused(msg.sender);
    }

    function setGuardian(address newGuardian) external onlyGuardian {
        require(newGuardian != address(0), "Invalid address");
        emit GuardianUpdated(guardian, newGuardian);
        guardian = newGuardian;
    }

    // ──────────────────────────────────────────────
    //  View
    // ──────────────────────────────────────────────

    function getDeposit(uint256 depositId) external view returns (EscrowDeposit memory) {
        return deposits[depositId];
    }

    /**
     * @dev Allow contract to receive MON directly.
     */
    receive() external payable {}
}
