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
import {
  LEVEL2_TARGET_SOURCE,
  VULNERABLE_ORACLE_SOURCE,
  SIMPLE_AMM_SOURCE,
  stripComments
} from './l2sources';
import { LEVEL3_TARGET_SOURCE } from './l3sources';

const LEVEL1_SOURCE_CODE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface ITRCReceiver {
    function onTRCReceived(uint256 amount) external;
}

contract Level1_Reentrancy {
    IERC20 public immutable trace;
    mapping(address => uint256) public balances;
    uint256 public constant VAULT_AMOUNT = 100 ether;

    constructor(address _trace) {
        trace = IERC20(_trace);
    }

    function deposit(uint256 amount) external {
        require(amount > 0, "Amount must be greater than zero");

        bool success = trace.transferFrom(
            msg.sender,
            address(this),
            amount
        );

        require(success, "Transfer failed");
        balances[msg.sender] += amount;
    }

    function withdraw() external {
        uint256 amount = balances[msg.sender];

        require(amount > 0, "No balance");

        bool success = trace.transfer(
            msg.sender,
            amount
        );

        require(success, "Transfer failed");

        if (msg.sender.code.length > 0) {
            ITRCReceiver(msg.sender).onTRCReceived(amount);
        }

        balances[msg.sender] = 0;
    }

    function isComplete() external view returns (bool) {
        return trace.balanceOf(address(this)) == 0;
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

const LEVEL2_SKELETON = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILevel2 {
    function deposit(uint256 amount) external;
    function borrow(uint256 amount) external;
    function mkt() external view returns (address);
    function trace() external view returns (address);
    function oracle() external view returns (address);
}

interface IERC20 {
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

interface IOracle {
    function amm() external view returns (address);
}

interface IAMM {
    function swapTRACEForMKT(uint256 amountIn) external;
}

contract Attacker {
    ILevel2 public vault;

    constructor(address _vault) {
        // TODO: Initialize the target
    }

    function attack() external {
        // TODO: Exploit the target
}
`;

const LEVEL3_SKELETON = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

interface ILevel3 {
    function withdraw(
        address recipient,
        uint256 amount,
        bytes calldata signature
    ) external;
}

contract Attacker {
    ILevel3 public vault;

    constructor(address _vault) {
        // TODO: Initialize the target
    }

    function attack(bytes memory signature) external {
        // TODO: Exploit the target
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
  const { data: factoryTraceAddressRaw } = useReadContract({
    address: CTF_FACTORY_ADDRESS as `0x${string}`,
    abi: CTF_FACTORY_ABI,
    functionName: 'trace',
  });
  const factoryTraceAddress = factoryTraceAddressRaw as `0x${string}` | undefined;

  const { data: l1PlayerTrace, refetch: refetchL1PlayerTrace } = useReadContract({
    address: factoryTraceAddress, abi: TRACE_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!factoryTraceAddress && !!address }
  });
  const { data: l1VaultTrace, refetch: refetchL1VaultTrace } = useReadContract({
    address: factoryTraceAddress, abi: TRACE_ABI, functionName: 'balanceOf', args: [targetAddress as `0x${string}`], query: { enabled: !!factoryTraceAddress && !!targetAddress }
  });


  const [l1AttackerInput, setL1AttackerInput] = useState('');
  const [isL1Funding, setIsL1Funding] = useState(false);
  const [l2AttackerInput, setL2AttackerInput] = useState('');
  const [isL2Funding, setIsL2Funding] = useState(false);

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
  const { data: l3PlayerTrace, refetch: refetchL3PlayerTrace } = useReadContract({
    address: l3TraceAddress as `0x${string}`, abi: TRACE_ABI, functionName: 'balanceOf', args: [address as `0x${string}`], query: { enabled: !!l3TraceAddress && !!address }
  });
  const [l3Signature, setL3Signature] = useState('');

  // --------------------------------------------------------
  // REFETCH POLLING
  // --------------------------------------------------------
  useEffect(() => {
    const interval = setInterval(() => {
      refetchL1PlayerTrace?.();
      refetchL1VaultTrace?.();
      refetchL2PlayerMkt?.();
      refetchL2PlayerTrace?.();
      refetchL2VaultTrace?.();
      refetchL2OraclePrice?.();
      refetchL2ReserveMkt?.();
      refetchL2ReserveTrace?.();
      refetchL3PlayerTrace?.();
      refetchL3VaultTrace?.();
      refetchIsComplete?.();
      refetchSolved?.();
    }, 3000);
    return () => clearInterval(interval);
  }, [
    refetchL1PlayerTrace, refetchL1VaultTrace,
    refetchL2PlayerMkt, refetchL2PlayerTrace, refetchL2VaultTrace,
    refetchL2OraclePrice, refetchL2ReserveMkt, refetchL2ReserveTrace,
    refetchL3PlayerTrace, refetchL3VaultTrace,
    refetchIsComplete, refetchSolved
  ]);


  // --------------------------------------------------------
  // GLOBAL ACTIONS
  // --------------------------------------------------------
  const [isInitializing, setIsInitializing] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);

  const handleFundL1Attacker = async () => {
    if (!address) return addLog('> ERROR: WALLET_NOT_CONNECTED');
    if (!factoryTraceAddress) return addLog('> ERROR: TRACE ADDRESS NOT FOUND');
    if (!isAddress(l1AttackerInput) || l1AttackerInput === '0x0000000000000000000000000000000000000000') {
      return addLog('> ERROR: INVALID ATTACKER ADDRESS');
    }

    setIsL1Funding(true);
    try {
      addLog('> FUNDING_ATTACKER');
      const hash = await writeContractAsync({
        address: factoryTraceAddress,
        abi: TRACE_ABI,
        functionName: 'transfer',
        args: [l1AttackerInput, parseEther('10')]
      });
      addLog(`> TX_SUBMITTED: ${hash.slice(0, 10)}...`);
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog('> ATTACKER_FUNDED: 10 TRC');
      } else {
        addLog('> ATTACKER_FUNDING_FAILED');
      }
    } catch (e: any) {
      addLog('> ATTACKER_FUNDING_FAILED');
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsL1Funding(false);
    }
  };

  const handleFundL2Attacker = async () => {
    setIsL2Funding(true);
    try {
      addLog(`> TRANSFERRING ASSETS TO ATTACKER...`);

      const hash1 = await writeContractAsync({
        address: l2MktAddress as `0x${string}`,
        abi: MKT_ABI,
        functionName: 'transfer',
        args: [l2AttackerInput as `0x${string}`, parseEther('10')]
      });
      addLog(`> TX 1 (10 MKT) SUBMITTED: ${hash1.slice(0, 10)}...`);
      await publicClient?.waitForTransactionReceipt({ hash: hash1 });

      const hash2 = await writeContractAsync({
        address: factoryTraceAddress as `0x${string}`,
        abi: TRACE_ABI,
        functionName: 'transfer',
        args: [l2AttackerInput as `0x${string}`, parseEther('40')]
      });
      addLog(`> TX 2 (40 TRC) SUBMITTED: ${hash2.slice(0, 10)}...`);
      await publicClient?.waitForTransactionReceipt({ hash: hash2 });

      addLog('> ATTACKER_FUNDED: 10 MKT, 40 TRC');
    } catch (e: any) {
      addLog('> ATTACKER_FUNDING_FAILED');
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsL2Funding(false);
    }
  };

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
        if (selectedLevel < 3) setSelectedLevel((selectedLevel + 1) as 1 | 2 | 3);
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
              <div className="flex-none flex flex-col md:flex-row md:items-center justify-between gap-4 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                <div>
                  <h2 className="text-xs font-bold opacity-70 tracking-widest mb-1">LEVEL 0{selectedLevel}</h2>
                  <h3 className="text-xl lg:text-2xl font-bold tracking-widest">{LEVEL_DATA[selectedLevel - 1].title}</h3>
                </div>

                <div className="flex flex-col gap-3 md:items-end">
                  <div className="flex flex-col gap-1 md:items-end">
                    <span className="opacity-70 text-[10px] tracking-widest">TARGET INSTANCE</span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-sm break-all">{targetAddress}</span>
                      <button onClick={() => copyToClipboard(targetAddress)} className="text-[9px] border border-[#00ff00] px-1.5 py-0.5 hover:bg-[#00ff00] hover:text-black min-w-fit">COPY</button>
                    </div>
                  </div>
                  {selectedLevel === 1 && factoryTraceAddress && (
                    <div className="flex flex-col gap-1 md:items-end mt-2 md:mt-0 pt-2 md:pt-0 border-t border-[#00ff00]/30 md:border-none">
                      <span className="opacity-70 text-[10px] tracking-widest">TRACE TOKEN</span>
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono text-sm break-all">{factoryTraceAddress}</span>
                        <button onClick={() => copyToClipboard(factoryTraceAddress)} className="text-[9px] border border-[#00ff00] px-1.5 py-0.5 hover:bg-[#00ff00] hover:text-black min-w-fit">COPY</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* LEVEL CONTENT */}
              {selectedLevel === 1 ? (
                <div className="flex-grow flex flex-col border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">

                  <div className="flex justify-between items-center border-b border-[#00ff00]/30 pb-2 mb-4">
                    <h2 className="text-xs font-bold tracking-widest">CHALLENGE: REENTRANCY</h2>
                    <span className="text-[10px] opacity-70">TARGET IS VULNERABLE</span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">PLAYER TRC BALANCE</span>
                      <span className="font-mono text-[11px] text-[#00ff00] font-bold mt-1">{l1PlayerTrace !== undefined ? formatEther(l1PlayerTrace) : '---'} TRC</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">VAULT TRC BALANCE</span>
                      <span className="font-mono text-[11px] text-red-500 font-bold mt-1">{l1VaultTrace !== undefined ? formatEther(l1VaultTrace) : '---'} TRC</span>
                    </div>
                  </div>

                  <p className="text-xs mb-6 opacity-80 leading-relaxed max-w-2xl">
                    Analyze the target contract and find a way to drain the vault's 100 TRC. Use the provided attacker skeleton to build your exploit in Remix. Deploy your attacker contract, fund it using the interface below, execute the attack, and return here once the vault balance reaches zero.
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

                  <div className="flex flex-col gap-2 mt-auto">
                    <label className="text-[10px] tracking-widest opacity-70">ATTACKER CONTRACT</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={l1AttackerInput}
                        onChange={(e) => setL1AttackerInput(e.target.value)}
                        placeholder="Enter deployed attacker address"
                        className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all min-w-0"
                      />
                      <button
                        onClick={handleFundL1Attacker}
                        disabled={isL1Funding || !l1AttackerInput || !factoryTraceAddress}
                        className="px-4 py-3 border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors font-bold text-xs tracking-widest whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isL1Funding ? '[ FUNDING... ]' : '[ FUND ATTACKER WITH 10 TRC ]'}
                      </button>
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
                  <h2 className="text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">ORACLE MANIPULATION</h2>

                  <p className="text-xs mb-6 opacity-80 leading-relaxed">
                    Analyze the target contract and its connected components. Find a way to make your collateral sufficient to borrow the vault's TRC. Use the provided attacker skeleton to build your exploit in Remix, deploy it, fund it using the interface below, execute the attack, and return here once the vault balance reaches zero.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mb-6">
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">PLAYER TRC</span>
                      <span className="font-mono text-[11px] text-[#00ff00] font-bold mt-1">{l2PlayerTrace !== undefined ? formatEther(l2PlayerTrace) : '---'}</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">PLAYER MKT</span>
                      <span className="font-mono text-[11px] text-[#00ff00] font-bold mt-1">{l2PlayerMkt !== undefined ? formatEther(l2PlayerMkt) : '---'}</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">VAULT TRC</span>
                      <span className="font-mono text-[11px] text-red-500 font-bold mt-1">{l2VaultTrace !== undefined ? formatEther(l2VaultTrace) : '---'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex flex-col justify-center">
                      <span className="text-[10px] opacity-70 tracking-widest mb-2 border-b border-[#00ff00]/30 pb-1">AMM RESERVES</span>
                      <div className="flex justify-between items-center text-xs">
                        <span className="opacity-70">MKT:</span>
                        <span className="font-mono text-[#00ff00]">{l2AmmReserveMkt !== undefined ? formatEther(l2AmmReserveMkt) : '---'}</span>
                      </div>
                      <div className="flex justify-between items-center text-xs mt-1">
                        <span className="opacity-70">TRC:</span>
                        <span className="font-mono text-[#00ff00]">{l2AmmReserveTrace !== undefined ? formatEther(l2AmmReserveTrace) : '---'}</span>
                      </div>
                    </div>
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex flex-col justify-center">
                      <span className="text-[10px] opacity-70 tracking-widest mb-2 border-b border-[#00ff00]/30 pb-1">ORACLE PRICE</span>
                      <div className="flex items-center justify-center h-full">
                        <span className="font-mono text-xs text-[#00ff00]">{l2OraclePrice !== undefined ? formatEther(l2OraclePrice) : '---'} TRC / MKT</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">MKT TOKEN</span>
                      <span className="font-mono text-xs">{l2MktAddress}</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">TRACE TOKEN</span>
                      <span className="font-mono text-xs">{factoryTraceAddress}</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">AMM</span>
                      <span className="font-mono text-xs">{l2AmmAddress}</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">ORACLE</span>
                      <span className="font-mono text-xs">{l2OracleAddress}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">TARGET SOURCE</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(stripComments(LEVEL2_TARGET_SOURCE));
                          addLog('> SOURCE_COPIED_TO_CLIPBOARD');
                        }}
                        className="text-[10px] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-2 py-1 transition-colors"
                      >
                        [ COPY SOURCE ]
                      </button>
                    </div>
                    <div className="border border-[#00ff00]/30 bg-[#00ff00]/5 text-[10px] tracking-widest p-2 opacity-70">
                      Level2_OracleManipulation.sol
                    </div>
                    <textarea
                      readOnly
                      value={stripComments(LEVEL2_TARGET_SOURCE)}
                      className="bg-black/50 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-64 resize-y outline-none focus:border-[#00ff00] transition-colors mb-4"
                    />

                    <span className="text-[10px] opacity-70 tracking-widest mt-2 mb-2">CONNECTED COMPONENTS</span>

                    <details className="mb-2 border border-[#00ff00]/30 bg-[#00ff00]/5 group">
                      <summary className="p-3 text-[10px] tracking-widest opacity-70 cursor-pointer hover:bg-[#00ff00]/10 outline-none select-none list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex justify-between items-center">
                          <span>VulnerableOracle.sol</span>
                          <span className="group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="p-3 border-t border-[#00ff00]/30">
                        <textarea readOnly value={stripComments(VULNERABLE_ORACLE_SOURCE)} className="bg-black/50 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-40 w-full resize-y outline-none focus:border-[#00ff00] transition-colors" />
                      </div>
                    </details>

                    <details className="mb-2 border border-[#00ff00]/30 bg-[#00ff00]/5 group">
                      <summary className="p-3 text-[10px] tracking-widest opacity-70 cursor-pointer hover:bg-[#00ff00]/10 outline-none select-none list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex justify-between items-center">
                          <span>SimpleAMM.sol</span>
                          <span className="group-open:rotate-180 transition-transform">▼</span>
                        </div>
                      </summary>
                      <div className="p-3 border-t border-[#00ff00]/30">
                        <textarea readOnly value={stripComments(SIMPLE_AMM_SOURCE)} className="bg-black/50 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-64 w-full resize-y outline-none focus:border-[#00ff00] transition-colors" />
                      </div>
                    </details>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">ATTACKER SKELETON</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(LEVEL2_SKELETON);
                          addLog('> SKELETON_COPIED_TO_CLIPBOARD');
                        }}
                        className="text-[10px] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-2 py-1 transition-colors"
                      >
                        [ COPY ]
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={LEVEL2_SKELETON}
                      className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-40 sm:h-48 resize-y outline-none focus:border-[#00ff00] transition-colors"
                    />
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <label className="text-[10px] tracking-widest opacity-70">ATTACKER CONTRACT</label>
                    <div className="flex flex-col sm:flex-row gap-3">
                      <input
                        type="text"
                        value={l2AttackerInput}
                        onChange={(e) => setL2AttackerInput(e.target.value)}
                        placeholder="Enter deployed attacker address"
                        className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all min-w-0"
                      />
                      <button
                        onClick={handleFundL2Attacker}
                        disabled={isL2Funding || !l2AttackerInput || !factoryTraceAddress || !l2MktAddress}
                        className="px-4 py-3 border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors font-bold text-xs tracking-widest whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isL2Funding ? '[ FUNDING... ]' : '[ FUND ATTACKER WITH ASSETS ]'}
                      </button>
                    </div>
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
                    Analyze the target contract and identify a way to drain the vault. Request the provided authorization payload, then build an attacker contract in Remix to exploit the target. Return here once the vault balance reaches zero.
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-6">
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">PLAYER TRC BALANCE</span>
                      <span className="font-mono text-[11px] text-[#00ff00] font-bold mt-1">{l3PlayerTrace !== undefined ? formatEther(l3PlayerTrace) : '---'} TRC</span>
                    </div>
                    <div className="border border-[#00ff00]/30 p-2 bg-[#00ff00]/5 flex flex-col items-center justify-center text-center">
                      <span className="text-[9px] opacity-70 tracking-widest">VAULT TRC BALANCE</span>
                      <span className="font-mono text-[11px] text-red-500 font-bold mt-1">{l3VaultTrace !== undefined ? formatEther(l3VaultTrace) : '---'} TRC</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="border border-[#00ff00]/30 p-3 bg-[#00ff00]/5 flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">TRACE TOKEN</span>
                      <span className="font-mono text-xs">{l3TraceAddress as string}</span>
                    </div>
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">TARGET SOURCE</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(stripComments(LEVEL3_TARGET_SOURCE));
                          addLog('> SOURCE_COPIED_TO_CLIPBOARD');
                        }}
                        className="text-[10px] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-2 py-1 transition-colors"
                      >
                        [ COPY SOURCE ]
                      </button>
                    </div>
                    <div className="border border-[#00ff00]/30 bg-[#00ff00]/5 text-[10px] tracking-widest p-2 opacity-70">
                      Level3_SignatureReplay.sol
                    </div>
                    <textarea
                      readOnly
                      value={stripComments(LEVEL3_TARGET_SOURCE)}
                      className="bg-black/50 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-64 resize-y outline-none focus:border-[#00ff00] transition-colors mb-4"
                    />
                  </div>

                  <div className="flex flex-col gap-4 mb-6">
                    <button onClick={handleRequestSignature} className="border border-[#00ff00] hover:bg-[#00ff00]/20 p-3 text-xs tracking-widest">
                      [ REQUEST 10 TRC SIGNATURE FROM BACKEND ]
                    </button>

                    {l3Signature && (
                      <div className="flex flex-col gap-2 mt-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] opacity-70 tracking-widest">VALID SIGNATURE</span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(l3Signature);
                              addLog('> SIGNATURE_COPIED_TO_CLIPBOARD');
                            }}
                            className="text-[10px] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-2 py-1 transition-colors"
                          >
                            [ COPY ]
                          </button>
                        </div>
                        <textarea readOnly value={l3Signature} className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs break-all outline-none resize-y h-24 focus:border-[#00ff00] transition-colors" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 mb-6">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] opacity-70 tracking-widest">ATTACKER SKELETON</span>
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(LEVEL3_SKELETON);
                          addLog('> SKELETON_COPIED_TO_CLIPBOARD');
                        }}
                        className="text-[10px] border border-[#00ff00] hover:bg-[#00ff00] hover:text-black px-2 py-1 transition-colors"
                      >
                        [ COPY ]
                      </button>
                    </div>
                    <textarea
                      readOnly
                      value={LEVEL3_SKELETON}
                      className="bg-[#00ff00]/5 border border-[#00ff00]/30 p-3 font-mono text-[10px] sm:text-xs h-40 sm:h-48 resize-y outline-none focus:border-[#00ff00] transition-colors"
                    />
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
                  className={`px-8 py-4 border-2 font-bold tracking-widest transition-all w-full max-w-xs ${!isConnected ? 'border-red-500/50 text-red-500/50 cursor-not-allowed' :
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
                    onClick={() => isUnlocked && setSelectedLevel(level.id as 1 | 2 | 3)}
                    disabled={!isUnlocked}
                    className={`flex flex-col text-left p-3 border transition-all min-w-0 ${!isUnlocked ? 'border-red-500/30 opacity-40 cursor-not-allowed text-red-500' :
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
