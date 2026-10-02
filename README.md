# Myraa — Real-Time Voice-to-Voice AI Companion (with AIRA Multimodal PC & Browser Agent)

**Myraa** is a futuristic, real-time, voice-to-voice AI assistant web application powered by the **Gemini Live API (`gemini-3.1-flash-live-preview`)** and the **Web Audio API**, combined with the **AIRA Multimodal Windows + Browser Agent** for authorized file, folder, screenshot, webpage, and desktop automation.

**Tap → Speak → Myraa responds.**

---

## 1. Requirements

* **Node.js**: v20+ recommended
* **Browser**: Modern Chromium, Edge, Firefox, or Safari with `AudioContext`, `AudioWorklet`, and `navigator.mediaDevices.getUserMedia` support
* **Gemini API Key**: A valid Google Gemini API key with access to `gemini-3.1-flash-live-preview`

---

## 2. Installation

```bash
npm install
```

---

## 3. Configuration

Copy `.env.example` to `.env` and set your Gemini API key:

```env
GEMINI_API_KEY="your_gemini_api_key_here"
VITE_GEMINI_API_KEY="your_gemini_api_key_here"
```

> **Security Note**: Never commit your `.env` file to Git. Myraa uses an Express + WebSocket backend bridge (`server.ts`) so `@google/genai` credentials remain protected on the server rather than exposed in public client bundles.

---

## 4. Running

Start the full-stack development server on `http://localhost:3000`:

```bash
npm run dev
```

Build for production:

```bash
npm run build
npm start
```

---

## 5. Architecture

### Output & Session Control Flow

```text
React UI (MyraaOrb / VoiceVisualizer / StatusIndicator)
   ↓
StateManager (disconnected | connecting | listening | speaking | interrupted | error)
   ↓
LiveSession (WebSocket Bridge /ws/live + ToolManager)
   ↓
Gemini Live API (gemini-3.1-flash-live-preview)
   ↓
AudioPlayer (24 kHz PCM16 Low-Latency Sequential Streaming & Instant Barge-In)
```

### Microphone Input Pipeline

```text
Microphone (MediaStream with Echo Cancellation & Noise Suppression)
   ↓
AudioStreamer (AudioWorkletNode → Resampled 16 kHz Mono PCM16 Chunks + Client VAD)
   ↓
LiveSession (Continuous Realtime Input Stream)
   ↓
Gemini Live API
```

### Modular Tool Registry (`ToolManager`)

```text
ToolManager
 ├── openWebsite          (Opens YouTube, Google, GitHub, Spotify, or custom URLs)
 ├── searchWeb            (Searches Google, YouTube, Wikipedia, DuckDuckGo, GitHub)
 ├── getCurrentTime       (Exact local & international IANA timezone clock readouts)
 ├── openApplication      (Launches browser/URI protocol apps & Windows Companion apps)
 ├── createReminder       (Persists voice reminders in localStorage)
 └── AIRA PC/Browser Tools (organize_desktop, search_files, list_directory, take_screenshot, read_page, whatsapp_send_message, get_system_info)
```

---

## 6. Troubleshooting

* **Microphone Permission Denied**: Click the lock/tune icon in your browser's address bar, allow Microphone access, and click **Try Connecting Again**.
* **API Key Missing or Invalid**: Verify `GEMINI_API_KEY` is set in `.env` (or in AI Studio Secrets) and restart the server.
* **No Audio Output**: Ensure your system output volume is unmuted and click the central orb directly (browsers require a user gesture to unlock `AudioContext`).
* **Browser Popup Blocked on `openWebsite`**: When a tool opens an external site asynchronously from a voice callback, Myraa also surfaces a one-tap **Launch Card** on screen so you can open the tab immediately.
