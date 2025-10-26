
#!/usr/bin/env python3
"""
Spanish Text-to-Speech using Coqui TTS
Preprocesses Spanish text to remove unwanted characters and synthesize natural speech.
"""

import re
import unicodedata
from TTS.api import TTS

def preprocess_spanish_text(text):
    """
    Preprocess Spanish text for TTS by:
    - Normalizing Unicode to NFKC form
    - Removing brackets and their contents
    - Removing unwanted symbols while keeping Spanish characters
    - Keeping accented characters (á, é, í, ó, ú, ñ, ü)
    - Keeping Spanish punctuation (¿, ¡, etc.)
    """
    # Normalize Unicode to NFKC (compatibility decomposition + canonical composition)
    text = unicodedata.normalize('NFKC', text)
    
    # Remove brackets and their contents
    text = re.sub(r'[\[\]【】\(\)（）\{\}]', '', text)
    text = re.sub(r'\[.*?\]', '', text)
    text = re.sub(r'【.*?】', '', text)
    
    # Keep Spanish alphabet (a-z, A-Z), accented characters, ñ, and Spanish punctuation
    # Keep: á é í ó ú ñ ü and their uppercase variants
    # Keep: Spanish punctuation (¿ ¡ . , ; : ! ? - ')
    text = re.sub(r'[^a-zA-ZáéíóúñüÁÉÍÓÚÑÜ¿¡.,;:!?\-\'\s]', '', text)
    
    # Normalize whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    
    return text

def synthesize_spanish_speech(text, output_file='output_spanish.wav', language='es'):
    """
    Synthesize Spanish speech from text using Coqui TTS XTTS v2 model.
    
    Args:
        text: Spanish text to synthesize
        output_file: Output WAV file path
        language: Language code (default: 'es' for Spanish)
    """
    print(f"Texto original: {text}")
    
    # Preprocess the text
    cleaned_text = preprocess_spanish_text(text)
    print(f"Texto limpio: {cleaned_text}")
    
    if not cleaned_text:
        print("Advertencia: No queda texto después del preprocesamiento")
        return
    
    # Initialize TTS with XTTS v2 multilingual model
    print("Cargando modelo XTTS v2 (esto puede tardar un momento)...")
    tts = TTS(model_name="tts_models/multilingual/multi-dataset/xtts_v2", progress_bar=True)
    
    # Synthesize speech
    print(f"Sintetizando voz a {output_file}...")
    tts.tts_to_file(
        text=cleaned_text,
        file_path=output_file,
        language=language
    )
    
    print(f"¡Éxito! Audio guardado en {output_file}")

if __name__ == "__main__":
    # Example usage with Spanish test text
    test_text = "¡Hola! [Prueba] ¿Cómo estás? Esta es una demostración de síntesis de voz en español."
    
    print("=" * 60)
    print("Demostración de Síntesis de Voz en Español")
    print("=" * 60)
    
    # Synthesize the test text
    synthesize_spanish_speech(test_text)
    
    # You can also try custom text:
    # custom_text = input("\nIngresa texto en español para sintetizar (o presiona Enter para omitir): ")
    # if custom_text.strip():
    #     synthesize_spanish_speech(custom_text, output_file='custom_output_spanish.wav')
