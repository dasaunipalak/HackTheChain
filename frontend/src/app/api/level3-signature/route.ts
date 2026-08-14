import { NextRequest, NextResponse } from 'next/server';
import { privateKeyToAccount } from 'viem/accounts';
import { encodePacked, keccak256, isAddress } from 'viem';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { instanceAddress, playerAddress, amount } = body;

    if (!instanceAddress || !playerAddress || !amount) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!isAddress(instanceAddress)) {
      return NextResponse.json({ error: 'Invalid instanceAddress' }, { status: 400 });
    }

    if (!isAddress(playerAddress)) {
      return NextResponse.json({ error: 'Invalid playerAddress' }, { status: 400 });
    }

    // Validate amount is exactly 10 TRC in wei (10000000000000000000)
    if (amount !== '10000000000000000000') {
      return NextResponse.json({ error: 'Invalid challenge withdrawal amount' }, { status: 400 });
    }

    const privateKey = process.env.LEVEL3_SIGNER_PRIVATE_KEY;
    if (!privateKey) {
      return NextResponse.json({ error: 'Server misconfiguration: missing private key' }, { status: 500 });
    }
    
    // Ensure pk starts with 0x
    const pk = privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`;

    let account;
    try {
      account = privateKeyToAccount(pk as `0x${string}`);
    } catch (err) {
      return NextResponse.json({ error: 'Server misconfiguration: invalid private key' }, { status: 500 });
    }

    const messageHash = keccak256(
      encodePacked(
        ['address', 'address', 'uint256'],
        [instanceAddress as `0x${string}`, playerAddress as `0x${string}`, BigInt(amount)]
      )
    );

    // Sign the hash with the Ethereum signed message prefix
    const signature = await account.signMessage({
      message: { raw: messageHash }
    });

    return NextResponse.json({
      signature,
      signer: account.address
    });
  } catch (error) {
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
