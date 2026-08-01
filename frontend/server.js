import http from 'http';
import handler from './api/council/vote.js';
import 'dotenv/config';

const server = http.createServer(async (req, res) => {
  // CORS setup
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'OPTIONS, POST');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.url === '/api/council/vote') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', async () => {
      try {
        req.body = JSON.parse(body || '{}');
      } catch(e) {
        req.body = {};
      }
      
      // Shim res.status().json()
      res.status = function(code) {
        res.statusCode = code;
        return res;
      };
      res.json = function(data) {
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data));
      };

      try {
        await handler(req, res);
      } catch (err) {
        res.status(500).json({ error: 'Internal Server Error' });
      }
    });
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

server.listen(3000, () => {
  console.log('Local API stub listening on port 3000');
});
