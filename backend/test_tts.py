"""Test script for TTS endpoint"""
import asyncio
import sys
from app.services.tts_service import synthesize_speech

async def test_tts():
    """Test TTS synthesis"""
    try:
        print("Testing TTS synthesis...")
        text = "Hello, this is a test of the text to speech system."
        voice = "en-US-AriaNeural"
        
        print(f"Text: {text}")
        print(f"Voice: {voice}")
        
        audio_data = await synthesize_speech(text, voice)
        
        if audio_data and len(audio_data) > 0:
            print(f"✅ TTS synthesis successful!")
            print(f"   Audio data size: {len(audio_data)} bytes")
            return True
        else:
            print("❌ TTS synthesis returned empty data")
            return False
    except Exception as e:
        print(f"❌ TTS synthesis failed: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = asyncio.run(test_tts())
    sys.exit(0 if success else 1)
