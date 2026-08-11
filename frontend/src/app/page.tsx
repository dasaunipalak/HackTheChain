'use client';

import { useState, useRef, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther, isAddress } from 'viem';
import { CTF_FACTORY_ADDRESS, CTF_FACTORY_ABI, LEVEL1_ABI, LEVEL2_ABI, ATTACKER_ABI } from './config';

const LEVEL_DATA = [
  { id: 1, title: 'ACCESS CONTROL' },
  { id: 2, title: 'REENTRANCY' },
  { id: 3, title: 'LOCKED' },
  { id: 4, title: 'LOCKED' },
  { id: 5, title: 'LOCKED' }
];

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [selectedLevel, setSelectedLevel] = useState<1 | 2>(1);

  // Level 1 State
  const [attackerInput, setAttackerInput] = useState('');
  const [registeredAttacker, setRegisteredAttacker] = useState('');
  const [logsL1, setLogsL1] = useState<string[]>(['> SYSTEM_READY']);

  // Level 2 State
  const [logsL2, setLogsL2] = useState<string[]>(['> SYSTEM_READY']);

  const currentLogs = selectedLevel === 1 ? logsL1 : logsL2;
  const addLog = (msg: string) => {
    if (selectedLevel === 1) setLogsL1(prev => [...prev, msg]);
    else setLogsL2(prev => [...prev, msg]);
  };

  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentLogs, selectedLevel]);

  const isExploitSubmitted = currentLogs.some(l => l.includes('EXPLOIT_SUBMITTED') || l.includes('UNAUTHORIZED_WITHDRAW_SUBMITTED'));
  const isExploitConfirmed = currentLogs.some(l => l.includes('EXPLOIT_CONFIRMED') || l.includes('TRANSACTION_CONFIRMED'));
  
  // Use blockchain state for verification source of truth where possible, but keep local log state for immediate UX
  const isLevelCompleteLocally = currentLogs.some(l => l.includes('VERIFICATION_CONFIRMED ✓'));

  // Check if Level 1 is solved globally (used to unlock Level 2)
  const { data: isLevel1SolvedRaw, refetch: refetchIsLevel1Solved } = useReadContract({
    address: CTF_FACTORY_ADDRESS,
    abi: CTF_FACTORY_ABI,
    functionName: 'isSolved',
    args: address ? [BigInt(1), address] : undefined,
    query: { enabled: !!address }
  });
  const isLevel1Solved = !!isLevel1SolvedRaw;

  // Read target instance
  const { data: targetAddressRaw, refetch: refetchTarget } = useReadContract({
    address: CTF_FACTORY_ADDRESS,
    abi: CTF_FACTORY_ABI,
    functionName: 'levelInstances',
    args: address ? [BigInt(selectedLevel), address] : undefined,
    query: { enabled: !!address }
  });

  const targetAddress = (targetAddressRaw && targetAddressRaw !== '0x0000000000000000000000000000000000000000')
    ? (targetAddressRaw as `0x${string}`)
    : undefined;

  // Read Target Balance
  const { data: targetBalance, refetch: refetchBalance } = useBalance({
    address: targetAddress,
    query: { enabled: !!targetAddress }
  });

  // Read Target isComplete
  const { data: isComplete, refetch: refetchIsComplete } = useReadContract({
    address: targetAddress,
    abi: selectedLevel === 1 ? LEVEL1_ABI : LEVEL2_ABI,
    functionName: 'isComplete',
    query: { enabled: !!targetAddress }
  });

  // Read Target Owner (L1 only)
  const { data: ownerAddressRaw, refetch: refetchOwner } = useReadContract({
    address: targetAddress,
    abi: LEVEL1_ABI,
    functionName: 'owner',
    query: { enabled: !!targetAddress && selectedLevel === 1 }
  });
  const ownerAddress = ownerAddressRaw as string | undefined;

  // Write Contract Setup
  const { writeContractAsync } = useWriteContract();

  const handleInitLevel = async () => {
    setIsInitializing(true);
    try {
      addLog('> PREPARING_TRANSACTION');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS,
        abi: CTF_FACTORY_ABI,
        functionName: selectedLevel === 1 ? 'deployLevel1' : 'deployLevel2',
        value: selectedLevel === 1 ? parseEther('0.02') : parseEther('0.01'),
      });
      addLog(`> TX_HASH: ${hash}`);
      
      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog(`> LEVEL_0${selectedLevel}_INITIALIZED`);
        addLog('> TARGET_ACQUIRED ✓');
        refetchTarget();
      } else {
        addLog('> ERROR: TARGET DEPLOYMENT FAILED');
      }
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsInitializing(false);
    }
  };

  const handleRegisterAttacker = async () => {
    if (!isAddress(attackerInput)) {
      addLog('> ERROR: INVALID ATTACKER ADDRESS');
      return;
    }
    const code = await publicClient?.getBytecode({ address: attackerInput as `0x${string}` });
    if (!code || code === '0x') {
      addLog('> ERROR: NO CONTRACT FOUND AT ADDRESS');
      return;
    }
    setRegisteredAttacker(attackerInput);
    addLog(`> ATTACKER_REGISTERED ✓`);
  };

  const handleExecuteExploit = async () => {
    if (selectedLevel === 2 && (!registeredAttacker || !targetAddress)) return;
    if (selectedLevel === 1 && !targetAddress) return;
    
    setIsExploiting(true);
    try {
      if (selectedLevel === 2) {
        addLog('> EXPLOIT_SUBMITTED');
        const hash = await writeContractAsync({
          address: registeredAttacker as `0x${string}`,
          abi: ATTACKER_ABI,
          functionName: 'attack',
          value: parseEther('0.001'),
        });
        addLog(`> TX_HASH: ${hash}`);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });
        if (receipt?.status === 'success') {
          addLog('> EXPLOIT_CONFIRMED ✓');
          refetchBalance();
          const comp = await refetchIsComplete();
          if (comp.data) {
            addLog('> TARGET_BALANCE_ZERO ✓');
          }
        } else {
          addLog('> ERROR: EXPLOIT TRANSACTION REVERTED');
        }
      } else if (selectedLevel === 1) {
        if (!address) return;
        addLog('> UNAUTHORIZED_WITHDRAW_SUBMITTED');
        const hash = await writeContractAsync({
          address: targetAddress as `0x${string}`,
          abi: LEVEL1_ABI,
          functionName: 'withdrawAll',
          args: [address],
        });
        addLog(`> TX_HASH: ${hash}`);

        const receipt = await publicClient?.waitForTransactionReceipt({ hash });
        if (receipt?.status === 'success') {
          addLog('> TRANSACTION_CONFIRMED ✓');
          refetchBalance();
          const comp = await refetchIsComplete();
          if (comp.data) {
            addLog('> TARGET_BALANCE_ZERO ✓');
          }
        } else {
          addLog('> ERROR: TRANSACTION REVERTED');
        }
      }
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsExploiting(false);
    }
  };

  const handleVerifyHack = async () => {
    if (!targetAddress) return;
    setIsVerifying(true);
    try {
      const result = await refetchIsComplete();
      if (!result.data) {
        addLog('> ERROR: TARGET NOT DRAINED');
        return;
      }

      addLog('> VALIDATION_SUBMITTED');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS,
        abi: CTF_FACTORY_ABI,
        functionName: selectedLevel === 1 ? 'validateLevel1' : 'validateLevel2',
      });
      addLog(`> TX_HASH: ${hash}`);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog('> VALIDATION_CONFIRMED ✓');
        addLog('> ACCESS GRANTED');
        addLog(`> LEVEL 0${selectedLevel} COMPLETE`);
        addLog(`> BADGE_0${selectedLevel}_MINTED`);
        
        if (selectedLevel === 1) {
          await refetchIsLevel1Solved();
          setSelectedLevel(2);
        }
      } else {
        addLog('> ERROR: VALIDATION TRANSACTION FAILED');
      }
    } catch (e: any) {
      addLog(`> ERROR: ${e.shortMessage || e.message}`);
    } finally {
      setIsVerifying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    addLog('> COPIED_TO_CLIPBOARD');
  };

  const formatLog = (log: string, index: number) => {
    if (log.startsWith('> ERROR')) {
      return <div key={index} className="text-red-500">{log}</div>;
    }
    if (log.startsWith('> TX_HASH:')) {
      const hash = log.split('TX_HASH: ')[1];
      return <div key={index}>&gt; TX: <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer" className="underline hover:text-white break-all">{hash}</a></div>;
    }
    if (log.includes('✓') || log.includes('ACCESS GRANTED')) {
      return <div key={index} className="text-[#00ff00] font-bold shadow-[0_0_5px_rgba(0,255,0,0.3)]">{log}</div>;
    }
    return <div key={index}>{log}</div>;
  };

  // Determine actual completion status globally for the *selected* level
  const isSelectedLevelFullyComplete = (selectedLevel === 1 && isLevel1Solved) || (selectedLevel === 2 && isLevelCompleteLocally);

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
          
          {/* COMMAND CENTER */}
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

          {/* SYSTEM STATUS */}
          <div className="flex-none border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
            <h2 className="text-xs font-bold mb-3 border-b border-[#00ff00]/30 pb-2 tracking-widest">SYSTEM STATUS</h2>
            <div className="flex flex-col gap-2.5 text-[10px] sm:text-xs">
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">WALLET</span>
                <span>{isConnected ? '● CONNECTED' : '○ DISCONNECTED'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">NETWORK</span>
                <span className={chainId !== 11155111 ? 'text-red-500' : ''}>{chainId === 11155111 ? '● SEPOLIA' : '○ WRONG NETWORK'}</span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">TARGET</span>
                <span>{targetAddress ? '● ACQUIRED' : '○ PENDING'}</span>
              </div>
              {selectedLevel === 2 && ownerAddress && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">OWNER</span>
                  <span>{ownerAddress ? '● DETECTED' : '○ PENDING'}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="opacity-70 tracking-widest">VAULT</span>
                <span>{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '---'}</span>
              </div>
              {selectedLevel === 2 && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">ATTACKER</span>
                  <span>{registeredAttacker ? '● REGISTERED' : '○ PENDING'}</span>
                </div>
              )}
              {selectedLevel === 2 && (
                <div className="flex justify-between">
                  <span className="opacity-70 tracking-widest">EXPLOIT</span>
                  <span>{isExploitConfirmed ? '● EXECUTED' : '○ PENDING'}</span>
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

          {/* TRANSACTION LOG */}
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
                  <span className="opacity-70 text-[10px] tracking-widest">TARGET</span>
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="font-mono text-xs sm:text-sm break-all">{targetAddress}</span>
                    <button onClick={() => copyToClipboard(targetAddress)} className="text-[9px] border border-[#00ff00] px-1.5 py-0.5 hover:bg-[#00ff00] hover:text-black">COPY</button>
                  </div>
                </div>

                <div className="flex flex-col gap-1 md:items-end border-t md:border-t-0 md:border-l border-[#00ff00]/30 pt-3 md:pt-0 md:pl-5">
                  <span className="opacity-70 text-[10px] tracking-widest">VAULT BALANCE</span>
                  <span className="font-bold text-lg sm:text-xl tracking-widest">{targetBalance ? `${formatEther(targetBalance.value)} ETH` : (selectedLevel === 1 ? '0.010 ETH' : '0.020 ETH')}</span>
                  <span className={`text-[10px] font-bold tracking-widest ${isComplete ? 'text-[#00ff00]' : 'opacity-70'}`}>STATUS: {isComplete ? 'DRAINED' : 'ACTIVE'}</span>
                </div>
              </div>

              <div className="flex-none border border-[#00ff00] bg-[#00ff00]/5 px-4 py-3 shadow-[0_0_10px_rgba(0,255,0,0.05)]">
                 <span className="opacity-70 text-[10px] font-bold tracking-widest block mb-1">OBJECTIVE</span>
                 <span className="text-xs tracking-wide">
                   {selectedLevel === 2 ? 'Drain the target contract by exploiting its reentrancy vulnerability.' : 'Find and exploit an incorrectly protected administrative function.'}
                 </span>
              </div>

              {/* VULNERABLE CONTRACT */}
              <div className="flex-none flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)]">
                <div className="flex justify-between items-end border-b border-[#00ff00]/30 pb-2 mb-3">
                  <h2 className="text-xs font-bold tracking-widest">VULNERABLE CONTRACT</h2>
                  {selectedLevel === 1 && (
                    <span className="text-[10px] text-red-500 tracking-widest font-bold animate-pulse">⚠ ACCESS CONTROL MISSING</span>
                  )}
                </div>
                <pre className="text-[10px] sm:text-xs overflow-y-auto whitespace-pre-wrap break-words p-3 lg:p-4 bg-[#00ff00]/5 border border-[#00ff00]/20 leading-relaxed max-h-40 sm:max-h-48 max-w-full">
                  {selectedLevel === 2 ? (
                    <code>{`function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");

    // ⚠ REENTRANCY WINDOW
    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");

    balances[msg.sender] = 0; 
}`}</code>
                  ) : (
                    <code>{`contract Level2_AccessControl {
    address public owner;

    constructor() payable {
        owner = msg.sender;
    }

    function withdrawAll(address payable recipient) external {
        // ⚠ PRIVILEGED FUNCTION
        // Notice: There is no require(msg.sender == owner) here!
        recipient.transfer(address(this).balance);
    }
}`}</code>
                  )}
                </pre>
              </div>

              {/* ACTION AREA / SUCCESS */}
              {isSelectedLevelFullyComplete ? (
                <div className="flex-grow flex flex-col items-center justify-center border-2 border-[#00ff00] bg-[#00ff00]/10 p-6 shadow-[0_0_30px_rgba(0,255,0,0.2)] min-h-0 text-center animate-fade-in">
                  <h2 className="text-2xl lg:text-4xl font-bold mb-4 tracking-widest animate-pulse">&gt; ACCESS GRANTED</h2>
                  <p className="text-lg lg:text-xl mb-2 tracking-widest">LEVEL 0{selectedLevel} COMPLETE</p>
                  <p className="text-xs opacity-80 mb-6 tracking-widest">ON-CHAIN VERIFICATION PASSED</p>
                  <p className="font-bold text-lg lg:text-xl border-t border-[#00ff00]/50 pt-4 tracking-widest">SOULBOUND BADGE #{selectedLevel} MINTED</p>
                </div>
              ) : selectedLevel === 2 ? (
                /* LEVEL 2 ACTION: ATTACKER CONTRACT */
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">YOUR ATTACKER CONTRACT</h2>
                  
                  <div className="flex flex-wrap gap-2 lg:gap-4 mb-4 text-[10px] lg:text-xs font-bold tracking-widest">
                    <span className="text-[#00ff00]">01 WRITE IN REMIX</span>
                    <span className="opacity-30">|</span>
                    <span className="text-[#00ff00]">02 DEPLOY TO SEPOLIA</span>
                    <span className="opacity-30">|</span>
                    <span className="text-[#00ff00]">03 REGISTER HERE</span>
                  </div>

                  {!registeredAttacker ? (
                    <div className="flex flex-col flex-grow justify-between">
                      <div className="mb-4">
                        <div className="flex items-center gap-3 mb-2">
                          <button onClick={() => copyToClipboard(`interface ILevel2 {
    function donate(address _to) external payable;
    function withdraw() external;
}
contract Attacker {
    constructor(address _target) { }
    function attack() external payable { }
    receive() external payable { }
}`)} className="text-[9px] border border-[#00ff00] px-2 py-1 hover:bg-[#00ff00] hover:text-black tracking-widest">[ COPY SKELETON ]</button>
                          <span className="text-[10px] opacity-70">Provides target address to constructor.</span>
                        </div>
                      </div>
                      
                      <div className="flex flex-col gap-2 mt-auto">
                        <div className="flex flex-col sm:flex-row gap-3">
                          <input
                            type="text"
                            value={attackerInput}
                            onChange={(e) => setAttackerInput(e.target.value)}
                            placeholder="[ 0xAttackerAddress........................ ]"
                            className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] font-mono text-xs transition-all placeholder-[#00ff00]/30"
                          />
                          <button
                            onClick={handleRegisterAttacker}
                            className="px-6 py-3 bg-transparent border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors whitespace-nowrap font-bold text-xs tracking-widest"
                          >
                            [ REGISTER ATTACKER ]
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col h-full gap-4 border border-[#00ff00] p-4 lg:p-5 bg-[#00ff00]/10 mt-1">
                      <h3 className="flex-none font-bold tracking-widest text-sm mb-1 text-[#00ff00]">ATTACKER REGISTERED ✓</h3>
                      <div className="flex flex-col gap-2 text-[11px] mb-2">
                        <div>
                          <span className="opacity-70 tracking-widest inline-block w-20">TARGET:</span>
                          <span className="font-mono text-[#00ff00] break-all">{targetAddress}</span>
                        </div>
                        <div>
                          <span className="opacity-70 tracking-widest inline-block w-20">ATTACKER:</span>
                          <span className="font-mono text-[#00ff00] break-all">{registeredAttacker}</span>
                        </div>
                      </div>
                      <div className="flex-grow flex items-end">
                        <button
                          onClick={handleExecuteExploit}
                          disabled={isExploiting || isComplete}
                          className="w-full px-4 py-4 lg:py-5 bg-transparent border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all font-bold text-base lg:text-lg animate-pulse disabled:opacity-50 disabled:animate-none tracking-widest"
                        >
                          {isExploiting ? '[ EXECUTING... ]' : '[ EXECUTE EXPLOIT ]'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* LEVEL 2 ACTION: DIRECT EXECUTION */
                <div className="flex-grow flex flex-col min-h-0 border border-[#00ff00] bg-black p-4 lg:p-5 shadow-[0_0_15px_rgba(0,255,0,0.1)] overflow-y-auto">
                  <h2 className="flex-none text-xs font-bold border-b border-[#00ff00]/30 pb-2 mb-4 tracking-widest">CONTRACT INTERACTION</h2>
                  
                  <div className="flex flex-col flex-grow justify-between">
                    <div className="flex flex-col gap-4 text-xs font-mono tracking-wide">
                      <div className="flex flex-col gap-1">
                        <span className="opacity-70 text-[10px] tracking-widest">TARGET FUNCTION</span>
                        <span className="text-[#00ff00] p-2 bg-[#00ff00]/10 border border-[#00ff00]/30">withdrawAll(address recipient)</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="opacity-70 text-[10px] tracking-widest">RECIPIENT (YOUR WALLET)</span>
                        <span className="p-2 bg-[#00ff00]/10 border border-[#00ff00]/30 break-all">{address || 'NOT CONNECTED'}</span>
                      </div>
                      <div className="flex flex-col gap-1">
                        <span className="opacity-70 text-[10px] tracking-widest">ON-CHAIN OWNER (NOT YOU)</span>
                        <span className="p-2 bg-red-500/10 border border-red-500/30 text-red-500 break-all">{ownerAddress || 'FETCHING...'}</span>
                      </div>
                    </div>
                    
                    <div className="flex flex-col gap-2 mt-6">
                      <button
                        onClick={handleExecuteExploit}
                        disabled={isExploiting || isComplete || !address}
                        className="w-full px-4 py-4 bg-transparent border-2 border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-all font-bold text-sm lg:text-base animate-pulse disabled:opacity-50 disabled:animate-none tracking-widest"
                      >
                        {isExploiting ? '[ EXECUTING... ]' : '[ EXECUTE UNAUTHORIZED WITHDRAWAL ]'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex-grow border border-[#00ff00] bg-black p-8 shadow-[0_0_15px_rgba(0,255,0,0.1)] flex flex-col items-center justify-center text-center">
              <h2 className="text-3xl mb-6 font-bold tracking-widest animate-pulse">_SYSTEM_READY</h2>
              <p className="opacity-80 max-w-lg leading-relaxed tracking-wide text-sm">
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
                const isUnlocked = level.id === 1 || (level.id === 2 && isLevel1Solved);
                const isCurrent = level.id === selectedLevel;
                // isCompleted visually relies on global chain state
                const isCompleted = (level.id === 1 && isLevel1Solved) || (level.id === 2 && isLevelCompleteLocally);
                
                return (
                  <button 
                    key={level.id}
                    onClick={() => isUnlocked && setSelectedLevel(level.id as 1 | 2)}
                    disabled={!isUnlocked}
                    className={`flex flex-col text-left p-3 border transition-all ${
                      !isUnlocked ? 'border-red-500/30 opacity-40 cursor-not-allowed text-red-500' :
                      isCurrent ? 'border-[#00ff00] bg-[#00ff00]/10 text-[#00ff00]' :
                      'border-[#00ff00]/30 hover:bg-[#00ff00]/10 text-[#00ff00]'
                    }`}
                  >
                    <div className="font-bold tracking-widest text-xs flex gap-2 items-center">
                      <span className="w-4 inline-block text-center">{isCompleted ? '✓' : isCurrent ? '→' : !isUnlocked ? '🔒' : ' '}</span>
                      <span>LEVEL 0{level.id}</span>
                    </div>
                    <div className="text-[9px] sm:text-[10px] opacity-70 tracking-widest mt-1 ml-6">{level.title}</div>
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
