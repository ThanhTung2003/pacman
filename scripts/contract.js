export const CONTRACT_ABI = [
  'function owner() external view returns (address)',
  'function gameStartFee() external view returns (uint256)',
  'function gameEndFee() external view returns (uint256)',
  'function totalStartPaid() external view returns (uint256)',
  'function totalEndPaid() external view returns (uint256)',
  'function totalPlayers() external view returns (uint256)',
  'function contractBalance() external view returns (uint256)',
  'function payGameStart() external payable',
  'function payGameEnd() external payable',
  'function setFees(uint256 _startFee, uint256 _endFee) external',
  'function withdraw() external',
  'function transferOwnership(address newOwner) external',
  'event GameStartPaid(address indexed player, uint256 amount)',
  'event GameEndPaid(address indexed player, uint256 amount)',
  'event FeesUpdated(uint256 newStartFee, uint256 newEndFee)',
  'event Withdrawn(address indexed to, uint256 amount)',
];

export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000';

export const BASE_CHAIN_ID     = 8453;
export const BASE_CHAIN_HEX    = '0x2105';
export const BASE_RPC          = 'https://mainnet.base.org';
