from typing import Dict, Set
from fastapi import WebSocket
import json


class ConnectionManager:
    def __init__(self):
        # conversation_id -> set of websockets
        self.rooms: Dict[int, Set[WebSocket]] = {}
        # websocket -> user_id
        self.users: Dict[WebSocket, int] = {}

    async def connect(self, websocket: WebSocket, conversation_id: int, user_id: int):
        await websocket.accept()
        if conversation_id not in self.rooms:
            self.rooms[conversation_id] = set()
        self.rooms[conversation_id].add(websocket)
        self.users[websocket] = user_id

    def disconnect(self, websocket: WebSocket, conversation_id: int):
        self.rooms.get(conversation_id, set()).discard(websocket)
        self.users.pop(websocket, None)

    async def broadcast(self, conversation_id: int, message: dict, exclude: WebSocket = None):
        for ws in list(self.rooms.get(conversation_id, set())):
            if ws != exclude:
                try:
                    await ws.send_text(json.dumps(message))
                except Exception:
                    pass


manager = ConnectionManager()
