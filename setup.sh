#!/bin/bash

echo "🚀 Setting up AI News Reporter..."

# Backend setup
echo "📦 Setting up backend..."
cd backend
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install -r requirements.txt
echo "✅ Backend dependencies installed"
cd ..

# Frontend setup
echo "📦 Setting up frontend..."
cd frontend
npm install
echo "✅ Frontend dependencies installed"
cd ..

echo ""
echo "✨ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Copy backend/.env.example to backend/.env and add your API keys"
echo "2. Copy frontend/.env.example to frontend/.env.local"
echo "3. Start backend: cd backend && source venv/bin/activate && uvicorn app.main:app --reload"
echo "4. Start frontend: cd frontend && npm run dev"
echo ""
echo "📚 See README.md for detailed instructions"
