#!/bin/bash
# scripts/dev.sh — основные команды для разработки

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

case "$1" in
  up)
    echo "🚀 Запуск всех сервисов..."
    docker compose up -d
    echo "⏳ Ждём готовности backend..."
    sleep 3
    docker compose logs backend --tail=20
    echo ""
    echo "✅ Готово!"
    echo "   API docs:   http://localhost:8000/docs"
    echo "   Health:     http://localhost:8000/health"
    echo "   Hardhat:    http://localhost:8545"
    ;;

  down)
    echo "🛑 Остановка..."
    docker compose down
    ;;

  logs)
    SERVICE=${2:-backend}
    docker compose logs -f "$SERVICE"
    ;;

  shell)
    SERVICE=${2:-backend}
    docker compose exec "$SERVICE" /bin/bash
    ;;

  test-api)
    echo "🧪 Тест: Health check"
    curl -s http://localhost:8000/health | python3 -m json.tool

    echo ""
    echo "🧪 Тест: Регистрация пользователя"
    curl -s -X POST http://localhost:8000/api/v1/auth/register \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com","username":"testuser","password":"password123"}' \
      | python3 -m json.tool

    echo ""
    echo "🧪 Тест: Логин"
    TOKEN=$(curl -s -X POST http://localhost:8000/api/v1/auth/login \
      -H "Content-Type: application/json" \
      -d '{"email":"test@example.com","password":"password123"}' \
      | python3 -c "import sys,json; print(json.load(sys.stdin)['access_token'])")
    echo "Access token: ${TOKEN:0:40}..."

    echo ""
    echo "🧪 Тест: /me (профиль)"
    curl -s http://localhost:8000/api/v1/auth/me \
      -H "Authorization: Bearer $TOKEN" \
      | python3 -m json.tool
    ;;

  deploy-contract)
    echo "📦 Деплой контракта в Hardhat..."
    docker compose exec hardhat npx hardhat run scripts/deploy.js --network localhost
    ;;

  reset-db)
    echo "⚠️  Удаление данных PostgreSQL..."
    docker compose down -v
    docker compose up -d db redis
    echo "✅ БД сброшена"
    ;;

  *)
    echo "Использование: $0 {up|down|logs [service]|shell [service]|test-api|deploy-contract|reset-db}"
    ;;
esac

  send-eth)
    ADDRESS=${2}
    AMOUNT=${3:-1}
    if [ -z "$ADDRESS" ]; then
      echo "Usage: bash scripts/dev.sh send-eth 0xADDRESS [amount]"
      exit 1
    fi
    echo "💸 Sending ${AMOUNT} ETH to ${ADDRESS}..."
    docker compose exec backend python3 -c "
import asyncio
from app.services.blockchain_service import w3
async def main():
    account = w3.eth.account.from_key('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
    nonce = await w3.eth.get_transaction_count(account.address)
    tx = {'to': '${ADDRESS}', 'value': w3.to_wei(${AMOUNT}, 'ether'), 'gas': 21000, 'gasPrice': w3.to_wei('1', 'gwei'), 'nonce': nonce, 'chainId': await w3.eth.chain_id}
    signed = account.sign_transaction(tx)
    receipt = await w3.eth.wait_for_transaction_receipt(await w3.eth.send_raw_transaction(signed.raw_transaction))
    bal = await w3.eth.get_balance('${ADDRESS}')
    print(f'✅ Sent! Balance: {w3.from_wei(bal, \"ether\")} ETH')
asyncio.run(main())
"
    ;;
