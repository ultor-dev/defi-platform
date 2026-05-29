import resend
from app.core.config import settings

resend.api_key = settings.RESEND_API_KEY


async def send_email(to: str, subject: str, html: str) -> bool:
    try:
        resend.Emails.send({
            "from": settings.EMAIL_FROM,
            "to": to,
            "subject": subject,
            "html": html,
        })
        return True
    except Exception as e:
        print(f"Email send failed: {e}")
        return False


async def send_verification_email(to: str, username: str, token: str):
    url = f"{settings.FRONTEND_URL}/verify-email?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:40px;border-radius:12px">
      <h1 style="color:#38bdf8;margin-bottom:8px">⬡ DeFi Platform</h1>
      <h2 style="color:#f1f5f9">Подтверди свой email</h2>
      <p style="color:#94a3b8">Привет, {username}! Нажми кнопку ниже чтобы подтвердить email и активировать аккаунт.</p>
      <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#38bdf8;color:#0f172a;border-radius:8px;text-decoration:none;font-weight:700">
        Подтвердить email
      </a>
      <p style="color:#475569;font-size:13px">Ссылка действительна 24 часа. Если ты не регистрировался — просто игнорируй это письмо.</p>
      <p style="color:#334155;font-size:11px;margin-top:24px">{url}</p>
    </div>
    """
    await send_email(to, "Подтверди свой email — DeFi Platform", html)


async def send_password_reset_email(to: str, username: str, token: str):
    url = f"{settings.FRONTEND_URL}/reset-password?token={token}"
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;background:#0f172a;color:#f1f5f9;padding:40px;border-radius:12px">
      <h1 style="color:#38bdf8;margin-bottom:8px">⬡ DeFi Platform</h1>
      <h2 style="color:#f1f5f9">Сброс пароля</h2>
      <p style="color:#94a3b8">Привет, {username}! Кто-то запросил сброс пароля для твоего аккаунта.</p>
      <a href="{url}" style="display:inline-block;margin:24px 0;padding:12px 28px;background:#ef4444;color:#fff;border-radius:8px;text-decoration:none;font-weight:700">
        Сбросить пароль
      </a>
      <p style="color:#475569;font-size:13px">Ссылка действительна 1 час. Если ты не запрашивал сброс — игнорируй письмо.</p>
      <p style="color:#334155;font-size:11px;margin-top:24px">{url}</p>
    </div>
    """
    await send_email(to, "Сброс пароля — DeFi Platform", html)
