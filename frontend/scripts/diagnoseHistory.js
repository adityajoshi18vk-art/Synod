import { publicClient, ADDRESSES, BURNER_KEYS } from '../src/lib/config.js';
import { VOTING_ABI } from '../src/lib/abis.js';
import { privateKeyToAccount } from 'viem/accounts';
import { keccak256, encodePacked } from 'viem';

async function main() {
  const account = privateKeyToAccount(BURNER_KEYS[0]);
  
  // Try to estimate gas for a FRESH commitVote call (not for an already-used proposal)
  // First, get current proposal count to know the latest
  const count = await publicClient.readContract({
    address: ADDRESSES.voting,
    abi: VOTING_ABI,
    functionName: 'proposalCount',
  });
  console.log('Current proposal count:', count);
  
  // Estimate gas for commitVote on a hypothetical proposal
  // We'll use the latest proposal that is still pending, or just check gas for the ABI
  const salt = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  const hashData = keccak256(encodePacked(
    ['bool', 'bytes32', 'address'],
    [true, salt, account.address]
  ));
  
  // Check each proposal from #28 backwards to find one with commit window open
  // Actually, let's just estimate gas for the exact function signature
  // by using eth_estimateGas with a made up proposal that doesn't exist (will revert but shows gas path)
  
  // Instead, let's check the actual gas used on OLDER successful proposals
  // Look at proposal #1 or early ones to see what normal gas usage looks like
  console.log('\n=== CHECKING GAS ON HISTORICAL SUCCESSFUL PROPOSALS ===');
  
  // Check proposals 1-5 to find their commit/reveal tx hashes
  for (let pid = 1n; pid <= 5n; pid++) {
    try {
      const p = await publicClient.readContract({
        address: ADDRESSES.voting,
        abi: VOTING_ABI,
        functionName: 'getProposal',
        args: [pid],
      });
      console.log(`\n  Proposal #${pid}: status=${p.status}, tallied=${p.tallied}, yesWeight=${p.yesWeight}, noWeight=${p.noWeight}, yesCount=${p.yesCount}, noCount=${p.noCount}`);
    } catch (e) {
      console.log(`  Proposal #${pid}: ${e.shortMessage || e.message}`);
    }
  }

  // Check the PREVIOUS proposal #27 which was the run where reveals had insufficient balance
  // Let's check if proposal #27's commits also reverted
  console.log('\n=== PROPOSAL #27 COMMITS (from first demo run) ===');
  // Proposal #27 commit hashes from the first run:
  const p27commits = [
    '0x570df8e7ff4b6314689fda73a8bf43df663282db5168e762ec2f706de53902e1', // Burner 0
    '0xa9bf56465835bc920d02956750c7eb4fb0e9700786711a2a2fb1e80530980a69', // Council Arjun
  ];
  for (const h of p27commits) {
    const receipt = await publicClient.getTransactionReceipt({ hash: h });
    console.log(`  ${h.slice(0,18)}... status=${receipt.status} gasUsed=${receipt.gasUsed} logs=${receipt.logs.length}`);
  }
}

main().catch(console.error);
