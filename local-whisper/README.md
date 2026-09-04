# Local whisper.cpp fallback

Consult Scribe uses browser speech recognition first. **whisper.cpp is used only when starting a conversation produces a `network` speech-recognition error.** After that switch, microphone audio is converted to 16-bit 16 kHz WAV in the browser and sent only to the local Express backend at `localhost`; the backend runs `whisper-cli.exe` and the local GGML model.

This keeps the speech fallback offline from Google/OpenAI/Groq.

## Windows setup

1. Run `setup-whisper-windows.ps1` from this folder in PowerShell. It downloads the official whisper.cpp Windows x64 binary and the multilingual `base` model.
2. The script prints the two paths to put into `backend/.env`.
3. Copy `backend/.env.example` to `backend/.env` and set:

```env
WHISPER_CPP_PATH=C:\ConsultScribe\whisper.cpp\whisper-cli.exe
WHISPER_MODEL_PATH=C:\ConsultScribe\whisper.cpp\models\ggml-base.bin
WHISPER_THREADS=0
```

The multilingual `base` model is intentional because the UI supports Tamil and English. The official whisper.cpp CLI expects 16-bit WAV input; Consult Scribe now creates that format locally before fallback transcription.

## Performance

`base` is the recommended demo balance for Tamil + English. If the PC is weaker, replace the model with `ggml-tiny.bin`; if you want better accuracy and accept more CPU time, use `ggml-small.bin`.
