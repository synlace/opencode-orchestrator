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
    throw new Error("Missing Google environment credentials (GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN)");
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
      name: "calendar_list_events",
      description: "List events from a Google Calendar.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Optional. The calendar ID to list events from. Defaults to 'primary'." },
          timeMin: { type: "string", description: "Optional. Lower bound (exclusive) for an event's end time to filter by (ISO 8601 format)." },
          timeMax: { type: "string", description: "Optional. Upper bound (exclusive) for an event's start time to filter by (ISO 8601 format)." },
          maxResults: { type: "integer", description: "Optional. Maximum number of events to return. Defaults to 25." },
          query: { type: "string", description: "Optional. Free-text search terms to filter events by." }
        }
      }
    },
    {
      name: "calendar_create_event",
      description: "Create a new event in a Google Calendar.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Optional. The calendar ID to create the event in. Defaults to 'primary'." },
          summary: { type: "string", description: "Required. The title of the event." },
          description: { type: "string", description: "Optional. The description of the event." },
          startTime: { type: "string", description: "Required. Start time of the event (ISO 8601 format, e.g., '2026-06-12T15:00:00Z')." },
          endTime: { type: "string", description: "Required. End time of the event (ISO 8601 format, e.g., '2026-06-12T16:00:00Z')." },
          location: { type: "string", description: "Optional. The location of the event." }
        },
        required: ["summary", "startTime", "endTime"]
      }
    },
    {
      name: "calendar_update_event",
      description: "Update an existing event in a Google Calendar.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Optional. The calendar ID containing the event. Defaults to 'primary'." },
          eventId: { type: "string", description: "Required. The ID of the event to update." },
          summary: { type: "string", description: "Optional. The updated title of the event." },
          description: { type: "string", description: "Optional. The updated description of the event." },
          startTime: { type: "string", description: "Optional. Updated start time (ISO 8601 format)." },
          endTime: { type: "string", description: "Optional. Updated end time (ISO 8601 format)." },
          location: { type: "string", description: "Optional. Updated location." }
        },
        required: ["eventId"]
      }
    },
    {
      name: "calendar_delete_event",
      description: "Delete an event from a Google Calendar.",
      inputSchema: {
        type: "object",
        properties: {
          calendarId: { type: "string", description: "Optional. The calendar ID containing the event. Defaults to 'primary'." },
          eventId: { type: "string", description: "Required. The ID of the event to delete." }
        },
        required: ["eventId"]
      }
    },
    {
      name: "calendar_list_calendars",
      description: "List the calendars in the user's Google Calendar account.",
      inputSchema: {
        type: "object",
        properties: {}
      }
    }
  ];
}

async function callTool(name, args) {
  const token = await getAccessToken();
  
  switch (name) {
    case "calendar_list_events": {
      const calendarId = encodeURIComponent(args.calendarId || "primary");
      const params = new URLSearchParams();
      if (args.timeMin) params.append("timeMin", args.timeMin);
      if (args.timeMax) params.append("timeMax", args.timeMax);
      params.append("maxResults", (args.maxResults || 25).toString());
      if (args.query) params.append("q", args.query);
      params.append("singleEvents", "true");
      params.append("orderBy", "startTime");
      
      return await request(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events?${params.toString()}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
    }
    
    case "calendar_create_event": {
      const calendarId = encodeURIComponent(args.calendarId || "primary");
      const payload = {
        summary: args.summary,
        description: args.description || "",
        start: { dateTime: args.startTime },
        end: { dateTime: args.endTime },
        location: args.location || ""
      };
      
      const postData = JSON.stringify(payload);
      return await request(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "calendar_update_event": {
      const calendarId = encodeURIComponent(args.calendarId || "primary");
      const eventId = encodeURIComponent(args.eventId);
      const payload = {};
      if (args.summary !== undefined) payload.summary = args.summary;
      if (args.description !== undefined) payload.description = args.description;
      if (args.startTime !== undefined) payload.start = { dateTime: args.startTime };
      if (args.endTime !== undefined) payload.end = { dateTime: args.endTime };
      if (args.location !== undefined) payload.location = args.location;
      
      const postData = JSON.stringify(payload);
      return await request(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData)
        }
      }, postData);
    }
    
    case "calendar_delete_event": {
      const calendarId = encodeURIComponent(args.calendarId || "primary");
      const eventId = encodeURIComponent(args.eventId);
      await request(`https://www.googleapis.com/calendar/v3/calendars/${calendarId}/events/${eventId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      return { status: "success" };
    }
    
    case "calendar_list_calendars": {
      return await request(`https://www.googleapis.com/calendar/v3/users/me/calendarList`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
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
            name: "local-calendar-mcp",
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
