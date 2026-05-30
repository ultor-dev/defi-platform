#!/bin/bash
ADDRESS=${1}
AMOUNT=${2:-1}

if [ -z "$ADDRESS" ]; then
  echo "Usage: bash scripts/send_eth.sh 0xADDRESS [amount]"
  exit 1
fi

echo "💸 Sending ${AMOUNT} ETH to ${ADDRESS}..."
cd ~/projects/defi-platform
docker compose exec backend python3 -c "
import asyncio
from app.services.blockchain_service import w3
async def main():
    account = w3.eth.account.from_key('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
    nonce = await w3.eth.get_transaction_count(account.address)
    chain_id = await w3.eth.chain_id
    tx = {
        'to': '${ADDRESS}',
        'value': w3.to_wei(${AMOUNT}, 'ether'),
        'gas': 21000,
        'gasPrice': w3.to_wei('1', 'gwei'),
        'nonce': nonce,
        'chainId': chain_id,
    }
    signed = account.sign_transaction(tx)
    receipt = await w3.eth.wait_for_transaction_receipt(await w3.eth.send_raw_transaction(signed.raw_transaction))
    bal = await w3.eth.get_balance('${ADDRESS}')
    print(f'Status: {receipt.status}')
    print(f'Balance: {w3.from_wei(bal, \"ether\")} ETH')
asyncio.run(main())
"
