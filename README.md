# ArbiPilot

ArbiPilot is an Arbitrum-native Explain-Then-Execute agent: the LLM only parses intent, while deterministic allowlisted code prepares and executes swap transactions.

## One-Line Pitch

Natural-language swap planning with strict validation, human-readable risk preview, and deterministic execution on Arbitrum Sepolia.

## Why This Matters

Most wallet agents hide execution logic behind model output. ArbiPilot makes the boundary explicit:

- LLM: parse user intent only.
- Code: validate, quote, build calldata, and execute from fixed allowlists.

## Supported Scope

- Action: `swap`
- Recognized but rejected: `bridge`
- Chain: `arbitrum-sepolia` (`421614`)
- Tokens: `USDC`, `WETH` (`ETH` prompt alias normalizes to `WETH`)

## Supported User Flow

1. User connects wallet.
2. User enters a prompt (example: `swap 10 USDC to ETH on Arbitrum with safe slippage`).
3. `POST /api/agent/plan` parses + validates intent and returns explain/risk/preview.
4. User approves execution.
5. `POST /api/agent/execute` returns deterministic tx requests.
6. UI sends optional ERC-20 approval tx, then swap tx.
7. UI shows tx hashes and explorer links.
8. Registry section provides Agent0 SDK registration runbook and tx hash resolver.

## Architecture

### Trust Boundary

- Server-only planner call (`ATXP` OpenAI-compatible API): natural-language to strict JSON intent.
- No model-driven addresses, targets, or calldata.
- All onchain execution is deterministic and allowlisted in code.

### Key Modules

- Planner: `src/lib/agent/atxp-client.ts`, `src/lib/agent/planner.ts`
- Validation + schemas: `src/lib/agent/schema.ts`, `src/lib/agent/validator.ts`
- Chain config + allowlists: `src/lib/config/chains.ts`, `src/lib/config/allowlist.ts`
- Quote + execution: `src/lib/protocols/swap-quote.ts`, `src/lib/protocols/swap-execute.ts`
- Risk + explain: `src/lib/risk/risk-engine.ts`, `src/lib/risk/explain.ts`
- Registry path: `src/lib/registry/register-agent.ts`, `scripts/register-agent.mjs`

## Real vs Mocked

### Real (testnet-real)

- ATXP server-side planner integration.
- Camelot Sepolia contract-backed quote via Quoter.
- Camelot Sepolia router calldata generation (`exactInputSingle`) with deterministic allowlisted targets.
- Optional approval tx generation based on live allowance check.
- Wallet-signed execution path on Arbitrum Sepolia.
- Agent0 SDK registration script path for registry tx hash generation.

### Still Simplified (explicit)

- `priceImpactBps` is currently returned as `0` (no pool-depth impact model yet).
- Registry registration is script-driven, not one-click browser execution.

### Blocked

- No hard technical blocker remains in code.
- Operationally, you still need valid credentials/rpc/key and a real registry address to submit a real registration tx.

## API Routes

- `GET /api/health`
- `POST /api/agent/plan`
- `POST /api/agent/execute`
- `POST /api/registry/register`

## Environment Variables

| Name | Required | Visibility | Purpose |
|---|---|---|---|
| `ATXP_API_KEY` | Yes | Server | ATXP auth key |
| `OPENAI_BASE_URL` | Yes | Server | OpenAI-compatible endpoint (`https://llm.atxp.ai/v1`) |
| `OPENAI_MODEL` | Yes | Server | Planner model id |
| `ARBITRUM_SEPOLIA_RPC_URL` | Yes | Server | RPC for quote/balance/allowance and registry script |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | Yes | Public | WalletConnect configuration |
| `REGISTRY_CONTRACT_ADDRESS` | Yes | Server | Identity registry address for Agent0 `registryOverrides` |
| `REGISTRY_EXPLORER_BASE_URL` | Yes | Server | Explorer base URL |
| `NEXT_PUBLIC_APP_URL` | Yes | Public | App canonical URL |
| `ARBITRUM_SEPOLIA_USDC_ADDRESS` | Optional | Server | Override USDC allowlist address |
| `ARBITRUM_SEPOLIA_WETH_ADDRESS` | Optional | Server | Override WETH allowlist address |
| `CAMELOT_SEPOLIA_SWAP_ROUTER_ADDRESS` | Optional | Server | Override Camelot router |
| `CAMELOT_SEPOLIA_QUOTER_ADDRESS` | Optional | Server | Override Camelot quoter |
| `REGISTRY_SIGNER_PRIVATE_KEY` | Optional (required for registration execution) | Server | Private key used by `register:agent` script |

## Local Setup

```bash
npm install
cp .env.example .env.local
npm run check
npm run dev
```

Open `http://localhost:3000`.

## ATXP Runtime Setup

- Configure `ATXP_API_KEY`, `OPENAI_BASE_URL`, `OPENAI_MODEL` in `.env.local`.
- Planner endpoint (`POST /api/agent/plan`) calls ATXP server-side only.
- Secrets are never exposed to browser code.

## Arbitrum Sepolia + Camelot Integration

Configured defaults:

- Chain ID: `421614`
- Router: `0x171B925C51565F5D2a7d8C494ba3188D304EFD93`
- Quoter: `0xe49ef2F48539EA7498605CC1B3a242042cb5FC83`
- WETH: `0x980B62Da83eFf3D4576C647993b0c1D7faf17c73`
- USDC: `0xb893E3334D4Bd6C5ba8277Fd559e99Ed683A9FC7`

All are allowlisted and can be overridden only via env.

## Registry Integration (Agent0 SDK)

### Why this path is safe

- Uses official `agent0-sdk` registration methods.
- Does not manually guess ABI/function signatures.
- Injects Arbitrum Sepolia identity registry through `registryOverrides`.

### Run registration and get tx hash

```bash
npm run register:agent -- --name "ArbiPilot" --description "Explain-Then-Execute swap agent on Arbitrum Sepolia"
```

Script output includes:

- tx hash
- explorer link
- agent id (when available)
- agent URI (when available)

### Resolve an existing tx hash in app API

```bash
curl -X POST http://localhost:3000/api/registry/register \
  -H "Content-Type: application/json" \
  -d '{"txHash":"0xYOUR_TX_HASH"}'
```

## Demo Runbook (60-90 seconds)

1. Connect wallet on Arbitrum Sepolia.
2. Enter: `swap 10 USDC to ETH on Arbitrum with safe slippage`.
3. Click `Generate Plan` and show Intent, Execution Plan, Risk, Explain.
4. Click `Approve (if needed) & Execute Swap`.
5. Confirm approval tx if prompted, then confirm swap tx.
6. Show explorer links for approval/swap.
7. Open Registry Path card and show Agent0 SDK command + readiness.

## Deploy Publicly

### Vercel

1. Import repo.
2. Set Node `22.x`.
3. Add all env vars from table.
4. Deploy.
5. Verify `GET /api/health`.

### Any Node Host

1. `npm install`
2. `npm run build`
3. `npm run start`
4. Configure env vars + HTTPS.

## Limitations

- Single action (`swap`) and single chain (`arbitrum-sepolia`).
- Single pair family (`USDC`/`WETH`).
- No route optimization across multiple DEXes.
- No persistent database/auth/multi-agent/autonomous loop features.

## Future Improvements

- Add deterministic multi-hop/path selection within allowlisted pools.
- Add deterministic price impact estimation from pool state.
- Add guarded server-side registry execution with explicit operator auth.
- Add richer swap simulation previews before wallet signing.

## What I Still Need To Fill In Before Submit

Only if not already done in your environment:

1. Set real `ATXP_API_KEY` and `OPENAI_MODEL`.
2. Set real `ARBITRUM_SEPOLIA_RPC_URL`.
3. Set bounty-provided `REGISTRY_CONTRACT_ADDRESS`.
4. Set `REGISTRY_SIGNER_PRIVATE_KEY` and run `npm run register:agent` to produce a real registration tx hash.

## Submission Checklist

- [x] One-page Explain-Then-Execute UI
- [x] Wallet connect + Arbitrum Sepolia execution flow
- [x] Server-only ATXP planner integration
- [x] Strict zod validation for plan/execute/registry payloads
- [x] Deterministic allowlisted swap quote + execution path
- [x] Optional approval + swap two-step tx flow
- [x] Health endpoint with readiness signals
- [x] Agent0 SDK-based registry registration path
- [x] `.env.example` fully documented
- [x] `npm run check` script available for pre-submit verification
