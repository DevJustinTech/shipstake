import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta

from config import DB_PATH

_SCHEMA = """
CREATE TABLE IF NOT EXISTS commitments (
    id INTEGER PRIMARY KEY,          -- matches the onchain commitment id
    github_owner TEXT NOT NULL,
    github_repo TEXT NOT NULL,
    github_author TEXT,              -- optional: restrict to a specific committer
    token_login TEXT,                -- optional: connected GitHub account whose token to use
    created_at TEXT NOT NULL,
    checked_in INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS github_tokens (
    login TEXT PRIMARY KEY,          -- GitHub username
    access_token TEXT NOT NULL,
    session_secret_hash TEXT,        -- sha256 of the browser session secret
    connected_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_states (
    state TEXT PRIMARY KEY,
    created_at TEXT NOT NULL
);
"""


@contextmanager
def _conn():
    conn = sqlite3.connect(DB_PATH)
    try:
        yield conn
        conn.commit()
    finally:
        conn.close()


def init_db() -> None:
    with _conn() as conn:
        conn.executescript(_SCHEMA)
        # migration for DBs created before token_login existed
        cols = [r[1] for r in conn.execute("PRAGMA table_info(commitments)").fetchall()]
        if "token_login" not in cols:
            conn.execute("ALTER TABLE commitments ADD COLUMN token_login TEXT")
        token_cols = [r[1] for r in conn.execute("PRAGMA table_info(github_tokens)").fetchall()]
        if "session_secret_hash" not in token_cols:
            conn.execute("ALTER TABLE github_tokens ADD COLUMN session_secret_hash TEXT")


def register_commitment(
    commitment_id: int,
    github_owner: str,
    github_repo: str,
    github_author: str | None,
    token_login: str | None = None,
) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO commitments (id, github_owner, github_repo, github_author, token_login, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?)",
            (commitment_id, github_owner, github_repo, github_author, token_login, datetime.utcnow().isoformat()),
        )


def get_registration(commitment_id: int) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT id, github_owner, github_repo, github_author, token_login, created_at, checked_in "
            "FROM commitments WHERE id = ?",
            (commitment_id,),
        ).fetchone()
    if not row:
        return None
    keys = ["id", "github_owner", "github_repo", "github_author", "token_login", "created_at", "checked_in"]
    return dict(zip(keys, row))


def save_github_token(login: str, access_token: str, session_secret_hash: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT OR REPLACE INTO github_tokens (login, access_token, session_secret_hash, connected_at) "
            "VALUES (?, ?, ?, ?)",
            (login, access_token, session_secret_hash, datetime.utcnow().isoformat()),
        )


def get_github_auth(login: str) -> dict | None:
    with _conn() as conn:
        row = conn.execute(
            "SELECT access_token, session_secret_hash FROM github_tokens WHERE login = ?", (login,)
        ).fetchone()
    return {"access_token": row[0], "session_secret_hash": row[1]} if row else None


def get_github_token(login: str) -> str | None:
    auth = get_github_auth(login)
    return auth["access_token"] if auth else None


def save_oauth_state(state: str) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO oauth_states (state, created_at) VALUES (?, ?)",
            (state, datetime.utcnow().isoformat()),
        )


def pop_oauth_state(state: str) -> bool:
    """True if the state existed and was less than 10 minutes old. Consumes it,
    and purges any other states past that age."""
    cutoff = (datetime.utcnow() - timedelta(minutes=10)).isoformat()
    with _conn() as conn:
        row = conn.execute(
            "SELECT created_at FROM oauth_states WHERE state = ?", (state,)
        ).fetchone()
        conn.execute(
            "DELETE FROM oauth_states WHERE state = ? OR created_at < ?", (state, cutoff)
        )
    return bool(row) and row[0] >= cutoff


def get_unchecked_registrations() -> list[dict]:
    """Registrations that haven't been checked in yet — the auto-verify
    loop's work queue."""
    keys = ["id", "github_owner", "github_repo", "github_author", "token_login", "created_at", "checked_in"]
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, github_owner, github_repo, github_author, token_login, created_at, checked_in "
            "FROM commitments WHERE checked_in = 0"
        ).fetchall()
    return [dict(zip(keys, row)) for row in rows]


def mark_checked_in(commitment_id: int) -> None:
    with _conn() as conn:
        conn.execute("UPDATE commitments SET checked_in = 1 WHERE id = ?", (commitment_id,))
