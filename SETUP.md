# Philip-Mildred Command Center Setup Guide

## Prerequisites

- **Node.js** 20.x or later
- **npm** 10.x or later
- **OpenClaw Gateway** running on port 18789 (for agent status integration)

## Installation

### 1. Clone and Install

```bash
git clone https://github.com/philipriccio/philip-mildred-command-center.git
cd philip-mildred-command-center
npm install
```

### 2. Environment Configuration

Copy the example environment file and configure:

```bash
cp .env.example .env
```

Edit `.env` with your settings (see ENVIRONMENT.md for details).

### 3. Database Setup

The SQLite database is automatically created on first run. Default lanes and agents are seeded automatically.

### 4. Start the Application

**Development mode (both frontend and backend):**

```bash
# Terminal 1 - Backend server
npm run server

# Terminal 2 - Frontend dev server
npm run dev
```

**Or use concurrently:**
```bash
npm install -g concurrently
concurrently "npm run server" "npm run dev"
```

### 5. Access the Application

- **Frontend:** http://localhost:3000
- **Backend API:** http://localhost:3001
- **WebSocket:** ws://localhost:3001/gateway

## Production Build

```bash
# Build the frontend
npm run build

# The built files will be in dist/
```

## Optional: GitHub Integration

To enable PR status tracking:

1. Create a GitHub Personal Access Token with `repo` scope
2. Add to your `.env`: `GITHUB_TOKEN=your_token_here`
3. Restart the server

## Troubleshooting

### Port already in use

- Frontend default: 3000
- Backend default: 3001

Change with environment variables:
```bash
PORT=3002 npm run server
VITE_API_PORT=3002 npm run dev
```

### Database issues

Delete `server/data.db` and restart to reinitialize:
```bash
rm server/data.db
npm run server
```

### WebSocket connection failed

Ensure OpenClaw Gateway is running on port 18789.
