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

  // Level 2 Local State
  const [attackerInput, setAttackerInput] = useState('');
  const [registeredAttacker, setRegisteredAttacker] = useState('');
  
  // Level 4 Local State
  const [l4Signature, setL4Signature] = useState('');
  const [isRequestingSignature, setIsRequestingSignature] = useState(false);

  // UI Flow States
  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logsEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [currentLogs, selectedLevel]);

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
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">CONTRACT INTERACTION</h2>
                  <div className="flex flex-col flex-grow justify-between">
                    <div className="flex flex-col gap-4 text-xs font-mono tracking-wide">
                      <div className="flex flex-col gap-1">
                        <span className="opacity-70 text-[10px] tracking-widest">TARGET FUNCTION</span>
                        <span className="text-[#00ff00] p-2 bg-[#00ff00]/10 border border-[#00ff00]/30 break-all">withdrawAll(address recipient)</span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-2 mt-6">
                      <button onClick={() => executeGenericTx(targetAddress, LEVEL1_ABI, 'withdrawAll', [address], '0', 'UNAUTHORIZED_WITHDRAW')} disabled={isExploiting || !address} className="w-full px-4 py-4 bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all font-bold text-sm lg:text-base animate-pulse disabled:opacity-50 disabled:animate-none tracking-widest break-words">
                        {isExploiting ? '[ EXECUTING... ]' : '[ EXECUTE UNAUTHORIZED WITHDRAWAL ]'}
                      </button>
                    </div>
                  </div>
                </div>
              ) : selectedLevel === 2 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">YOUR ATTACKER CONTRACT</h2>
                  {!registeredAttacker ? (
                    <div className="flex flex-col flex-grow justify-between">
                      <div className="flex flex-col gap-2 mt-auto">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input type="text" value={attackerInput} onChange={(e) => setAttackerInput(e.target.value)} placeholder="[ 0xAttacker... ]" className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all min-w-0" />
                          <button onClick={handleRegisterAttacker} className="px-4 py-3 border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors font-bold text-xs tracking-widest whitespace-nowrap">
                            [ REGISTER ]
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full gap-4 border border-[#00ff00] p-4 bg-[#00ff00]/10 mt-1">
                      <div className="flex-grow flex items-end">
                        <button onClick={() => executeGenericTx(registeredAttacker as `0x${string}`, ATTACKER_ABI, 'attack', [], '0.001', 'EXPLOIT')} disabled={isExploiting} className="w-full px-4 py-4 bg-transparent border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all font-bold text-base animate-pulse disabled:opacity-50 disabled:animate-none tracking-widest break-words">
                          {isExploiting ? '[ EXECUTING... ]' : '[ EXECUTE REENTRANCY ]'}
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

                  <div className="flex flex-col gap-3">
                    <button onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'claimAirdrop', [], '0', 'AIRDROP')} disabled={isExploiting || l3HasClaimed} className={`p-3 border text-xs tracking-widest ${!l3HasClaimed ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 1. CLAIM AIRDROP ]
                    </button>
                    <button onClick={() => l3AmmRaw && executeGenericTx(l3AmmRaw as `0x${string}`, LEVEL3_AMM_ABI, 'swapETHForTokens', [], '0.1', 'AMM_SWAP')} disabled={isExploiting || !l3AmmRaw || !l3HasClaimed || l3HasManipulated} className={`p-3 border text-xs tracking-widest ${l3HasClaimed && !l3HasManipulated ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 2. MANIPULATE AMM (Send 0.1 ETH) ]
                    </button>
                    <button onClick={() => l3TokenRaw && l3MktBalance !== undefined && executeGenericTx(l3TokenRaw as `0x${string}`, MOCK_TOKEN_ABI, 'approve', [targetAddress, l3MktBalance], '0', 'APPROVE')} disabled={isExploiting || !l3TokenRaw || !l3HasManipulated || l3HasApproved} className={`p-3 border text-xs tracking-widest ${l3HasManipulated && !l3HasApproved ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 3. APPROVE COLLATERAL ]
                    </button>
                    <button onClick={() => l3MktBalance !== undefined && executeGenericTx(targetAddress, LEVEL3_ABI, 'deposit', [l3MktBalance], '0', 'DEPOSIT')} disabled={isExploiting || !l3HasApproved || l3HasDeposited} className={`p-3 border text-xs tracking-widest ${l3HasApproved && !l3HasDeposited ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 4. DEPOSIT MANIPULATED COLLATERAL ]
                    </button>
                    <button onClick={() => executeGenericTx(targetAddress, LEVEL3_ABI, 'borrow', [parseEther('0.1')], '0', 'BORROW')} disabled={isExploiting || !l3HasDeposited} className={`p-3 border text-xs tracking-widest ${l3HasDeposited ? 'border-red-500 text-red-500 hover:bg-red-500/20 animate-pulse' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 5. BORROW EXCESSIVE ETH ]
                    </button>
                  </div>
                </div>
              ) : selectedLevel === 4 ? (
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">SIGNATURE REPLAY</h2>
                  
                  <div className="flex flex-col gap-4 text-[10px] sm:text-xs">
                    <p className="opacity-80 leading-relaxed">
                      This vault requires an off-chain ECDSA signature from the trusted signer to withdraw funds. We will request a valid signature from the backend, then replay it multiple times to drain the vault.
                    </p>
                    <button onClick={() => address && requestLevel4Signature(targetAddress, address, '0.01')} disabled={isRequestingSignature} className="p-3 border border-[#00ff00] hover:bg-[#00ff00]/20 text-xs tracking-widest disabled:opacity-50">
                      {isRequestingSignature ? '[ REQUESTING... ]' : '[ REQUEST SIGNATURE ]'}
                    </button>
                    <button 
                      onClick={() => l4Signature && executeGenericTx(targetAddress, LEVEL4_ABI, 'withdraw', [address, parseEther('0.01'), l4Signature as `0x${string}`], '0', 'WITHDRAW')} 
                      disabled={!l4Signature || isExploiting} 
                      className={`p-3 border text-xs tracking-widest ${l4Signature ? 'border-red-500 text-red-500 hover:bg-red-500/20 animate-pulse' : 'border-[#00ff00]/30 text-[#00ff00]/30 cursor-not-allowed'}`}
                    >
                      {l4Signature ? '[ EXECUTE WITHDRAWAL ]' : '[ EXECUTE WITHDRAWAL ] (Awaiting Signature)'}
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

                  <div className="flex flex-col gap-4">
                    <button onClick={async () => {
                      if (!address) return;
                      const data = encodeFunctionData({ abi: LEVEL5_ABI, functionName: "updateAddress", args: [address] });
                      await executeGenericTx(targetAddress, LEVEL5_ABI, 'execute', [data], '0', 'DELEGATECALL');
                    }} disabled={isExploiting || !address || l5OwnerRaw === address} className={`p-3 border text-xs tracking-widest ${l5OwnerRaw !== address ? 'border-[#00ff00] hover:bg-[#00ff00]/20' : 'border-[#00ff00]/30 text-[#00ff00]/30'}`}>
                      [ 1. SEND DELEGATECALL PAYLOAD ]
                    </button>
                    
                    <button onClick={() => executeGenericTx(targetAddress, LEVEL5_ABI, 'withdraw', [address], '0', 'WITHDRAW')} disabled={isExploiting || l5OwnerRaw !== address} className={`p-3 border text-xs tracking-widest ${l5OwnerRaw === address ? 'border-red-500 text-red-500 hover:bg-red-500/20 animate-pulse' : 'border-[#00ff00]/30 text-[#00ff00]/30 cursor-not-allowed'}`}>
                      [ 2. DRAIN VAULT AS OWNER ]
                    </button>
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
