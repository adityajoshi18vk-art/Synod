import { publicClient } from '../src/lib/config.js';
import { formatEther } from 'viem';
import 'dotenv/config';

const BURNERS = [
  '0x6Cd74544087e541e74cB41Ff42F4D00472Eb5caB',
  '0x636C3E2709ff7949C56fe60a41A654e0F553D542',
  '0x369aA1B28ED190cE8423eD4596124AbcEE1d93c0',
  '0xBA18e7E01568A681039aDa33d4fC59F99bE16c50',
  '0x0bB0ABf9A3d5ea6E1a1eD8a26e4c65bE35B20e22'
];

const COUNCIL = [
  '0x2eaA7453768409D69974788743B33fD3B6Fc3510',
  '0x502b93EB1297B2223491e857380a47d338a8D14E',
  '0x99eDA17E3a63eba753903DEDD4B673F5aE32d10E',
  '0xAACEb83Ea4Dfd0ce8C973b10Da975C54b2Ee98d5',
  '0x00189adCa451E9Bd5D9Da66Dc66E90A032Bbf8f0'
];

async function main() {
  console.log("=== BURNERS ===");
  for (const a of BURNERS) {
    const bal = await publicClient.getBalance({ address: a });
    console.log(`${a}: ${formatEther(bal)} MON`);
  }
  console.log("\n=== COUNCIL ===");
  for (const a of COUNCIL) {
    const bal = await publicClient.getBalance({ address: a });
    console.log(`${a}: ${formatEther(bal)} MON`);
  }
}
main().catch(console.error);
