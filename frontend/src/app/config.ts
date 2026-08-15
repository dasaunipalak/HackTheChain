import { parseAbi } from 'viem';

export const CTF_FACTORY_ADDRESS =
  '0x350B35411F440dB246A626f838df08C9a0D340Fc';

export const CTF_FACTORY_ABI = parseAbi([
  'function deployLevel1() external returns (address)',
  'function deployLevel2() external returns (address)',
  'function deployLevel3() external returns (address)',

  'function levelInstances(uint256, address) external view returns (address)',
  'function isSolved(uint256, address) external view returns (bool)',
  'function trace() external view returns (address)',

  'function validateLevel1() external',
  'function validateLevel2() external',
  'function validateLevel3() external',
]);

// ============================================================
// LEVEL 1 — REENTRANCY / TRC
// ============================================================

export const LEVEL1_ABI = parseAbi([
  'function deposit(uint256 amount) external',
  'function withdraw() external',
  'function balances(address) external view returns (uint256)',
  'function isComplete() external view returns (bool)',
]);

// ERC20/TRC interface used by Level 1, 2, 3
export const TRACE_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

// ============================================================
// LEVEL 2 — ORACLE MANIPULATION
// ============================================================

export const LEVEL2_ABI = parseAbi([
  'function deposit(uint256 amount) external',
  'function borrow(uint256 amount) external',

  'function mkt() external view returns (address)',
  'function trace() external view returns (address)',
  'function oracle() external view returns (address)',

  'function isComplete() external view returns (bool)',
]);

// MKT token
export const MKT_ABI = parseAbi([
  'function transfer(address to, uint256 amount) external returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) external returns (bool)',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
]);

// AMM used to manipulate the oracle
export const LEVEL2_AMM_ABI = parseAbi([
  'function swapTRACEForMKT(uint256 traceIn) external',
  'function reserveMKT() external view returns (uint256)',
  'function reserveTRACE() external view returns (uint256)'
]);

// Vulnerable oracle
export const LEVEL2_ORACLE_ABI = parseAbi([
  'function getPrice() external view returns (uint256)',
]);

// ============================================================
// LEVEL 3 — SIGNATURE REPLAY
// ============================================================

export const LEVEL3_ABI = parseAbi([
  'function withdraw(address recipient, uint256 amount, bytes signature) external',
  'function trustedSigner() external view returns (address)',
  'function trace() external view returns (address)',
  'function isComplete() external view returns (bool)',
]);
