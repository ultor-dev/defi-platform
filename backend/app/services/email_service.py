# Email отключён в dev-режиме — заглушка
import logging
logger = logging.getLogger(__name__)

async def send_email(to: str, subject: str, html: str) -> bool:
    logger.info(f"[DEV] Email to={to} subject={subject}")
    return True

async def send_verification_email(to: str, username: str, token: str):
    logger.info(f"[DEV] Verification email: to={to} token={token}")

async def send_password_reset_email(to: str, username: str, token: str):
    logger.info(f"[DEV] Password reset email: to={to} token={token}")
