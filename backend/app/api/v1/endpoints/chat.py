from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_token
from app.models.user import User
from app.models.message import Conversation, ConversationParticipant, Message
from app.services.chat_service import manager

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_user_from_token(token: str, db: AsyncSession) -> User:
    payload = decode_token(token)
    user_id = int(payload.get("sub"))
    result = await db.execute(select(User).where(User.id == user_id))
    return result.scalar_one_or_none()


@router.post("/conversations")
async def create_conversation(
    recipient_id: int,
    db: AsyncSession = Depends(get_db),
    # В реальном проекте тут get_current_user, упрощаем для теста
):
    conv = Conversation()
    db.add(conv)
    await db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=1))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=recipient_id))
    await db.commit()
    return {"conversation_id": conv.id}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(conversation_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Message)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    messages = result.scalars().all()
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "content": m.encrypted_content,
            "created_at": m.created_at.isoformat(),
        }
        for m in messages
    ]


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    conversation_id: int,
    token: str,
):
    async with AsyncSessionLocal() as db:
        user = await get_user_from_token(token, db)
        if not user:
            await websocket.close(code=4001)
            return

        await manager.connect(websocket, conversation_id, user.id)
        try:
            while True:
                data = await websocket.receive_text()

                # Сохраняем сообщение в БД
                async with AsyncSessionLocal() as db2:
                    msg = Message(
                        conversation_id=conversation_id,
                        sender_id=user.id,
                        encrypted_content=data,
                    )
                    db2.add(msg)
                    await db2.commit()
                    await db2.refresh(msg)

                # Рассылаем всем в комнате
                await manager.broadcast(conversation_id, {
                    "id": msg.id,
                    "sender_id": user.id,
                    "sender": user.username,
                    "content": data,
                    "created_at": msg.created_at.isoformat(),
                })
        except WebSocketDisconnect:
            manager.disconnect(websocket, conversation_id)
