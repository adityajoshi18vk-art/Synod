// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract AgentRegistry {
    struct Agent {
        bool isRegistered;
        string label;
        uint256 reputationScore;
        uint256 totalVotes;
        uint256 correctVotes;
    }

    address public owner;
    address public votingContract;

    mapping(address => Agent) public agents;
    address[] public agentList;
    
    event AgentRegistered(address indexed agentAddress, string label);
    event ReputationUpdated(address indexed agentAddress, uint256 oldScore, uint256 newScore);
    event VotingContractSet(address indexed votingContract);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    modifier onlyVotingContract() {
        require(msg.sender == votingContract, "Only voting contract");
        _;
    }

    modifier onlyRegistered(address agentAddress) {
        require(agents[agentAddress].isRegistered, "Agent not registered");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    /**
     * @dev Set the SynodVoting contract address (only owner, one-time setup).
     */
    function setVotingContract(address _votingContract) external onlyOwner {
        require(_votingContract != address(0), "Invalid address");
        votingContract = _votingContract;
        emit VotingContractSet(_votingContract);
    }

    /**
     * @dev Register a new agent. Initial reputation is set to 500 (neutral).
     */
    function register(address agentAddress, string calldata label) external {
        require(!agents[agentAddress].isRegistered, "Already registered");
        
        agents[agentAddress] = Agent({
            isRegistered: true,
            label: label,
            reputationScore: 500, // 0-1000 scale, neutral baseline
            totalVotes: 0,
            correctVotes: 0
        });
        agentList.push(agentAddress);

        emit AgentRegistered(agentAddress, label);
    }

    /**
     * @dev Check if an address is a registered agent.
     */
    function isRegistered(address agentAddress) external view returns (bool) {
        return agents[agentAddress].isRegistered;
    }

    /**
     * @dev Get the reputation score of a registered agent.
     */
    function getReputation(address agentAddress) external view returns (uint256) {
        return agents[agentAddress].reputationScore;
    }

    /**
     * @dev Get total number of registered agents.
     */
    function getAgentCount() external view returns (uint256) {
        return agentList.length;
    }

    /**
     * @dev Update reputation using EMA formula.
     *      new_score = 0.8 * old_score + 0.2 * new_result
     *      where new_result is 1000 for correct, 0 for incorrect.
     *      Only callable by the SynodVoting contract.
     */
    function updateReputation(address agentAddress, bool isCorrect) external onlyVotingContract onlyRegistered(agentAddress) {
        uint256 oldScore = agents[agentAddress].reputationScore;
        uint256 newResult = isCorrect ? 1000 : 0;
        
        // EMA: 80% old score, 20% new result
        uint256 newScore = (oldScore * 80 + newResult * 20) / 100;

        agents[agentAddress].reputationScore = newScore;
        agents[agentAddress].totalVotes += 1;
        if (isCorrect) {
            agents[agentAddress].correctVotes += 1;
        }

        emit ReputationUpdated(agentAddress, oldScore, newScore);
    }
}
