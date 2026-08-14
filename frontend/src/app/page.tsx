'use client';
import { useState, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useReadContracts, useWriteContract, usePublicClient } from 'wagmi';
import { parseEther, formatEther, isAddress, parseAbi } from 'viem';
import {
  CTF_FACTORY_ADDRESS,
  CTF_FACTORY_ABI,
  LEVEL1_ABI,
  LEVEL2_ABI,
  LEVEL3_ABI,
  TRACE_ABI,
  MKT_ABI,
  LEVEL2_AMM_ABI,
  LEVEL2_ORACLE_ABI,
} from './config';

const LEVEL1_SOURCE_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract Level1_Reentrancy {
    IERC20 public immutable trace;
    mapping(address => uint256) public balances;

    constructor(address _trace) {
        trace = IERC20(_trace);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");
        bool success = trace.transferFrom(msg.sender, address(this), amount);
        require(success, "Transfer failed");
        balances[msg.sender] += amount;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];
        require(amount > 0, "No balance");

        // Vulnerability: TRC is transferred before the balance is cleared.
        bool success = trace.transfer(msg.sender, amount);
        require(success, "Transfer failed");

        if (msg.sender.code.length > 0) {
            ITRCReceiver(msg.sender).onTRCReceived(amount);
        }

        // Too late!
        balances[msg.sender] = 0;
    }
}`;

const LEVEL1_SKELETON = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILevel1 {
    function deposit(uint256 amount) external;
    function withdraw() external;
}

interface ITRACE {
    function approve(address spender, uint256 amount) external returns (bool);
}

contract Attacker {
    ILevel1 public vault;
    ITRACE public trace;

    constructor(address _vault, address _trace) {
        // TODO: Initialize vault and trace interfaces
    }

    function attack(uint256 amount) external {
        // TODO: Exploit reentrancy
    }

    function onTRCReceived(uint256 amount) external {
        // TODO: Recursive call
    }
}`;

const LEVEL_DATA = [
  { id: 1, title: 'REENTRANCY' },
  { id: 2, title: 'ORACLE MANIPULATION' },
  { id: 3, title: 'SIGNATURE REPLAY' },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  const [selectedLevel, setSelectedLevel] = useState<1 | 2 | 3>(1);

  // Level State Logs
  const [logsL1, setLogsL1] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL2, setLogsL2] = useState<string[]>(['> SYSTEM_READY']);
  const [logsL3, setLogsL3] = useState<string[]>(['> SYSTEM_READY']);

  const getLogs = (l: number) => {
    switch (l) {
      case 1: return logsL1;
      case 2: return logsL2;
      case 3: return logsL3;
      default: return [];
    }
  };
  const currentLogs = getLogs(selectedLevel);

  const addLog = (msg: string) => {
    switch (selectedLevel) {
      case 1: setLogsL1(p => [...p, msg]); break;
      case 2: setLogsL2(p => [...p, msg]); break;
      case 3: setLogsL3(p => [...p, msg]); break;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('> COPIED_TO_CLIPBOARD');
  };

  // --------------------------------------------------------
  // GLOBAL STATE
  // --------------------------------------------------------
  const { data: targetAddressRaw, refetch: refetchTarget } = useReadContract({
    address: CTF_FACTORY_ADDRESS as `0x${string}`,
    abi: CTF_FACTORY_ABI,
    functionName: 'levelInstances',
    args: [BigInt(selectedLevel), address as `0x${string}`],
    query: { enabled: !!address }
  });
  const targetAddress = targetAddressRaw && targetAddressRaw !== '0x0000000000000000000000000000000000000000' ? (targetAddressRaw as `0x${string}`) : undefined;

  const { data: solvedStatus, refetch: refetchSolved } = useReadContracts({
    contracts: [
      { address: CTF_FACTORY_ADDRESS as `0x${string}`, abi: CTF_FACTORY_ABI, functionName: 'isSolved', args: [BigInt(1), address as `0x${string}`] },
      { address: CTF_FACTORY_ADDRESS as `0x${string}`, abi: CTF_FACTORY_ABI, functionName: 'isSolved', args: [BigInt(2), address as `0x${string}`] },
      { address: CTF_FACTORY_ADDRESS as `0x${string}`, abi: CTF_FACTORY_ABI, functionName: 'isSolved', args: [BigInt(3), address as `0x${string}`] }
    ]
  });

  const isLevelSolvedGlobal = (level: number) => {
    if (!solvedStatus || !solvedStatus[level - 1]) return false;
    return solvedStatus[level - 1].result === true;
  };

  const currentAbi = selectedLevel === 1 ? LEVEL1_ABI : selectedLevel === 2 ? LEVEL2_ABI : LEVEL3_ABI;

  const { data: isComplete, refetch: refetchIsComplete } = useReadContract({
    address: targetAddress, abi: currentAbi, functionName: 'isComplete',
    query: { enabled: !!targetAddress }
  });
  const isLevelCompleteLocally = !!isComplete;

  // --------------------------------------------------------
  // LEVEL 1: REENTRANCY STATE
  // --------------------------------------------------------
  const { data: l1TraceAddress } = useReadContract({
    address: '0x435602f1E0efCfC57222B357B91611D57330F318', // Wait, I need TRACE address from CTFFactory. But I can just check target TRC balance since we know it's a TRC challenge.
    // Wait, the player doesn't strictly need the trace address for UI display if we just fetch trace address from somewhere? 
    // Actually, TRACE is not exposed on Level 1 ABI. Wait, in Level1_Reentrancy.sol, it is `IERC20 public immutable trace`.
    // Let's add it to LEVEL1_ABI! Wait, config.ts doesn't have it.
    // For now, if we can't easily get the trace balance because we don't have trace address, we can rely on `isComplete()` which returns true when drained.
  });

  // --------------------------------------------------------
  // LEVEL 2: ORACLE MANIPULATION STATE
  // --------------------------------------------------------
  const { data: l2MktRaw } = useReadContract({
    address: selectedLevel === 2 ? targetAddress : undefined, abi: LEVEL2_ABI, functionName: 'mkt', query: { enabled: selectedLevel === 2 && !!targetAddress }
  });
  const { data: l2TraceRaw } = useReadContract({
    address: selectedLevel === 2 ? targetAddress : undefined, abi: LEVEL2_ABI, functionName: 'trace', query: { enabled: selectedLevel === 2 && !!targetAddress }
  });
  const { data: l2AmmRaw } = useReadContract({
    address: selectedLevel === 2 ? targetAddress : undefined, abi: LEVEL2_ABI, functionName: 'oracle', query: { enabled: false } // Wait, I need AMM, but vault has oracle.
  });
  // Actually oracle exposes amm(), but vault does not expose amm() directly. Let's just fetch oracle first.
  const { data: l2OracleRaw } = useReadContract({
    address: selectedLevel === 2 ? targetAddress : undefined, abi: LEVEL2_ABI, functionName: 'oracle', query: { enabled: selectedLevel === 2 && !!targetAddress }
  });
  // Now fetch AMM from Oracle
  const { data: l2AmmFromOracle } = useReadContract({
    address: (l2OracleRaw as `0x${string}`), abi: parseAbi(['function amm() external view returns (address)']), functionName: 'amm', query: { enabled: !!l2OracleRaw }
  });
  const l2AmmAddress = l2AmmFromOracle as `0x${string}`;
  const l2OracleAddress = l2OracleRaw as `0x${string}`;
  const l2MktAddress = l2MktRaw as `0x${string}`;
  const l2TraceAddress = l2TraceRaw as `0x${string}`;

  // Market State (Level 2)
  const { data: l2OraclePrice, refetch: refetchL2OraclePrice } = useReadContract({
    address: l2OracleAddress, abi: LEVEL2_ORACLE_ABI, functionName: 'getPrice', query: { enabled: !!l2OracleAddress }
  });
  const { data: l2AmmReserveMkt, refetch: refetchL2ReserveMkt } = useReadContract({
    address: l2AmmAddress, abi: LEVEL2_AMM_ABI, functionName: 'reserveMKT', query: { enabled: !!l2AmmAddress }
  });
  const { data: l2AmmReserveTrace, refetch: refetchL2ReserveTrace } = useReadContract({
    address: l2AmmAddress, abi: LEVEL2_AMM_ABI, functionName: 'reserveTRACE', query: { enabled: !!l2AmmAddress }
  });

  // Player State (Level 2)
  const { data: l2PlayerMkt, refetch: refetchL2PlayerMkt } = useReadContract({
    address: l2MktAddress, abi: MKT_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!l2MktAddress && !!address }
  });
  const { data: l2PlayerTrace, refetch: refetchL2PlayerTrace } = useReadContract({
    address: l2TraceAddress, abi: TRACE_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!l2TraceAddress && !!address }
  });
  
  // Vault State (Level 2)
  const { data: l2VaultTrace, refetch: refetchL2VaultTrace } = useReadContract({
    address: l2TraceAddress, abi: TRACE_ABI, functionName: 'balanceOf', args: [targetAddress as `0x${string}`], query: { enabled: !!l2TraceAddress && !!targetAddress }
  });

  // --------------------------------------------------------
  // LEVEL 3: SIGNATURE REPLAY STATE
  // --------------------------------------------------------
  const { data: l3TraceAddress } = useReadContract({
    address: selectedLevel === 3 ? targetAddress : undefined, abi: LEVEL3_ABI, functionName: 'trace', query: { enabled: selectedLevel === 3 && !!targetAddress }
  });
  const { data: l3VaultTrace, refetch: refetchL3VaultTrace } = useReadContract({
    address: l3TraceAddress as `0x${string}`, abi: TRACE_ABI, functionName: 'balanceOf', args: [targetAddress as `0x${string}`], query: { enabled: !!l3TraceAddress && !!targetAddress }
  });
  const [l3Signature, setL3Signature] = useState('');


  // --------------------------------------------------------
  // GLOBAL ACTIONS
  // --------------------------------------------------------
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const executeGenericTx = async (target: `0x${string}`, abi: any, functionName: string, args: any[] = [], value: string = '0', logName: string = functionName) => {
    setIsExploiting(true);
    try {
      addLog(`> PREPARING_TRANSACTION: ${logName}`);
      const hash = await writeContractAsync({
        address: target,
        abi,
        functionName,
        args,
        value: parseEther(value)
      });
      addLog(`> TX_SUBMITTED: ${hash.slice(0, 10)}...`);
      await publicClient?.waitForTransactionReceipt({ hash });
      addLog(`> TX_CONFIRMED: ${logName} ✓`);
      refetchAllState();
      return true;
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
      return false;
    } finally {
      setIsExploiting(false);
    }
  };

  const refetchAllState = () => {
    refetchIsComplete();
    refetchTarget();
    if (selectedLevel === 2) {
      refetchL2OraclePrice();
      refetchL2ReserveMkt();
      refetchL2ReserveTrace();
      refetchL2PlayerMkt();
      refetchL2PlayerTrace();
      refetchL2VaultTrace();
    }
    if (selectedLevel === 3) {
      refetchL3VaultTrace();
    }
  };

  const handleInitialize = async () => {
    if (!address) return addLog('> ERROR: WALLET_NOT_CONNECTED');
    setIsInitializing(true);
    try {
      addLog('> PREPARING_TRANSACTION');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS as `0x${string}`,
        abi: CTF_FACTORY_ABI,
        functionName: selectedLevel === 1 ? 'deployLevel1' : selectedLevel === 2 ? 'deployLevel2' : 'deployLevel3',
        args: []
      });
      addLog(`> TX_SUBMITTED: ${hash.slice(0, 10)}...`);
      await publicClient?.waitForTransactionReceipt({ hash });
      addLog('> TX_CONFIRMED: INITIALIZATION COMPLETE');
      await refetchTarget();
      refetchAllState();
    } catch (e: any) { addLog(`> ERROR: ${e.shortMessage || e.message}`); }
    finally { setIsInitializing(false); }
  };

  const handleVerifyHack = async () => {
    if (!address || !targetAddress) return;
    setIsVerifying(true);
    try {
      addLog('> INITIATING_VALIDATION');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS as `0x${string}`,
        abi: CTF_FACTORY_ABI,
        functionName: selectedLevel === 1 ? 'validateLevel1' : selectedLevel === 2 ? 'validateLevel2' : 'validateLevel3',
        args: []
      });
      addLog(`> TX_SUBMITTED: ${hash.slice(0, 10)}...`);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog(`> LEVEL 0${selectedLevel} COMPLETE`);
        addLog(`> BADGE_0${selectedLevel}_MINTED`);
        await refetchSolved();
        if (selectedLevel < 3) setSelectedLevel((selectedLevel + 1) as 1|2|3);
      } else addLog('> ERROR: VALIDATION TRANSACTION FAILED');
    } catch (e: any) { addLog(`> ERROR: ${e.shortMessage || e.message}`); }
    finally { setIsVerifying(false); }
  };

  // --------------------------------------------------------
  // LEVEL 3 SIGNATURE LOGIC
  // --------------------------------------------------------
  const handleRequestSignature = async () => {
    if (!targetAddress || !address) return;
    try {
      addLog('> REQUESTING_SIGNATURE_FROM_BACKEND');
      const res = await fetch('/api/level3-signature', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceAddress: targetAddress,
          playerAddress: address,
          amount: parseEther('10').toString() // 10 TRC
        })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch signature');
      }
      setL3Signature(data.signature);
      addLog(`> SIGNATURE_RECEIVED: ${data.signature.substring(0, 20)}...`);
    } catch (e: any) {
      addLog(`> ERROR: ${e.message}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-[#00ff00] font-mono selection:bg-[#00ff00] selection:text-black flex flex-col items-center">
      
      {/* HEADER SECTION */}
      <header className="w-full border-b border-[#00ff00]/30 bg-black/90 sticky top-0 z-50 shadow-[0_0_20px_rgba(0,255,0,0.15)]">
        <div className="max-w-[1920px] mx-auto flex flex-wrap items-center justify-between p-4 gap-4">
          <div className="flex flex-col">
            <h1 className="text-xl md:text-3xl font-bold tracking-[0.2em] uppercase" style={{ textShadow: '0 0 10px rgba(0,255,0,0.5)' }}>HackTheChain</h1>
            <div className="flex items-center gap-3 text-[10px] md:text-xs tracking-widest mt-1 opacity-80">
              <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-[#00ff00] animate-pulse"></span> SYSTEM ONLINE</span>
              <span className="hidden sm:inline border-l border-[#00ff00]/30 pl-3">SEPOLIA NETWORK</span>
            </div>
          </div>
          <ConnectButton />
        </div>
      </header>

      {/* MAIN CONTENT AREA */}
      <div className="flex-grow w-full max-w-[1920px] grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 p-4 lg:p-6 min-h-0">
        
        {/* LEFT COLUMN: COMMAND CENTER & LOGS */}
        <div className="lg:col-span-4 xl:col-span-3 flex flex-col gap-4 lg:gap-5 min-w-0 h-full">
          
          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">COMMAND CENTER</h2>
            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70 tracking-widest">CONNECTION</span>
                <span className={isConnected ? "text-[#00ff00] font-bold" : "text-red-500 font-bold"}>{isConnected ? 'SECURE' : 'DISCONNECTED'}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="opacity-70 tracking-widest">TARGET_STATUS</span>
                {isComplete ? (
                  <span className="text-[#00ff00] font-bold animate-pulse">COMPROMISED ✓</span>
                ) : targetAddress ? (
                  <span className="text-yellow-500 font-bold">ACTIVE</span>
                ) : (
                  <span className="opacity-50">UNINITIALIZED</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex-grow border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] flex flex-col min-h-[300px]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest flex justify-between">
              <span>SYSTEM LOGS</span>
              <span className="animate-pulse">_</span>
            </h2>
            <div className="flex-grow overflow-y-auto font-mono text-[10px] md:text-xs flex flex-col gap-1.5 opacity-90 pr-2">
              {currentLogs.map((log, i) => (
                <div key={i} className={`break-words whitespace-pre-wrap ${log.includes('ERROR') ? 'text-red-500' : log.includes('✓') ? 'text-[#00ff00] font-bold' : ''}`}>
                  {log}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* MIDDLE COLUMN: MAIN WORKSPACE */}
        <div className="lg:col-span-8 xl:col-span-6 flex flex-col gap-4 lg:gap-5 min-w-0 h-full">
          
          {targetAddress ? (
            <>
              {/* LEVEL INFORMATION */}
              <div className="flex-none flex flex-col md:flex-row md:items-end justify-between gap-4 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                <div>
                  <h2 className="text-xs font-bold opacity-70 tracking-widest mb-1">LEVEL 0{selectedLevel}</h2>
                  <h3 className="text-xl lg:text-2xl font-bold tracking-widest">{LEVEL_DATA[selectedLevel - 1].title}</h3>
                </div>
                
                <div className="flex flex-col gap-1 md:items-end">
                  <span className="opacity-70 text-[10px] tracking-widest">TARGET INSTANCE</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-sm break-all">{targetAddress}</span>
                  </div>
                </div>
              </div>

              {/* LEVEL CONTENT */}
              {selectedLevel === 1 ? (
                <div className="flex-grow flex flex-col border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  
                  <div className="flex justify-between items-center border-b border-[#00ff00]/30 pb-2 mb-4">
                    <h2 className="text-xs font-bold tracking-widest">CHALLENGE: REENTRANCY</h2>
                    <span className="text-[10px] opacity-70">TARGET IS VULNERABLE</span>
                  </div>

                  <p className="text-xs mb-6 opacity-80 leading-relaxed max-w-2xl">
                    The target vault handles user balances but performs an external transfer before updating the state.
                    Since TRC implements `ITRCReceiver` hooks (like ERC777), the recipient contract can re-enter `withdraw()` before its balance is zeroed.
                    <br/><br/>
                    Build your attack contract in Remix, fund it, and execute the attack to drain the vault's 100 TRC.
                  </p>

                  <div className="flex flex-col gap-4 mb-6">
                    <div className="bg-black border border-[#00ff00]/30 relative group">
                      <div className="absolute right-2 top-2 z-10">
                        <button onClick={() => copyToClipboard(LEVEL1_SOURCE_CODE)} className="text-[10px] bg-[#00ff00]/10 border border-[#00ff00]/50 px-2 py-1 hover:bg-[#00ff00] hover:text-black">
                          [ COPY SOURCE ]
                        </button>
                      </div>
                      <pre className="p-4 text-[10px] font-mono text-[#00ff00]/70 overflow-x-auto whitespace-pre max-h-[300px]">
                        {LEVEL1_SOURCE_CODE}
                      </pre>
                    </div>

                    <div className="bg-black border border-[#00ff00]/30 relative group">
                      <div className="absolute right-2 top-2 z-10">
                        <button onClick={() => copyToClipboard(LEVEL1_SKELETON)} className="text-[10px] bg-[#00ff00]/10 border border-[#00ff00]/50 px-2 py-1 hover:bg-[#00ff00] hover:text-black">
                          [ COPY SKELETON ]
                        </button>
                      </div>
                      <pre className="p-4 text-[10px] font-mono text-[#00ff00]/70 overflow-x-auto whitespace-pre max-h-[250px]">
                        {LEVEL1_SKELETON}
                      </pre>
                    </div>
                  </div>

                  {isComplete && (
                     <button onClick={handleVerifyHack} disabled={isVerifying} className="w-full py-4 mt-auto border-2 border-[#00ff00] bg-[#00ff00]/10 hover:bg-[#00ff00] hover:text-black transition-all font-bold tracking-widest mt-6">
                        {isVerifying ? '[ VERIFYING... ]' : '[ VERIFY ON-CHAIN ]'}
                     </button>
                  )}
                </div>
              ) : selectedLevel === 2 ? (
                <div className="flex-grow flex flex-col border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">MARKET MANIPULATION CONSOLE</h2>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex flex-col gap-2">
                      <div className="text-[10px] opacity-70 tracking-widest border-b border-[#00ff00]/20 pb-1">MARKET STATE (AMM)</div>
                      <div className="flex justify-between text-xs"><span>MKT RESERVE:</span> <span>{l2AmmReserveMkt ? formatEther(l2AmmReserveMkt) : '---'} MKT</span></div>
                      <div className="flex justify-between text-xs"><span>TRC RESERVE:</span> <span>{l2AmmReserveTrace ? formatEther(l2AmmReserveTrace) : '---'} TRC</span></div>
                      <div className="flex justify-between text-xs font-bold text-yellow-400 mt-1 border-t border-[#00ff00]/20 pt-1"><span>ORACLE PRICE:</span> <span>{l2OraclePrice ? formatEther(l2OraclePrice) : '---'} TRC / MKT</span></div>
                    </div>
                    
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex flex-col gap-2">
                      <div className="text-[10px] opacity-70 tracking-widest border-b border-[#00ff00]/20 pb-1">PLAYER BALANCES</div>
                      <div className="flex justify-between text-xs"><span>MKT (Collateral):</span> <span>{l2PlayerMkt ? formatEther(l2PlayerMkt) : '---'} MKT</span></div>
                      <div className="flex justify-between text-xs"><span>TRC (Capital):</span> <span>{l2PlayerTrace ? formatEther(l2PlayerTrace) : '---'} TRC</span></div>
                    </div>
                  </div>

                  <div className="border border-red-500/50 p-3 bg-red-500/5 mb-6 flex justify-between items-center">
                    <span className="text-[10px] text-red-500 tracking-widest font-bold">TARGET VAULT BALANCE</span>
                    <span className="text-red-500 font-bold font-mono">{l2VaultTrace ? formatEther(l2VaultTrace) : '---'} TRC</span>
                  </div>

                  <div className="flex flex-col gap-3">
                    <div className="text-[10px] opacity-70 tracking-widest">ATTACK SEQUENCE</div>
                    
                    {/* STEP 1 */}
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button onClick={() => executeGenericTx(l2TraceAddress, TRACE_ABI, 'approve', [l2AmmAddress, parseEther('40')], '0', 'approve TRC')} disabled={isExploiting} className="flex-1 border border-[#00ff00]/50 hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest text-left">
                        1. [ APPROVE 40 TRC TO AMM ]
                      </button>
                      <button onClick={() => executeGenericTx(l2AmmAddress, LEVEL2_AMM_ABI, 'swapTRACEForMKT', [parseEther('40')], '0', 'swapTRACEForMKT')} disabled={isExploiting} className="flex-1 border border-[#00ff00]/50 hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest text-left">
                        2. [ SWAP 40 TRC FOR MKT ]
                      </button>
                    </div>

                    {/* STEP 2 */}
                    <div className="flex flex-col sm:flex-row gap-2 mt-2">
                      <button onClick={() => executeGenericTx(l2MktAddress, MKT_ABI, 'approve', [targetAddress, parseEther('10')], '0', 'approve MKT')} disabled={isExploiting} className="flex-1 border border-[#00ff00]/50 hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest text-left">
                        3. [ APPROVE 10 MKT TO VAULT ]
                      </button>
                      <button onClick={() => executeGenericTx(targetAddress, LEVEL2_ABI, 'deposit', [parseEther('10')], '0', 'deposit')} disabled={isExploiting} className="flex-1 border border-[#00ff00]/50 hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest text-left">
                        4. [ DEPOSIT 10 MKT COLLATERAL ]
                      </button>
                    </div>

                    {/* STEP 3 */}
                    <button onClick={() => executeGenericTx(targetAddress, LEVEL2_ABI, 'borrow', [parseEther('100')], '0', 'borrow')} disabled={isExploiting} className="w-full border-2 border-red-500/50 hover:bg-red-500/20 text-red-500 p-4 text-xs tracking-widest font-bold mt-2">
                      5. [ EXPLOIT: BORROW 100 TRC ]
                    </button>
                  </div>

                  {isComplete && (
                     <button onClick={handleVerifyHack} disabled={isVerifying} className="w-full py-4 mt-auto border-2 border-[#00ff00] bg-[#00ff00]/10 hover:bg-[#00ff00] hover:text-black transition-all font-bold tracking-widest mt-6">
                        {isVerifying ? '[ VERIFYING... ]' : '[ VERIFY ON-CHAIN ]'}
                     </button>
                  )}
                </div>
              ) : selectedLevel === 3 ? (
                <div className="flex-grow flex flex-col border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">SIGNATURE REPLAY</h2>
                  
                  <p className="text-xs mb-6 opacity-80 leading-relaxed">
                    The backend signer provides valid signatures authorizing a 10 TRC withdrawal for your address.
                    Since the signature is never invalidated (no nonce), you can replay it multiple times to drain the vault.
                  </p>

                  <div className="border border-red-500/50 p-3 bg-red-500/5 mb-6 flex justify-between items-center">
                    <span className="text-[10px] text-red-500 tracking-widest font-bold">TARGET VAULT BALANCE</span>
                    <span className="text-red-500 font-bold font-mono">{l3VaultTrace ? formatEther(l3VaultTrace) : '---'} TRC</span>
                  </div>

                  <div className="flex flex-col gap-4 mb-6">
                    <button onClick={handleRequestSignature} className="border border-[#00ff00] hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest">
                      [ 1. REQUEST 10 TRC SIGNATURE FROM BACKEND ]
                    </button>
                    
                    {l3Signature && (
                      <div className="flex flex-col gap-2">
                        <span className="text-[10px] tracking-widest opacity-70">VALID SIGNATURE</span>
                        <textarea readOnly value={l3Signature} className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-2 font-mono text-[10px] break-all outline-none resize-none h-16" />
                        
                        <button 
                          onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'withdraw', [address, parseEther('10'), l3Signature as `0x${string}`], '0', 'withdraw')}
                          disabled={isExploiting}
                          className="border border-[#00ff00] hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest mt-2"
                        >
                          [ 2. SUBMIT WITHDRAWAL (REPLAYABLE) ]
                        </button>
                      </div>
                    )}
                  </div>

                  {isComplete && (
                     <button onClick={handleVerifyHack} disabled={isVerifying} className="w-full py-4 mt-auto border-2 border-[#00ff00] bg-[#00ff00]/10 hover:bg-[#00ff00] hover:text-black transition-all font-bold tracking-widest mt-6">
                        {isVerifying ? '[ VERIFYING... ]' : '[ VERIFY ON-CHAIN ]'}
                     </button>
                  )}
                </div>
              ) : null}
            </>
          ) : (
            <div className="flex-grow flex flex-col items-center justify-center border border-[#00ff00] bg-black p-8 shadow-[0_0_15px_rgba(0,255,0,0.1)] relative">
              <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#00ff00]/10 via-transparent to-transparent opacity-50 pointer-events-none"></div>
              
              <div className="text-center z-10 flex flex-col items-center max-w-lg">
                <div className="w-16 h-16 border-2 border-[#00ff00] rounded-full flex items-center justify-center mb-6 shadow-[0_0_15px_rgba(0,255,0,0.3)]">
                  <span className="text-2xl font-bold">0{selectedLevel}</span>
                </div>
                
                <h2 className="text-xl md:text-2xl font-bold tracking-widest mb-4">LEVEL 0{selectedLevel}: {LEVEL_DATA[selectedLevel - 1].title}</h2>
                <p className="text-sm opacity-70 leading-relaxed mb-8 font-mono">
                  Target system identified. Ready to provision vulnerable contract instance on the Sepolia network. Stand by for deployment.
                </p>
                
                <button 
                  onClick={handleInitialize} 
                  disabled={!isConnected || isInitializing}
                  className={`px-8 py-4 border-2 font-bold tracking-widest transition-all w-full max-w-xs ${
                    !isConnected ? 'border-red-500/50 text-red-500/50 cursor-not-allowed' :
                    isInitializing ? 'border-[#00ff00]/50 text-[#00ff00]/50 cursor-wait' :
                    'border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00] hover:text-black shadow-[0_0_15px_rgba(0,255,0,0.2)] hover:shadow-[0_0_25px_rgba(0,255,0,0.5)]'
                  }`}
                >
                  {isInitializing ? '[ INITIALIZING... ]' : '[ INITIALIZE TARGET ]'}
                </button>
                
                {!isConnected && (
                  <p className="text-red-500 mt-4 text-[10px] tracking-widest font-mono">WALLET CONNECTION REQUIRED</p>
                )}
              </div>
            </div>
          )}
        </div>
        
        {/* RIGHT COLUMN: LEVEL NAVIGATION */}
        <div className="xl:col-span-3 lg:col-span-12 flex flex-col gap-4 lg:gap-5 min-w-0 h-full">
          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] h-full flex flex-col">
            <h2 className="text-xs font-bold mb-4 border-b border-[#00ff00]/30 pb-2 tracking-widest">LEVEL NAVIGATION</h2>
            <div className="flex flex-col gap-3">
              {LEVEL_DATA.map((level) => {
                const isUnlocked = level.id === 1 || isLevelSolvedGlobal(level.id - 1);
                const isCurrent = level.id === selectedLevel;
                const isCompleted = isLevelSolvedGlobal(level.id) || (isCurrent && isLevelCompleteLocally);
                
                return (
                  <button 
                    key={level.id}
                    onClick={() => isUnlocked && setSelectedLevel(level.id as 1|2|3)}
                    disabled={!isUnlocked}
                    className={`flex flex-col text-left p-3 border transition-all min-w-0 ${
                      !isUnlocked ? 'border-red-500/30 opacity-40 cursor-not-allowed text-red-500' :
                      isCurrent ? 'border-[#00ff00] bg-[#00ff00]/10 text-[#00ff00] shadow-[0_0_10px_rgba(0,255,0,0.2)]' :
                      'border-[#00ff00]/30 hover:bg-[#00ff00]/10 text-[#00ff00]'
                    }`}
                  >
                    <div className="font-bold tracking-widest text-xs flex gap-2 items-center min-w-0">
                      <span className="w-4 flex-shrink-0 text-center">{isCompleted ? '✓' : isCurrent ? '→' : !isUnlocked ? '🔒' : ' '}</span>
                      <span className="truncate">LEVEL 0{level.id}</span>
                    </div>
                    <div className="text-[10px] mt-1 opacity-70 ml-6 tracking-widest truncate">{level.title}</div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
