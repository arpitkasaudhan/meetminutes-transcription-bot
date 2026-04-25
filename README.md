# MeetMinutes — Google Meet Transcription Bot

A system where a user submits a Google Meet link, a bot joins the meeting, captures audio, and streams a live transcription to the frontend in real-time.

---

## Architecture Overview

```
Browser (React)
    │  POST /sessions          (REST)
    │  WS join-session         (Socket.IO)
    ▼
NestJS Backend (port 3000)
    │  BullMQ job → Redis
    ▼
BotProcessor (Worker)
    │  spawn node dist/bot/bot.js
    ▼
Playwright Bot (Chromium + Xvfb)
    │  WS audio-chunk, bot-status  (Socket.IO back to backend)
    ▼
NestJS Backend
    │  Groq Whisper API (HTTP)
    ▼
Frontend (Socket.IO transcript-chunk event)
```

---

## Quick Start (Docker)

**Prerequisites:** Docker + Docker Compose, a free [Groq API key](https://console.groq.com).

```bash
cp .env.example .env
# Edit .env and set GROQ_API_KEY=gsk_...

docker compose up --build
```

- Frontend: http://localhost
- Backend API: http://localhost:3000
- Redis: localhost:6379

---

## Local Development (without Docker)

### Prerequisites

- Node.js 20+
- Redis running locally (`docker run -p 6379:6379 redis:alpine`)
- A Groq API key

### Backend

```bash
cd backend
npm install
npx playwright install chromium   # download Chromium browser

cp ../.env.example .env            # set GROQ_API_KEY

npm run build         # compiles NestJS app + bot script
npm run start         # or: npm run start:dev for watch mode
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173.

---

## API

### `POST /sessions`

Start a new transcription session.

**Body**
```json
{
  "meetUrl": "https://meet.google.com/xxx-yyyy-zzz",
  "botDisplayName": "MeetMinutes Bot"
}
```

**Response**
```json
{
  "id": "uuid",
  "meetUrl": "...",
  "botDisplayName": "...",
  "status": "QUEUED",
  "createdAt": "ISO8601",
  "updatedAt": "ISO8601"
}
```

### `GET /sessions/:id`

Returns the current session state.

---

## WebSocket Events (Socket.IO)

| Direction        | Event             | Payload                                       |
|------------------|-------------------|-----------------------------------------------|
| Client → Server  | `join-session`    | `sessionId: string`                           |
| Server → Client  | `session-status`  | `{ sessionId, status }`                       |
| Server → Client  | `transcript-chunk`| `{ sessionId, text, timestamp }`              |
| Bot → Server     | `audio-chunk`     | `{ sessionId, chunk: base64WebM }`            |
| Bot → Server     | `bot-status`      | `{ sessionId, status }`                       |

**Session lifecycle:** `QUEUED → JOINING → RECORDING → DONE | FAILED`

---

## Design Decisions

### 1. Audio Capture Approach

**Method: `getUserMedia()` + `MediaRecorder` (stop/restart per chunk)**

After the bot joins the meeting, we inject JavaScript into the page via `page.exposeFunction` + `page.evaluate` that:
1. Calls `navigator.mediaDevices.getUserMedia({ audio: true })` with echo cancellation and noise suppression enabled.
2. Creates a `MediaRecorder` on the resulting stream encoding as `audio/webm;codecs=opus`.
3. **Stop/restart per chunk** — instead of using `timeslice`, we stop and restart the recorder every 5 seconds so each blob is a complete, self-contained WebM file that Groq Whisper can decode independently.
4. Each chunk is base64-encoded and sent to the backend via `window.__sendAudioChunk__()` (exposed from Node.js via `page.exposeFunction`).

**Why `getUserMedia` and not `getDisplayMedia`?**  
`getDisplayMedia` captures all system audio indiscriminately — background music, YouTube tabs, OS notifications — causing Whisper to hallucinate on noise. `getUserMedia` targets the microphone directly, giving clean, speech-only audio.

**Why stop/restart instead of `timeslice`?**  
`MediaRecorder` with a timeslice emits continuation chunks that lack the WebM EBML header. Only the first chunk is a valid standalone file. Stopping and restarting creates a fresh, complete WebM file every 5 seconds that any decoder (including Whisper) can process independently.

### 2. Headed Mode with Xvfb

The bot runs Chromium in **headed mode** inside a virtual framebuffer (Xvfb).

**Reason:** Google Meet's JavaScript heavily fingerprints the browser environment. In headless mode it is more likely to:
- Detect the bot and show a "browser not supported" message.
- Fail to initialize the audio/video pipeline it uses internally.
- Silently drop participants who don't have a proper display.

Xvfb gives us a real display at zero cost inside Docker, making the browser behave identically to a desktop session.

### 3. Transcription Service — Groq Whisper

Chosen because:
- Free tier is generous (fastest Whisper inference available anywhere).
- `whisper-large-v3` — the highest accuracy Whisper model — gives excellent results on 5-second audio windows.
- A meeting context prompt (`"This is a live Google Meet conversation between participants"`) is passed with every request to help Whisper recognise conversational speech patterns.
- Simple REST API; no streaming WebSocket required on the Groq side.

### 4. Job Queue — BullMQ + Redis

- Each `POST /sessions` enqueues one `join-meeting` job.
- The processor runs with `concurrency: 5` (configurable).
- Jobs are retried up to **2 times** (3 attempts total) with exponential backoff starting at 5 s.
- After all retries are exhausted, the session is marked `FAILED`.

### 5. Session Storage

Sessions are stored in-memory (`Map<string, Session>`) for simplicity. In production this would be Redis or a database so sessions survive restarts and work across multiple backend replicas.

---

## Environment Variables

| Variable          | Required | Default               | Description                                    |
|-------------------|----------|-----------------------|------------------------------------------------|
| `GROQ_API_KEY`    | Yes      | —                     | Groq API key (get one free at console.groq.com)|
| `PORT`            | No       | `3000`                | Backend HTTP port                              |
| `REDIS_HOST`      | No       | `localhost`           | Redis hostname                                 |
| `REDIS_PORT`      | No       | `6379`                | Redis port                                     |
| `BACKEND_WS_URL`  | No       | `http://localhost:3000`| Bot → backend WebSocket URL                   |
| `VITE_BACKEND_URL`| No       | `http://localhost:3000`| Frontend → backend URL (build-time)           |

---

## What Was Completed

- [x] **Part 1 — Backend (NestJS + TypeScript)**
  - [x] `POST /sessions` endpoint (Meet URL + bot name → session + queued job)
  - [x] `GET /sessions/:id` status endpoint
  - [x] BullMQ job queue with Redis, up-to-2 retries, exponential backoff
  - [x] Session lifecycle tracking (QUEUED → JOINING → RECORDING → DONE/FAILED)
  - [x] Audio chunk ingestion via Socket.IO → Groq Whisper transcription
  - [x] Live transcript broadcast to frontend via Socket.IO rooms
- [x] **Part 2 — Playwright Bot**
  - [x] Opens Google Meet link in Chromium
  - [x] Handles pre-join screen (name input, popups)
  - [x] Clicks "Ask to join" / "Join now"
  - [x] Captures audio via `getUserMedia` + `MediaRecorder` (stop/restart per chunk)
  - [x] Streams base64 WebM/Opus chunks every 5 s via Socket.IO (real-time)
  - [x] Headed mode with Xvfb in Docker
- [x] **Part 3 — Frontend (React + TypeScript)**
  - [x] Submit form (Meet URL + bot display name)
  - [x] Session view with status badge + visual indicators
  - [x] Live transcript panel with auto-scroll
- [x] **Part 4 — DevOps**
  - [x] Multi-stage `Dockerfile` for backend (builder + Playwright runtime)
  - [x] Multi-stage `Dockerfile` for frontend (builder + nginx)
  - [x] `docker-compose.yml` — `docker compose up --build` starts everything
  - [x] `.env.example` with all required variables

## Known Limitations

- **Google account authentication**: Google Meet requires meetings to have "Quick Access" enabled for unauthenticated browsers. In production, the bot would use a dedicated Google service account to join without host approval.
- **Admission by host**: With Quick Access off, the host must click "Admit" when the bot knocks. With Quick Access on, the bot joins directly.
- **Session persistence**: Sessions live in-memory and are lost on restart. Production would use Redis or a database.
- **Multiple concurrent meetings**: The worker runs at `concurrency: 5`. In Docker, each bot instance shares one Xvfb display; a production setup would allocate display numbers dynamically per worker.

