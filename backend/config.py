import os

from dotenv import load_dotenv

load_dotenv()

MONAD_RPC_URL = os.environ.get("MONAD_RPC_URL", "https://testnet-rpc.monad.xyz")
CONTRACT_ADDRESS = os.environ["CONTRACT_ADDRESS"]
VERIFIER_PRIVATE_KEY = os.environ["VERIFIER_PRIVATE_KEY"]
GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")  # optional, raises GitHub's rate limit
DB_PATH = os.environ.get("DB_PATH", "shipstake.db")

# GitHub OAuth app — lets users connect their account so the verifier can
# read their private repos. Optional: without it, public repos still work.
GITHUB_CLIENT_ID = os.environ.get("GITHUB_CLIENT_ID")
GITHUB_CLIENT_SECRET = os.environ.get("GITHUB_CLIENT_SECRET")
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000")
