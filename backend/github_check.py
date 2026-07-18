from datetime import datetime, timezone

import httpx

from config import GITHUB_TOKEN


class GitHubCheckError(Exception):
    pass


def _headers(token: str | None = None) -> dict:
    headers = {"Accept": "application/vnd.github+json"}
    effective = token or GITHUB_TOKEN
    if effective:
        headers["Authorization"] = f"Bearer {effective}"
    return headers


async def repo_visible(owner: str, repo: str, token: str | None = None) -> None:
    """Raises GitHubCheckError if the repo can't be read with the given token
    (falling back to the server token / anonymous). Call at registration time
    so nobody stakes against a repo the verifier will never be able to see."""
    url = f"https://api.github.com/repos/{owner}/{repo}"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, headers=_headers(token))

    if resp.status_code == 404:
        raise GitHubCheckError(
            f"Repo {owner}/{repo} not found. If it's private, connect your "
            "GitHub account first so the verifier can read it."
        )
    if resp.status_code == 401:
        raise GitHubCheckError(
            "GitHub token was rejected — reconnect your GitHub account."
        )
    if resp.status_code != 200:
        raise GitHubCheckError(f"GitHub API returned {resp.status_code}: {resp.text[:200]}")


async def list_user_repos(token: str) -> list[dict]:
    """Repos the connected user can see (own, collaborator, org), most
    recently pushed first. Paginates up to 300 repos."""
    repos: list[dict] = []
    async with httpx.AsyncClient(timeout=15) as client:
        for page in range(1, 4):
            resp = await client.get(
                "https://api.github.com/user/repos",
                params={
                    "sort": "pushed",
                    "per_page": 100,
                    "page": page,
                    "affiliation": "owner,collaborator,organization_member",
                },
                headers=_headers(token),
            )
            if resp.status_code == 401:
                raise GitHubCheckError("GitHub token was rejected — reconnect your GitHub account.")
            if resp.status_code != 200:
                raise GitHubCheckError(f"GitHub API returned {resp.status_code}: {resp.text[:200]}")
            batch = resp.json()
            repos.extend(
                {
                    "full_name": r["full_name"],
                    "owner": r["owner"]["login"],
                    "name": r["name"],
                    "private": r["private"],
                    "pushed_at": r["pushed_at"],
                }
                for r in batch
            )
            if len(batch) < 100:
                break
    return repos


async def recent_commits(
    owner: str,
    repo: str,
    since: datetime,
    author: str | None = None,
    token: str | None = None,
    limit: int = 4,
) -> list[dict]:
    """Newest-first commits on the default branch since `since`, trimmed to
    what the frontend's activity feed renders. Same visibility rules as
    has_activity_since — pass a connected user's token for private repos."""
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)
    since_iso = since.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    params = {"since": since_iso, "per_page": limit}
    if author:
        params["author"] = author

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params, headers=_headers(token))

    if resp.status_code == 404:
        raise GitHubCheckError(
            f"Repo {owner}/{repo} not found — if it's private, the connected "
            "GitHub account must have access to it."
        )
    if resp.status_code == 401:
        raise GitHubCheckError(
            "GitHub token was rejected — reconnect your GitHub account."
        )
    if resp.status_code == 409:
        return []  # empty repo
    if resp.status_code != 200:
        raise GitHubCheckError(f"GitHub API returned {resp.status_code}: {resp.text[:200]}")

    return [
        {
            "sha": c["sha"][:7],
            "message": c["commit"]["message"].splitlines()[0][:100],
            "author": (c.get("author") or {}).get("login") or c["commit"]["author"]["name"],
            "date": c["commit"]["author"]["date"],
            "url": c["html_url"],
        }
        for c in resp.json()
    ]


async def has_activity_since(
    owner: str, repo: str, since: datetime, author: str | None = None, token: str | None = None
) -> bool:
    """True if the repo has at least one commit on its default branch
    since `since` (optionally filtered to a specific GitHub username).
    Pass `token` (a connected user's OAuth token) to read private repos."""
    if since.tzinfo is None:  # storage writes naive UTC timestamps
        since = since.replace(tzinfo=timezone.utc)
    since_iso = since.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    params = {"since": since_iso, "per_page": 1}
    if author:
        params["author"] = author

    url = f"https://api.github.com/repos/{owner}/{repo}/commits"
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.get(url, params=params, headers=_headers(token))

    if resp.status_code == 404:
        raise GitHubCheckError(
            f"Repo {owner}/{repo} not found — if it's private, the connected "
            "GitHub account must have access to it."
        )
    if resp.status_code == 401:
        raise GitHubCheckError(
            "GitHub token was rejected — reconnect your GitHub account."
        )
    if resp.status_code == 409:
        return False  # empty repo
    if resp.status_code != 200:
        raise GitHubCheckError(f"GitHub API returned {resp.status_code}: {resp.text[:200]}")

    return len(resp.json()) > 0
