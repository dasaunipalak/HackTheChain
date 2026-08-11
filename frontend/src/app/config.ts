import { parseAbi } from 'viem';

// Replace with your actual CTFFactory contract address
export const CTF_FACTORY_ADDRESS = '0x35b412Aa138104F9DA9b4B2Cc62D916f6974E12E';

export const CTF_FACTORY_ABI = parseAbi([
  'function deployLevel1() external payable returns (address)',
  'function levelInstances(uint256, address) view returns (address)',
  'function validateLevel1() external'
]);

export const LEVEL1_ABI = parseAbi([
  'function donate(address _to) external payable',
  'function withdraw() external',
  'function isComplete() external view returns (bool)'
]);

export const ATTACKER_ABI = parseAbi([
  'function attack() external payable'
]);
