from web3 import Web3

from config import CONTRACT_ADDRESS, MONAD_RPC_URL, VERIFIER_PRIVATE_KEY
from contract_abi import COMMITMENT_DEVICE_ABI

w3 = Web3(Web3.HTTPProvider(MONAD_RPC_URL))
_account = w3.eth.account.from_key(VERIFIER_PRIVATE_KEY)
contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=COMMITMENT_DEVICE_ABI)


def get_commitment(commitment_id: int) -> dict:
    creator, beneficiary, amount, deadline, description, status = contract.functions.getCommitment(
        commitment_id
    ).call()
    return {
        "creator": creator,
        "beneficiary": beneficiary,
        "amount_wei": amount,
        "deadline": deadline,
        "description": description,
        # 0 Active, 1 Fulfilled, 2 Failed, 3 Withdrawn
        "status": ["active", "fulfilled", "failed", "withdrawn"][status],
    }


def submit_check_in(commitment_id: int) -> str:
    """Signs and sends checkIn(id) as the verifier wallet. Returns tx hash."""
    tx = contract.functions.checkIn(commitment_id).build_transaction(
        {
            "from": _account.address,
            "nonce": w3.eth.get_transaction_count(_account.address),
            "chainId": w3.eth.chain_id,
            "gasPrice": w3.eth.gas_price,
        }
    )
    signed = _account.sign_transaction(tx)
    tx_hash = w3.eth.send_raw_transaction(signed.raw_transaction)
    w3.eth.wait_for_transaction_receipt(tx_hash, timeout=60)
    return tx_hash.hex()
