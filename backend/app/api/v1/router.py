from fastapi import APIRouter
from app.api.v1.endpoints import auth, kyc, wallet

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(kyc.router)
api_router.include_router(wallet.router)
