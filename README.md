# ShipStake

An onchain commitment device. Stake MON against a goal — "ship this repo by
Friday" — and name a beneficiary. A verifier backend checks your GitHub
activity; check in before the deadline and you reclaim your stake, miss it
and anyone can sweep the stake to your beneficiary.

Personal problem it solves: side projects die from lack of a real deadline.
Money on the line, verified automatically against something you can't fake
(commit history), fixes that.

## How it works

```
1. Connect wallet → create a commitment (stake MON, name a beneficiary,
   set a deadline, describe the goal) → contract locks the funds.
2. Frontend registers the commitment with the backend: which GitHub repo
   to watch.
3. The backend auto-verifies every 60s: it checks the GitHub API for
   commits since the commitment was created, and as soon as it finds one
   it calls checkIn() onchain as the trusted verifier wallet. The "Verify"
   button does the same check on demand (nice for demos) — but you never
   *need* to click it, so a forgotten click can't cost you your stake.
4. Checked in → withdraw your stake back.
   Deadline passed with no check-in → beneficiary (or anyone, on their
   behalf) claims the stake.
```

```
contracts/   Solidity contract (Hardhat) — CommitmentDevice.sol
backend/     FastAPI verifier — checks GitHub, signs checkIn() txs
frontend/    Next.js app — wallet connect, create/verify/claim UI
```

## GitHub connection & private repos

Connecting GitHub is step 1 of creating a commitment: an OAuth flow stores
your token with the verifier and hands your browser a session secret. The
form then shows a searchable dropdown of your repos (private ones included,
marked with a lock) instead of free-text owner/repo fields — no typos, no
staking against the wrong repo. The verifier uses your token to read commit
activity, and repo visibility is validated *before* the stake transaction,
so you can't lock funds against a repo the verifier will never be able to
see. Endpoints that use your token require the session secret, so knowing
someone's GitHub username gets you nothing.

## Known simplifications (say these out loud in the demo, don't hide them)

- The verifier is a single trusted backend wallet, not a decentralized
  oracle. For a 6-day hackathon that's the right tradeoff — a production
  version would swap it for Chainlink Functions (or similar) calling the
  GitHub API directly onchain, removing the need to trust one party's
  attestation.
- Private-repo support uses a classic OAuth app with the coarse `repo`
  scope, and tokens are stored in plaintext SQLite on the verifier. A
  production version would use a GitHub App (read-only, per-repo
  installation) and encrypt tokens at rest.
- `frontend/package.json` pins `qr` to 0.5.5 via `overrides`: qr@0.6.0
  started rejecting `border: 0`, which crashes the WalletConnect QR code
  inside RainbowKit (`cuer` calls it that way — "invalid border=0" in the
  console). Drop the override once cuer/RainbowKit ship a fix.

## Setup

### 1. Contract

```bash
cd contracts
npm install
cp .env.example .env   # fill DEPLOYER_PRIVATE_KEY (get testnet MON: https://testnet.monad.xyz)
```

Generate a throwaway verifier wallet (don't reuse your main wallet):

```bash
node -e "const {Wallet}=require('ethers');const w=Wallet.createRandom();console.log('address:',w.address);console.log('key:',w.privateKey)"
```

Put that address in `.env` as `VERIFIER_ADDRESS`, then:

```bash
npm run deploy:testnet
```

Note the deployed contract address it prints — you'll need it in both
`backend/.env` and `frontend/.env.local`.

### 2. Backend

```bash
cd backend
python -m venv .venv && .venv\Scripts\activate   # (Windows) or source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # CONTRACT_ADDRESS from step 1, VERIFIER_PRIVATE_KEY from the wallet above
uvicorn main:app --reload --port 8000
```

For private-repo support, also create a GitHub OAuth app at
https://github.com/settings/developers (callback URL:
`http://localhost:8000/auth/github/callback`, or your deployed backend URL)
and fill `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` in `backend/.env`.
Without it, everything else still works — the "Connect GitHub" button will
just report that OAuth isn't configured.

Send the verifier wallet a little testnet MON too (from the faucet) — it
pays gas for every `checkIn()` call.

### 3. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local   # contract address + backend URL + a WalletConnect project ID
npm run dev
```

## Hackathon submission checklist

- [ ] Name: ShipStake (or rename — grep/replace is cheap)
- [ ] Description + problem statement: use the two paragraphs at the top of this file
- [ ] Hosted project URL: deploy `frontend/` (Vercel — same flow as the portfolio) + `backend/` (Render/Fly/Railway all have free tiers with a persistent process, which you need since it's not serverless-friendly as-is)
- [ ] Public GitHub repo: push this folder as a new repo
- [ ] Contract address: from `npm run deploy:testnet`, link it on https://testnet.monadexplorer.com
- [ ] Demo video (≤3 min): record the full loop — create commitment → push a commit to a real repo → hit Verify → show the checkIn tx on the explorer → withdraw
- [ ] Social post URL: post the demo video/GIF

## What would make this stand out (if time allows)

- A public leaderboard of "shipped vs. slashed" — feeds the "most viral" prize angle
- Let the beneficiary be a public goods address (a real charity/DAO) as a default option, not just a friend
- Show the countdown + live GitHub activity feed on the commitment's dashboard card, so the demo video has something visually alive to point at
