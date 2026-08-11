'use client';

import { useState, useRef, useEffect } from 'react';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount, useReadContract, useWriteContract, useBalance, usePublicClient } from 'wagmi';
import { parseEther, formatEther, isAddress } from 'viem';
import { CTF_FACTORY_ADDRESS, CTF_FACTORY_ABI, LEVEL1_ABI, ATTACKER_ABI } from './config';

export default function Home() {
  const { address, isConnected, chainId } = useAccount();
  const publicClient = usePublicClient();

  const [attackerInput, setAttackerInput] = useState('');
  const [registeredAttacker, setRegisteredAttacker] = useState('');
  const [logs, setLogs] = useState<string[]>(['> SYSTEM_READY']);

  const [isInitializing, setIsInitializing] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isExploiting, setIsExploiting] = useState(false);

  const logsEndRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const isExploitSubmitted = logs.some(l => l.includes('EXPLOIT_TRANSACTION_SUBMITTED'));
  const isExploitConfirmed = logs.some(l => l.includes('EXPLOIT_TRANSACTION_CONFIRMED'));
  const isLevelComplete = logs.some(l => l.includes('ACHIEVEMENT UNLOCKED'));

  const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

  // Read target instance
  const { data: targetAddressRaw, refetch: refetchTarget } = useReadContract({
    address: CTF_FACTORY_ADDRESS,
    abi: CTF_FACTORY_ABI,
    functionName: 'levelInstances',
    args: address ? [BigInt(1), address] : undefined,
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
    abi: LEVEL1_ABI,
    functionName: 'isComplete',
    query: { enabled: !!targetAddress }
  });

  // Write Contract Setup
  const { writeContractAsync } = useWriteContract();

  const handleInitLevel = async () => {
    setIsInitializing(true);
    try {
      addLog('> PREPARING TRANSACTION');
      addLog('> WAITING FOR WALLET');
      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS,
        abi: CTF_FACTORY_ABI,
        functionName: 'deployLevel1',
        value: parseEther('0.01'),
      });
      addLog(`> TRANSACTION PENDING`);
      addLog(`> TX_HASH: ${hash}`);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog('> TRANSACTION CONFIRMED');
        addLog('> TARGET_INSTANCE_ACQUIRED');
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
    addLog(`> ATTACKER_REGISTERED: ${attackerInput}`);
  };

  const handleExecuteExploit = async () => {
    if (!registeredAttacker || !targetAddress) return;
    setIsExploiting(true);
    try {
      addLog('> PREPARING TRANSACTION');
      addLog('> WAITING FOR WALLET');
      const hash = await writeContractAsync({
        address: registeredAttacker as `0x${string}`,
        abi: ATTACKER_ABI,
        functionName: 'attack',
        value: parseEther('0.001'),
      });
      addLog(`> EXPLOIT_TRANSACTION_SUBMITTED`);
      addLog(`> TRANSACTION PENDING`);
      addLog(`> TX_HASH: ${hash}`);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });
      if (receipt?.status === 'success') {
        addLog('> EXPLOIT_TRANSACTION_CONFIRMED');
        addLog('> TRANSACTION CONFIRMED');
        refetchBalance();
        refetchIsComplete();
      } else {
        addLog('> ERROR: EXPLOIT TRANSACTION REVERTED');
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
      addLog('> CHECKING TARGET STATE');

      const result = await refetchIsComplete();

      if (!result.data) {
        addLog('> ERROR: TARGET NOT DRAINED');
        addLog('> ERROR: LEVEL VERIFICATION FAILED');
        return;
      }

      addLog('> TARGET BALANCE REACHED ZERO');
      addLog('> ON-CHAIN CONDITION SATISFIED');

      addLog('> PREPARING VALIDATION TRANSACTION');
      addLog('> WAITING FOR WALLET');

      const hash = await writeContractAsync({
        address: CTF_FACTORY_ADDRESS,
        abi: CTF_FACTORY_ABI,
        functionName: 'validateLevel1',
      });

      addLog('> VALIDATION_TRANSACTION_SUBMITTED');
      addLog('> TRANSACTION PENDING');
      addLog(`> TX_HASH: ${hash}`);

      const receipt = await publicClient?.waitForTransactionReceipt({ hash });

      if (receipt?.status === 'success') {
        addLog('> TRANSACTION CONFIRMED');
        addLog('> ACCESS GRANTED');
        addLog('> LEVEL 01 COMPLETE');
        addLog('> ON-CHAIN VERIFICATION PASSED');
        addLog('> ACHIEVEMENT UNLOCKED');
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
      return <div key={index} className="text-red-500 py-0.5">{log}</div>;
    }
    if (log.startsWith('> TX_HASH:')) {
      const hash = log.split('TX_HASH: ')[1];
      return <div key={index} className="py-0.5">&gt; TX: <a href={`https://sepolia.etherscan.io/tx/${hash}`} target="_blank" rel="noreferrer" className="underline hover:text-white break-all">{hash}</a></div>;
    }
    if (log.includes('ACHIEVEMENT UNLOCKED') || log.includes('ACCESS GRANTED') || log.includes('LEVEL 01 COMPLETE')) {
      return <div key={index} className="text-[#00ff00] font-bold py-0.5 shadow-[0_0_10px_rgba(0,255,0,0.3)]">{log}</div>;
    }
    return <div key={index} className="py-0.5">{log}</div>;
  };

  return (
    <main className="min-h-screen bg-black text-[#00ff00] font-mono flex flex-col items-center p-8">
      {/* Header Section */}
      <div className="w-full max-w-6xl p-6 flex justify-between items-center border-b border-[#00ff00]/30 mb-8">
        <h1 className="text-2xl font-bold tracking-widest text-[#00ff00]">HACK_THE_CHAIN</h1>
        <div className="flex items-center gap-4">
          <ConnectButton />
        </div>
      </div>

      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-3 gap-8">

        {/* LEFT COLUMN: Controls & Status */}
        <div className="lg:col-span-1 flex flex-col gap-8">

          <div className="border border-[#00ff00] bg-black p-6 shadow-[0_0_15px_rgba(0,255,0,0.15)]">
            <h2 className="text-lg font-bold mb-4 border-b border-[#00ff00]/30 pb-2">COMMAND CENTER</h2>
            <div className="flex flex-col gap-4">
              <button
                onClick={handleInitLevel}
                disabled={!isConnected || !!targetAddress || isInitializing}
                className="px-4 py-3 border border-[#00ff00] text-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm tracking-widest"
              >
                {isInitializing ? '[ INITIALIZING... ]' : '[ INIT LEVEL 1 ]'}
              </button>
              <button
                onClick={handleVerifyHack}
                disabled={!targetAddress || isVerifying || isLevelComplete}
                className="px-4 py-3 border border-red-500 text-red-500 hover:bg-red-500 hover:text-black transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm tracking-widest"
              >
                {isVerifying ? '[ VERIFYING... ]' : '[ VERIFY HACK ]'}
              </button>
            </div>
          </div>

          <div className="border border-[#00ff00] bg-black p-6 shadow-[0_0_15px_rgba(0,255,0,0.15)]">
            <h2 className="text-lg font-bold mb-4 border-b border-[#00ff00]/30 pb-2">SYSTEM STATUS</h2>
            <div className="flex flex-col gap-3 text-xs">
              <div className="grid grid-cols-2">
                <span className="opacity-70">WALLET</span>
                <span className="text-right">{isConnected ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="opacity-70">NETWORK</span>
                <span className={`text-right ${chainId !== 11155111 ? 'text-red-500' : ''}`}>
                  {chainId === 11155111 ? 'SEPOLIA' : (chainId ? 'WRONG NETWORK' : '---')}
                </span>
              </div>
              <div className="grid grid-cols-2">
                <span className="opacity-70">TARGET</span>
                <span className="text-right">{targetAddress ? 'ACQUIRED' : 'PENDING'}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="opacity-70">BALANCE</span>
                <span className="text-right">{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '---'}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="opacity-70">ATTACKER</span>
                <span className="text-right">{registeredAttacker ? 'REGISTERED' : 'NOT REGISTERED'}</span>
              </div>
              <div className="grid grid-cols-2">
                <span className="opacity-70">EXPLOIT</span>
                <span className="text-right">{isExploitConfirmed ? 'CONFIRMED' : (isExploitSubmitted ? 'PENDING' : 'NOT EXECUTED')}</span>
              </div>
              <div className="grid grid-cols-2 border-t border-[#00ff00]/30 pt-3 mt-1">
                <span className="opacity-70 font-bold">LEVEL</span>
                <span className={`text-right font-bold ${isLevelComplete ? 'text-[#00ff00]' : ''}`}>
                  {isLevelComplete ? 'COMPLETE' : 'INCOMPLETE'}
                </span>
              </div>
            </div>
          </div>

          <div className="border border-[#00ff00] bg-black p-6 shadow-[0_0_15px_rgba(0,255,0,0.15)] h-64 flex flex-col">
            <h2 className="text-lg font-bold mb-4 border-b border-[#00ff00]/30 pb-2">TRANSACTION LOG</h2>
            <div className="flex flex-col gap-1 text-[11px] overflow-y-auto flex-grow pr-2">
              {logs.map((log, i) => formatLog(log, i))}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: Challenge Workspace */}
        <div className="lg:col-span-2 flex flex-col gap-8">

          {targetAddress ? (
            <>
              <div className="border border-[#00ff00] bg-black p-8 relative shadow-[0_0_15px_rgba(0,255,0,0.15)]">
                <h2 className="text-sm font-bold opacity-70 tracking-widest mb-1">LEVEL 01</h2>
                <h3 className="text-3xl font-bold tracking-widest mb-8">REENTRANCY</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                  <div>
                    <p className="opacity-70 text-xs mb-2 tracking-widest">TARGET CONTRACT</p>
                    <div className="flex items-center gap-3">
                      <span className="break-all font-mono text-sm">{targetAddress}</span>
                      <button onClick={() => copyToClipboard(targetAddress)} className="text-[10px] border border-[#00ff00] px-2 py-1 hover:bg-[#00ff00] hover:text-black tracking-widest">[COPY]</button>
                    </div>
                  </div>
                  <div>
                    <p className="opacity-70 text-xs mb-2 tracking-widest">VAULT BALANCE</p>
                    <p className="font-bold text-2xl tracking-widest">{targetBalance ? `${formatEther(targetBalance.value)} ETH` : '0.000 ETH'}</p>
                    <p className={`text-xs mt-2 font-bold tracking-widest ${isComplete ? 'text-[#00ff00]' : 'opacity-70'}`}>
                      STATUS: {isComplete ? 'DRAINED' : 'ACTIVE'}
                    </p>
                  </div>
                </div>

                <div className="border-t border-[#00ff00]/30 pt-6">
                  <p className="opacity-70 text-xs mb-2 tracking-widest">OBJECTIVE</p>
                  <p className="text-sm tracking-wide">Drain the target contract by exploiting a flaw in its withdrawal mechanism.</p>
                </div>
              </div>

              <div className="border border-[#00ff00] bg-black p-8 shadow-[0_0_15px_rgba(0,255,0,0.15)]">
                <div className="flex justify-between items-end border-b border-[#00ff00]/30 pb-4 mb-6">
                  <h2 className="text-xl font-bold tracking-widest">VULNERABLE CONTRACT</h2>
                  <span className="text-xs opacity-70 tracking-widest">SOURCE: Level1_Reentrancy.sol</span>
                </div>
                <p className="text-sm mb-6 opacity-80 leading-relaxed tracking-wide">
                  Inspect the withdrawal logic carefully. Find where execution can return to the contract before its state is updated.
                </p>
                <pre className="text-sm overflow-x-auto p-6 bg-[#00ff00]/5 border border-[#00ff00]/20 leading-loose">
                  <code>{`function withdraw() external {
    uint256 amount = balances[msg.sender];
    require(amount > 0, "No balance");

    (bool success, ) = msg.sender.call{value: amount}("");
    require(success, "Transfer failed");

    balances[msg.sender] = 0; 
}`}</code>
                </pre>
              </div>

              <div className="border border-[#00ff00] bg-black p-8 shadow-[0_0_15px_rgba(0,255,0,0.15)]">
                <h2 className="text-xl font-bold border-b border-[#00ff00]/30 pb-4 mb-4 tracking-widest">YOUR ATTACKER CONTRACT</h2>
                <p className="text-sm mb-6 opacity-80 tracking-wide">
                  Develop and deploy your exploit in <a href="https://remix.ethereum.org" target="_blank" rel="noreferrer" className="underline hover:text-[#00ff00] font-bold">Remix</a> on Sepolia.
                </p>

                <div className="flex flex-wrap gap-4 mb-8 text-xs font-bold tracking-widest">
                  <span className="text-[#00ff00]">01 WRITE IN REMIX</span>
                  <span className="opacity-30">|</span>
                  <span className="text-[#00ff00]">02 DEPLOY TO SEPOLIA</span>
                  <span className="opacity-30">|</span>
                  <span className="text-[#00ff00]">03 REGISTER HERE</span>
                </div>

                <div className="mb-8">
                  <p className="text-xs text-[#00ff00] mb-2 opacity-80">Note: Provide the TARGET CONTRACT address as the constructor argument in Remix.</p>
                  <button onClick={() => copyToClipboard(`interface ILevel1 {
    function donate(address _to) external payable;
    function withdraw() external;
}

contract Attacker {
    constructor(address _target) {
        // Store target address
    }
    function attack() external payable {
        // Your implementation
    }
    receive() external payable {
        // Your reentrancy logic
    }
}`)} className="text-[10px] border border-[#00ff00] px-3 py-1.5 hover:bg-[#00ff00] hover:text-black mb-3 tracking-widest">[ COPY SKELETON ]</button>
                  <pre className="text-sm overflow-x-auto p-6 bg-[#00ff00]/5 border border-[#00ff00]/20 opacity-80 leading-loose">
                    <code>{`interface ILevel1 {
    function donate(address _to) external payable;
    function withdraw() external;
}

contract Attacker {
    constructor(address _target) { ... }
    function attack() external payable { ... }
    receive() external payable { ... }
}`}</code>
                  </pre>
                </div>

                {!registeredAttacker ? (
                  <div className="flex flex-col gap-3 mt-4">
                    <p className="text-xs opacity-70 tracking-widest">ATTACKER CONTRACT ADDRESS</p>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <input
                        type="text"
                        value={attackerInput}
                        onChange={(e) => setAttackerInput(e.target.value)}
                        placeholder="0x..."
                        className="bg-[#00ff00]/5 border border-[#00ff00]/50 p-3 flex-grow outline-none focus:border-[#00ff00] focus:shadow-[0_0_10px_rgba(0,255,0,0.3)] font-mono text-sm transition-all"
                      />
                      <button
                        onClick={handleRegisterAttacker}
                        className="px-8 py-3 bg-transparent border border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-colors whitespace-nowrap font-bold tracking-widest"
                      >
                        [ REGISTER ]
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-6 border border-[#00ff00] p-6 bg-[#00ff00]/10 shadow-[0_0_15px_rgba(0,255,0,0.15)] mt-4">
                    <div className="flex justify-between items-center mb-2 border-b border-[#00ff00]/30 pb-4">
                      <h3 className="font-bold tracking-widest">ATTACKER REGISTERED</h3>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs mb-2">
                      <div>
                        <span className="opacity-70 tracking-widest block mb-2">TARGET</span>
                        <span className="font-mono text-[#00ff00] text-sm break-all">{targetAddress}</span>
                      </div>
                      <div>
                        <span className="opacity-70 tracking-widest block mb-2">ATTACKER</span>
                        <span className="font-mono text-[#00ff00] text-sm break-all">{registeredAttacker}</span>
                      </div>
                    </div>
                    <button
                      onClick={handleExecuteExploit}
                      disabled={isExploiting || isComplete}
                      className="w-full px-6 py-5 bg-transparent border-2 border-[#00ff00] hover:bg-[#00ff00] hover:text-black transition-all font-bold text-xl animate-pulse disabled:opacity-50 disabled:animate-none tracking-widest mt-2"
                    >
                      {isExploiting ? '[ EXECUTING... ]' : '[ EXECUTE EXPLOIT ]'}
                    </button>
                  </div>
                )}
              </div>

              {isLevelComplete && (
                <div className="border-2 border-[#00ff00] bg-[#00ff00]/20 p-10 text-center shadow-[0_0_40px_rgba(0,255,0,0.4)] mb-8">
                  <h2 className="text-4xl font-bold mb-6 tracking-widest animate-pulse">&gt; ACCESS GRANTED</h2>
                  <p className="text-2xl mb-3 tracking-widest">LEVEL 01 COMPLETE</p>
                  <p className="opacity-80 mb-6 tracking-widest text-sm">ON-CHAIN VERIFICATION PASSED</p>
                  <p className="font-bold text-xl mt-6 border-t border-[#00ff00]/50 pt-6 tracking-widest">ACHIEVEMENT UNLOCKED</p>
                </div>
              )}
            </>
          ) : (
            <div className="border border-[#00ff00] bg-black p-12 shadow-[0_0_15px_rgba(0,255,0,0.15)] flex flex-col items-center justify-center h-full text-center min-h-[400px]">
              <h2 className="text-3xl mb-6 font-bold tracking-widest animate-pulse">_SYSTEM_READY</h2>
              <p className="opacity-80 max-w-lg leading-relaxed tracking-wide">
                Welcome, operative. Connect your Sepolia wallet and initialize Level 1 to spawn your isolated target instance.
              </p>
            </div>
          )}

        </div>
      </div>
    </main>
  );
}