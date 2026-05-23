# DeFi Platform — Руководство разработчика

## Стек
| Слой | Технология |
|------|------------|
| Backend | FastAPI + PostgreSQL + Redis |
| Auth | JWT (access + refresh tokens) |
| Blockchain | Solidity ERC-20 + Hardhat + web3.py |
| Messenger | WebSocket (День 3) |
| Frontend | React (День 3) |
| Dev окружение | Docker Compose |

---

## Быстрый старт (WSL2 + Docker Desktop)

### 1. Открой проект в VS Code через WSL2
```bash
# В WSL2 терминале:
cd ~/projects
git clone <your-repo> defi-platform   # или скопируй папку
cd defi-platform
code .   # откроет VS Code подключённый к WSL2
```

### 2. Настрой .env
```bash
cp .env .env.local
# Отредактируй .env — SECRET_KEY обязательно!
# Сгенерировать ключ:
openssl rand -hex 32
```

### 3. Запусти всё одной командой
```bash
bash scripts/dev.sh up
```

### 4. Проверь что всё работает
```bash
bash scripts/dev.sh test-api
```

Swagger UI: http://localhost:8000/docs

---

## Структура проекта
```
defi-platform/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── core/
│   │   │   ├── config.py        # Настройки (pydantic-settings)
│   │   │   ├── database.py      # SQLAlchemy async
│   │   │   └── security.py      # JWT + bcrypt + role guards
│   │   ├── models/
│   │   │   ├── user.py          # User, Wallet, роли, KYC статусы
│   │   │   └── message.py       # Conversation, Message (E2E)
│   │   ├── schemas/             # Pydantic request/response модели
│   │   ├── services/
│   │   │   ├── wallet_service.py    # Self-custody генерация ключей
│   │   │   └── blockchain_service.py # web3.py интеграция
│   │   └── api/v1/endpoints/
│   │       ├── auth.py          # register, login, refresh, /me
│   │       ├── kyc.py           # submit, review, pending
│   │       └── wallet.py        # my wallet, balance
│   └── Dockerfile
├── contracts/
│   ├── contracts/
│   │   └── DeFiPlatformToken.sol  # ERC-20 с mint/burn
│   ├── scripts/deploy.js
│   └── hardhat.config.js
├── nginx/nginx.conf
├── scripts/dev.sh               # Хелпер для dev команд
└── docker-compose.yml
```

---

## Команды разработки

```bash
bash scripts/dev.sh up              # запустить всё
bash scripts/dev.sh down            # остановить
bash scripts/dev.sh logs backend    # логи FastAPI
bash scripts/dev.sh logs hardhat    # логи Hardhat node
bash scripts/dev.sh shell backend   # bash внутри контейнера
bash scripts/dev.sh test-api        # быстрый E2E тест
bash scripts/dev.sh deploy-contract # деплой Solidity
bash scripts/dev.sh reset-db        # сбросить БД (удаляет данные!)
```

---

## Роли и права

| Роль | Как получить | Что может |
|------|-------------|-----------|
| `unverified` | Регистрация | Видеть свой профиль, кошелёк |
| `user` | KYC approved | + Баланс, транзакции, мессенджер |
| `moderator` | Admin вручную | + Проверять KYC заявки |
| `admin` | В БД вручную | Полный доступ |

### KYC flow
```
Регистрация → POST /api/v1/kyc/submit → (модер проверяет) 
→ POST /api/v1/kyc/review {approved: true} → роль становится "user"
```

---

## API Endpoints (День 1)

### Auth
- `POST /api/v1/auth/register` — регистрация (автоматом создаёт кошелёк)
- `POST /api/v1/auth/login` — логин → access + refresh tokens
- `POST /api/v1/auth/refresh` — обновить токены
- `GET /api/v1/auth/me` — профиль текущего пользователя

### KYC
- `POST /api/v1/kyc/submit` — подать KYC заявку
- `POST /api/v1/kyc/review` — одобрить/отклонить (модер)
- `GET /api/v1/kyc/pending` — список ждущих проверки (модер)

### Wallet
- `GET /api/v1/wallet/me` — адрес кошелька
- `GET /api/v1/wallet/balance` — ETH + токены (только user+)

---

## День 2: Blockchain
1. Деплоим контракт: `bash scripts/dev.sh deploy-contract`
2. Копируем адрес в `.env` → `TOKEN_CONTRACT_ADDRESS=0x...`
3. Перезапускаем backend: `docker compose restart backend`
4. Добавляем endpoint для transfer токенов

## День 3: Мессенджер + Frontend
1. WebSocket endpoint `/ws/{conversation_id}`
2. E2E шифрование (ключи у клиента, сервер хранит cyphertext)
3. React + ethers.js фронтенд

---

## Как стать модератором (для тестов)
```bash
# Зайди в psql внутри контейнера:
bash scripts/dev.sh shell db
psql -U defi -d defidb

-- В psql:
UPDATE users SET role = 'moderator' WHERE username = 'testuser';
\q
```
