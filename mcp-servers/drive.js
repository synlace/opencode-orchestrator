#!/usr/bin/env node
const https = require('https');
const readline = require('readline');

function request(url, options, postData) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(data ? JSON.parse(data) : {});
          } catch (e) {
            resolve(data);
          }
        } else {
          reject(new Error(`Status: ${res.statusCode}, Data: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

let cachedAccessToken = null;
let tokenExpiry = 0;

async function getAccessToken() {
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }
  
  const clientId = process.env.GMAIL_CLIENT_ID || process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET || process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN || process.env.GOOGLE_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GOOGLE environment credentials");
  }
  
  const tokenUrl = 'https://oauth2.googleapis.com/token';
  const postData = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    refresh_token: refreshToken,
    grant_type: 'refresh_token'
  }).toString();

  const res = await request(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  }, postData);
  
  cachedAccessToken = res.access_token;
  tokenExpiry = Date.now() + (res.expires_in * 1000) - 60000;
  return cachedAccessToken;
}

function getToolsList() {
  return [
    {
      name: "drive_list_files",
      description: "Lists, filters, or searches files in Google Drive.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional search query in Google Drive syntax, e.g., name contains 'test' or mimeType = 'application/pdf'." },
          pageSize: { type: "integer", description: "Optional. Maximum number of files to return. Defaults to 20." },
          pageToken: { type: "string", description: "Optional page token." }
        }
      }
    },
    {
      name: "drive_get_file_content",
      description: "Retrieves the content of a specific file by its fileId.",
      inputSchema: {
        type: "object",
        properties: {
          fileId: { type: "string", description: "Required. The unique identifier of the file to fetch." }
        },
        required: ["fileId"]
      }
    }
  ];
}

async function callTool(name, args) {
  const token = await getAccessToken();
  
  switch (name) {
    case "drive_list_files": {
      const q = args.query || "";
      const maxResults = args.pageSize || 20;
      const pageToken = args.pageToken || "";
      
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      params.append("pageSize", maxResults.toString());
      if (pageToken) params.append("pageToken", pageToken);
      params.append("fields", "nextPageToken, files(id, name, mimeType, size, createdTime, modifiedTime)");
      
      return await request(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    case "drive_get_file_content": {
      const { fileId } = args;
      
      // Get file metadata first to check mimeType
      const meta = await request(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=mimeType,name`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const isGoogleDoc = meta.mimeType && meta.mimeType.startsWith('application/vnd.google-apps.');
      
      let url;
      if (isGoogleDoc) {
        // Export Google Workspace formats (Docs, Sheets, Slides) to text/csv
        let mimeType = 'text/plain';
        if (meta.mimeType === 'application/vnd.google-apps.spreadsheet') {
          mimeType = 'text/csv';
        }
        url = `https://www.googleapis.com/drive/v3/files/${fileId}/export?mimeType=${mimeType}`;
      } else {
        url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
      }
      
      const content = await request(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      return typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    }
    
    default:
      throw new Error(`Unknown tool name: ${name}`);
  }
}

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

function sendResponse(response) {
  process.stdout.write(JSON.stringify(response) + '\n');
}

rl.on('line', async (line) => {
  if (!line.trim()) return;
  try {
    const req = JSON.parse(line);
    const { jsonrpc, id, method, params } = req;
    
    if (method === 'initialize') {
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: {
          protocolVersion: params.protocolVersion || "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "local-drive-mcp",
            version: "1.0.0"
          }
        }
      });
      return;
    }
    
    if (method === 'notifications/initialized') {
      return;
    }
    
    if (method === 'tools/list') {
      sendResponse({
        jsonrpc: "2.0",
        id: id,
        result: {
          tools: getToolsList()
        }
      });
      return;
    }
    
    if (method === 'tools/call') {
      try {
        const toolResult = await callTool(params.name, params.arguments);
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: {
            content: [
              {
                type: "text",
                text: typeof toolResult === 'string' ? toolResult : JSON.stringify(toolResult, null, 2)
              }
            ]
          }
        });
      } catch (err) {
        sendResponse({
          jsonrpc: "2.0",
          id: id,
          result: {
            content: [
              {
                type: "text",
                text: `Error calling tool ${params.name}: ${err.message}`
              }
            ],
            isError: true
          }
        });
      }
      return;
    }
    
    sendResponse({
      jsonrpc: "2.0",
      id: id,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
  } catch (err) {
    console.error("Error processing line:", err);
  }
});