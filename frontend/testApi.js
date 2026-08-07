async function test() {
  const res = await fetch('http://localhost:3000/api/council/vote', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ description: "Test Arbitrage", amount: "0.1", target: "0x123" })
  });
  const data = await res.json();
  console.log(JSON.stringify(data, null, 2));
}
test();
