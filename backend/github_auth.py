"""GitHub OAuth web flow — lets a user connect their account so the verifier
can read their private repos with their token."""

import hashlib
import hmac
import secrets
from urllib.parse import urlencode

import httpx

import storage
from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET


class GitHubAuthError(Exception):
    pass


def oauth_configured() -> bool:
    return bool(GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET)


def build_authorize_url() -> str:
    """Mints a CSRF state and returns the GitHub authorize URL to redirect to."""
    state = secrets.token_urlsafe(32)
    storage.save_oauth_state(state)
    params = {
        "client_id": GITHUB_CLIENT_ID,
        # `repo` is the narrowest classic OAuth scope that can read private
        # repos. A production version would use a GitHub App with read-only,
        # per-repo installation instead.
        "scope": "repo",
        "state": state,
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


def _hash_secret(secret: str) -> str:
    return hashlib.sha256(secret.encode()).hexdigest()


def token_for_session(login: str, session: str) -> str:
    """Returns the stored access token for `login` if `session` matches the
    secret minted at connect time. Raises GitHubAuthError otherwise — this is
    what stops one user from acting as another by just claiming their login."""
    auth = storage.get_github_auth(login)
    if not auth or not auth["session_secret_hash"] or not session:
        raise GitHubAuthError(f"GitHub account '{login}' isn't connected — connect it first")
    if not hmac.compare_digest(auth["session_secret_hash"], _hash_secret(session)):
        raise GitHubAuthError("Session doesn't match — reconnect your GitHub account")
    return auth["access_token"]


async def exchange_code(code: str, state: str) -> tuple[str, str]:
    """Validates state, swaps the code for an access token, stores it keyed
    by the GitHub login, and returns (login, session_secret). The session
    secret goes back to the browser and must accompany future requests that
    use this token."""
    if not storage.pop_oauth_state(state):
        raise GitHubAuthError("OAuth state didn't match (expired or forged) — try connecting again")

    async with httpx.AsyncClient(timeout=15) as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            data={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json() if token_resp.status_code == 200 else {}
        access_token = token_data.get("access_token")
        if not access_token:
            detail = token_data.get("error_description") or token_resp.text[:200]
            raise GitHubAuthError(f"GitHub rejected the code exchange: {detail}")

        user_resp = await client.get(
            "https://api.github.com/user",
            headers={
                "Accept": "application/vnd.github+json",
                "Authorization": f"Bearer {access_token}",
            },
        )
        if user_resp.status_code != 200:
            raise GitHubAuthError(f"Couldn't fetch the GitHub user: {user_resp.status_code}")
        login = user_resp.json()["login"]

    session_secret = secrets.token_urlsafe(32)
    storage.save_github_token(login, access_token, _hash_secret(session_secret))
    return login, session_secret
