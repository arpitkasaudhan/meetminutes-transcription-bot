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

**Method: `AudioContext.createMediaElementSource()` + `MediaRecorder`**

After the bot joins the meeting, we inject JavaScript that:
1. Iterates over all `<audio>` elements Google Meet creates for remote participants.
2. Connects each to a shared `AudioContext` via `createMediaElementSource()`.
3. Routes the merged audio to a `MediaStreamDestination`.
4. Runs `MediaRecorder` on that destination with a 5-second timeslice, encoding as `audio/webm;codecs=opus`.
5. Each `dataavailable` chunk is base64-encoded and sent to the backend via `window.__sendAudioChunk__()` (exposed from Node.js via `page.exposeFunction`).
6. A `MutationObserver` watches for new `<audio>` elements as participants join mid-meeting.

**Why not `getDisplayMedia`?**  
`getDisplayMedia` requires a user gesture and cannot be auto-approved without OS-level patches. The `createMediaElementSource` approach works fully in process with no extra permissions.

**Why not OS-level capture (PulseAudio loopback)?**  
That would require tight coupling between the Node.js process and the audio subsystem. The in-page MediaRecorder approach is self-contained and portable.

### 2. Headed Mode with Xvfb

The bot runs Chromium in **headed mode** inside a virtual framebuffer (Xvfb).

**Reason:** Google Meet's JavaScript heavily fingerprints the browser environment. In headless mode it is more likely to:
- Detect the bot and show a "browser not supported" message.
- Fail to initialize the audio/video pipeline it uses internally.
- Silently drop participants who don't have a proper display.

Xvfb gives us a real display at zero cost inside Docker, making the browser behave identically to a desktop session.

### 3. Transcription Service — Groq Whisper

Chosen because:
- Free tier is generous (fastest inference available for Whisper).
- `whisper-large-v3-turbo` gives an excellent accuracy/latency tradeoff for 5-second audio windows.
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
  - [x] Captures tab audio via `createMediaElementSource` + `MediaRecorder`
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

## Known Limitations / What Was Skipped

- **Google account authentication**: Google Meet may require participants to be signed in to a Google account. The bot currently runs without authentication. For a production system, you would pass a Google session cookie or use a service account.
- **Admission by host**: When a non-authenticated user uses "Ask to join", a human host must admit them. In a real deployment the bot owner would host the meeting or use a Google Workspace account that auto-admits.
- **Session persistence**: Sessions live in memory and are lost on restart.
- **Multiple concurrent meetings**: Supported by the worker's `concurrency: 5` setting, but each instance needs its own Xvfb display number (`:99`, `:100`, etc.). A production implementation would allocate display numbers dynamically.

