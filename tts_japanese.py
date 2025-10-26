
#!/usr/bin/env python3
"""
Japanese Text-to-Speech using Coqui TTS
Preprocesses Japanese text to remove unwanted characters and synthesize natural speech.
"""

import re
import unicodedata
from TTS.api import TTS

def preprocess_japanese_text(text):
    """
    Preprocess Japanese text for TTS by:
    - Normalizing Unicode to NFKC form
    - Removing brackets and their contents
    - Removing long vowel marks (ー) that might be mispronounced
    - Removing extra punctuation while keeping basic Japanese punctuation
    - Keeping hiragana, katakana, kanji, and basic punctuation
    """
    # Normalize Unicode to NFKC (compatibility decomposition + canonical composition)
    text = unicodedata.normalize('NFKC', text)
    
    # Remove brackets and their contents
    text = re.sub(r'[\[\]【】\(\)（）\{\}]', '', text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'【.*?】', '', text)
    
    # Remove long vowel marks (ー) - these can be problematic in TTS
    text = text.replace('ー', '')
    
    # Remove unwanted symbols but keep Japanese punctuation
    # Keep: hiragana (3040-309F), katakana (30A0-30FF), kanji (4E00-9FFF)
    # Keep: Japanese punctuation (。、！？・)
    # Remove: other special characters, diacritics, brackets, etc.
    text = re.sub(r'[^\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF。、！？・\s]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def synthesize_japanese_speech(text, output_file='output.wav', language='ja'):
    """
    Synthesize Japanese speech from text using Coqui TTS XTTS v2 model.
    
    Args:
        text: Japanese text to synthesize
        output_file: Output WAV file path
        language: Language code (default: 'ja' for Japanese)
    """
    print(f"Original text: {text}")
    
    # Preprocess the text
    cleaned_text = preprocess_japanese_text(text)
    print(f"Cleaned text: {cleaned_text}")
    
    if not cleaned_text:
        print("Warning: No text remaining after preprocessing")
        return
    
    # Initialize TTS with XTTS v2 multilingual model
    print("Loading XTTS v2 model (this may take a moment)...")
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True)
    
    # Synthesize speech
    print(f"Synthesizing speech to {output_file}...")
    tts.tts_to_file(
        text=cleaned_text,
        file_path=output_file,
        language=language
    )
    
    print(f"Success! Audio saved to {output_file}")

if __name__ == "__main__":
    # Example usage with test text
    test_text = "こんにちは！[テスト] これはー長い音です。"
    
    print("=" * 60)
    print("Japanese Text-to-Speech Demo")
    print("=" * 60)
    
    # Synthesize the test text
    synthesize_japanese_speech(test_text)
    
    # You can also try custom text:
    # custom_text = input("\nEnter Japanese text to synthesize (or press Enter to skip): ")
    # if custom_text.strip():
    #     synthesize_japanese_speech(custom_text, output_file='custom_output.wav')
