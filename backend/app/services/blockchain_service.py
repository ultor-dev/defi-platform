from web3 import AsyncWeb3
from app.core.config import settings

w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(settings.WEB3_PROVIDER_URL))

ERC20_ABI = [
    {
        "inputs": [{"name": "account", "type": "address"}],
        "name": "balanceOf",
        "outputs": [{"name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "transfer",
        "outputs": [{"name": "", "type": "bool"}],
        "stateMutability": "nonpayable",
        "type": "function",
    },
    {
        "inputs": [
            {"name": "to", "type": "address"},
            {"name": "amount", "type": "uint256"},
        ],
        "name": "mint",
        "outputs": [],
        "stateMutability": "nonpayable",
        "type": "function",
    },
]


def get_contract():
    if not settings.TOKEN_CONTRACT_ADDRESS:
        raise ValueError("TOKEN_CONTRACT_ADDRESS not set in .env")
    return w3.eth.contract(
        address=AsyncWeb3.to_checksum_address(settings.TOKEN_CONTRACT_ADDRESS),
        abi=ERC20_ABI,
    )


async def get_eth_balance(address: str) -> str:
    try:
        wei = await w3.eth.get_balance(AsyncWeb3.to_checksum_address(address))
        return str(AsyncWeb3.from_wei(wei, "ether"))
    except Exception:
        return "0"


async def get_token_balance(address: str) -> str:
    try:
        contract = get_contract()
        raw = await contract.functions.balanceOf(
            AsyncWeb3.to_checksum_address(address)
        ).call()
        return str(AsyncWeb3.from_wei(raw, "ether"))
    except Exception:
        return "0"


async def mint_tokens(to_address: str, amount_tokens: float, minter_private_key: str) -> str:
    """Минт токенов на адрес. minter_private_key — ключ деплойера контракта."""
    contract = get_contract()
    amount_wei = AsyncWeb3.to_wei(amount_tokens, "ether")
    checksum_address = AsyncWeb3.to_checksum_address(to_address)

    account = w3.eth.account.from_key(minter_private_key)
    nonce = await w3.eth.get_transaction_count(account.address)
    chain_id = await w3.eth.chain_id

    tx = await contract.functions.mint(checksum_address, amount_wei).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain_id,
        "gas": 100000,
        "gasPrice": AsyncWeb3.to_wei("1", "gwei"),
    })

    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt.transactionHash.hex()


async def transfer_tokens(
    from_private_key: str,
    to_address: str,
    amount_tokens: float,
) -> str:
    """Transfer токенов от одного пользователя другому."""
    contract = get_contract()
    amount_wei = AsyncWeb3.to_wei(amount_tokens, "ether")
    checksum_to = AsyncWeb3.to_checksum_address(to_address)

    account = w3.eth.account.from_key(from_private_key)
    nonce = await w3.eth.get_transaction_count(account.address)
    chain_id = await w3.eth.chain_id

    tx = await contract.functions.transfer(checksum_to, amount_wei).build_transaction({
        "from": account.address,
        "nonce": nonce,
        "chainId": chain_id,
        "gas": 100000,
        "gasPrice": AsyncWeb3.to_wei("1", "gwei"),
    })

    signed = account.sign_transaction(tx)
    tx_hash = await w3.eth.send_raw_transaction(signed.raw_transaction)
    receipt = await w3.eth.wait_for_transaction_receipt(tx_hash)
    return receipt.transactionHash.hex()


async def is_connected() -> bool:
    try:
        return await w3.is_connected()
    except Exception:
        return False
