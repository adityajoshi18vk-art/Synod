import { privateKeyToAccount } from 'viem/accounts';

const burnerKeys = [
  "0x3983ba8563dfbf01820a33e187cd37da895f9b21159b754d3ff928d809e14234",
  "0x4518de9dc908da43df142e6f30481ad0aad15e4e52bdda5adccbce01f078bc07",
  "0x3876b63538c81ade9aeba3cba1dbd93177909e32ce174b2f36f40b80015dce18",
  "0x7d0ad3d512224d03e6c7b7128001d6f495a7790d1ccebe9298f867a58cf8e7e4",
  "0x7eebcdd227eb2c318f5096bb367cdd86990ed87f019caeb6119da8b3e8ed648a"
];

const councilKeys = [
  "0x9bca857345a2c1fdc1124205d32f88f298048ea48b8bbd8063ae83268849dbb6",
  "0x4f8594e82ca44a65b6c4de3bef0aecca9b2fa87dd5ccdec935901946d8035ec1",
  "0xe0131529fc2f490a25f82abf189af13c159604f42629467b3d8cf3ef5e91cc7e",
  "0xfd3022c80f61ae5280d54ed61ff70e3ae6d01e1c396b35b835e2d00549728c2d",
  "0xb4c26637ca8a535f5bd77d6a0f98521e68ffbc0eb464a4a56ee18205ca18062d"
];

console.log("Burners:");
burnerKeys.forEach((k, i) => console.log(`Demo Agent ${i+1}:`, privateKeyToAccount(k).address));

console.log("\nCouncil:");
councilKeys.forEach((k, i) => console.log(`Council ${i+1}:`, privateKeyToAccount(k).address));
