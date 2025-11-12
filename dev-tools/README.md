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

**Option 1: Minimal install (recommended - saves disk space)**
```bash
cd dev-tools
pip install -r requirements.txt
```

**Option 2: Full install with all language models (requires ~3GB+)**
```bash
pip install TTS>=0.22.0 jaconv>=0.3.4 unidecode>=0.3.8
```

Note: The minimal install excludes heavy language models like `gruut_lang_de` (German) to save disk space.

### Production App:
The main ARCHIMEDES application uses **Web Speech API** (browser-based) for all text-to-speech functionality. This requires zero server dependencies and supports multiple languages including English, Japanese, Spanish, and more.

See `client/src/hooks/use-speech.ts` for the production TTS implementation.
