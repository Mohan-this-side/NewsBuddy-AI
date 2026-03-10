from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import news, chat, tts
from app.config import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="AI News Reporter API",
    description="Backend API for AI News Reporter platform",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url, "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(news.router)
app.include_router(chat.router)
app.include_router(tts.router)


@app.get("/")
async def root():
    return {"message": "AI News Reporter API", "status": "running"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
