import { parseAbi } from 'viem';

// Replace with your actual CTFFactory contract address
export const CTF_FACTORY_ADDRESS = '0x435602f1E0efCfC57222B357B91611D57330F318';

export const CTF_FACTORY_ABI = parseAbi([
  'function deployLevel1() external payable returns (address)',
  'function deployLevel2() external payable returns (address)',
  'function deployLevel3() external payable returns (address)',
  'function deployLevel4() external payable returns (address)',
  'function deployLevel5() external payable returns (address)',
  'function levelInstances(uint256, address) view returns (address)',
  'function isSolved(uint256, address) view returns (bool)',
  'function validateLevel1() external',
  'function validateLevel2() external',
  'function validateLevel3() external',
  'function validateLevel4() external',
  'function validateLevel5() external'
]);

export const LEVEL1_ABI = parseAbi([
  'function withdrawAll(address recipient) external',
  'function owner() external view returns (address)',
  'function isComplete() external view returns (bool)'
]);

export const LEVEL2_ABI = parseAbi([
  'function donate(address _to) external payable',
  'function withdraw() external',
  'function isComplete() external view returns (bool)'
]);

export const ATTACKER_ABI = parseAbi([
  'function attack() external payable'
]);

export const LEVEL3_ABI = parseAbi([
  'function claimAirdrop() external',
  'function deposit(uint256 amount) external',
  'function borrow(uint256 borrowAmount) external',
  'function token() external view returns (address)',
  'function amm() external view returns (address)',
  'function oracle() external view returns (address)',
  'function isComplete() external view returns (bool)'
]);

export const MOCK_TOKEN_ABI = parseAbi([
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)'
]);

export const LEVEL3_AMM_ABI = parseAbi([
  'function swapETHForTokens() external payable'
]);

export const LEVEL3_ORACLE_ABI = parseAbi([
  'function getPrice() external view returns (uint256)'
]);

export const LEVEL4_ABI = parseAbi([
  'function withdraw(address recipient, uint256 amount, bytes signature) external',
  'function trustedSigner() external view returns (address)',
  'function isComplete() external view returns (bool)'
]);

export const LEVEL5_ABI = parseAbi([
  'function execute(bytes data) external',
  'function withdraw(address recipient) external',
  'function updateAddress(address) external',
  'function implementation() external view returns (address)',
  'function owner() external view returns (address)',
  'function isComplete() external view returns (bool)'
]);
