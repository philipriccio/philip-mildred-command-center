# Environment Variables

Copy this file to `.env` and fill in your values. Do not commit `.env` to version control.

## Required Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Backend server port | `3001` |
| `NODE_ENV` | Environment mode | `development` |

## Optional Variables

### GitHub Integration

| Variable | Description | Required for PR Tracking |
|----------|-------------|--------------------------|
| `GITHUB_TOKEN` | GitHub Personal Access Token with `repo` scope | Yes |

### OpenClaw Gateway

| Variable | Description | Default |
|----------|-------------|---------|
| `GATEWAY_URL` | OpenClaw Gateway WebSocket URL | `ws://localhost:18789` |

### File Uploads

| Variable | Description | Default |
|----------|-------------|---------|
| `UPLOAD_DIR` | Directory for uploaded evidence | `uploads/` |
| `MAX_FILE_SIZE` | Max upload size in bytes | `10485760` (10MB) |

## Example `.env` File

```bash
# Server Configuration
PORT=3001
NODE_ENV=development

# GitHub Integration (optional)
GITHUB_TOKEN=ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx

# OpenClaw Gateway (optional)
GATEWAY_URL=ws://localhost:18789
```

## Security Notes

- Never commit actual secrets to version control
- Use different tokens for development and production
- Rotate GitHub tokens periodically
