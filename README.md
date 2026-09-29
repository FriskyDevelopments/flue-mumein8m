# Flue agents on Render

A [Render](https://render.com) template for hosting [Flue](https://www.flueframework.com/) agents as webhook endpoints. Each TypeScript file in .flue/agents/ becomes a POST /agents/<name>/<id> route on a single Node.js web service, with built-in streaming, structured outputs, and session continuity.
This template ships two webhook-triggered agents, a single `render.yaml` Blueprint, and the Node.js build target so the entire stack deploys as one Render web service.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy-template/api/github/start?template_repo=flue)

## What's included

| Component | Description |
| --- | --- |
| **Translate agent** | Translates text between languages and returns a typed result (translation + confidence) using a [valibot](https://valibot.dev/) schema. |
| **Assistant agent** | A general-purpose conversational agent. Continues the same conversation when you reuse the agent ID in the request URL. |
| **Bundled HTTP server** | `flue build --target node` produces a single self-contained `dist/server.mjs` that exposes every webhook agent as `POST /agents/<name>/<id>`. |
| **One-click deploy** | A `render.yaml` Blueprint that provisions the web service with the right build, start, and health check settings. |

## Project structure

```text
.
├── .flue/
│   └── agents/
│       ├── translate.ts      # Webhook agent — structured translation
│       └── assistant.ts      # Webhook agent — conversational replies
├── AGENTS.md                 # Default system prompt for every agent
├── .env.example              # Provider keys for local development
├── package.json
├── render.yaml               # Render Blueprint (web service)
└── tsconfig.json
```

Flue discovers agents from `.flue/agents/`. Each file exports a default async handler and a `triggers` object — `{ webhook: true }` exposes the agent over HTTP. See the [Flue README](https://github.com/withastro/flue#readme) for the full agent API.

## Deploy to Render

1. Click the **Deploy to Render** button above (or use [this link](https://dashboard.render.com/blueprint/new?repo=https://github.com/render-examples/flue)).
2. Set the `ANTHROPIC_API_KEY` environment variable to your [Anthropic API key](https://console.anthropic.com/).
3. Click **Apply** to create the web service.

Render runs `npm ci --include=dev && npm run build` (which calls `flue build --target node`), then starts the bundled server with `node dist/server.mjs`. The `--include=dev` flag is needed because `@flue/cli` is a build-time dependency and `NODE_ENV=production` would otherwise skip it. Render injects `PORT` and Flue's Hono server binds to it automatically. The `/health` endpoint backs the health check.

> **Note:** This Blueprint uses Render's `free` plan, which spins down after 15 minutes of inactivity. For production traffic, change `plan: free` to `plan: starter` (or higher) in `render.yaml` before deploying.

> **Important:** Webhook agents in this template are **unauthenticated**. Anyone who finds your service URL can invoke the agents and incur LLM provider costs on your account. Flue does not ship built-in auth, and its handler context does not expose request headers. Before you point real traffic at this service, do at least one of the following:
>
> - Add an in-payload shared-secret check inside each agent (read a token from `payload` and compare against an env var set with `generateValue: true`).
> - Front the service with an authenticated reverse proxy or API gateway.
> - Move the Flue service to a Render private service and gate access with another web service that handles auth.
>
> A follow-up template that pairs Flue with a `pserv` and a small auth front door is on the roadmap.

## Deploy to Deno Deploy

The Node build output runs unchanged on Deno 2.

| Setting | Value |
| --- | --- |
| Install command | `npm ci --include=dev` |
| Build command | `npm run build` |
| Entrypoint | `dist/server.mjs` |
| Env vars | `ANTHROPIC_API_KEY`, `FLUE_SECRET`, optional `MODEL_ID` |

Local check: `npm run build && deno run -A dist/server.mjs`, then `curl localhost:3583/health`.

## Choosing the model / your own LLM gateway

Set `MODEL_ID` to any `provider/model-id` Flue knows (Anthropic, OpenAI, DeepSeek, OpenRouter, Groq, xAI, Mistral, Kimi, Fireworks, Cloudflare Workers AI, …) plus that provider's key, e.g. `MODEL_ID=deepseek/deepseek-v4-pro` + `DEEPSEEK_API_KEY`.

To send everything through your own gateway instead, also set:

| Env | Meaning |
| --- | --- |
| `LLM_BASE_URL` | Gateway base URL, e.g. `https://llm.example.com/v1` |
| `LLM_API_KEY` | Key sent to the gateway as `Authorization: Bearer …` |

The gateway receives the provider's native API (for `deepseek/*` and most OpenAI-style providers: streaming `POST <base>/chat/completions`) with the model id from `MODEL_ID`, so map that id to whatever backend you meter.

## Auth

Every agent requires the JSON body to include `"secret"` matching the `FLUE_SECRET` env var. Requests without it, with the wrong value, or when `FLUE_SECRET` is unset are rejected before the model is called (generic 500, no details). Flue's handler context does not expose headers, so the secret travels in the payload.

```bash
curl -X POST https://<host>/agents/translate/demo \
  -H 'content-type: application/json' \
  -d '{"secret":"<FLUE_SECRET>","text":"Hello","language":"Spanish"}'
```

## Run locally

### Prerequisites

- [Node.js](https://nodejs.org/) 22 or later
- An [Anthropic API key](https://console.anthropic.com/)

### Install and configure

```bash
git clone https://github.com/render-examples/flue.git
cd flue
npm install
cp .env.example .env
```

Edit `.env` and set your `ANTHROPIC_API_KEY`:

```bash
ANTHROPIC_API_KEY=sk-ant-...
```

### Start the dev server

```bash
npm run dev
```

Flue's dev server starts at `http://localhost:3583` and rebuilds on file changes. Edit an agent under `.flue/agents/`, save, and the next request picks up your change.

## API usage

Every webhook agent is exposed at `POST /agents/<agent-name>/<id>`. The `<id>` is the session ID — reuse it to continue a conversation, or generate a new one to start fresh.

### Translate agent

```bash
curl -X POST http://localhost:3583/agents/translate/demo \
  -H "Content-Type: application/json" \
  -d '{"text": "Hello world", "language": "French"}'
```

The response includes the typed result that matches the agent's [valibot](https://valibot.dev/) schema:

```json
{
  "result": {
    "translation": "Bonjour le monde",
    "confidence": "high"
  }
}
```

### Assistant agent

```bash
curl -X POST http://localhost:3583/agents/assistant/session-abc \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the capital of Japan?"}'
```

Send another request to the same `session-abc` ID to continue the same thread:

```bash
curl -X POST http://localhost:3583/agents/assistant/session-abc \
  -H "Content-Type: application/json" \
  -d '{"message": "And how many people live there?"}'
```

Use a different ID (`session-xyz`, `user-42`, a UUID — whatever makes sense for your app) to start a separate conversation.

### Streaming responses

Pass `Accept: text/event-stream` to receive Server-Sent Events with progress updates as the agent runs:

```bash
curl -N -X POST http://localhost:3583/agents/assistant/demo \
  -H "Content-Type: application/json" \
  -H "Accept: text/event-stream" \
  -d '{"message": "Plan a 3-day trip to Tokyo."}'
```

### Fire-and-forget mode

Pass `X-Webhook: true` to receive an immediate `202 Accepted` response. The agent runs in the background:

```bash
curl -X POST http://localhost:3583/agents/assistant/job-1 \
  -H "Content-Type: application/json" \
  -H "X-Webhook: true" \
  -d '{"message": "Summarize this week's GitHub issues."}'
```

## Configuration

### Switch the model

Both agents read the default model from the `MODEL_ID` environment variable (provider/model-id format). Override it on your Render service or in your local `.env`:

| Provider | Example `MODEL_ID` | Required key |
| --- | --- | --- |
| Anthropic (default) | `anthropic/claude-sonnet-4-6` | `ANTHROPIC_API_KEY` |
| OpenAI | `openai/gpt-5.5` | `OPENAI_API_KEY` |
| OpenRouter | `openrouter/moonshotai/kimi-k2.6` | `OPENROUTER_API_KEY` |

Each agent calls `init({ model: env.MODEL_ID ?? 'anthropic/claude-sonnet-4-6' })`, so the env var wins and the hardcoded default keeps the agent runnable if the var is unset. To override the model for a single call (without changing the agent default), pass `{ model: '...' }` directly to `session.prompt()` or `session.skill()`.

### Add an agent

Drop a new file into `.flue/agents/` with a default export and a `triggers` definition:

```ts
// .flue/agents/summarize.ts
import type { FlueContext } from '@flue/sdk/client';
import * as v from 'valibot';

export const triggers = { webhook: true };

export default async function ({ init, payload }: FlueContext) {
  const agent = await init({ model: 'anthropic/claude-sonnet-4-6' });
  const session = await agent.session();
  return await session.prompt(`Summarize in one sentence:\n\n${payload.text}`);
}
```

Redeploy and the agent is reachable at `POST /agents/summarize/<id>`.

### Customize the system prompt

`AGENTS.md` at the repo root is the default system prompt for every agent. Edit it to set tone, response style, or guardrails that apply across the project. For per-agent overrides, define a role under `.flue/roles/<role>.md` and pass `{ role: '<role>' }` to `session.prompt()`.

### Add tools, skills, or sandboxes

Flue supports custom tool definitions, markdown-defined skills under `.agents/skills/`, MCP servers via `connectMcpServer()`, and full container sandboxes through connectors like Daytona. See the [Flue README](https://github.com/withastro/flue#readme) for examples.

## How the deploy works

| Step | What happens |
| --- | --- |
| **Build** | `npm ci --include=dev && npm run build` installs dependencies (including `@flue/cli` from `devDependencies`) and runs `flue build --target node`, which discovers agents in `.flue/agents/` and emits a single bundled `dist/server.mjs` plus a `dist/manifest.json`. |
| **Start** | `node dist/server.mjs` starts a [Hono](https://hono.dev/) HTTP server. It registers `/health`, `/agents` (manifest), and `/agents/:name/:id` for every webhook agent. |
| **Port** | The server reads `process.env.PORT` (Render injects this) and binds to all interfaces. |
| **Shutdown** | The server handles `SIGTERM` and `SIGINT` for clean rollouts during Render deploys. |

## Limits

- **No authentication.** Webhook endpoints are publicly invokable. See the **Deploy to Render** section for mitigation options.
- Flue's Node.js target stores session message history in memory. Sessions reset on every restart or deploy. For durable sessions, use the Cloudflare target (Durable Objects) or supply a custom session store.
- `dist/` is rebuilt on every deploy; nothing in `dist/` should be committed to git.
- The `free` plan in `render.yaml` is fine for trying the template but not for production traffic. Upgrade the plan or set up [autoscaling](https://render.com/docs/scaling) for sustained workloads.

## Learn more

- [Flue framework](https://www.flueframework.com/)
- [Flue on GitHub](https://github.com/withastro/flue)
- [Render web services](https://render.com/docs/web-services)
- [Render Blueprints](https://render.com/docs/blueprint-spec)
- [valibot schema validation](https://valibot.dev/)
