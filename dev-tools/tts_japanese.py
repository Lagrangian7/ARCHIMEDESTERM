#!/usr/bin/env python3
"""
Japanese Text-to-Speech Service
Provides Japanese TTS capabilities using gTTS
"""

from gtts import gTTS
import sys
import os


def text_to_speech_japanese(text, output_file='output_japanese.mp3'):
    """
    Convert Japanese text to speech and save as MP3.

    Args:
        text: Japanese text to convert to speech
        output_file: Path to save the MP3 file

    Returns:
        Path to the generated MP3 file
    """
    try:
        # Create gTTS object with Japanese language
        tts = gTTS(text=text, lang='ja', slow=False)

        # Save to file
        tts.save(output_file)
        print(f"Audio saved to {output_file}")
        return output_file

    except Exception as e:
        print(f"Error generating Japanese TTS: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main entry point for Japanese TTS."""
    if len(sys.argv) < 2:
        print("Usage: python tts_japanese.py <text>", file=sys.stderr)
        sys.exit(1)

    text = ' '.join(sys.argv[1:])
    output = text_to_speech_japanese(text)
    print(f"Successfully generated: {output}")


if __name__ == "__main__":
    main()