"""
Web3 / Blockchain service.
День 2: здесь добавим деплой контракта, минт токенов и transfer.
"""
from web3 import AsyncWeb3
from app.core.config import settings

# Подключение к ноде (Hardhat local или Sepolia)
w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(settings.WEB3_PROVIDER_URL))

# ABI ERC-20 (минимальный, для balanceOf и transfer)
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


async def get_eth_balance(address: str) -> str:
    """ETH баланс в ETH (не Wei)."""
    try:
        wei = await w3.eth.get_balance(address)
        return str(AsyncWeb3.from_wei(wei, "ether"))
    except Exception:
        return "0"


async def get_token_balance(address: str) -> str:
    """ERC-20 баланс в токенах."""
    if not settings.TOKEN_CONTRACT_ADDRESS:
        return "0"
    try:
        contract = w3.eth.contract(
            address=AsyncWeb3.to_checksum_address(settings.TOKEN_CONTRACT_ADDRESS),
            abi=ERC20_ABI,
        )
        raw = await contract.functions.balanceOf(
            AsyncWeb3.to_checksum_address(address)
        ).call()
        return str(AsyncWeb3.from_wei(raw, "ether"))
    except Exception:
        return "0"


async def is_connected() -> bool:
    try:
        return await w3.is_connected()
    except Exception:
        return False
