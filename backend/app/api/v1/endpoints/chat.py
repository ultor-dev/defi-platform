from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import joinedload

from app.core.database import get_db, AsyncSessionLocal
from app.core.security import decode_token, get_current_user
from app.models.user import User
from app.models.message import Conversation, ConversationParticipant, Message
from app.services.chat_service import manager

router = APIRouter(prefix="/chat", tags=["chat"])


async def get_user_from_token(token: str) -> User | None:
    try:
        payload = decode_token(token)
        user_id = int(payload.get("sub"))
        async with AsyncSessionLocal() as db:
            result = await db.execute(select(User).where(User.id == user_id))
            return result.scalar_one_or_none()
    except Exception:
        return None


async def get_or_create_conversation(user1_id: int, user2_id: int, db: AsyncSession) -> int:
    """Находит существующий диалог между двумя юзерами или создаёт новый."""
    # Ищем общий conversation
    result = await db.execute(
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id == user1_id)
    )
    user1_convs = {r[0] for r in result.fetchall()}

    result = await db.execute(
        select(ConversationParticipant.conversation_id)
        .where(ConversationParticipant.user_id == user2_id)
    )
    user2_convs = {r[0] for r in result.fetchall()}

    common = user1_convs & user2_convs
    if common:
        return min(common)

    # Создаём новый
    conv = Conversation()
    db.add(conv)
    await db.flush()
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=user1_id))
    db.add(ConversationParticipant(conversation_id=conv.id, user_id=user2_id))
    await db.commit()
    return conv.id


@router.get("/users")
async def get_users(current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Список всех пользователей для начала диалога."""
    result = await db.execute(select(User).where(User.id != current_user.id))
    users = result.scalars().all()
    return [{"id": u.id, "username": u.username, "role": u.role} for u in users]


@router.post("/conversations/with/{user_id}")
async def open_conversation(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Открыть или создать диалог с пользователем."""
    result = await db.execute(select(User).where(User.id == user_id))
    target = result.scalar_one_or_none()
    if not target:
        raise HTTPException(404, "User not found")

    conv_id = await get_or_create_conversation(current_user.id, user_id, db)
    return {"conversation_id": conv_id, "with": {"id": target.id, "username": target.username}}


@router.get("/conversations/{conversation_id}/messages")
async def get_messages(
    conversation_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    # Проверяем что юзер участник
    result = await db.execute(
        select(ConversationParticipant).where(
            and_(
                ConversationParticipant.conversation_id == conversation_id,
                ConversationParticipant.user_id == current_user.id,
            )
        )
    )
    if not result.scalar_one_or_none():
        raise HTTPException(403, "Not a participant")

    result = await db.execute(
        select(Message, User.username)
        .join(User, Message.sender_id == User.id)
        .where(Message.conversation_id == conversation_id)
        .order_by(Message.created_at)
    )
    rows = result.fetchall()
    return [
        {
            "id": m.id,
            "sender_id": m.sender_id,
            "sender": username,
            "content": m.encrypted_content,
            "created_at": m.created_at.isoformat(),
        }
        for m, username in rows
    ]


@router.websocket("/ws/{conversation_id}")
async def websocket_endpoint(websocket: WebSocket, conversation_id: int, token: str):
    user = await get_user_from_token(token)
    if not user:
        await websocket.close(code=4001)
        return

    # Проверяем участие в conversation
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(ConversationParticipant).where(
                and_(
                    ConversationParticipant.conversation_id == conversation_id,
                    ConversationParticipant.user_id == user.id,
                )
            )
        )
        if not result.scalar_one_or_none():
            await websocket.close(code=4003)
            return

    await manager.connect(websocket, conversation_id, user.id)

    try:
        while True:
            data = await websocket.receive_text()
            if not data.strip():
                continue

            async with AsyncSessionLocal() as db:
                msg = Message(
                    conversation_id=conversation_id,
                    sender_id=user.id,
                    encrypted_content=data,
                )
                db.add(msg)
                await db.commit()

                # найти второго участника
                async with AsyncSessionLocal() as db2:
                    result2 = await db2.execute(
                        select(ConversationParticipant.user_id).where(
                            ConversationParticipant.conversation_id == conversation_id,
                            ConversationParticipant.user_id != user.id,
                        )
                    )
                    recipient_id = result2.scalar_one_or_none()
                    if recipient_id:
                        from app.models.notification import Notification, NotificationType
                        db2.add(Notification(
                            user_id=recipient_id,
                            type=NotificationType.NEW_MESSAGE,
                            title="New Message 💬",
                            body=f"{user.username}: {data[:80]}",
                        ))
                        await db2.commit()

                await db.refresh(msg)

            await manager.broadcast(conversation_id, {
                "id": msg.id,
                "sender_id": user.id,
                "sender": user.username,
                "content": data,
                "created_at": msg.created_at.isoformat(),
            })
    except WebSocketDisconnect:
        manager.disconnect(websocket, conversation_id)
