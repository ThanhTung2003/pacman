// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title PacmanFees
 * @notice Fee collector for Pacman game on Base Mainnet
 *         - payGameStart(): player pays before each game session
 *         - payGameEnd():   player pays when session ends
 *         - setFees():      owner adjusts fee amounts
 *         - withdraw():     owner withdraws accumulated ETH
 */
contract PacmanFees {

    address public owner;
    uint256 public gameStartFee = 0.0000003 ether; // ~$0.001
    uint256 public gameEndFee   = 0.0000003 ether; // ~$0.001

    uint256 public totalStartPaid;
    uint256 public totalEndPaid;
    uint256 public totalPlayers;

    mapping(address => bool) private _seen;

    event GameStartPaid(address indexed player, uint256 amount);
    event GameEndPaid(address indexed player, uint256 amount);
    event FeesUpdated(uint256 newStartFee, uint256 newEndFee);
    event Withdrawn(address indexed to, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }

    constructor() {
        owner = msg.sender;
    }

    // ─── Player Functions ────────────────────────────────────────

    /// @notice Pay the game-start fee. Must send at least gameStartFee.
    function payGameStart() external payable {
        require(msg.value >= gameStartFee, "Insufficient start fee");

        if (!_seen[msg.sender]) {
            _seen[msg.sender] = true;
            totalPlayers++;
        }

        totalStartPaid += msg.value;
        emit GameStartPaid(msg.sender, msg.value);
    }

    /// @notice Pay the game-end fee. Must send at least gameEndFee.
    function payGameEnd() external payable {
        require(msg.value >= gameEndFee, "Insufficient end fee");
        totalEndPaid += msg.value;
        emit GameEndPaid(msg.sender, msg.value);
    }

    // ─── Owner Functions ─────────────────────────────────────────

    /// @notice Update fee amounts.
    function setFees(uint256 _startFee, uint256 _endFee) external onlyOwner {
        gameStartFee = _startFee;
        gameEndFee   = _endFee;
        emit FeesUpdated(_startFee, _endFee);
    }

    /// @notice Withdraw all ETH in this contract to the owner.
    function withdraw() external onlyOwner {
        uint256 bal = address(this).balance;
        require(bal > 0, "Nothing to withdraw");
        payable(owner).transfer(bal);
        emit Withdrawn(owner, bal);
    }

    /// @notice Transfer ownership to a new address.
    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Zero address");
        owner = newOwner;
    }

    // ─── View ────────────────────────────────────────────────────

    function contractBalance() external view returns (uint256) {
        return address(this).balance;
    }
}
