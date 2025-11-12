# Development Tools

## Python TTS Scripts

These scripts are for **local development and testing only**. They are **NOT** used in production deployments.

### Files:
- `tts_japanese.py` - Japanese text-to-speech using Coqui TTS
- `tts_spanish.py` - Spanish text-to-speech using Coqui TTS

### Requirements:
These scripts require Python packages that are several GB in size:
```
TTS>=0.22.0
jaconv>=0.3.4
unidecode>=0.3.8
```

### Installation (Local Development Only):
```bash
pip install TTS>=0.22.0 jaconv>=0.3.4 unidecode>=0.3.8
```

### Production App:
The main ARCHIMEDES application uses **Web Speech API** (browser-based) for all text-to-speech functionality. This requires zero server dependencies and supports multiple languages including English, Japanese, Spanish, and more.

See `client/src/hooks/use-speech.ts` for the production TTS implementation.
