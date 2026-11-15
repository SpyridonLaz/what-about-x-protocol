// Real examples for the AI entries: the full content of every message of the scenario in
// src/protocols/ai.ts (same order, same values), plus what the user sees meanwhile.
//
// Checked against: MCP specification 2026-07-28 (server/discover, tools/list, tools/call,
// `_meta` keys io.modelcontextprotocol/*, Streamable HTTP headers MCP-Protocol-Version /
// Mcp-Method / Mcp-Name), A2A v1.0 (Agent Card supportedInterfaces, SendStreamingMessage,
// StreamResponse statusUpdate / artifactUpdate, ROLE_* and TASK_STATE_* values, GetTask),
// the Claude Messages API streaming events, RFC 6749 / RFC 7636 / RFC 8707 (OAuth + PKCE).
// Hosts are example names; keys, ids and vectors are shortened or illustrative.
import type { Example, WireLang, WireMsg } from './types';

const r = String.raw;
const w = (lang: WireLang, body: string): WireMsg => ({ lang, body: body.replace(/^\n/, '').replace(/\n\s*$/, '') });

const MCP_META = r`"_meta": {
      "io.modelcontextprotocol/protocolVersion": "2026-07-28",
      "io.modelcontextprotocol/clientInfo": { "name": "ExampleChat", "version": "1.0.0" },
      "io.modelcontextprotocol/clientCapabilities": {}
    }`;

const mcp: Example = {
  app: 'ExampleChat — chat app with a weather connector',
  scene: [
    { at: 0, role: 'status', text: 'Connecting to mcp.weather.example…' },
    { at: 2, role: 'status', text: 'Browser: “Allow ExampleChat to read forecasts?” → Allow' },
    { at: 7, role: 'status', text: 'Connected · 1 tool available: get_forecast' },
    { at: 8, role: 'user', text: 'Do I need an umbrella in Athens tomorrow?' },
    { at: 9, role: 'tool', text: 'get_forecast   city: "Athens" · days: 1' },
    { at: 13, role: 'result', text: '80% chance of rain, 19 °C' },
    { at: 15, role: 'assistant', text: 'Yes — take an umbrella: 80% chance of rain tomorrow.' },
  ],
  wire: [
    w('http', r`
POST /mcp HTTP/1.1
Host: mcp.weather.example
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "server/discover",
  "params": {
    ${MCP_META}
  }
}`),
    w('http', r`
HTTP/1.1 401 Unauthorized
WWW-Authenticate: Bearer resource_metadata="https://mcp.weather.example/.well-known/oauth-protected-resource"`),
    w('http', r`
// First the app reads two metadata documents (the protected resource's, then
// the authorization server's) to learn where to send the user. Then it opens
// the user's browser at the authorization server:
GET /authorize?response_type=code
    &client_id=example-chat
    &state=af0ifjsldkj
    &redirect_uri=http://127.0.0.1:8765/callback
    &code_challenge=E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM
    &code_challenge_method=S256
    &resource=https://mcp.weather.example
    &scope=forecast.read HTTP/1.1
Host: auth.example.com

// …the user logs in and clicks "Allow"…

HTTP/1.1 302 Found
Location: http://127.0.0.1:8765/callback?code=SplxlOBeZQQYbYS6WxSbIA&state=af0ifjsldkj`),
    w('http', r`
// The app swaps the code for a token (POST /token with the PKCE code_verifier):
HTTP/1.1 200 OK
Content-Type: application/json
Cache-Control: no-store

{
  "access_token": "eyJhbGciOiJSUzI1NiIs…",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "forecast.read"
}`),
    w('http', r`
POST /mcp HTTP/1.1
Host: mcp.weather.example
Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: server/discover

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "server/discover",
  "params": {
    ${MCP_META}
  }
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "resultType": "complete",
    "supportedVersions": ["2026-07-28"],
    "capabilities": { "tools": {}, "resources": {} },
    "_meta": {
      "io.modelcontextprotocol/serverInfo": { "name": "weather", "version": "1.0.0" }
    },
    "ttlMs": 3600000
  }
}`),
    w('http', r`
POST /mcp HTTP/1.1
Host: mcp.weather.example
Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/list

{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/list",
  "params": {
    ${MCP_META}
  }
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "resultType": "complete",
    "tools": [
      {
        "name": "get_forecast",
        "description": "Get the weather forecast for a city",
        "inputSchema": {
          "type": "object",
          "properties": {
            "city": { "type": "string", "description": "City name" },
            "days": { "type": "integer", "description": "Days ahead (1-7)" }
          },
          "required": ["city"]
        }
      }
    ],
    "ttlMs": 300000
  }
}`),
    w('http', r`
// MCP is done for now. The app talks to the model API and passes the tool on:
POST /v1/messages HTTP/1.1
Host: api.llm.example
x-api-key: ••••••••
Content-Type: application/json

{
  "model": "example-model",
  "max_tokens": 1024,
  "tools": [
    {
      "name": "get_forecast",
      "description": "Get the weather forecast for a city",
      "input_schema": {
        "type": "object",
        "properties": {
          "city": { "type": "string", "description": "City name" },
          "days": { "type": "integer", "description": "Days ahead (1-7)" }
        },
        "required": ["city"]
      }
    }
  ],
  "messages": [
    { "role": "user", "content": "Do I need an umbrella in Athens tomorrow?" }
  ]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "role": "assistant",
  "content": [
    {
      "type": "tool_use",
      "id": "toolu_01",
      "name": "get_forecast",
      "input": { "city": "Athens", "days": 1 }
    }
  ],
  "stop_reason": "tool_use"
}`),
    w('http', r`
POST /mcp HTTP/1.1
Host: mcp.weather.example
Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
Content-Type: application/json
Accept: application/json, text/event-stream
MCP-Protocol-Version: 2026-07-28
Mcp-Method: tools/call
Mcp-Name: get_forecast

{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "tools/call",
  "params": {
    "name": "get_forecast",
    "arguments": { "city": "Athens", "days": 1 },
    ${MCP_META}
  }
}`),
    w('http', r`
// Behind the MCP server: an ordinary web API call.
GET /forecast?city=Athens&days=1 HTTP/1.1
Host: api.weather.example
Accept: application/json`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{ "rain_probability": 0.8, "temp_c": 19 }`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "resultType": "complete",
    "content": [
      { "type": "text", "text": "80% chance of rain, 19 °C" }
    ],
    "isError": false
  }
}`),
    w('http', r`
POST /v1/messages HTTP/1.1
Host: api.llm.example
x-api-key: ••••••••
Content-Type: application/json

{
  "model": "example-model",
  "max_tokens": 1024,
  // "tools": the same list as before
  "messages": [
    { "role": "user", "content": "Do I need an umbrella in Athens tomorrow?" },
    { "role": "assistant", "content": [
        { "type": "tool_use", "id": "toolu_01", "name": "get_forecast",
          "input": { "city": "Athens", "days": 1 } }
    ] },
    { "role": "user", "content": [
        { "type": "tool_result", "tool_use_id": "toolu_01",
          "content": "80% chance of rain, 19 °C" }
    ] }
  ]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Yes — take an umbrella: 80% chance of rain tomorrow." }
  ],
  "stop_reason": "end_turn"
}`),
  ],
};

const A2A_POST = r`POST /a2a/v1 HTTP/1.1
Host: hotels.example
Authorization: Bearer eyJhbGciOiJSUzI1NiIs…
Content-Type: application/json
A2A-Version: 1.0`;

const a2a: Example = {
  app: 'Travel planner agent — talking to a hotel agent',
  names: { user: 'node.clientAgent', assistant: 'node.remoteAgent' },
  scene: [
    { at: 0, role: 'status', text: 'Who can book hotels? Reading the Agent Card of hotels.example…' },
    { at: 1, role: 'status', text: 'Found “Hotel Booking Agent” · skills: hotel-search, booking' },
    { at: 2, role: 'user', text: 'Find a hotel in Lisbon, 12–14 May, under €150' },
    { at: 3, role: 'status', text: 'Task 7f3c… created · submitted' },
    { at: 4, role: 'status', text: 'Task 7f3c… working · “Searching 42 hotels…”' },
    { at: 5, role: 'assistant', text: 'Sea view (€140) or city centre (€120)?' },
    { at: 6, role: 'user', text: 'City centre, please' },
    { at: 7, role: 'status', text: 'Task 7f3c… working · “Booking city centre hotel…”' },
    { at: 8, role: 'result', text: 'Artifact “booking-confirmation”: Hotel Centro, 12–14 May, €240' },
    { at: 9, role: 'status', text: 'Task 7f3c… completed' },
    { at: 11, role: 'status', text: 'One minute later: task 7f3c… is still stored, with its artifact' },
  ],
  wire: [
    w('http', r`
GET /.well-known/agent-card.json HTTP/1.1
Host: hotels.example
Accept: application/json`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "name": "Hotel Booking Agent",
  "description": "Finds and books hotels",
  "version": "1.0.0",
  "supportedInterfaces": [
    {
      "url": "https://hotels.example/a2a/v1",
      "protocolBinding": "JSONRPC",
      "protocolVersion": "1.0"
    }
  ],
  "capabilities": { "streaming": true },
  "defaultInputModes": ["text/plain"],
  "defaultOutputModes": ["text/plain"],
  "skills": [
    {
      "id": "hotel-search",
      "name": "Hotel search",
      "description": "Find hotels by city, dates and price",
      "tags": ["travel", "hotels"]
    },
    {
      "id": "booking",
      "name": "Booking",
      "description": "Book a room and return a confirmation",
      "tags": ["travel", "booking"]
    }
  ]
  // + "securitySchemes": OAuth 2.0 (left out to keep this short)
}`),
    w('http', r`
${A2A_POST}

{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "SendStreamingMessage",
  "params": {
    "message": {
      "messageId": "msg-001",
      "role": "ROLE_USER",
      "parts": [
        { "text": "Find a hotel in Lisbon, 12–14 May, under €150" }
      ]
    }
  }
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: text/event-stream

// A stream always begins with the Task object itself:
data: {"jsonrpc":"2.0","id":1,"result":{"task":{
data:   "id":"7f3c…","contextId":"c41a…",
data:   "status":{"state":"TASK_STATE_SUBMITTED"}}}}`),
    w('sse', r`
// same stream, next event
data: {"jsonrpc":"2.0","id":1,"result":{"statusUpdate":{
data:   "taskId":"7f3c…","contextId":"c41a…",
data:   "status":{"state":"TASK_STATE_WORKING",
data:     "message":{"messageId":"msg-002","role":"ROLE_AGENT",
data:       "parts":[{"text":"Searching 42 hotels…"}]}}}}}`),
    w('sse', r`
// same stream, 2.7 seconds later
data: {"jsonrpc":"2.0","id":1,"result":{"statusUpdate":{
data:   "taskId":"7f3c…","contextId":"c41a…",
data:   "status":{"state":"TASK_STATE_INPUT_REQUIRED",
data:     "message":{"messageId":"msg-003","role":"ROLE_AGENT",
data:       "parts":[{"text":"Sea view (€140) or city centre (€120)?"}]}}}}}

// the task is waiting: the stream ends here`),
    w('http', r`
${A2A_POST}

{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "SendStreamingMessage",
  "params": {
    "message": {
      "messageId": "msg-004",
      "taskId": "7f3c…",
      "contextId": "c41a…",
      "role": "ROLE_USER",
      "parts": [
        { "text": "City centre, please" }
      ]
    }
  }
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: text/event-stream

// The new stream begins with the Task again, in its current state:
data: {"jsonrpc":"2.0","id":2,"result":{"task":{
data:   "id":"7f3c…","contextId":"c41a…",
data:   "status":{"state":"TASK_STATE_WORKING",
data:     "message":{"messageId":"msg-005","role":"ROLE_AGENT",
data:       "parts":[{"text":"Booking city centre hotel…"}]}}}}}`),
    w('sse', r`
// same stream: the result
data: {"jsonrpc":"2.0","id":2,"result":{"artifactUpdate":{
data:   "taskId":"7f3c…","contextId":"c41a…",
data:   "artifact":{"artifactId":"art-1","name":"booking-confirmation",
data:     "parts":[{"text":"Hotel Centro, Lisbon · 12–14 May · 2 nights · €240"}]}}}}`),
    w('sse', r`
data: {"jsonrpc":"2.0","id":2,"result":{"statusUpdate":{
data:   "taskId":"7f3c…","contextId":"c41a…",
data:   "status":{"state":"TASK_STATE_COMPLETED"}}}}

// completed is a final state: the stream closes`),
    w('http', r`
${A2A_POST}

{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "GetTask",
  "params": { "id": "7f3c…", "historyLength": 10 }
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "id": "7f3c…",
    "contextId": "c41a…",
    "status": { "state": "TASK_STATE_COMPLETED" },
    "artifacts": [
      {
        "artifactId": "art-1",
        "name": "booking-confirmation",
        "parts": [
          { "text": "Hotel Centro, Lisbon · 12–14 May · 2 nights · €240" }
        ]
      }
    ],
    "history": [
      // the messages of this task, newest last (5 here)
    ]
  }
}`),
  ],
};

const LLM_TOOL = r`"tools": [
    {
      "name": "get_weather",
      "description": "Get the current weather for a city",
      "input_schema": {
        "type": "object",
        "properties": { "city": { "type": "string" } },
        "required": ["city"]
      }
    }
  ]`;

const llmApi: Example = {
  app: 'Your chat app',
  scene: [
    { at: 0, role: 'user', text: 'What’s the weather in Athens?' },
    { at: 3, role: 'tool', text: 'get_weather   city: "Athens"' },
    { at: 7, role: 'result', text: '{"temp_c": 24, "sky": "sunny"}' },
    { at: 9, role: 'assistant', text: 'It’s 24 °C and sunny in Athens.' },
  ],
  wire: [
    w('http', r`
POST /chat HTTP/1.1
Host: app.example
Content-Type: application/json

{ "message": "What’s the weather in Athens?" }`),
    w('http', r`
// The API key is a secret: it lives on your server, never in the browser.
// (Message shape of the Claude Messages API. Each provider adds its own
// headers, for example an API version header.)
POST /v1/messages HTTP/1.1
Host: api.llm.example
x-api-key: ••••••••
Content-Type: application/json

{
  "model": "example-model",
  "max_tokens": 1024,
  "stream": true,
  ${LLM_TOOL},
  "messages": [
    { "role": "user", "content": "What’s the weather in Athens?" }
  ]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: text/event-stream

event: message_start
data: {"type":"message_start","message":{"id":"msg_01","role":"assistant","content":[],"stop_reason":null}}`),
    w('sse', r`
event: content_block_start
data: {"type":"content_block_start","index":0,"content_block":{"type":"tool_use","id":"toolu_01","name":"get_weather","input":{}}}`),
    w('sse', r`
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"{\"city\": \"Ath"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"input_json_delta","partial_json":"ens\"}"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}`),
    w('sse', r`
event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"tool_use"},"usage":{"output_tokens":34}}

event: message_stop
data: {"type":"message_stop"}`),
    w('text', r`
// Your own code, on your own server. No network involved.
result = get_weather(city="Athens")`),
    w('json', r`
{ "temp_c": 24, "sky": "sunny" }`),
    w('http', r`
POST /v1/messages HTTP/1.1
Host: api.llm.example
x-api-key: ••••••••
Content-Type: application/json

{
  "model": "example-model",
  "max_tokens": 1024,
  "stream": true,
  // "tools": the same list as before
  "messages": [
    { "role": "user", "content": "What’s the weather in Athens?" },
    { "role": "assistant", "content": [
        { "type": "tool_use", "id": "toolu_01", "name": "get_weather",
          "input": { "city": "Athens" } }
    ] },
    { "role": "user", "content": [
        { "type": "tool_result", "tool_use_id": "toolu_01",
          "content": "{\"temp_c\": 24, \"sky\": \"sunny\"}" }
    ] }
  ]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: text/event-stream

// message_start and content_block_start (type "text") come first, then:
event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"It’s 24 °C"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" and sunny"}}

event: content_block_delta
data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":" in Athens."}}`),
    w('sse', r`
event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"},"usage":{"output_tokens":14}}

event: message_stop
data: {"type":"message_stop"}`),
    w('http', r`
// Your app's own stream to the browser (any format you like):
HTTP/1.1 200 OK
Content-Type: text/event-stream

data: It’s 24 °C

data:  and sunny

data:  in Athens.`),
  ],
};

const rag: Example = {
  app: 'Company handbook assistant',
  scene: [
    { at: 0, role: 'status', text: 'Admin uploads handbook.pdf · indexing… 312 chunks' },
    { at: 3, role: 'status', text: 'Index ready. (Days later…)' },
    { at: 4, role: 'user', text: 'How many vacation days do new employees get?' },
    { at: 8, role: 'status', text: 'Found 4 passages: p.12 · p.13 · p.40 · p.3' },
    { at: 10, role: 'assistant', text: 'New employees get 25 vacation days per year.' },
    { at: 11, role: 'result', text: 'Source: handbook.pdf, page 12' },
  ],
  wire: [
    w('text', r`
// handbook.pdf is cut into 312 chunks. This is chunk 87 (page 12):
"4.2 Annual leave. New employees receive 25 vacation days per
year, counted from their first working day. Leave must be
requested at least two weeks ahead…"`),
    w('http', r`
POST /v1/embeddings HTTP/1.1
Host: embed.example
Content-Type: application/json

{
  "model": "example-embedding-model",
  "input": [
    "Welcome to the company. This handbook applies to…",
    "…",
    "4.2 Annual leave. New employees receive 25 vacation days…"
    // 312 texts in total
  ]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    { "index": 0,  "embedding": [0.0213, -0.0457, 0.0132, …] },
    { "index": 86, "embedding": [0.0191, -0.0312, 0.0544, …] }
    // 312 vectors, 1024 numbers each (values are illustrative)
  ]
}`),
    w('json', r`
// Every vector database has its own API. A typical "upsert":
{
  "index": "handbook",
  "vectors": [
    {
      "id": "handbook-87",
      "values": [0.0191, -0.0312, 0.0544, …],
      "metadata": {
        "page": 12,
        "section": "4.2 Annual leave",
        "text": "New employees receive 25 vacation days per year…"
      }
    }
    // + 311 more
  ]
}`),
    w('http', r`
POST /ask HTTP/1.1
Host: handbook.example
Content-Type: application/json

{ "question": "How many vacation days do new employees get?" }`),
    w('http', r`
POST /v1/embeddings HTTP/1.1
Host: embed.example
Content-Type: application/json

{
  "model": "example-embedding-model",
  "input": ["How many vacation days do new employees get?"]
}`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "data": [
    { "index": 0, "embedding": [0.0187, -0.0298, 0.0561, …] }
  ]
}
// Compare with chunk 87: [0.0191, -0.0312, 0.0544, …] — very close.`),
    w('json', r`
{
  "index": "handbook",
  "vector": [0.0187, -0.0298, 0.0561, …],
  "top_k": 4,
  "metric": "cosine"
}`),
    w('json', r`
{
  "matches": [
    { "id": "handbook-87",  "score": 0.89, "metadata": { "page": 12,
      "text": "New employees receive 25 vacation days per year…" } },
    { "id": "handbook-91",  "score": 0.84, "metadata": { "page": 13,
      "text": "Unused vacation days can be carried over until…" } },
    { "id": "handbook-240", "score": 0.71, "metadata": { "page": 40,
      "text": "Part-time employees receive vacation days in…" } },
    { "id": "handbook-9",   "score": 0.66, "metadata": { "page": 3,
      "text": "This handbook applies to all employees…" } }
  ]
}`),
    w('text', r`
// The prompt the app builds. This is the "augmented" in RAG:
Answer the question using only the context below.
Say which page you used. If the answer is not there, say so.

Context:
[p.12] New employees receive 25 vacation days per year…
[p.13] Unused vacation days can be carried over until…
[p.40] Part-time employees receive vacation days in…
[p.3]  This handbook applies to all employees…

Question: How many vacation days do new employees get?`),
    w('text', r`
New employees get 25 vacation days per year [handbook p.12].`),
    w('http', r`
HTTP/1.1 200 OK
Content-Type: application/json

{
  "answer": "New employees get 25 vacation days per year.",
  "sources": [
    { "file": "handbook.pdf", "page": 12 }
  ]
}`),
  ],
};

const AGENT_TOOLS = r`"tools": [
    { "name": "run_tests",  "description": "Run the test suite",
      "input_schema": { "type": "object", "properties": {} } },
    { "name": "read_file",  "description": "Read a file",
      "input_schema": { "type": "object",
        "properties": { "path": { "type": "string" } } } },
    { "name": "edit_file",  "description": "Replace text in a file",
      "input_schema": { "type": "object",
        "properties": { "path": { "type": "string" },
          "old_text": { "type": "string" }, "new_text": { "type": "string" } } } }
  ]`;

const agentReq = (count: number, added: string) => w('json', r`
// POST /v1/messages — system prompt and tools as before.
// The conversation is now ${count} messages long. New at the end:
{
  "messages": [
    // …messages 1–${count - 1}: unchanged, sent again…
    { "role": "user", "content": [
        { "type": "tool_result", "tool_use_id": ${added} }
    ] }
  ]
}`);

const agentLoop: Example = {
  app: 'Coding agent — terminal',
  scene: [
    { at: 0, role: 'user', text: 'Fix the failing test in calc.py' },
    { at: 2, role: 'tool', text: 'run_tests' },
    { at: 4, role: 'result', text: '1 failed: test_divide_by_zero' },
    { at: 6, role: 'tool', text: 'read_file   calc.py' },
    { at: 8, role: 'result', text: '2 lines read' },
    { at: 10, role: 'tool', text: 'edit_file   calc.py  (+2 lines)' },
    { at: 12, role: 'result', text: 'calc.py saved' },
    { at: 14, role: 'tool', text: 'run_tests' },
    { at: 16, role: 'result', text: '5 passed' },
    { at: 18, role: 'assistant', text: 'Fixed: divide() now raises ValueError for b = 0.' },
  ],
  wire: [
    w('text', r`
$ agent "Fix the failing test in calc.py"`),
    w('http', r`
POST /v1/messages HTTP/1.1
Host: api.llm.example
x-api-key: ••••••••
Content-Type: application/json

{
  "model": "example-model",
  "max_tokens": 4096,
  "system": "You are a coding agent. Use the tools to reach the goal. When you are done, say what you changed.",
  ${AGENT_TOOLS},
  "messages": [
    { "role": "user", "content": "Fix the failing test in calc.py" }
  ]
}`),
    w('json', r`
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "I'll run the tests first to see what fails." },
    { "type": "tool_use", "id": "toolu_01", "name": "run_tests", "input": {} }
  ],
  "stop_reason": "tool_use"
}`),
    w('text', r`
$ python -m pytest -q`),
    w('text', r`
....F                                              [100%]
FAILED test_calc.py::test_divide_by_zero
    def test_divide_by_zero():
        with pytest.raises(ValueError):
>           divide(1, 0)
calc.py:2: ZeroDivisionError: division by zero
1 failed, 4 passed in 0.12s`),
    agentReq(3, r`"toolu_01",
          "content": "....F\nFAILED test_calc.py::test_divide_by_zero\n…ZeroDivisionError…"`),
    w('json', r`
{
  "role": "assistant",
  "content": [
    { "type": "tool_use", "id": "toolu_02", "name": "read_file",
      "input": { "path": "calc.py" } }
  ],
  "stop_reason": "tool_use"
}`),
    w('text', r`
// the harness, in its own code:
open("calc.py").read()`),
    w('text', r`
def divide(a, b):
    return a / b`),
    agentReq(5, r`"toolu_02",
          "content": "def divide(a, b):\n    return a / b\n"`),
    w('json', r`
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "divide() does not handle b = 0. The test expects ValueError." },
    { "type": "tool_use", "id": "toolu_03", "name": "edit_file",
      "input": {
        "path": "calc.py",
        "old_text": "    return a / b",
        "new_text": "    if b == 0:\n        raise ValueError(\"division by zero\")\n    return a / b"
      } }
  ],
  "stop_reason": "tool_use"
}`),
    w('text', r`
--- calc.py
+++ calc.py
 def divide(a, b):
+    if b == 0:
+        raise ValueError("division by zero")
     return a / b`),
    w('text', r`
ok: calc.py saved`),
    agentReq(7, r`"toolu_03",
          "content": "ok: calc.py saved"`),
    w('json', r`
{
  "role": "assistant",
  "content": [
    { "type": "tool_use", "id": "toolu_04", "name": "run_tests", "input": {} }
  ],
  "stop_reason": "tool_use"
}`),
    w('text', r`
$ python -m pytest -q`),
    w('text', r`
.....                                              [100%]
5 passed in 0.11s`),
    agentReq(9, r`"toolu_04",
          "content": ".....\n5 passed in 0.11s"`),
    w('json', r`
{
  "role": "assistant",
  "content": [
    { "type": "text", "text": "Fixed: divide() now raises ValueError for b = 0." }
  ],
  "stop_reason": "end_turn"
}
// No tool_use block, stop_reason "end_turn": the loop ends.`),
    w('text', r`
Fixed: divide() now raises ValueError for b = 0.

Done: 1 file changed, 5 tests pass`),
  ],
};

const multiAgent: Example = {
  app: 'Trip planner — lead agent with three subagents',
  scene: [
    { at: 0, role: 'user', text: 'Plan a 3-day class trip to Athens: 20 students, budget €6,000' },
    { at: 1, role: 'status', text: 'Plan: 3 subtasks → transport · lodging · programme' },
    { at: 4, role: 'result', text: 'programme ✓  €1,450' },
    { at: 5, role: 'result', text: 'transport ✓  €1,900' },
    { at: 6, role: 'result', text: 'lodging ✗  €2,900 — over the limit' },
    { at: 7, role: 'status', text: 'Total €6,250 > €6,000 → lodging goes back' },
    { at: 8, role: 'result', text: 'lodging ✓  €2,350' },
    { at: 9, role: 'assistant', text: 'Your trip plan: coach €1,900 + hostel €2,350 + programme €1,450 = €5,700. That is €300 under budget.' },
  ],
  wire: [
    w('text', r`
Plan a 3-day class trip to Athens: 20 students, budget €6,000`),
    w('text', r`
// Brief written by the orchestrator. This is ALL the subagent knows.
You are the transport subagent.
Task: return travel to Athens for 22 people (20 students, 2 teachers).
Limit: €2,000 in total.
Reply with: price, departure and return times. Nothing else.`),
    w('text', r`
You are the lodging subagent.
Task: 2 nights for 22 people, close to the centre of Athens.
Limit: €2,400 in total.
Reply with: price, address, number of rooms. Nothing else.`),
    w('text', r`
You are the programme subagent.
Task: a programme for 3 days for a school class in Athens.
Limit: €1,600 for entry fees.
Reply with: a day-by-day list and the total price.`),
    w('text', r`
// The subagent searched and compared for 39 seconds. Only this comes back:
Day 1: Acropolis and Acropolis Museum
Day 2: National Archaeological Museum, Plaka walk
Day 3: Ancient Agora, free time
Total entry fees: €1,450`),
    w('text', r`
Coach, 22 seats or more. Out 08:00, back 17:00 on day 3.
Total: €1,900`),
    w('text', r`
Hostel near Monastiraki, 6 rooms, 2 nights.
Total: €2,900 — this is €500 over the limit. No cheaper option
with 6 rooms was found.`),
    w('text', r`
// The orchestrator's own check: 1,900 + 2,900 + 1,450 = 6,250 > 6,000
Your result is over the limit and the whole trip is €250 over budget.
Find lodging for €2,400 or less. Fewer, larger rooms are fine.`),
    w('text', r`
Hostel near Monastiraki, 5 larger rooms, 2 nights.
Total: €2,350`),
    w('text', r`
Class trip to Athens — 3 days, 20 students + 2 teachers

Transport   Coach, out 08:00 / back 17:00        €1,900
Lodging     Hostel near Monastiraki, 5 rooms     €2,350
Programme   Acropolis, museums, Plaka, Agora     €1,450
                                          Total  €5,700
                                          Budget €6,000  ✓`),
  ],
};

const LOGITS = r`
// One score (logit) for EVERY token in the vocabulary. The top ones:`;

const llmInside: Example = {
  app: 'Text being generated, one token at a time',
  scene: [
    { at: 0, role: 'user', text: 'The capital of Greece is' },
    { at: 3, role: 'status', text: 'Predicting the next token…' },
    { at: 4, role: 'assistant', text: ' Athens' },
    { at: 6, role: 'status', text: 'Predicting the next token…' },
    { at: 7, role: 'assistant', text: ' Athens.', replace: true },
    { at: 9, role: 'status', text: 'Predicting the next token…' },
    { at: 10, role: 'status', text: 'End token → stop. 2 tokens generated in 3 passes.' },
  ],
  wire: [
    w('text', r`
The capital of Greece is`),
    w('text', r`
text   │ The │  capital │  of │  Greece │  is
id     │ 464 │   3139   │ 286 │  10315  │ 318

// Ids are illustrative: every model has its own vocabulary.
// Common words are one token; rare words are split into pieces.`),
    w('text', r`
// One row per token. Real models use thousands of numbers per row.
The      [  0.12, -0.48,  0.33,  0.05, … ]
 capital [ -0.27,  0.61,  0.09, -0.14, … ]
 of      [  0.02,  0.11, -0.39,  0.27, … ]
 Greece  [  0.55, -0.08,  0.21, -0.62, … ]
 is      [ -0.16,  0.30,  0.07,  0.44, … ]`),
    w('text', r`${LOGITS}
" Athens"    17.9
" the"       14.5
" a"         13.4
" located"   12.8
…            (tens of thousands more)`),
    w('text', r`
// softmax turns the scores into probabilities that add up to 100%
" Athens"    92%  ██████████████████▍
" the"        3%  ▌
" a"          1%  ▏
" located"  0.6%  ▏
…

→ drawn: " Athens"`),
    w('text', r`
// The same 5 rows as before, plus one new row at the end:
 is      [ -0.16,  0.30,  0.07,  0.44, … ]
 Athens  [  0.48, -0.11,  0.26, -0.57, … ]`),
    w('text', r`${LOGITS}
"."          16.2
","          14.0
" and"       13.1
…            (tens of thousands more)`),
    w('text', r`
"."          81%  ████████████████▏
","           9%  █▊
" and"        4%  ▊
…

→ drawn: "."`),
    w('text', r`
// 7 rows now: The · capital · of · Greece · is · Athens · .
 Athens  [  0.48, -0.11,  0.26, -0.57, … ]
.        [ -0.03,  0.19, -0.22,  0.08, … ]`),
    w('text', r`${LOGITS}
<end of sequence>   18.4
" It"               14.6
" Athens"           12.9
…                   (tens of thousands more)`),
    w('text', r`
<end of sequence>   96%  ███████████████████▏
" It"                2%  ▍
…

→ drawn: <end of sequence>   → stop

Output:  The capital of Greece is Athens.`),
  ],
};

export const AI_EXAMPLES: Record<string, Example> = {
  mcp,
  a2a,
  'llm-api': llmApi,
  rag,
  'agent-loop': agentLoop,
  'multi-agent': multiAgent,
  'llm-inside': llmInside,
};
