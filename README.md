# ⬡ DeFi Platform

Децентрализованная финансовая платформа с KYC верификацией, self-custody кошельками, ERC-20 токенами, приватным мессенджером и графом кошельков.

![Status](https://img.shields.io/badge/status-active-brightgreen)
![Tests](https://img.shields.io/badge/tests-26%20passed-brightgreen)
![Stack](https://img.shields.io/badge/stack-FastAPI%20%2B%20React%20%2B%20Solidity-blue)

---

## Стек

| Слой | Технология |
|------|------------|
| Backend | FastAPI + PostgreSQL + Redis |
| Auth | JWT (access + refresh) + bcrypt |
| Blockchain | Solidity ERC-20 + Hardhat + web3.py |
| Email | Resend API |
| Frontend | React + Vite + Axios |
| Proxy | Nginx |
| Dev окружение | Docker Compose |
| Тесты | pytest — 26 тестов |

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

Проверь:
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

> ⚠️ Никогда не работай через `/mnt/c/...` — файловая система Windows в 10x медленнее из WSL2.

### 5. Открой в VS Code

```bash
code .
```

---

## Установка — Linux / macOS

```bash
# Ubuntu/Debian:
sudo apt update && sudo apt install -y git curl
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER && newgrp docker
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# macOS:
brew install node git
# Docker Desktop: скачай с docker.com

# Клонируй:
cd ~ && mkdir -p projects && cd projects
git clone https://github.com/ultor-dev/defi-platform.git
cd defi-platform
```

---

## Быстрый старт

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

Заполни `.env`:
```bash
nano .env
```

Обязательные поля:
```env
SECRET_KEY=<результат openssl rand -hex 32>
ENCRYPTION_KEY=<результат python3 команды выше>
RESEND_API_KEY=re_xxxxxxxx     # получить на resend.com (бесплатно)
EMAIL_FROM=noreply@yourdomain.com
```

> `TOKEN_CONTRACT_ADDRESS` оставь пустым — заполнится на шаге 3.

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

Вывод:
```
✅ DeFiPlatformToken deployed to: 0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
👉 Добавь в .env:
TOKEN_CONTRACT_ADDRESS=0x5FC8d32690cc91D4c39d9d3abcBD16989F875707
```

Скопируй адрес в `.env`, перезапусти backend:
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
bash scripts/dev.sh test-api
# Swagger UI: http://localhost:8000/docs
```

---

## Структура проекта

```
defi-platform/
├── backend/
│   ├── app/
│   │   ├── main.py                      # FastAPI entry point, CORS, lifespan
│   │   ├── core/
│   │   │   ├── config.py                # Настройки (pydantic-settings)
│   │   │   ├── database.py              # SQLAlchemy async engine
│   │   │   └── security.py             # JWT, bcrypt, role guards
│   │   ├── models/
│   │   │   ├── user.py                  # User, Profile, Wallet + generate_uid()
│   │   │   ├── kyc.py                   # KYCApplication, KYCStatus
│   │   │   ├── transaction.py           # Transaction, TransactionType
│   │   │   ├── notification.py          # Notification, NotificationType
│   │   │   ├── message.py               # Conversation, Message
│   │   │   └── token.py                 # UserToken (email verify, reset)
│   │   ├── schemas/
│   │   │   └── user.py                  # UserOut, WalletOut, ProfileOut и др.
│   │   ├── services/
│   │   │   ├── wallet_service.py        # generate_wallet(), Fernet encrypt/decrypt
│   │   │   ├── blockchain_service.py    # web3.py: балансы, mint, transfer
│   │   │   ├── chat_service.py          # WebSocket ConnectionManager
│   │   │   └── email_service.py         # Resend: verify + reset password
│   │   ├── utils/
│   │   │   ├── wallet.py                # get_primary_wallet() — без дублирования
│   │   │   └── user.py                  # get_user_with_relations()
│   │   └── api/v1/endpoints/
│   │       ├── auth.py                  # register, login, refresh, /me
│   │       ├── auth_email.py            # forgot/reset password, verify email
│   │       ├── kyc.py                   # submit, status, history
│   │       ├── wallet.py                # все операции с кошельками
│   │       ├── profile.py               # GET/PATCH профиля
│   │       ├── chat.py                  # WebSocket + REST
│   │       └── admin.py                 # stats, users, KYC review, network graph
│   └── tests/                           # 26 pytest тестов
├── contracts/
│   ├── contracts/DeFiPlatformToken.sol  # ERC-20: mint, burn, transfer
│   └── scripts/deploy.js
├── frontend/
│   └── src/
│       ├── api.js                       # axios + JWT interceptor + error normalizer
│       ├── App.jsx                      # все роуты
│       ├── components/Navbar.jsx
│       └── pages/
│           ├── Login.jsx
│           ├── Register.jsx
│           ├── Dashboard.jsx            # профиль + мульти-кошельки + балансы
│           ├── KYC.jsx                  # форма + статус + история заявок
│           ├── Chat.jsx                 # личный мессенджер (WebSocket)
│           ├── Admin.jsx                # панель администратора
│           ├── Graph.jsx                # d3.js граф кошельков
│           ├── ForgotPassword.jsx
│           ├── ResetPassword.jsx
│           └── VerifyEmail.jsx
├── nginx/nginx.conf
├── scripts/
│   ├── dev.sh                           # команды разработки
│   └── send_eth.sh                      # отправка тестового ETH
├── docker-compose.yml
├── .env                                 # не в git!
└── .env.example
```

---

## Схема БД

| Таблица | Назначение |
|---------|-----------|
| `users` | Аккаунты: uid, email, username, role, is_active |
| `profiles` | Личные данные: bio, avatar, country, phone, telegram |
| `wallets` | Кошельки (несколько на юзера): address, label, is_primary |
| `kyc_applications` | История KYC заявок с reviewer и rejection_reason |
| `transactions` | История переводов: from/to wallet, tx_hash, amount |
| `notifications` | Уведомления с типами и action_url |
| `conversations` | Диалоги в мессенджере |
| `messages` | Сообщения (encrypted_content) |
| `user_tokens` | Токены для email verify и password reset |

---

## Роли пользователей

| Роль | Как получить | Права |
|------|-------------|-------|
| `UNVERIFIED` | Регистрация | Профиль, кошелёк, чат |
| `USER` | KYC одобрен | + Баланс, трансфер токенов, экспорт ключа |
| `ADMIN` | Через psql | Всё + Admin Panel |

### Стать админом

```bash
docker compose exec db psql -U defi -d defidb -c \
  "UPDATE users SET role='ADMIN', email_verified=true WHERE username='твой_username';"
```

### KYC Flow

```
Регистрация → POST /kyc/submit → Admin одобряет → роль USER + 100 DPT автоминт
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

### KYC
| Метод | Путь | Доступ |
|-------|------|--------|
| POST | `/kyc/submit` | Auth |
| GET | `/kyc/status` | Auth |
| GET | `/kyc/history` | Auth |

### Wallet
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/wallet/me` | Auth |
| GET | `/wallet/all` | Auth |
| POST | `/wallet/create` | Auth |
| PATCH | `/wallet/{id}/primary` | Auth |
| PATCH | `/wallet/{id}/label` | Auth |
| GET | `/wallet/balance` | USER+ |
| GET | `/wallet/balances` | USER+ |
| POST | `/wallet/transfer` | USER+ |
| GET | `/wallet/export-key` | USER+ |

### Profile
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/profile` | Auth |
| PATCH | `/profile` | Auth |

### Admin
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/admin/stats` | ADMIN |
| GET | `/admin/users` | ADMIN |
| GET | `/admin/kyc/pending` | ADMIN |
| POST | `/admin/kyc/approve/{id}` | ADMIN |
| POST | `/admin/kyc/reject/{id}` | ADMIN |
| PATCH | `/admin/users/{id}/toggle-active` | ADMIN |
| PATCH | `/admin/users/{id}/role` | ADMIN |
| GET | `/admin/network/graph` | Auth |

### Chat
| Метод | Путь | Доступ |
|-------|------|--------|
| GET | `/chat/users` | Auth |
| POST | `/chat/conversations/with/{id}` | Auth |
| GET | `/chat/conversations/{id}/messages` | Auth |
| WS | `/chat/ws/{id}?token=...` | Auth |

---

## Команды разработки

```bash
bash scripts/dev.sh up                 # Запустить все сервисы
bash scripts/dev.sh down               # Остановить
bash scripts/dev.sh logs backend       # Логи FastAPI
bash scripts/dev.sh logs hardhat       # Логи Hardhat
bash scripts/dev.sh shell backend      # Bash внутри контейнера
bash scripts/dev.sh test-api           # E2E тест API
bash scripts/dev.sh reset-db           # Сброс БД (удаляет данные!)

# Отправить тестовый ETH (нужен для оплаты газа при transfer):
bash scripts/send_eth.sh 0xАДРЕС 1

# Тесты:
docker compose exec backend python -m pytest tests/ -v
```

---

## Важные нюансы

### Hardhat — временный блокчейн

Hardhat нода сбрасывается при `docker compose down -v`. После пересоздания:

```bash
# 1. Передеплоить контракт:
docker compose exec hardhat sh
npx hardhat run scripts/deploy.js --network localhost
exit

# 2. Скопировать адрес в .env → TOKEN_CONTRACT_ADDRESS=0x...

# 3. Перезапустить backend:
docker compose restart backend
```

### Resend слетает после пересоздания контейнера

```bash
docker compose exec backend pip install resend==2.4.0 --break-system-packages -q
docker compose restart backend
```

Постоянный фикс — в `backend/Dockerfile` добавить:
```dockerfile
RUN pip install resend==2.4.0
```

### ETH для газа

Transfer DPT токенов требует ETH. В dev отправляй тестовый ETH:
```bash
bash scripts/send_eth.sh 0xАДРЕС_ПОЛЬЗОВАТЕЛЯ 1
```

### Создать enum типы вручную (после docker compose down -v)

```bash
docker compose exec db psql -U defi -d defidb -c "
CREATE TYPE userrole AS ENUM ('UNVERIFIED', 'USER', 'ADMIN');
CREATE TYPE kycstatus AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
CREATE TYPE txstatus AS ENUM ('PENDING', 'SUCCESS', 'FAILED');
CREATE TYPE txtype AS ENUM ('TRANSFER', 'MINT', 'BURN');
CREATE TYPE notiftype AS ENUM ('KYC_APPROVED', 'KYC_REJECTED', 'TRANSFER_RECEIVED', 'TRANSFER_SENT', 'SYSTEM', 'NEW_MESSAGE');
CREATE TYPE tokentype AS ENUM ('email_verification', 'password_reset');
"
```

---

## .env переменные

| Переменная | Описание |
|-----------|---------|
| `DATABASE_URL` | `postgresql+asyncpg://defi:pass@db:5432/defidb` |
| `REDIS_URL` | `redis://:pass@redis:6379/0` |
| `SECRET_KEY` | JWT секрет → `openssl rand -hex 32` |
| `ENCRYPTION_KEY` | Fernet ключ для шифрования приватных ключей |
| `WEB3_PROVIDER_URL` | `http://hardhat:8545` (local) или Infura (testnet) |
| `CHAIN_ID` | `31337` (Hardhat) или `11155111` (Sepolia) |
| `TOKEN_CONTRACT_ADDRESS` | Адрес ERC-20 из вывода deploy.js |
| `HARDHAT_DEPLOYER_KEY` | Приватный ключ деплойера (только dev) |
| `KYC_REWARD_TOKENS` | Токенов за KYC (по умолчанию 100) |
| `RESEND_API_KEY` | API ключ от resend.com |
| `EMAIL_FROM` | Email отправителя |
| `FRONTEND_URL` | `http://localhost:5173` |
| `DEBUG` | `true` включает SQL логи |
| `BACKEND_CORS_ORIGINS` | `["http://localhost:5173"]` |

---

## Roadmap

- [ ] Notifications UI (уведомления в реальном времени)
- [ ] История транзакций в Dashboard
- [ ] E2E шифрование в чате
- [ ] Gasless transactions (платформа платит за газ)
- [ ] Деплой на Polygon / Sepolia testnet
- [ ] HTTPS через Let's Encrypt
- [ ] Alembic миграции вместо create_all
- [ ] CI/CD через GitHub Actions
- [ ] Staking контракт
- [ ] 2FA для администраторов
- [ ] Реферальная система