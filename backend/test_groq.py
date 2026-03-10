#!/usr/bin/env python3
"""Test script for Groq API connection."""
import asyncio
import sys
from app.config import settings
from langchain_groq import ChatGroq

async def test_groq_api():
    """Test Groq API connection and response generation."""
    try:
        print("Testing Groq API connection...")
        print(f"API Key present: {'Yes' if settings.groq_api_key else 'No'}")
        print(f"API Key length: {len(settings.groq_api_key) if settings.groq_api_key else 0}")
        
        if not settings.groq_api_key:
            print("ERROR: Groq API key not found in environment variables!")
            return False
        
        # Initialize LLM
        llm = ChatGroq(
            model="llama-3.3-70b-versatile",
            temperature=0.7,
            groq_api_key=settings.groq_api_key,
        )
        
        # Test simple query
        print("\nSending test query...")
        test_prompt = "Hello! Can you respond with a short greeting?"
        response = await llm.ainvoke(test_prompt)
        
        print(f"\n✅ SUCCESS! Groq API is working correctly.")
        print(f"Response: {response.content[:200]}")
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: Groq API test failed!")
        print(f"Error: {str(e)}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_groq_api())
    sys.exit(0 if success else 1)
