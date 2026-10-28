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

### The app
- **Sidebar:** pick what you're making: *Motion graphics*, *Documentary* or *Reddit story*. Only that mode's settings are shown.
- **Surprise me** (Motion) asks the AI for a fresh history or religion topic, avoiding the ones you already made. **Trending** (Documentary) pulls trending topics.
- **+ paste my own script instead** swaps the AI script for yours.
- **The reel** (right) lists your finished videos with thumbnails: *Play* opens one, *Copy caption* copies its TikTok description.
- **Night shift:** queue videos with *+ Add to night shift*, then start the shift and let it run overnight.
- Light and dark themes (bottom left). The app remembers your last mode, style, voice and handle in `.ace_settings.json`.

---

## ✨ Motion Graphics Mode (AI animated TikToks)

Animated explainers drawn with code instead of stock images, with word-by-word captions.

**Styles:** Atlas (dark glowing history maps), Ink (warm line art), Parchment (old map on paper), Neon (synthwave, for mysteries and tech), Newspaper (1900s front page). On *Auto*, the AI picks the style that fits the topic. Styles are color and font tokens in `motion/src/theme.ts`.

**Scene types the AI combines:** map (flags, arrows, country or region zoom), counter, title card, line-art illustration, with/without comparison, timeline, quote, versus (stats battle).

`Topic ➔ AI storyboard (scenes + visuals as JSON) ➔ Kokoro voice with word timings ➔ Remotion (React) render ➔ 1080x1920 MP4`

**AI is detected automatically.** If Claude Code is installed and logged in (`claude` on PATH), the app uses it, running on your Claude subscription with no API key. Otherwise it falls back to `GEMINI_API_KEY`. The sidebar shows which one is active. Force one with `ACE_LLM=claude` or `ACE_LLM=gemini`, and pick a Claude model with `ACE_CLAUDE_MODEL=opus`.

**Requirements:** Node.js 20+. The first render installs the packages in `motion/` automatically.

**GUI:** choose *Motion graphics* in the sidebar, type a subject (or hit *Surprise me*), click a style card, pick a voice and a length.

**CLI:**

    python make_motion.py "The Karboğazı ambush of 1920" --style atlas --handle @yourchannel

Output goes to `output/`: the `.mp4`, a `.caption.txt` (TikTok description + hashtags) and a `.storyboard.json`. Edit the JSON (narration, headlines, map markers...) and re-render it with voice using `python make_motion.py --from-storyboard output/<name>.storyboard.json`. Add `--seconds 30` to a new video to change its target length. Preview and tweak the templates live with `cd motion && npm run studio`.

Renders take ~3-5 min per minute of video on a 4-core CPU.

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