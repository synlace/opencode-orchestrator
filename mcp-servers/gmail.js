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
  
  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  const refreshToken = process.env.GMAIL_REFRESH_TOKEN;
  
  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Missing GMAIL environment credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)");
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
      name: "gmail_search_threads",
      description: "Lists email threads from the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional filter query in Gmail syntax." },
          pageSize: { type: "integer", description: "Optional. Maximum number of threads to return. Defaults to 20." },
          pageToken: { type: "string", description: "Optional page token." },
          includeTrash: { type: "boolean", description: "Optional. Include drafts from TRASH. Defaults to false." }
        }
      }
    },
    {
      name: "gmail_get_thread",
      description: "Retrieves a specific email thread from the authenticated user's Gmail account, including a list of its messages.",
      inputSchema: {
        type: "object",
        properties: {
          threadId: { type: "string", description: "Required. The unique identifier of the thread to fetch." },
          messageFormat: { type: "string", enum: ["MESSAGE_FORMAT_UNSPECIFIED", "MINIMAL", "FULL_CONTENT"], description: "Optional format of messages." }
        },
        required: ["threadId"]
      }
    },
    {
      name: "gmail_list_drafts",
      description: "Lists draft emails from the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "Optional filter query." },
          pageSize: { type: "integer", description: "Optional. Maximum drafts to return." },
          pageToken: { type: "string", description: "Optional page token." }
        }
      }
    },
    {
      name: "gmail_create_draft",
      description: "Creates a new draft email in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          to: { type: "array", items: { type: "string" }, description: "Required. List of plain email addresses." },
          subject: { type: "string", description: "Optional subject line." },
          body: { type: "string", description: "Optional plain text body." },
          htmlBody: { type: "string", description: "Optional HTML body." },
          cc: { type: "array", items: { type: "string" }, description: "Optional CC addresses." },
          bcc: { type: "array", items: { type: "string" }, description: "Optional BCC addresses." },
          replyToMessageId: { type: "string", description: "Optional ID of message to reply to." },
          attachments: { type: "array", items: { type: "string" }, description: "Optional attachment paths." }
        },
        required: ["to"]
      }
    },
    {
      name: "gmail_list_labels",
      description: "Lists all user-defined labels available in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          pageSize: { type: "integer" },
          pageToken: { type: "string" }
        }
      }
    },
    {
      name: "gmail_create_label",
      description: "Creates a new label in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          displayName: { type: "string", description: "Required label name." },
          color: { type: "string", description: "Optional label color." },
          autoCreateParentLabels: { type: "boolean", description: "Optional parent creation." }
        },
        required: ["displayName"]
      }
    },
    {
      name: "gmail_update_label",
      description: "Modifies an existing label's name and color in the user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          labelId: { type: "string", description: "Required label ID." },
          displayName: { type: "string" },
          color: { type: "string" }
        },
        required: ["labelId"]
      }
    },
    {
      name: "gmail_delete_label",
      description: "Deletes a label in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          labelId: { type: "string" }
        },
        required: ["labelId"]
      }
    },
    {
      name: "gmail_label_thread",
      description: "Adds labels to an entire thread in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          threadId: { type: "string" },
          labelIds: { type: "array", items: { type: "string" } }
        },
        required: ["threadId", "labelIds"]
      }
    },
    {
      name: "gmail_unlabel_thread",
      description: "Removes labels from an entire thread in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          threadId: { type: "string" },
          labelIds: { type: "array", items: { type: "string" } }
        },
        required: ["threadId", "labelIds"]
      }
    },
    {
      name: "gmail_label_message",
      description: "Adds one or more labels to a specific message in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string" },
          labelIds: { type: "array", items: { type: "string" } }
        },
        required: ["messageId", "labelIds"]
      }
    },
    {
      name: "gmail_unlabel_message",
      description: "Removes one or more labels from a specific message in the authenticated user's Gmail account.",
      inputSchema: {
        type: "object",
        properties: {
          messageId: { type: "string" },
          labelIds: { type: "array", items: { type: "string" } }
        },
        required: ["messageId", "labelIds"]
      }
    }
  ];
}

async function callTool(name, args) {
  const token = await getAccessToken();
  
  switch (name) {
    case "gmail_search_threads": {
      const q = args.query || "";
      const maxResults = args.pageSize || 20;
      const pageToken = args.pageToken || "";
      const includeSpamTrash = args.includeTrash || false;
      
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      params.append("maxResults", maxResults.toString());
      if (pageToken) params.append("pageToken", pageToken);
      if (includeSpamTrash) params.append("includeSpamTrash", "true");
      
      const listRes = await request(`https://gmail.googleapis.com/gmail/v1/users/me/threads?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!listRes.threads || listRes.threads.length === 0) {
        return { threads: [], nextPageToken: null };
      }
      
      // Fetch details in parallel
      const details = await Promise.all(listRes.threads.map(async (t) => {
        try {
          return await request(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${t.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        } catch (e) {
          console.error(`Error fetching thread ${t.id}:`, e);
          return null;
        }
      }));
      
      return {
        threads: details.filter(Boolean).map(d => ({
          id: d.id,
          messages: (d.messages || []).map(m => {
            const headers = m.payload?.headers || [];
            const getHeader = (name) => {
              const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
              return h ? h.value : '';
            };
            return {
              id: m.id,
              snippet: m.snippet,
              subject: getHeader('subject'),
              from: getHeader('from'),
              to: getHeader('to'),
              date: getHeader('date')
            };
          })
        })),
        nextPageToken: listRes.nextPageToken || null
      };
    }
    
    case "gmail_get_thread": {
      const { threadId, messageFormat } = args;
      const format = messageFormat === "MINIMAL" ? "minimal" : "full";
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=${format}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    case "gmail_list_drafts": {
      const q = args.query || "";
      const maxResults = args.pageSize || 20;
      const pageToken = args.pageToken || "";
      
      const params = new URLSearchParams();
      if (q) params.append("q", q);
      params.append("maxResults", maxResults.toString());
      if (pageToken) params.append("pageToken", pageToken);
      
      const draftsRes = await request(`https://gmail.googleapis.com/gmail/v1/users/me/drafts?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (!draftsRes.drafts || draftsRes.drafts.length === 0) {
        return { drafts: [], nextPageToken: null };
      }
      
      // Fetch draft details in parallel
      const details = await Promise.all(draftsRes.drafts.map(async (d) => {
        try {
          const msg = await request(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${d.message.id}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          const headers = msg.payload?.headers || [];
          const getHeader = (name) => {
            const h = headers.find(h => h.name.toLowerCase() === name.toLowerCase());
            return h ? h.value : '';
          };
          return {
            id: d.id,
            messageId: d.message.id,
            subject: getHeader('subject'),
            from: getHeader('from'),
            to: getHeader('to'),
            date: getHeader('date'),
            snippet: msg.snippet
          };
        } catch (e) {
          console.error(`Error fetching draft message ${d.message.id}:`, e);
          return { id: d.id, messageId: d.message.id };
        }
      }));
      
      return {
        drafts: details,
        nextPageToken: draftsRes.nextPageToken || null
      };
    }
    
    case "gmail_create_draft": {
      const { to, subject, body, htmlBody, cc, bcc, replyToMessageId } = args;
      const lines = [];
      lines.push(`To: ${to.join(', ')}`);
      if (cc && cc.length) lines.push(`Cc: ${cc.join(', ')}`);
      if (bcc && bcc.length) lines.push(`Bcc: ${bcc.join(', ')}`);
      if (subject) lines.push(`Subject: ${subject}`);
      
      if (replyToMessageId) {
        lines.push(`In-Reply-To: <${replyToMessageId}>`);
        lines.push(`References: <${replyToMessageId}>`);
      }
      
      if (htmlBody && body) {
        const boundary = 'boundary_' + Date.now().toString(16);
        lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`);
        lines.push('');
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/plain; charset="utf-8"');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(body).toString('base64'));
        lines.push(`--${boundary}`);
        lines.push('Content-Type: text/html; charset="utf-8"');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(htmlBody).toString('base64'));
        lines.push(`--${boundary}--`);
      } else if (htmlBody) {
        lines.push('Content-Type: text/html; charset="utf-8"');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(htmlBody).toString('base64'));
      } else {
        lines.push('Content-Type: text/plain; charset="utf-8"');
        lines.push('Content-Transfer-Encoding: base64');
        lines.push('');
        lines.push(Buffer.from(body || '').toString('base64'));
      }
      
      const rawMessage = lines.join('\r\n');
      const base64url = Buffer.from(rawMessage)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
        
      const payload = {
        message: {
          raw: base64url
        }
      };
      
      const postData = JSON.stringify(payload);
      
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/drafts`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "gmail_list_labels": {
      const maxResults = args.pageSize || 100;
      const pageToken = args.pageToken || "";
      const params = new URLSearchParams();
      params.append("maxResults", maxResults.toString());
      if (pageToken) params.append("pageToken", pageToken);
      
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/labels?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    case "gmail_create_label": {
      const { displayName, color } = args;
      const payload = { name: displayName };
      if (color) payload.color = { textColor: color, backgroundColor: color };
      
      const postData = JSON.stringify(payload);
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/labels`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "gmail_update_label": {
      const { labelId, displayName, color } = args;
      const payload = {};
      if (displayName) payload.name = displayName;
      if (color) payload.color = { textColor: color, backgroundColor: color };
      
      const postData = JSON.stringify(payload);
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "gmail_delete_label": {
      const { labelId } = args;
      await request(`https://gmail.googleapis.com/gmail/v1/users/me/labels/${labelId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { status: "success" };
    }
    
    case "gmail_label_thread":
    case "gmail_unlabel_thread": {
      const { threadId, labelIds } = args;
      const isAdd = name === "gmail_label_thread";
      const payload = {
        addLabelIds: isAdd ? labelIds : [],
        removeLabelIds: isAdd ? [] : labelIds
      };
      const postData = JSON.stringify(payload);
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "gmail_label_message":
    case "gmail_unlabel_message": {
      const { messageId, labelIds } = args;
      const isAdd = name === "gmail_label_message";
      const payload = {
        addLabelIds: isAdd ? labelIds : [],
        removeLabelIds: isAdd ? [] : labelIds
      };
      const postData = JSON.stringify(payload);
      return await request(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}/modify`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
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
            name: "local-gmail-mcp",
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
