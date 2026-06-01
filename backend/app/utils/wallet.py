from app.models.user import Wallet, User


def get_primary_wallet(user: User) -> Wallet | None:
    """Возвращает primary кошелёк или первый в списке."""
    if not user.wallets:
        return None
    for w in user.wallets:
        if w.is_primary:
            return w
    return user.wallets[0]
