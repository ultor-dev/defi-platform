# ⬡ DeFi Platform

Децентрализованная финансовая платформа с KYC верификацией, self-custody кошельками, ERC-20 токенами и E2E мессенджером.

## Стек

| Слой | Технология |
|------|------------|
| Backend | FastAPI + PostgreSQL + Redis |
| Auth | JWT (access + refresh) + bcrypt |
| Blockchain | Solidity ERC-20 + Hardhat + web3.py |
| Email | Resend API |
| Frontend | React + Vite |
| Proxy | Nginx |
| Тесты | pytest (26 тестов) |

---

## Установка — Windows 11 + WSL2

### 1. Установи WSL2 и Ubuntu

```powershell
# В PowerShell от администратора:
wsl --install -d Ubuntu
```

Перезагрузи ПК. После перезагрузки откроется Ubuntu — задай username и password.

### 2. Установи Docker Desktop

Скачай с [docker.com/products/docker-desktop](https://www.docker.com/products/docker-desktop/).

После установки: Docker Desktop → Settings → Resources → WSL Integration → включи Ubuntu → **Apply & Restart**.

Проверь что Docker работает из WSL2:
```bash
docker --version
docker compose version
```

### 3. Установи Node.js внутри WSL2

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs git
node --version   # должно быть v20+
```

### 4. Клонируй проект

```bash
# Работай только в home директории WSL2, НЕ в /mnt/c/...
cd ~
mkdir -p projects && cd projects
git clone https://github.com/ultor-dev/defi-platform.git
cd defi-platform
```

> ⚠️ Никогда не работай с проектом через `/mnt/c/...` — файловая система Windows в 10x медленнее из WSL2.

### 5. Открой в VS Code

```bash
code .
```

VS Code откроется с расширением WSL — все терминалы внутри будут Ubuntu.

---

## Установка — Linux / macOS

### 1. Установи зависимости

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install -y git curl
# Docker:
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
# Node.js:
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

**macOS:**
```bash
# Homebrew:
brew install node git
# Docker Desktop: скачай с docker.com
```

### 2. Клонируй проект

```bash
cd ~
mkdir -p projects && cd projects
git clone https://github.com/ultor-dev/defi-platform.git
cd defi-platform
```

---

## Быстрый старт (одинаково для всех ОС)

### 1. Настрой .env

```bash
cp .env.example .env
```

Сгенерируй ключи:
```bash
# SECRET_KEY:
openssl rand -hex 32

# ENCRYPTION_KEY:
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Открой `.env` и заполни:
```bash
nano .env
```

Обязательные поля:
```
SECRET_KEY=<результат openssl rand -hex 32>
ENCRYPTION_KEY=<результат python3 команды выше>
RESEND_API_KEY=re_xxxxxxxx     # получить на resend.com (бесплатно)
EMAIL_FROM=noreply@yourdomain.com
```

> `TOKEN_CONTRACT_ADDRESS` оставь пустым — заполнится на шаге 4.

### 2. Запусти сервисы

```bash
bash scripts/dev.sh up
```

Первый запуск занимает 3–5 минут.

### 3. Задеплой смарт-контракт

```bash
docker compose exec hardhat sh
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost
exit
```

Вывод будет примерно такой:
```
✅ DeFiPlatformToken deployed to: 0x5FC8d32656cc91D4c39d9d3abcBD16231F875707
👉 Добавь в .env:
TOKEN_CONTRACT_ADDRESS=0x5FC8d32656cc91D4c39d9d3abcBD16231F875707
```

Скопируй адрес из вывода и добавь в `.env`:
```bash
nano .env
# TOKEN_CONTRACT_ADDRESS=0x<адрес из вывода выше>
```

Перезапусти backend:
```bash
docker compose restart backend
```

### 4. Запусти фронтенд

```bash
cd frontend
npm install
npm run dev -- --host
```

Открой в браузере: **http://localhost:5173**

### 5. Проверь

```bash
# В отдельном терминале из корня проекта:
bash scripts/dev.sh test-api

# Swagger UI:
# http://localhost:8000/docs
```

---

## Структура проекта

```
defi-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                   # FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py             # Настройки (pydantic-settings)
│   │   │   ├── database.py           # SQLAlchemy async
│   │   │   └── security.py           # JWT + bcrypt + role guards
│   │   ├── models/
│   │   │   ├── user.py               # User, Wallet, UserRole, KYCStatus
│   │   │   ├── message.py            # Conversation, Message
│   │   │   └── token.py              # UserToken (email verify, reset)
│   │   ├── schemas/                  # Pydantic модели
│   │   ├── services/
│   │   │   ├── wallet_service.py     # Self-custody генерация ключей
│   │   │   ├── blockchain_service.py # web3.py → Hardhat
│   │   │   ├── chat_service.py       # WebSocket менеджер
│   │   │   └── email_service.py      # Resend email
│   │   └── api/v1/endpoints/
│   │       ├── auth.py               # register, login, refresh, /me
│   │       ├── auth_email.py         # verify email, forgot/reset password
│   │       ├── kyc.py                # submit, review
│   │       ├── wallet.py             # balance, transfer, export-key
│   │       ├── chat.py               # WebSocket + REST
│   │       └── admin.py              # stats, users, KYC, network graph
│   └── tests/                        # 26 pytest тестов
├── contracts/
│   ├── contracts/
│   │   └── DeFiPlatformToken.sol     # ERC-20 (mint, burn, transfer)
│   └── scripts/deploy.js
├── frontend/
│   └── src/
│       ├── pages/                    # Login, Register, Dashboard, KYC,
│       │                             # Chat, Admin, Graph, ForgotPassword,
│       │                             # ResetPassword, VerifyEmail
│       └── components/               # Navbar
├── nginx/nginx.conf
├── scripts/
│   ├── dev.sh                        # Команды разработки
│   └── send_eth.sh                   # Отправка тестового ETH
├── docker-compose.yml
├── .env                              # Секреты (не в git!)
└── .env.example                      # Шаблон для .env
```

---

## Роли пользователей

| Роль | Как получить | Права |
|------|-------------|-------|
| `UNVERIFIED` | Регистрация | Профиль, адрес кошелька |
| `USER` | KYC одобрен | + Баланс, трансфер, чат, экспорт ключа |
| `ADMIN` | Через psql | Полный доступ + Admin Panel |

### Стать админом

```bash
docker compose exec db psql -U defi -d defidb -c \
  "UPDATE users SET role='ADMIN', kyc_status='APPROVED' WHERE username='твой_username';"
```

### KYC Flow

```
Регистрация → /kyc/submit → Admin одобряет → роль USER + 100 DPT автоминт
```

---

## Команды разработки

```bash
bash scripts/dev.sh up                 # Запустить все сервисы
bash scripts/dev.sh down               # Остановить
bash scripts/dev.sh logs backend       # Логи FastAPI
bash scripts/dev.sh logs hardhat       # Логи Hardhat
bash scripts/dev.sh shell backend      # Bash внутри контейнера
bash scripts/dev.sh test-api           # E2E тест API
bash scripts/dev.sh deploy-contract    # Деплой Solidity контракта
bash scripts/dev.sh reset-db           # Сброс БД (удаляет данные!)

# Отправить тестовый ETH пользователю (нужен для оплаты газа):
bash scripts/send_eth.sh 0xАДРЕС 1
```

---

## Важные нюансы

### Hardhat — временный блокчейн

Hardhat нода сбрасывается при каждом `docker compose down -v`. После пересоздания контейнеров нужно:

1. Зайти в контейнер и передеплоить контракт:
```bash
docker compose exec hardhat sh
npx hardhat run scripts/deploy.js --network localhost
exit
```

2. Скопировать новый адрес из вывода в `.env` → `TOKEN_CONTRACT_ADDRESS`

3. Перезапустить backend:
```bash
docker compose restart backend
```

> Адрес контракта может измениться если до этого уже был деплой в этой сессии. Всегда копируй актуальный адрес из вывода команды.

### ETH для газа

Каждый transfer токенов требует ETH для оплаты газа. В dev окружении отправляй тестовый ETH:

```bash
bash scripts/send_eth.sh 0xАДРЕС_ПОЛЬЗОВАТЕЛЯ 1
```

### Resend (email)

Зарегистрируйся на [resend.com](https://resend.com) → API Keys → Create → скопируй в `.env`.

Без Resend платформа работает полностью, кроме восстановления пароля и верификации email.

---

## Тесты

```bash
# Установить зависимости (один раз):
docker compose exec backend pip install pytest pytest-asyncio httpx aiosqlite

# Запустить:
docker compose exec backend python -m pytest tests/ -v

# Результат: 26 passed ✅
```

---

## API Endpoints

Base URL: `http://localhost:8000/api/v1` | Swagger: `http://localhost:8000/docs`

### Auth
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/auth/register` | Публичный |
| POST | `/auth/login` | Публичный |
| POST | `/auth/refresh` | Публичный |
| GET | `/auth/me` | Auth |
| POST | `/auth/forgot-password` | Публичный |
| POST | `/auth/reset-password` | Публичный |
| POST | `/auth/send-verification` | Auth |
| POST | `/auth/verify-email` | Публичный |

### KYC & Wallet
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/kyc/submit` | Auth |
| GET | `/wallet/me` | Auth |
| GET | `/wallet/balance` | USER+ |
| POST | `/wallet/transfer` | USER+ |
| GET | `/wallet/export-key` | USER+ |

### Admin
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/admin/stats` | ADMIN |
| GET | `/admin/users` | ADMIN |
| POST | `/admin/kyc/approve/{id}` | ADMIN |
| POST | `/admin/kyc/reject/{id}` | ADMIN |
| PATCH | `/admin/users/{id}/role` | ADMIN |
| GET | `/admin/network/graph` | Auth |

### Chat (WebSocket)
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/chat/users` | Auth |
| POST | `/chat/conversations/with/{id}` | Auth |
| WS | `/chat/ws/{id}?token=...` | Auth |

---

## .env переменные

| Переменная | Описание |
|-----------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://user:pass@db:5432/dbname` |
| `REDIS_URL` | `redis://:pass@redis:6379/0` |
| `SECRET_KEY` | JWT секрет → `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Fernet ключ для шифрования приватных ключей кошельков |
| `WEB3_PROVIDER_URL` | `http://hardhat:8545` (local) или Infura URL (testnet) |
| `CHAIN_ID` | `31337` (Hardhat) или `11155111` (Sepolia) |
| `TOKEN_CONTRACT_ADDRESS` | Адрес ERC-20 — копируется из вывода деплоя |
| `RESEND_API_KEY` | API ключ от resend.com |
| `EMAIL_FROM` | Email отправителя |
| `FRONTEND_URL` | `http://localhost:5173` |
| `DEBUG` | `true` включает SQL логи |
| `BACKEND_CORS_ORIGINS` | JSON массив origins: `["http://localhost:5173"]` |

---

## Roadmap

- [ ] E2E шифрование в чате
- [ ] Gasless transactions (платформа платит за газ)
- [ ] Деплой на Polygon / Sepolia testnet
- [ ] HTTPS через Let's Encrypt
- [ ] Alembic миграции вместо create_all
- [ ] CI/CD через GitHub Actions
- [ ] Staking контракт
- [ ] 2FA для администраторов
- [ ] Валидация регистрации (сложность пароля, формат username)
