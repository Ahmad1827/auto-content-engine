# Auto Content Engine

Automated YouTube video generator with AI narration.

## Pipeline
```
Gemini (script) → Kokoro TTS (voice) → MoviePy (video)
```

---

## Kokoro TTS Setup (voice generation)

Kokoro-82M is a local TTS model (~300MB). Runs offline after first download. Requires Python 3.12 and espeak-ng.

### 1. Install Python 3.12
- Download from: https://www.python.org/downloads/release/python-3120/
- Get **"Windows installer (64-bit)"**
- At install: **Customize installation** → check all → Install
- Do NOT check "Add to PATH" (to avoid conflicts with other Python versions)
- **Important:** must be stable 3.12 (not 3.13, 3.14, or any beta)

### 2. Install espeak-ng
- Download from: https://github.com/espeak-ng/espeak-ng/releases
- Get the `.msi` file (e.g. `espeak-ng-20191129-b702b03-x64.msi`)
- Install it (Next → Next → Install)
- Open **CMD as Administrator** and run:
```cmd
setx PATH "%PATH%;C:\Program Files\eSpeak NG" /M
```
- Close CMD

### 3. Create virtual environment
Open **CMD** (not PowerShell) and run line by line:
```cmd
cd /d "D:\Python projects\Auto_Content_Engine\auto-content-engine"
"C:\Users\massi\AppData\Local\Programs\Python\Python312\python.exe" -m venv kokoro_env
kokoro_env\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
```
Note: `pip install` takes 5-15 minutes (downloads PyTorch ~2GB). This is normal.

### 4. Test voice
```cmd
cd src\voice_gen
python test_voice.py
```
First run downloads Kokoro model (~300MB) from HuggingFace. After that it works offline.
Output: `test_output/test_FULL.wav`

---

## Running the app

### PowerShell (VS Code terminal)
```powershell
cd "D:\Python projects\Auto_Content_Engine\auto-content-engine"
.\kokoro_env\Scripts\Activate.ps1
python run.py
```

If you get "scripts disabled" error, run once:
```powershell
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

### CMD
```cmd
cd /d "D:\Python projects\Auto_Content_Engine\auto-content-engine"
kokoro_env\Scripts\activate.bat
python run.py
```

---

## API Keys

Create a `.env` file in the project root:
```
GEMINI_API_KEY=your_key_here
```
Get your key from: https://aistudio.google.com/apikey

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| numpy/torch build failed | Wrong Python version. Must be 3.12 stable |
| espeak-ng not found | Install MSI + add to PATH (see step 2) |
| activate.bat won't run | You're in PowerShell. Type `cmd` first, or use `.ps1` |
| pip seems stuck | Normal — downloading ~2GB. Wait 5-15 min |
| Voice sounds robotic | Use preset "calm" (speed 0.85) instead of "narration" |
| Gemini 429 error | Rate limited. Wait 1 min and retry |
