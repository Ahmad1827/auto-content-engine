# Auto Content Engine

Automated YouTube video generator with AI narration.

## ⚙️ Project Architecture

Data processing pipeline:
`Gemini (Script) ➔ Kokoro TTS (Voice) ➔ MoviePy (Video)`

---

## 🛠️ System Requirements & Setup

The **Kokoro-82M** model (~300MB) runs locally and requires strict configurations to work offline after the initial download.

### 1. Install Python 3.12
**Important:** You must strictly use the stable 3.12 version. Do not use 3.13, 3.14, or beta versions, as the required packages will not build correctly.

* Download the **"Windows installer (64-bit)"** from: [Python 3.12 Releases](https://www.python.org/downloads/release/python-3120/)
* During installation, choose **Customize installation** and check all options.
* **DO NOT** check "Add to PATH" to avoid conflicts with other Python versions already installed on your system.

### 2. Install espeak-ng
* Download the `.msi` file (e.g., `espeak-ng-20191129-b702b03-x64.msi`) from: [espeak-ng Releases](https://github.com/espeak-ng/espeak-ng/releases)
* Install the program using the default settings.
* Open **CMD as Administrator** and add the program to the environment variables:

```cmd
setx PATH "%PATH%;C:\Program Files\eSpeak NG" /M
```
* Close the CMD window after running.

### 3. API Key Configuration
The project requires access to the Gemini API.
* Get your key from: [Google AI Studio](https://aistudio.google.com/apikey)
* Create a file named `.env` in the root of the project and add the key:

```text
GEMINI_API_KEY=your_key_here
```

### 4. Create Virtual Environment
Open a **standard CMD** terminal (not PowerShell) and run the commands below sequentially. The package installation will take between 5 and 15 minutes (it downloads PyTorch, ~2GB).

```cmd
cd /d "D:\Python projects\Auto_Content_Engine\auto-content-engine"
"C:\Users\massi\AppData\Local\Programs\Python\Python312\python.exe" -m venv kokoro_env
kokoro_env\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
```

### 5. Local Voice Testing
The first run will download the Kokoro model from HuggingFace. Afterwards, it will work 100% offline. The generated file will be saved to `test_output/test_FULL.wav`.

```cmd
cd src\voice_gen
python test_voice.py
```

---

## 🚀 Running the App

Navigate to the project folder and activate the virtual environment depending on your preferred terminal:

**Using PowerShell (e.g., VS Code Terminal):**

If you receive a "scripts disabled" error, run this first: `Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned`

```powershell
cd "D:\Python projects\Auto_Content_Engine\auto-content-engine"
.\kokoro_env\Scripts\Activate.ps1
python run.py
```

**Using CMD:**

```cmd
cd /d "D:\Python projects\Auto_Content_Engine\auto-content-engine"
kokoro_env\Scripts\activate.bat
python run.py
```

---

## 🔧 Troubleshooting

| Problem | Solution |
| :--- | :--- |
| **numpy/torch build failed** | Incorrect Python version. You must exclusively use stable Python 3.12. |
| **espeak-ng not found** | Install the MSI file and add the path to PATH (see step 2). |
| **activate.bat won't run** | You are in a PowerShell terminal. Type `cmd` first, or use the `.ps1` script. |
| **pip installation seems stuck** | This is normal. It is downloading ~2GB of data. Wait 5-15 minutes. |
| **Voice sounds too robotic** | Use the "calm" preset with the speed set to 0.85 instead of "narration". |
| **Gemini 429 error** | Rate limited. Wait 1 minute and try again. |