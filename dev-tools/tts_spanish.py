#!/usr/bin/env python3
"""
Spanish Text-to-Speech Service
Provides Spanish TTS capabilities using gTTS
"""

from gtts import gTTS
import sys
import os


def text_to_speech_spanish(text, output_file='output_spanish.mp3'):
    """
    Convert Spanish text to speech and save as MP3.

    Args:
        text: Spanish text to convert to speech
        output_file: Path to save the MP3 file

    Returns:
        Path to the generated MP3 file
    """
    try:
        # Create gTTS object with Spanish language
        tts = gTTS(text=text, lang='es', slow=False)

        # Save to file
        tts.save(output_file)
        print(f"Audio saved to {output_file}")
        return output_file

    except Exception as e:
        print(f"Error generating Spanish TTS: {e}", file=sys.stderr)
        sys.exit(1)


def main():
    """Main entry point for Spanish TTS."""
    if len(sys.argv) < 2:
        print("Usage: python tts_spanish.py <text>", file=sys.stderr)
        sys.exit(1)

    text = ' '.join(sys.argv[1:])
    output = text_to_speech_spanish(text)
    print(f"Successfully generated: {output}")


if __name__ == "__main__":
    main()