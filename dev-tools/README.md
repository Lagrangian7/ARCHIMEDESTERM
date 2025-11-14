
# Development Tools

This directory contains development utilities and services for the Archimedes Terminal.

## Text-to-Speech Services

### Japanese TTS (`tts_japanese.py`)
Converts Japanese text to speech using Google Text-to-Speech (gTTS).

**Usage:**
```bash
python tts_japanese.py "こんにちは、世界"
```

### Spanish TTS (`tts_spanish.py`)
Converts Spanish text to speech using Google Text-to-Speech (gTTS).

**Usage:**
```bash
python tts_spanish.py "Hola, mundo"
```

## Code Quality

All Python code in this directory follows:
- **PEP 8** style guidelines
- **Type hints** where appropriate
- **Docstrings** for all functions and modules
- **Error handling** with proper exception management
- **Imports** organized: standard library, third-party, local

## Dependencies

Install required packages:
```bash
pip install -r requirements.txt
```

### Package List
- `gTTS`: Google Text-to-Speech library for multilingual TTS

## Testing

Run individual TTS services to verify functionality:
```bash
# Test Japanese TTS
python tts_japanese.py "テストメッセージ"

# Test Spanish TTS
python tts_spanish.py "mensaje de prueba"
```

## Contributing

When adding new Python tools:
1. Follow PEP 8 style guidelines (use `flake8` or `black` for formatting)
2. Add comprehensive docstrings
3. Include error handling
4. Update this README
5. Add dependencies to `requirements.txt`
