import asyncio
import logging
from datetime import datetime
from urllib.parse import quote, urlencode

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel

import chain
import storage
from config import FRONTEND_URL
from github_auth import (
    GitHubAuthError,
    build_authorize_url,
    exchange_code,
    oauth_configured,
    token_for_session,
)
from github_check import GitHubCheckError, has_activity_since, list_user_repos, repo_visible

app = FastAPI(title="ShipStake verifier")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten before mainnet; fine for a hackathon demo
    allow_methods=["*"],
    allow_headers=["*"],
)


logging.basicConfig(level=logging.INFO, format="%(levelname)s:     %(name)s - %(message)s")
logger = logging.getLogger("shipstake.autoverify")

AUTO_VERIFY_INTERVAL_SECONDS = 60


@app.on_event("startup")
async def _startup() -> None:
    storage.init_db()
    asyncio.create_task(_auto_verify_loop())


async def _auto_verify_loop() -> None:
    """Losing a stake should require NOT shipping — never a missed button
    click or a briefly-down backend. Sweep all unchecked commitments and
    check in automatically as soon as GitHub shows activity."""
    logger.info("auto-verify loop running every %ss", AUTO_VERIFY_INTERVAL_SECONDS)
    while True:
        try:
            await _auto_verify_sweep()
        except Exception:
            logger.exception("auto-verify sweep failed; retrying next interval")
        await asyncio.sleep(AUTO_VERIFY_INTERVAL_SECONDS)


async def _auto_verify_sweep() -> None:
    for reg in storage.get_unchecked_registrations():
        cid = reg["id"]
        try:
            onchain = await asyncio.to_thread(chain.get_commitment, cid)
            if onchain["status"] != "active":
                # settled some other way (slashed / manually verified elsewhere)
                storage.mark_checked_in(cid)
                continue
            if datetime.utcnow().timestamp() > onchain["deadline"]:
                continue  # too late — nothing the verifier can do anymore
            token = (
                storage.get_github_token(reg["token_login"]) if reg["token_login"] else None
            )
            found = await has_activity_since(
                reg["github_owner"],
                reg["github_repo"],
                datetime.fromisoformat(reg["created_at"]),
                reg["github_author"],
                token,
            )
            if found:
                tx_hash = await asyncio.to_thread(chain.submit_check_in, cid)
                storage.mark_checked_in(cid)
                logger.info("auto-verified commitment %s (tx %s)", cid, tx_hash)
        except Exception:
            logger.exception("auto-verify failed for commitment %s; will retry", cid)


@app.get("/auth/github/status")
def github_status() -> dict:
    """Lets the frontend know whether the Connect GitHub flow is available."""
    return {"configured": oauth_configured()}


@app.get("/auth/github/login")
def github_login() -> RedirectResponse:
    """Kicks off the OAuth web flow. The user lands on GitHub's consent
    screen; GitHub sends them back to /auth/github/callback."""
    if not oauth_configured():
        raise HTTPException(503, "GitHub OAuth isn't configured on this verifier (GITHUB_CLIENT_ID/SECRET)")
    return RedirectResponse(build_authorize_url())


@app.get("/auth/github/callback")
async def github_callback(code: str = "", state: str = "", error: str = "") -> RedirectResponse:
    """GitHub redirects here after consent. Stores the user's token and
    bounces back to the frontend with ?github=<login> (or ?github_error=...)."""
    if error or not code:
        reason = error or "missing code"
        return RedirectResponse(f"{FRONTEND_URL}/?{urlencode({'github_error': reason})}")
    try:
        login, session = await exchange_code(code, state)
    except GitHubAuthError as e:
        return RedirectResponse(f"{FRONTEND_URL}/?{urlencode({'github_error': str(e)})}")
    return RedirectResponse(f"{FRONTEND_URL}/?github={quote(login)}&session={quote(session)}")


@app.get("/github/repos")
async def github_repos(login: str, session: str) -> dict:
    """Repos the connected user can stake against, for the frontend's picker.
    Requires the session secret minted at connect time — the login alone must
    never unlock another user's repo list."""
    try:
        token = token_for_session(login, session)
    except GitHubAuthError as e:
        raise HTTPException(401, str(e))
    try:
        return {"repos": await list_user_repos(token)}
    except GitHubCheckError as e:
        raise HTTPException(502, str(e))


def _resolve_token(github_login: str | None, session: str | None) -> str | None:
    """Session-checked token lookup shared by validate + register. No login
    means the anonymous / server-token path (public repos)."""
    if not github_login:
        return None
    try:
        return token_for_session(github_login, session or "")
    except GitHubAuthError as e:
        raise HTTPException(401, str(e))


@app.get("/repos/validate")
async def validate_repo(
    owner: str, repo: str, github_login: str | None = None, session: str | None = None
) -> dict:
    """Called by the frontend BEFORE staking, so nobody locks funds against
    a repo the verifier can't read."""
    token = _resolve_token(github_login, session)
    try:
        await repo_visible(owner, repo, token)
    except GitHubCheckError as e:
        raise HTTPException(400, str(e))
    return {"ok": True}


class RegisterRequest(BaseModel):
    commitment_id: int
    github_owner: str
    github_repo: str
    github_author: str | None = None  # restrict to a specific GitHub username, optional
    github_login: str | None = None  # connected account whose OAuth token should be used
    session: str | None = None  # session secret proving this browser owns github_login


@app.post("/commitments/register")
async def register(body: RegisterRequest) -> dict:
    """Call this right after creating the commitment onchain, so the
    verifier knows which GitHub repo to watch for this commitment id."""
    token = _resolve_token(body.github_login, body.session)

    # Fail fast: never let someone stake against a repo the verifier can't see.
    try:
        await repo_visible(body.github_owner, body.github_repo, token)
    except GitHubCheckError as e:
        raise HTTPException(400, str(e))

    storage.register_commitment(
        body.commitment_id,
        body.github_owner,
        body.github_repo,
        body.github_author,
        body.github_login,
    )
    return {"ok": True}


@app.get("/commitments/{commitment_id}")
def get_commitment(commitment_id: int) -> dict:
    onchain = chain.get_commitment(commitment_id)
    if onchain["creator"] == "0x0000000000000000000000000000000000000000":
        raise HTTPException(404, "No such commitment")
    registration = storage.get_registration(commitment_id)
    return {"onchain": onchain, "tracking": registration}


@app.post("/commitments/{commitment_id}/verify")
async def verify(commitment_id: int) -> dict:
    """Checks GitHub for activity since the commitment was registered, and
    if found, signs+sends the onchain checkIn() as the verifier wallet."""
    registration = storage.get_registration(commitment_id)
    if not registration:
        raise HTTPException(404, "Commitment was never registered with the verifier")

    onchain = chain.get_commitment(commitment_id)
    if onchain["status"] != "active":
        return {"verified": False, "reason": f"onchain status is '{onchain['status']}', nothing to do"}

    if datetime.utcnow().timestamp() > onchain["deadline"]:
        return {"verified": False, "reason": "deadline already passed — call claimFailedStake instead"}

    token = (
        storage.get_github_token(registration["token_login"])
        if registration["token_login"]
        else None
    )
    try:
        found = await has_activity_since(
            registration["github_owner"],
            registration["github_repo"],
            datetime.fromisoformat(registration["created_at"]),
            registration["github_author"],
            token,
        )
    except GitHubCheckError as e:
        raise HTTPException(502, str(e))

    if not found:
        return {"verified": False, "reason": "no commits found since commitment was created"}

    tx_hash = chain.submit_check_in(commitment_id)
    storage.mark_checked_in(commitment_id)
    return {"verified": True, "tx_hash": tx_hash}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}
