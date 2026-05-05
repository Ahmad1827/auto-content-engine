# Auto Content Engine Pro

Automated dual-format video generator with AI narration, intelligent asset fetching, and cinematic editing. Optimized for WSL (Ubuntu).

## ⚙️ Project Architecture

Data processing pipeline:
`Trends / NewsAPI ➔ Gemini (Script) ➔ Web Scrape / Bing Image Creator ➔ Kokoro TTS (Voice) ➔ FFmpeg (Edit) ➔ MoviePy (Final Render)`

---

## 🛠️ System Requirements & Setup

The **Kokoro-82M** model (~300MB) runs locally. This project is configured to run entirely inside **WSL2 (Ubuntu)**.

### 1. Install System Dependencies
Open your Ubuntu terminal and install the required packages:

    sudo apt update
    sudo apt install ffmpeg espeak-ng python3.12-venv python3-pip

### 2. API Key Configuration
Create a file named `.env` in the root of the project.

    GEMINI_API_KEY="your_google_ai_studio_key"
    NEWS_API_KEY="your_newsapi_key"
    EXPLODING_TOPICS_KEY=""
    BING_COOKIE="your__U_cookie_value"
    BING_SRCH_COOKIE="your_SRCHHPGUSR_cookie_value"
    PEXELS_API_KEY="your_pexels_key_optional"

### 3. Create Virtual Environment & Install Packages
Navigate to your project folder inside WSL. The package installation will take a few minutes as it downloads PyTorch.

    python3 -m venv wsl_env
    source wsl_env/bin/activate
    pip install --upgrade pip
    pip install -r requirements.txt
    pip install requests python-dotenv BingImageCreator pytrends

---

## 🚀 Running the App

Navigate to the project folder and activate the virtual environment:

    source wsl_env/bin/activate
    python3 run.py

### 1-Click Viral Maker
1. Select format (`9:16 Shorts` or `16:9 YouTube`).
2. Select media type (`Documentary` or `Gameplay`).
3. Click **Generate Random Trending Video**.
4. Approve the global trend fetched via NewsAPI or Google Trends.
5. The app will generate the script, voice, subtitles, and video automatically.

---

## 🔧 Troubleshooting

| Problem | Solution |
| :--- | :--- |
| **numpy/torch build failed** | Ensure you are using Python 3.12 inside WSL. |
| **espeak-ng / ffmpeg not found** | Run `sudo apt install ffmpeg espeak-ng` in your Ubuntu terminal. |
| **Exec format error (VS Code)** | WSL interop is off. Edit `/etc/wsl.conf`, add `[interop] enabled=true appendWindowsPath=true`, save, and run `wsl --shutdown` in Windows PowerShell. |
| **Reddit pipeline failed: 'body'** | Ensure the generated AI script is passed as a dictionary containing `title`, `selftext`, and `body` keys before sending to the Reddit processor. |
| **Bing AI Failed: Redirect failed** | Your Bing cookies (`_U` and `SRCHHPGUSR`) expired. Grab new ones from your browser (Developer Tools -> Application -> Cookies) and update `.env`. |
| **Gemini 503 UNAVAILABLE** | Google servers are overloaded. Wait 30-60 seconds and click generate again. |