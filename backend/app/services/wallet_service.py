"""
Self-custody wallet service.
Приватный ключ генерируется на сервере, шифруется Fernet и хранится в БД.
В production пользователь должен иметь возможность экспортировать и импортировать
свой ключ — сервер не должен быть единственным хранилищем.
"""
import base64
from cryptography.fernet import Fernet
from eth_account import Account

from app.core.config import settings


def _get_fernet() -> Fernet:
    key = settings.ENCRYPTION_KEY
    if not key:
        # Dev fallback: generate a temporary key (НЕ для production)
        key = base64.urlsafe_b64encode(b"dev_key_32bytes_padding_here___!").decode()
    return Fernet(key.encode() if isinstance(key, str) else key)


def generate_wallet() -> dict:
    """Создаёт новый ETH кошелёк. Возвращает address и encrypted_private_key."""
    account = Account.create()
    fernet = _get_fernet()
    encrypted = fernet.encrypt(account.key.hex().encode()).decode()
    return {
        "address": account.address,
        "encrypted_private_key": encrypted,
    }


def decrypt_private_key(encrypted_key: str) -> str:
    """Расшифровывает приватный ключ для подписи транзакций."""
    fernet = _get_fernet()
    return fernet.decrypt(encrypted_key.encode()).decode()


def get_account_from_db_wallet(encrypted_key: str):
    """Возвращает eth_account.Account для подписи транзакций."""
    private_key = decrypt_private_key(encrypted_key)
    return Account.from_key(private_key)
