# ⚡ Unified Scaffold Engine

An enterprise-grade, high-availability AI workspace designed to solve two of the most expensive problems in production LLM applications: **compute waste from abandoned generations** and **downtime from model rate-limiting.**

---

## 🎯 The Problem vs. The Solution

**The Industry Problem:** Standard AI wrappers execute stateless, unidirectional API calls. If a user spots a typo mid-generation and hits "stop" or refreshes the page, the frontend UI stops updating, but the backend continues executing the LLM process to completion. This results in massive token bleed, wasted compute, and degraded user experience during provider outages.

**The Scaffold Engine Solution:**
This architecture introduces a **Bidirectional Abort Pipeline**. By tethering the native browser `AbortController` directly to the Express.js routing layer and the `@google/genai` SDK, client-side cancellations instantly sever the upstream HTTP request to Google's servers. Combined with a multi-model fallback cascade, this engine guarantees zero token waste and continuous availability.

---

## 🧠 Core Engineering Innovations

### 1. Zero-Waste Interrupt Architecture
* **Frontend:** React hooks capture user interrupt intents via state-driven UI swaps (Send ↔ Stop).
* **Network:** Generates a unique HTTP `AbortSignal` for every prompt lifecycle.
* **Backend:** Express middleware listens for `499 Client Closed Request` and immediately drops the active Gemini runtime loop, saving bandwidth and API quotas.

### 2. Multi-Model Cascade Routing
Built-in systemic fault tolerance for high-demand environments. If the primary intelligence node (`gemini-2.5-flash`) encounters a `503 Service Unavailable` or `429 Too Many Requests` error, the backend autonomous router catches the exception and hot-swaps to secondary nodes (`gemini-flash-latest`, `gemini-2.5-flash-lite`) mid-flight, completely transparent to the user.

### 3. Distributed State Isolation
Session context and chat histories are mapped into a secure, multi-tenant relational schema using **TiDB**. This ensures ACID-compliant data integrity and horizontal scalability without the overhead of complex localized caching.

---

## 🏗️ Systems Architecture

```text
[ Client (React/Vite) ]  <-- HTTP/REST (Signals) -->  [ API Gateway (Express) ]
          │                                                  │
          │ (State UI)                                       │ (Cascade Router)
          ▼                                                  ▼
[ Local Workspace State ]                          [ Fallback Engine ]
                                                     ├── 1. gemini-2.5-flash
                                                     ├── 2. gemini-flash-latest
                                                     └── 3. gemini-2.5-flash-lite
                                                             │
                                                             ▼
                                                    [ TiDB (MySQL State) ]


##   🛠️ Technical Stack

Client: React 18, Vite, Tailwind CSS, Lucide Architecture

Server: Node.js, Express, Network AbortSignals

Intelligence: Google GenAI SDK

Database: TiDB Cloud (Distributed SQL)

CI/CD Pipeline: Monorepo architecture deploying concurrently to Vercel (Client) and Render (Server)                                    

##🚀 Quick Start Guide
1. Environment Configuration
Clone the repository and establish your .env variables in the /backend directory:

Code snippet
PORT=5000
GEMINI_API_KEY=your_production_key_here
DATABASE_URL=mysql://<user>:<pass>@<host>:<port>/<db>?ssl={"rejectUnauthorized":true}
2. Bootstrapping the Monorepo
You will need two terminal instances to run the separated concerns locally.

Terminal A (Server Node):

Bash
cd backend
npm install
npm run start
Terminal B (Client Node):

Bash
cd frontend
npm install
npm run dev
👨‍💻 Architecture & Development
Designed and engineered by Francis Boateng (Xisco).
Focused on building resilient, scalable, and cost-optimized full-stack systems.

📄 License
Open-source under the MIT License.