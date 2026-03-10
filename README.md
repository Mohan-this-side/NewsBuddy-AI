# AI News Reporter

An intelligent news platform that aggregates real-time news and enables users to have interactive voice conversations with an AI-powered news companion. Built with FastAPI, Next.js, LangChain, and Groq.

## Features

- 📰 **Multi-Source News Aggregation**: Fetches news from Google News RSS, Hacker News, and GNews API
- 🤖 **AI-Powered Companion**: Interactive animated avatar that explains news articles conversationally
- 🎤 **Voice Interaction**: Browser-native speech recognition and text-to-speech synthesis
- 💬 **Real-Time Chat**: WebSocket-based chat with article-grounded responses using RAG
- 🎨 **Modern UI**: Beautiful, responsive design with dark theme
- ⚡ **Low Latency**: Optimized for sub-3-second response times

## Architecture

```
Frontend (Next.js)          Backend (FastAPI)
├── News Browsing UI    ←→   ├── News Aggregation Service
├── Article View        ←→   ├── RAG Pipeline (FAISS)
├── Animated Avatar     ←→   ├── Multi-Agent System (LangGraph)
├── Voice Input         ←→   ├── Groq LLM (Llama 3.3 70B)
└── Audio Playback      ←→   └── Edge TTS Service
```

## Tech Stack

### Backend
- **FastAPI**: Async web framework
- **LangChain + LangGraph**: Multi-agent orchestration
- **Groq API**: Ultra-fast LLM inference (~200ms)
- **FAISS**: Vector similarity search
- **sentence-transformers**: Local embeddings
- **Edge TTS**: Neural text-to-speech
- **newspaper3k**: Article content extraction

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety
- **TailwindCSS**: Styling
- **Framer Motion**: Animations
- **Web Speech API**: Browser-native STT
- **Web Audio API**: Audio playback and lip sync

## Setup Instructions

### Prerequisites

- Python 3.9+
- Node.js 18+
- Groq API key ([Get one here](https://console.groq.com))
- GNews API key (optional, [Get one here](https://gnews.io))

### Backend Setup

1. Navigate to the backend directory:
```bash
cd backend
```

2. Create a virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

3. Install dependencies:
```bash
pip install -r requirements.txt
```

4. Create a `.env` file from `.env.example`:
```bash
cp .env.example .env
```

5. Edit `.env` and add your API keys:
```env
GROQ_API_KEY=your_groq_api_key_here
GNEWS_API_KEY=your_gnews_api_key_here  # Optional
BACKEND_URL=http://localhost:8000
FRONTEND_URL=http://localhost:3000
```

6. Run the backend server:
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

The API will be available at `http://localhost:8000`

### Frontend Setup

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env.local` file:
```bash
cp .env.example .env.local
```

4. Edit `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_WS_URL=ws://localhost:8000
```

5. Run the development server:
```bash
npm run dev
```

The frontend will be available at `http://localhost:3000`

## Usage

1. **Browse News**: Navigate through different categories (Hot, AI & Tech, Sports, Geopolitics, Business, Science)
2. **Read Articles**: Click on any news card to view the full article
3. **Interact with AI Companion**: 
   - The AI companion automatically greets you with an article summary
   - Ask questions via voice (click the microphone button) or text input
   - The avatar animates and speaks responses
   - Use the mute button to silence audio while reading

## Project Structure

```
Project ANC/
├── backend/
│   ├── app/
│   │   ├── main.py              # FastAPI entry point
│   │   ├── config.py            # Configuration
│   │   ├── routers/             # API routes
│   │   ├── agents/              # Multi-agent system
│   │   ├── services/            # Business logic
│   │   └── models/              # Data models
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/                 # Next.js pages
│   │   ├── components/          # React components
│   │   ├── hooks/               # Custom hooks
│   │   └── lib/                 # Utilities
│   └── package.json
└── README.md
```

## API Endpoints

### News API
- `GET /api/news?category={category}&page={page}&page_size={size}` - Get news articles
- `GET /api/news/trending` - Get trending news
- `GET /api/news/article/{article_id}` - Get full article content

### Chat API
- `WS /ws/chat/{article_id}` - WebSocket connection for chat

### TTS API
- `POST /api/tts/synthesize` - Synthesize speech from text

## Performance Targets

- **End-to-end latency**: < 3 seconds (voice input → voice output)
- **News cache TTL**: 15 minutes
- **FAISS index cache**: LRU cache, max 100 articles

## Limitations & Future Improvements

- **Current Limitations**:
  - GNews API has 100 requests/day limit (caching mitigates this)
  - Web Speech API accuracy varies by browser
  - Article scraping may fail for some sites

- **Future Enhancements**:
  - Multi-article conversation support
  - Multilingual support
  - Custom avatar customization
  - Mobile app version
  - User accounts and saved articles

## License

This project is for educational purposes (CS5100 Foundation of AI course).

## Authors

- Mohan Bhosale
- Karthikeyan Sugavanan
