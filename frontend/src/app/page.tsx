'use client';

import { useState, useRef, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useReadContracts, useWriteContract, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther, isAddress, encodeFunctionData } from 'viem';
import { 
  CTF_FACTORY_ADDRESS, CTF_FACTORY_ABI, 
  LEVEL1_ABI, LEVEL2_ABI, ATTACKER_ABI,
  LEVEL3_ABI, LEVEL3_AMM_ABI, LEVEL3_ORACLE_ABI, MOCK_TOKEN_ABI,
  LEVEL4_ABI, LEVEL5_ABI 
} from './config';

const LEVEL1_SOURCE_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Level1_AccessControl {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function withdrawAll(address payable recipient) external {
        recipient.transfer(address(this).balance);
    }

    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}`;

const LEVEL2_SOURCE_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Level2_Reentrancy {
    mapping(address => uint256) public balances;
    
    constructor() payable {
        balances[address(this)] = msg.value;
    }

    function donate(address _to) external payable {
        balances[_to] += msg.value;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");

        balances[msg.sender] = 0; 
    }
    
    function isComplete() external view returns (bool) {
        return address(this).balance == 0;
    }
}`;

const LEVEL2_SKELETON = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface IVulnerable {
    function donate(address _to) external payable;
    function withdraw() external;
}

contract ReentrancyAttack {
    IVulnerable public target;
    address public owner;

    constructor(address _target) {
        // TODO
    }

    function attack() external payable {
        // TODO
    }

    receive() external payable {
        // TODO
    }
}`;

const LEVEL_DATA = [
  { id: 1, title: 'ACCESS CONTROL' },
  { id: 2, title: 'REENTRANCY' },
  { id: 3, title: 'ORACLE MANIPULATION' },
  { id: 4, title: 'SIGNATURE REPLAY' },
  { id: 5, title: 'DELEGATECALL' }
];

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Level State Logs
  const [logsL1, setLogsL1] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL2, setLogsL2] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL3, setLogsL3] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL4, setLogsL4] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL5, setLogsL5] = useState<string[]>(['> SYSTEM_READY']);

  const getLogs = (l: number) => {
    switch(l) {
      case 1: return logsL1; case 2: return logsL2; case 3: return logsL3;
      case 4: return logsL4; case 5: return logsL5; default: return [];
    }
  };
  const currentLogs = getLogs(selectedLevel);
  const addLog = (msg: string) => {
    switch(selectedLevel) {
      case 1: setLogsL1(p => [...p, msg]); break;
      case 2: setLogsL2(p => [...p, msg]); break;
      case 3: setLogsL3(p => [...p, msg]); break;
      case 4: setLogsL4(p => [...p, msg]); break;
      case 5: setLogsL5(p => [...p, msg]); break;
    }
  };

  const isExploitConfirmed = currentLogs.some(l => l.includes('EXPLOIT_CONFIRMED') || l.includes('TRANSACTION_CONFIRMED') || l.includes('_CONFIRMED ✓'));
  const isLevelCompleteLocally = currentLogs.some(l => l.includes('VERIFICATION_CONFIRMED ✓') || l.includes('VALIDATION_CONFIRMED ✓'));

  // Level 1 Local State
  const [l1Recipient, setL1Recipient] = useState<string>('');
  const [l1HintLevel, setL1HintLevel] = useState(0);
  const [l1OwnerResult, setL1OwnerResult] = useState<string | null>(null);
  const [l1IsCompleteResult, setL1IsCompleteResult] = useState<string | null>(null);


  const handleReadOwner = async () => {
    if (!publicClient || !targetAddress) return;
    try {
      const res = await publicClient.readContract({
        address: targetAddress,
        abi: LEVEL1_ABI,
        functionName: 'owner'
      });
      setL1OwnerResult(res as string);
      addLog(`> CALL owner()\n> RETURN: ${res}`);
    } catch (e: any) {
      addLog(`> ERROR: Failed to read owner()\n> ${e.shortMessage || e.message}`);
    }
  };

  const handleReadIsComplete = async () => {
    if (!publicClient || !targetAddress) return;
    try {
      const res = await publicClient.readContract({
        address: targetAddress,
        abi: LEVEL1_ABI,
        functionName: 'isComplete'
      });
      setL1IsCompleteResult(res ? 'true' : 'false');
      addLog(`> CALL isComplete()\n> RETURN: ${res}`);
    } catch (e: any) {
      addLog(`> ERROR: Failed to read isComplete()\n> ${e.shortMessage || e.message}`);
    }
  };
  
  // Level 2 Local State
  const [attackerInput, setAttackerInput] = useState('');
  const [registeredAttacker, setRegisteredAttacker] = useState('');
  const [l2AttackAmount, setL2AttackAmount] = useState('0.001');

  // Level 3 Local State
  const [l3SwapAmount, setL3SwapAmount] = useState('0.1');
  const [l3ApproveAmount, setL3ApproveAmount] = useState('');
  const [l3DepositAmount, setL3DepositAmount] = useState('');
  const [l3BorrowAmount, setL3BorrowAmount] = useState('0.1');
  
  // Level 4 Local State
  const [l4AmountInput, setL4AmountInput] = useState('0.01');
  const [l4Signature, setL4Signature] = useState('');
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);

  // Level 5 Local State
  const [l5AddressInput, setL5AddressInput] = useState('');
  const [l5Calldata, setL5Calldata] = useState('');
  const [l5WithdrawRecipient, setL5WithdrawRecipient] = useState('');

  // UI Flow States
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentLogs, selectedLevel]);

  useEffect(() => {
    if (address) {

      if (!l5AddressInput) setL5AddressInput(address);
      if (!l5WithdrawRecipient) setL5WithdrawRecipient(address);
    }
  }, [address]);

  // Global Solved State
  const { data: solvedData, refetch: refetchSolved } = useReadContracts({
    contracts: [1, 2, 3, 4, 5].map(id => ({
      address: CTF_FACTORY_ADDRESS as `0x${string}`,
      abi: CTF_FACTORY_ABI,
      functionName: 'isSolved',
      args: address ? [BigInt(id), address] : undefined,
    })),
    query: { enabled: !!address }
  });

  const isLevelSolvedGlobal = (id: number) => !!solvedData?.[id - 1]?.result;
  const isSelectedLevelFullyComplete = isLevelSolvedGlobal(selectedLevel) || isLevelCompleteLocally;

  // Selected Instance
  const { data: targetAddressRaw, refetch: refetchTarget } = useReadContract({
    address: CTF_FACTORY_ADDRESS as `0x${string}`, abi: CTF_FACTORY_ABI, functionName: 'levelInstances',
    args: address ? [BigInt(selectedLevel), address] : undefined,
    query: { enabled: !!address }
  });
  const targetAddress = (targetAddressRaw && targetAddressRaw !== '0x0000000000000000000000000000000000000000') ? (targetAddressRaw as `0x${string}`) : undefined;

  const currentAbi = selectedLevel === 1 ? LEVEL1_ABI : selectedLevel === 2 ? LEVEL2_ABI : selectedLevel === 3 ? LEVEL3_ABI : selectedLevel === 4 ? LEVEL4_ABI : LEVEL5_ABI;

  const { data: targetBalance, refetch: refetchBalance } = useBalance({ address: targetAddress, query: { enabled: !!targetAddress } });
  
  const { data: isComplete, refetch: refetchIsComplete } = useReadContract({
    address: targetAddress, abi: currentAbi, functionName: 'isComplete',
    query: { enabled: !!targetAddress }
  });

  // Specific state reads
  const { data: ownerAddressRaw, refetch: refetchOwner } = useReadContract({
    address: targetAddress, abi: LEVEL1_ABI, functionName: 'owner',
    query: { enabled: !!targetAddress && selectedLevel === 1 }
  });
  const ownerAddress = ownerAddressRaw as string | undefined;

  // L3 Reads
  const { data: l3TokenRaw, refetch: refetchL3Token } = useReadContract({
    address: targetAddress, abi: LEVEL3_ABI, functionName: 'token',
    query: { enabled: !!targetAddress && selectedLevel === 3 }
  });
  const { data: l3AmmRaw, refetch: refetchL3Amm } = useReadContract({
    address: targetAddress, abi: LEVEL3_ABI, functionName: 'amm',
    query: { enabled: !!targetAddress && selectedLevel === 3 }
  });
  const { data: l3OracleRaw, refetch: refetchL3Oracle } = useReadContract({
    address: targetAddress, abi: LEVEL3_ABI, functionName: 'oracle',
    query: { enabled: !!targetAddress && selectedLevel === 3 }
  });
  const { data: l3OraclePriceRaw, refetch: refetchL3OraclePrice } = useReadContract({
    address: l3OracleRaw as `0x${string}`, abi: LEVEL3_ORACLE_ABI, functionName: 'getPrice',
    query: { enabled: !!l3OracleRaw && selectedLevel === 3 }
  });
  const { data: l3PlayerMktBalanceRaw, refetch: refetchL3PlayerMktBalance } = useReadContract({
    address: l3TokenRaw as `0x${string}`, abi: MOCK_TOKEN_ABI, functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: { enabled: !!l3TokenRaw && !!address && selectedLevel === 3 }
  });

  // L4 Reads
  const { data: l4SignerRaw, refetch: refetchL4Signer } = useReadContract({
    address: targetAddress, abi: LEVEL4_ABI, functionName: 'trustedSigner',
    query: { enabled: !!targetAddress && selectedLevel === 4 }
  });

  // L5 Reads
  const { data: l5ImplRaw, refetch: refetchL5Impl } = useReadContract({
    address: targetAddress, abi: LEVEL5_ABI, functionName: 'implementation',
    query: { enabled: !!targetAddress && selectedLevel === 5 }
  });
  const { data: l5OwnerRaw, refetch: refetchL5Owner } = useReadContract({
    address: targetAddress, abi: LEVEL5_ABI, functionName: 'owner',
    query: { enabled: !!targetAddress && selectedLevel === 5 }
  });

  const { writeContractAsync } = useWriteContract();

  const handleInitLevel = async () => {
    setIsInitializing(true);
    try {
      addLog('> PREPARING_TRANSACTION');
      const val = selectedLevel === 3 ? '0.11' : selectedLevel === 4 || selectedLevel === 5 ? '0.05' : '0.01';
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS as `0x${string}`,
        abi: CTF_FACTORY_ABI,
        functionName: `deployLevel${selectedLevel}`,
        value: parseEther(val),
      });
      addLog(`> TX_HASH: ${hash}`);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog(`> LEVEL_0${selectedLevel}_INITIALIZED`);
        addLog('> TARGET_ACQUIRED ✓');
        refetchTarget();
      } else addLog('> ERROR: TARGET DEPLOYMENT FAILED');
    } catch (e: any) { addLog(`> ERROR: ${e.shortMessage || e.message}`); }
    finally { setIsInitializing(false); }
  };

  const handleVerifyHack = async () => {
    if (!targetAddress) return;
    setIsVerifying(true);
    try {
      const result = await refetchIsComplete();
      if (!result.data) { addLog('> ERROR: TARGET NOT DRAINED'); return; }
      addLog('> VALIDATION_SUBMITTED');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS as `0x${string}`,
        abi: CTF_FACTORY_ABI,
        functionName: `validateLevel${selectedLevel}`,
      });
      addLog(`> TX_HASH: ${hash}`);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog('> VALIDATION_CONFIRMED ✓');
        addLog('> ACCESS GRANTED');
        addLog(`> LEVEL 0${selectedLevel} COMPLETE`);
        addLog(`> BADGE_0${selectedLevel}_MINTED`);
        await refetchSolved();
        if (selectedLevel < 5) setSelectedLevel((selectedLevel + 1) as 1|2|3|4|5);
      } else addLog('> ERROR: VALIDATION TRANSACTION FAILED');
    } catch (e: any) { addLog(`> ERROR: ${e.shortMessage || e.message}`); }
    finally { setIsVerifying(false); }
  };

  const executeGenericTx = async (target: `0x${string}`, abi: any, functionName: string, args: any[] = [], value: string = '0', logStr: string) => {
    setIsExploiting(true);
    try {
      addLog(`> ${logStr}_SUBMITTED`);
      const hash = await writeContractAsync({ address: target, abi, functionName, args, value: parseEther(value) });
      addLog(`> TX_HASH: ${hash}`);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog(`> ${logStr}_CONFIRMED ✓`);
        await refetchAll();
        return true;
      } else {
        addLog('> ERROR: TRANSACTION REVERTED');
        return false;
      }
    } catch (e: any) { addLog(`> ERROR: ${e.shortMessage || e.message}`); return false; }
    finally { setIsExploiting(false); }
  };

  const refetchAll = async () => {
    refetchBalance(); refetchIsComplete();
    if (selectedLevel === 1) refetchOwner();
    if (selectedLevel === 3) { refetchL3Token(); refetchL3Amm(); refetchL3Oracle(); refetchL3OraclePrice(); refetchL3PlayerMktBalance(); }
    if (selectedLevel === 4) { refetchL4Signer(); }
    if (selectedLevel === 5) { refetchL5Impl(); refetchL5Owner(); }
  };

  const handleRegisterAttacker = async () => {
    if (!isAddress(attackerInput)) { addLog('> ERROR: INVALID ATTACKER ADDRESS'); return; }
    const code = await publicClient?.getBytecode({ address: attackerInput as `0x${string}` });
    if (!code || code === '0x') { addLog('> ERROR: NO CONTRACT FOUND AT ADDRESS'); return; }
    setRegisteredAttacker(attackerInput);
    addLog(`> ATTACKER_REGISTERED ✓`);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('> COPIED_TO_CLIPBOARD');
  };

  const formatLog = (log: string, index: number) => {
    if (log.startsWith('> ERROR')) return <div key={index} className="text-red-500">{log}</div>;
    if (log.startsWith('> TX_HASH:')) {
      const hash = log.split('TX_HASH: ')[1];
      return <div key={index}>&gt; TX: <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer" className="underline hover:text-white break-all">{hash}</a></div>;
    }
    if (log.includes('✓') || log.includes('ACCESS GRANTED')) return <div key={index} className="text-[#00ff00] font-bold shadow-[0_0_5px_rgba(0,255,0,0.3)]">{log}</div>;
    return <div key={index}>{log}</div>;
  };

  // Level 3 Derived State
  const l3HasClaimed = currentLogs.some(l => l.includes('AIRDROP_CONFIRMED ✓'));
  const l3HasManipulated = currentLogs.some(l => l.includes('AMM_SWAP_CONFIRMED ✓'));
  const l3HasApproved = currentLogs.some(l => l.includes('APPROVE_CONFIRMED ✓'));
  const l3HasDeposited = currentLogs.some(l => l.includes('DEPOSIT_CONFIRMED ✓'));
  const l3MktBalance = l3PlayerMktBalanceRaw as bigint | undefined;

  useEffect(() => {
    if (l3MktBalance !== undefined) {
      if (!l3ApproveAmount || l3HasManipulated) setL3ApproveAmount(l3MktBalance.toString());
      if (!l3DepositAmount || l3HasApproved) setL3DepositAmount(l3MktBalance.toString());
    }
  }, [l3MktBalance, l3HasManipulated, l3HasApproved]);

  // Level 4 Signature Endpoint
  const requestLevel4Signature = async (instanceAddress: string, playerAddress: string, amount: string) => {
    setIsRequestingSignature(true);
    try {
      addLog('> REQUESTING_SIGNATURE_FROM_BACKEND');
      const res = await fetch('/api/level4-signature', {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json'
          },
          body: JSON.stringify({
              instanceAddress,
              playerAddress,
              amount: parseEther(amount).toString()
          })
      });
      const data = await res.json();
      if (!res.ok) {
        addLog(`> ERROR: ${data.error || 'Failed to fetch signature'}`);
        return;
      }
      addLog(`> SIGNATURE_ACQUIRED ✓`);
      setL4Signature(data.signature);
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsRequestingSignature(false);
    }
  };

  // Level 5 encode data
  const handleEncodeCalldata = () => {
    if (!isAddress(l5AddressInput)) {
      addLog('> ERROR: INVALID ADDRESS FOR CALLDATA');
      return;
    }
    try {
      const data = encodeFunctionData({ abi: LEVEL5_ABI, functionName: "updateAddress", args: [l5AddressInput] });
      setL5Calldata(data);
      addLog('> CALLDATA_ENCODED ✓');
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    }
  }

  return (
    <main className="min-h-screen w-full max-w-full overflow-x-hidden bg-black text-[#00ff00] font-mono flex flex-col p-4 lg:p-6">
      {/* HEADER */}
      <header className="flex-none w-full flex justify-between items-center border-b border-[#00ff00]/30 pb-4 mb-4 lg:mb-5">
        <h1 className="text-xl font-bold tracking-widest text-[#00ff00]">HACK_THE_CHAIN</h1>
        <div className="flex items-center gap-6">
          <span className="opacity-70 text-xs hidden sm:inline tracking-widest font-bold">LEVEL 0{selectedLevel} / 05</span>
          <ConnectButton />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow w-full max-w-full grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0">
        
        {/* LEFT COLUMN: COMMAND CENTER & LOGS */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:gap-5 min-w-0 min-h-0">
          
          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">COMMAND CENTER</h2>
            <div className="flex flex-col gap-3">
              <div className="flex flex-row flex-wrap gap-2 mb-2">
                <span className="flex-1 px-3 py-2.5 border border-[#00ff00] text-[#00ff00] text-[10px] sm:text-xs tracking-widest font-bold bg-[#00ff00]/10 text-center">
                  [ LEVEL 0{selectedLevel} — {LEVEL_DATA[selectedLevel - 1].title} ]
                </span>
              </div>
              <button
                onClick={handleInitLevel}
                disabled={!isConnected || !!targetAddress || isInitializing}
                className="px-3 py-2.5 border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs tracking-widest"
              >
                {isInitializing ? '[ INITIALIZING... ]' : `[ INITIALIZE LEVEL ${selectedLevel} ]`}
              </button>
              <button
                onClick={handleVerifyHack}
                disabled={!targetAddress || isVerifying || isSelectedLevelFullyComplete}
                className="px-3 py-2.5 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs tracking-widest"
              >
                {isVerifying ? '[ VERIFYING... ]' : '[ VERIFY HACK ]'}
              </button>
            </div>
          </div>

          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">SYSTEM STATUS</h2>
            <div className="flex flex-col gap-2.5 text-[10px] sm:text-xs">
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">WALLET</span>
                <span>{isConnected ? '● CONNECTED' : '○ DISCONNECTED'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">TARGET</span>
                <span>{targetAddress ? '● ACQUIRED' : '○ PENDING'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">VAULT</span>
                <span>{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '---'}</span>
              </div>
              
              {selectedLevel === 2 && registeredAttacker && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">ATTACKER</span>
                  <span>● REGISTERED</span>
                </div>
              )}
              {selectedLevel === 3 && l3OraclePriceRaw && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">ORACLE PRICE</span>
                  <span>{formatEther(l3OraclePriceRaw as bigint)} ETH</span>
                </div>
              )}
              {selectedLevel === 4 && l4SignerRaw && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">TRUSTED SIGNER</span>
                  <span className="text-[10px] break-all max-w-[120px] text-right">{(l4SignerRaw as string).slice(0, 10)}...</span>
                </div>
              )}
              {selectedLevel === 5 && l5OwnerRaw && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">PROXY OWNER</span>
                  <span className="text-[10px] break-all max-w-[120px] text-right">{(l5OwnerRaw as string).slice(0, 10)}...</span>
                </div>
              )}

              <div className="flex justify-between border-t border-[#00ff00]/30 pt-2 mt-1">
                <span className="opacity-70 tracking-widest font-bold">LEVEL 0{selectedLevel} / 05</span>
                <span className={`font-bold ${isSelectedLevelFullyComplete ? 'text-[#00ff00]' : ''}`}>
                  {isSelectedLevelFullyComplete ? '✓ COMPLETE' : '○ IN PROGRESS'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="flex-none text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">TRANSACTION LOG</h2>
            <div className="flex-grow overflow-y-auto text-[10px] sm:text-xs pr-2 flex flex-col gap-1 leading-relaxed">
              {currentLogs.map((log, i) => formatLog(log, i))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: MAIN WORKSPACE */}
        <div className="lg:col-span-8 xl:col-span-6 flex flex-col gap-4 lg:gap-5 min-w-0 min-h-0 relative">
          
          {targetAddress ? (
            <>
              {/* LEVEL INFORMATION */}
              <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] flex flex-col md:flex-row justify-between gap-4 md:items-center">
                <div className="flex-none">
                  <h2 className="text-xs font-bold opacity-70 tracking-widest mb-1">LEVEL 0{selectedLevel}</h2>
                  <h3 className="text-xl lg:text-2xl font-bold tracking-widest">{LEVEL_DATA[selectedLevel - 1].title}</h3>
                </div>
                
                <div className="flex flex-col gap-1 md:items-end">
                  <span className="opacity-70 text-[10px] tracking-widest">TARGET INSTANCE</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-[10px] sm:text-xs break-all">{targetAddress}</span>
                    <button onClick={() => copyToClipboard(targetAddress)} className="text-[9px] border border-[#00ff00] px-1.5 py-0.5 hover:bg-[#00ff00] hover:text-black min-w-fit">COPY</button>
                  </div>
                </div>
              </div>

              {isSelectedLevelFullyComplete ? (
                <div className="flex-grow flex flex-col items-center justify-center border-2 border-[#00ff00] bg-[#00ff00]/10 p-6 shadow-[0_0_30px_rgba(0,255,0,0.2)] min-h-0 text-center animate-fade-in">
                  <h2 className="text-2xl lg:text-4xl font-bold mb-4 tracking-widest animate-pulse">&gt; ACCESS GRANTED</h2>
                  <p className="text-lg lg:text-xl mb-2 tracking-widest">LEVEL 0{selectedLevel} COMPLETE</p>
                  <p className="text-xs opacity-80 mb-6 tracking-widest">ON-CHAIN VERIFICATION PASSED</p>
                  <p className="font-bold text-lg lg:text-xl border-t border-[#00ff00]/50 pt-4 tracking-widest">SOULBOUND BADGE #{selectedLevel} MINTED</p>
                </div>
              ) : selectedLevel === 1 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">LIVE CONTRACT STATE</h2>
                  <div className="flex flex-col gap-2.5 text-[10px] sm:text-xs mb-6 font-mono">
                    <div className="flex justify-between">
                      <span className="opacity-70 tracking-widest">TARGET BALANCE</span>
                      <span>{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70 tracking-widest">PLAYER ADDRESS</span>
                      <span>{address || '---'}</span>
                    </div>
                  </div>

                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">CONTRACT SOURCE</h2>
                  <div className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 mb-6 overflow-x-auto text-[10px] font-mono leading-relaxed whitespace-pre">
                    {LEVEL1_SOURCE_CODE}
                  </div>

                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">CONTRACT INTERFACE</h2>
                  <div className="flex flex-col gap-4 text-xs font-mono tracking-wide mb-6">
                    <div className="flex flex-col p-3 border border-[#00ff00]/30 bg-[#00ff00]/5 gap-2">
                      <div className="flex items-center justify-between">
                        <span>owner()</span>
                        <button onClick={handleReadOwner} className="px-3 py-1 border border-[#00ff00] hover:bg-[#00ff00]/20 text-[10px]">[ READ ]</button>
                      </div>
                      {l1OwnerResult && <div className="text-[10px] opacity-70 break-all pt-2 border-t border-[#00ff00]/20">↳ {l1OwnerResult}</div>}
                    </div>
                    
                    <div className="flex flex-col p-3 border border-[#00ff00]/30 bg-[#00ff00]/5 gap-2">
                      <div className="flex items-center justify-between">
                        <span>isComplete()</span>
                        <button onClick={handleReadIsComplete} className="px-3 py-1 border border-[#00ff00] hover:bg-[#00ff00]/20 text-[10px]">[ READ ]</button>
                      </div>
                      {l1IsCompleteResult && <div className="text-[10px] opacity-70 break-all pt-2 border-t border-[#00ff00]/20">↳ {l1IsCompleteResult}</div>}
                    </div>
                    
                    <div className="flex flex-col gap-3 p-3 border border-[#00ff00]/30 bg-[#00ff00]/5">
                      <span>withdrawAll(address recipient)</span>
                      <input type="text" value={l1Recipient} onChange={(e) => setL1Recipient(e.target.value)} placeholder="Recipient address (0x...)" className="bg-black border border-[#00ff00]/50 p-2 outline-none focus:border-[#00ff00] font-mono text-[10px] w-full transition-all" />
                      <button onClick={async () => {
                        addLog(`> CALL withdrawAll(${l1Recipient})`);
                        await executeGenericTx(targetAddress, LEVEL1_ABI, 'withdrawAll', [l1Recipient], '0', 'withdrawAll');
                        refetchTarget();
                      }} disabled={isExploiting || !isAddress(l1Recipient)} className="w-full px-4 py-2 bg-transparent border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all font-bold text-xs disabled:opacity-50 tracking-widest break-words">
                        {isExploiting ? '[ SUBMITTING... ]' : '[ CALL withdrawAll ]'}
                      </button>
                    </div>
                  </div>

                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest cursor-pointer hover:text-[#00ff00]/70" onClick={() => setL1HintLevel(Math.max(1, l1HintLevel))}>
                    [ ? HINTS ]
                  </h2>
                  {l1HintLevel > 0 && (
                    <div className="flex flex-col gap-3 font-mono text-[10px] opacity-80 pl-2 border-l border-[#00ff00]/30">
                      <div>
                        <span className="font-bold text-[#00ff00]">HINT 1: </span>
                        Inspect the contract's owner variable and compare it with the functions that move funds.
                      </div>
                      {l1HintLevel >= 2 ? (
                        <div>
                          <span className="font-bold text-[#00ff00]">HINT 2: </span>
                          Who is allowed to call withdrawAll()?
                        </div>
                      ) : (
                        <button onClick={() => setL1HintLevel(2)} className="text-left hover:text-[#00ff00]">[ REVEAL HINT 2 ]</button>
                      )}
                      
                      {l1HintLevel >= 3 ? (
                        <div>
                          <span className="font-bold text-[#00ff00]">HINT 3: </span>
                          Does withdrawAll() actually verify the caller?
                        </div>
                      ) : l1HintLevel >= 2 ? (
                        <button onClick={() => setL1HintLevel(3)} className="text-left hover:text-[#00ff00]">[ REVEAL HINT 3 ]</button>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : selectedLevel === 2 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">LIVE CONTRACT STATE</h2>
                  <div className="flex flex-col gap-2.5 text-[10px] sm:text-xs mb-6 font-mono">
                    <div className="flex justify-between">
                      <span className="opacity-70 tracking-widest">TARGET BALANCE</span>
                      <span>{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '---'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="opacity-70 tracking-widest">PLAYER ADDRESS</span>
                      <span>{address || '---'}</span>
                    </div>
                  </div>

                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">CONTRACT SOURCE</h2>
                  <div className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 mb-6 overflow-x-auto text-[10px] font-mono leading-relaxed whitespace-pre">
                    {LEVEL2_SOURCE_CODE}
                  </div>


                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">BUILD YOUR ATTACK CONTRACT</h2>
                  <p className="opacity-80 text-xs leading-relaxed mb-4">
                    Analyze the target contract and construct your own attack contract.
                  </p>
                  
                  <div className="flex justify-end mb-2">
                    <button onClick={() => copyToClipboard(LEVEL2_SKELETON)} className="px-3 py-1 border border-[#00ff00] hover:bg-[#00ff00]/20 text-[10px] tracking-widest">
                      [ COPY SKELETON ]
                    </button>
                  </div>
                  <div className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 mb-6 overflow-x-auto text-[10px] font-mono leading-relaxed whitespace-pre">
                    {LEVEL2_SKELETON}
                  </div>



                  {!registeredAttacker ? (
                    <div className="flex flex-col gap-2 mt-auto">
                      <label className="text-[10px] tracking-widest opacity-70">ATTACK CONTRACT ADDRESS</label>
                      <div className="flex flex-col sm:flex-row gap-3">
                        <input type="text" value={attackerInput} onChange={(e) => setAttackerInput(e.target.value)} placeholder="0x..." className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all min-w-0" />
                        <button onClick={handleRegisterAttacker} className="px-4 py-3 border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors font-bold text-xs tracking-widest whitespace-nowrap">
                          [ REGISTER CONTRACT ]
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full gap-4 border border-[#00ff00] p-4 bg-[#00ff00]/10">
                      <div className="flex flex-col border-b border-[#00ff00]/30 pb-2 gap-1">
                        <span className="text-xs font-bold tracking-widest text-[#00ff00]">ATTACK CONTRACT REGISTERED ✓</span>
                        <span className="font-mono text-[10px] break-all opacity-70">Registered:<br/>{registeredAttacker}</span>
                      </div>
                      <div className="flex-grow flex flex-col gap-4">
                        <div className="font-mono text-xs text-[#00ff00]">attack()</div>
                        <div className="flex flex-col gap-2">
                          <label className="text-[10px] tracking-widest opacity-70">ETH AMOUNT TO SEND</label>
                          <input 
                            type="text" 
                            value={l2AttackAmount} 
                            onChange={(e) => setL2AttackAmount(e.target.value)} 
                            placeholder="0.001" 
                            className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-2 outline-none focus:border-[#00ff00] font-mono text-xs transition-all w-full" 
                          />
                        </div>
                        <button onClick={async () => {
                          const amt = Number(l2AttackAmount);
                          if (isNaN(amt) || amt <= 0) {
                            addLog("> ERROR: INVALID ETH AMOUNT");
                            return;
                          }
                          addLog(`> CALL attacker.attack() [VALUE: ${l2AttackAmount} ETH]`);
                          const success = await executeGenericTx(registeredAttacker as `0x${string}`, ATTACKER_ABI, 'attack', [], l2AttackAmount, 'attack');
                          if (success && publicClient && targetAddress) {
                            try {
                              const isCompleteRes = await publicClient.readContract({
                                address: targetAddress,
                                abi: LEVEL2_ABI,
                                functionName: 'isComplete'
                              });
                              if (isCompleteRes) {
                                addLog('> ATTACK_EXECUTED ✓\n> LEVEL_02_COMPLETE ✓');
                                handleVerifyHack();
                              }
                            } catch (e) {}
                          }
                        }} disabled={isExploiting} className="w-full px-4 py-4 mt-auto bg-transparent border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all font-bold text-base disabled:opacity-50 tracking-widest break-words">
                          {isExploiting ? '[ SUBMITTING... ]' : '[ EXECUTE attack() ]'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : selectedLevel === 3 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">MARKET MANIPULATION</h2>
                  
                  <div className="flex flex-col gap-3 mb-6">
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="opacity-70 w-16">TOKEN:</span><span className="font-mono text-[#00ff00] break-all">{l3TokenRaw as string || '...'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="opacity-70 w-16">AMM:</span><span className="font-mono text-[#00ff00] break-all">{l3AmmRaw as string || '...'}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="opacity-70 w-16">ORACLE:</span><span className="font-mono text-[#00ff00] break-all">{l3OracleRaw as string || '...'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col md:flex-row gap-3 md:items-end">
                      <div className="flex-grow">
                        <label className="text-[10px] tracking-widest opacity-70 block mb-1">1. CLAIM AIRDROP</label>
                        <button onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'claimAirdrop', [], '0', 'claimAirdrop')} disabled={isExploiting || l3HasClaimed} className={`w-full p-3 border text-xs tracking-widest text-left ${!l3HasClaimed ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                          [ CALL claimAirdrop() ]
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:items-end border-t border-[#00ff00]/20 pt-4">
                      <div className="flex-1">
                        <label className="text-[10px] tracking-widest opacity-70 block mb-1">2. SWAP ETH (MANIPULATE ORACLE)</label>
                        <input type="text" value={l3SwapAmount} onChange={(e) => setL3SwapAmount(e.target.value)} placeholder="0.1 ETH" disabled={isExploiting || !l3HasClaimed || l3HasManipulated} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 outline-none focus:border-[#00ff00] font-mono text-xs w-full disabled:opacity-50" />
                      </div>
                      <button onClick={() => l3AmmRaw && executeGenericTx(l3AmmRaw as `0x${string}`, LEVEL3_AMM_ABI, 'swapETHForTokens', [], l3SwapAmount, 'swapETHForTokens')} disabled={isExploiting || !l3AmmRaw || !l3HasClaimed || l3HasManipulated} className={`flex-1 p-3 border text-xs tracking-widest ${l3HasClaimed && !l3HasManipulated ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                        [ CALL swapETHForTokens() ]
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:items-end border-t border-[#00ff00]/20 pt-4">
                      <div className="flex-1">
                        <label className="text-[10px] tracking-widest opacity-70 block mb-1">3. APPROVE COLLATERAL</label>
                        <input type="text" value={l3ApproveAmount} onChange={(e) => setL3ApproveAmount(e.target.value)} placeholder="Tokens (wei)" disabled={isExploiting || !l3HasManipulated || l3HasApproved} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 outline-none focus:border-[#00ff00] font-mono text-xs w-full disabled:opacity-50" />
                      </div>
                      <button onClick={() => l3TokenRaw && executeGenericTx(l3TokenRaw as `0x${string}`, MOCK_TOKEN_ABI, 'approve', [targetAddress, BigInt(l3ApproveAmount)], '0', 'approve')} disabled={isExploiting || !l3TokenRaw || !l3HasManipulated || l3HasApproved || !l3ApproveAmount} className={`flex-1 p-3 border text-xs tracking-widest ${l3HasManipulated && !l3HasApproved ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                        [ CALL approve(vault, amount) ]
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:items-end border-t border-[#00ff00]/20 pt-4">
                      <div className="flex-1">
                        <label className="text-[10px] tracking-widest opacity-70 block mb-1">4. DEPOSIT COLLATERAL</label>
                        <input type="text" value={l3DepositAmount} onChange={(e) => setL3DepositAmount(e.target.value)} placeholder="Tokens (wei)" disabled={isExploiting || !l3HasApproved || l3HasDeposited} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 outline-none focus:border-[#00ff00] font-mono text-xs w-full disabled:opacity-50" />
                      </div>
                      <button onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'deposit', [BigInt(l3DepositAmount)], '0', 'deposit')} disabled={isExploiting || !l3HasApproved || l3HasDeposited || !l3DepositAmount} className={`flex-1 p-3 border text-xs tracking-widest ${l3HasApproved && !l3HasDeposited ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                        [ CALL deposit(amount) ]
                      </button>
                    </div>

                    <div className="flex flex-col md:flex-row gap-3 md:items-end border-t border-[#00ff00]/20 pt-4">
                      <div className="flex-1">
                        <label className="text-[10px] tracking-widest opacity-70 block mb-1">5. BORROW EXCESSIVE ETH</label>
                        <input type="text" value={l3BorrowAmount} onChange={(e) => setL3BorrowAmount(e.target.value)} placeholder="ETH" disabled={isExploiting || !l3HasDeposited} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 outline-none focus:border-[#00ff00] font-mono text-xs w-full disabled:opacity-50" />
                      </div>
                      <button onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'borrow', [parseEther(l3BorrowAmount)], '0', 'borrow')} disabled={isExploiting || !l3HasDeposited} className={`flex-1 p-3 border text-xs tracking-widest ${l3HasDeposited ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                        [ CALL borrow(amount) ]
                      </button>
                    </div>

                  </div>
                </div>
              ) : selectedLevel === 4 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">SIGNATURE REPLAY</h2>
                  
                  <div className="flex flex-col gap-6 text-[10px] sm:text-xs">

                    
                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] tracking-widest opacity-70">WITHDRAWAL AMOUNT (ETH)</label>
                      <div className="flex gap-3">
                        <input type="text" value={l4AmountInput} onChange={(e) => setL4AmountInput(e.target.value)} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono transition-all" />
                        <button onClick={() => address && requestLevel4Signature(targetAddress, address, l4AmountInput)} disabled={isRequestingSignature} className="px-4 py-3 border border-[#00ff00] hover:bg-[#00ff00]/20 tracking-widest disabled:opacity-50 whitespace-nowrap">
                          {isRequestingSignature ? '[ REQUESTING... ]' : '[ REQUEST SIGNATURE ]'}
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col gap-2">
                      <label className="text-[10px] tracking-widest opacity-70">VALID SIGNATURE</label>
                      <textarea readOnly value={l4Signature} placeholder="0x..." className="bg-black border border-[#00ff00]/30 p-3 text-[#00ff00]/80 h-24 font-mono break-all resize-none outline-none" />
                    </div>

                    <button 
                      onClick={() => l4Signature && executeGenericTx(targetAddress, LEVEL4_ABI, 'withdraw', [address, parseEther(l4AmountInput), l4Signature as `0x${string}`], '0', 'withdraw')} 
                      disabled={!l4Signature || isExploiting} 
                      className={`p-4 border font-bold text-sm tracking-widest ${l4Signature ? 'border-[#00ff00] hover:bg-[#00ff00] hover:text-black' : 'border-[#00ff00]/30 text-[#00ff00]/30 cursor-not-allowed'}`}
                    >
                      [ SEND TRANSACTION: withdraw() ]
                    </button>
                  </div>
                </div>
              ) : selectedLevel === 5 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">STORAGE COLLISION</h2>
                  
                  <div className="flex flex-col gap-3 mb-6">

                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="opacity-70 w-24">PROXY:</span><span className="font-mono text-[#00ff00] break-all">{targetAddress}</span>
                    </div>
                    <div className="flex flex-wrap gap-2 text-[10px]">
                      <span className="opacity-70 w-24">IMPLEMENTATION:</span><span className="font-mono text-[#00ff00] break-all">{l5ImplRaw as string || '...'}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-6">
                    <div className="flex flex-col gap-2 p-4 border border-[#00ff00]/30 bg-[#00ff00]/5">
                      <span className="text-[10px] tracking-widest opacity-70">1. ENCODE PAYLOAD</span>
                      <span className="text-[#00ff00] text-xs font-mono mb-2">updateAddress(address)</span>
                      <div className="flex gap-3">
                        <input type="text" value={l5AddressInput} onChange={(e) => setL5AddressInput(e.target.value)} placeholder="0x..." className="bg-black border border-[#00ff00]/50 p-2 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all" />
                        <button onClick={handleEncodeCalldata} className="px-3 border border-[#00ff00] hover:bg-[#00ff00]/20 text-xs tracking-widest whitespace-nowrap">
                          [ ENCODE ]
                        </button>
                      </div>
                      {l5Calldata && <div className="mt-2 text-[10px] font-mono break-all opacity-80">{l5Calldata}</div>}
                    </div>

                    <div className="flex flex-col gap-2">
                      <span className="text-[10px] tracking-widest opacity-70">2. EXECUTE DELEGATECALL</span>
                      <button onClick={async () => {
                        await executeGenericTx(targetAddress, LEVEL5_ABI, 'execute', [l5Calldata], '0', 'execute');
                      }} disabled={isExploiting || !l5Calldata || l5OwnerRaw === address} className={`p-3 border text-xs tracking-widest ${l5Calldata && l5OwnerRaw !== address ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                        [ CALL execute(bytes) ]
                      </button>
                    </div>
                    
                    <div className="flex flex-col gap-2 border-t border-[#00ff00]/30 pt-4">
                      <span className="text-[10px] tracking-widest opacity-70">3. WITHDRAW AS OWNER</span>
                      <div className="flex gap-3">
                        <input type="text" value={l5WithdrawRecipient} onChange={(e) => setL5WithdrawRecipient(e.target.value)} placeholder="0x..." disabled={l5OwnerRaw !== address} className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-2 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all disabled:opacity-50" />
                        <button onClick={() => executeGenericTx(targetAddress, LEVEL5_ABI, 'withdraw', [l5WithdrawRecipient], '0', 'withdraw')} disabled={isExploiting || l5OwnerRaw !== address} className={`px-4 border text-xs tracking-widest ${l5OwnerRaw === address ? 'border-[#00ff00] hover:bg-[#00ff00] hover:text-black font-bold' : 'border-[#00ff00]/30 text-[#00ff00]/30 cursor-not-allowed'}`}>
                          [ CALL withdraw(recipient) ]
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-grow border border-[#00ff00] bg-black p-8 shadow-[0_0_15px_rgba(0,255,0,0.1)] flex flex-col items-center justify-center text-center">
              <h2 className="text-xl sm:text-3xl mb-6 font-bold tracking-widest animate-pulse break-words">_SYSTEM_READY</h2>
              <p className="opacity-80 max-w-lg leading-relaxed tracking-wide text-xs sm:text-sm px-2">
                Welcome, operative. Connect your Sepolia wallet and initialize Level {selectedLevel} to spawn your isolated target instance.
              </p>
            </div>
          )}
        </div>
        
        {/* RIGHT COLUMN: LEVEL NAVIGATION */}
        <div className="xl:col-span-3 lg:col-span-12 flex flex-col gap-4 lg:gap-5 min-w-0 min-h-0">
          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">LEVELS</h2>
            <div className="flex flex-col gap-2">
              {LEVEL_DATA.map(level => {
                const isUnlocked = level.id === 1 || isLevelSolvedGlobal(level.id - 1);
                const isCurrent = level.id === selectedLevel;
                const isCompleted = isLevelSolvedGlobal(level.id) || (isCurrent && isLevelCompleteLocally);
                
                return (
                  <button 
                    key={level.id}
                    onClick={() => isUnlocked && setSelectedLevel(level.id as 1|2|3|4|5)}
                    disabled={!isUnlocked}
                    className={`flex flex-col text-left p-3 border transition-all min-w-0 ${
                      !isUnlocked ? 'border-red-500/30 opacity-40 cursor-not-allowed text-red-500' :
                      isCurrent ? 'border-[#00ff00] bg-[#00ff00]/10 text-[#00ff00]' :
                      'border-[#00ff00]/30 hover:bg-[#00ff00]/10 text-[#00ff00]'
                    }`}
                  >
                    <div className="font-bold tracking-widest text-xs flex gap-2 items-center min-w-0">
                      <span className="w-4 flex-shrink-0 text-center">{isCompleted ? '✓' : isCurrent ? '→' : !isUnlocked ? '🔒' : ' '}</span>
                      <span className="truncate">LEVEL 0{level.id}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] opacity-70 tracking-widest mt-1 ml-6 truncate">{level.title}</div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

      </div>
    </main>
  );
}
// force recompile
