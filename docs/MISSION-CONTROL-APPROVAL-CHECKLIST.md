# Mission Control Public Deployment — Approval Checklist

This is the short decision sheet for Philip before Mission Control is put online. Nothing in this file grants approval by itself.

## Recommended decision

Approve a **private, Cloudflare Access-gated staging deployment** at:

`https://mission.companytheatre.ca`

First launch mode should be **read-mostly dashboard only**. Telegram remains the command and approval surface.

## What is already prepared

- API and WebSocket auth boundary added.
- High-risk controls are disabled by default.
- Repeatable public-boundary smoke test exists: `npm run smoke:public-boundary`.
- Dockerfile supports persistent `/data` volume.
- Backup and restore scripts exist and were locally tested.
- Production env template exists with placeholders only: `.env.production.template`.
- Online runbook exists: `docs/MISSION-CONTROL-ONLINE-RUNBOOK.md`.
- Raw Mission Control auth token is stored in macOS Keychain, not git/docs/chat.
- No DNS, public deploy, tunnel, or gateway exposure has happened yet.

## Decisions Philip needs to approve

### 1. Subdomain

Recommended:

- `mission.companytheatre.ca`

Alternatives:

- `control.companytheatre.ca`
- `mildred.companytheatre.ca`

Recommendation: use `mission.companytheatre.ca`.

### 2. Access control

Recommended:

- Cloudflare Access in front of the app.
- Allow only Philip's approved Company Theatre email initially.
- Add Mildred/service testing identity only if needed.

Recommendation: Cloudflare Access only, no public unauthenticated app.

### 3. Deployment host

Recommended:

- Use Coolify/Docker if a suitable private resource exists.
- Create a new dedicated resource rather than mixing with Hawco/CRM apps.

Required:

- Dockerfile build.
- Exposed app port `3001`.
- Persistent volume mounted at `/data`.
- Environment values from `.env.production.template`.

### 4. Data persistence and backups

Required before relying on it:

- `/data/data.db` on persistent volume.
- `/data/uploads/` on persistent volume.
- Daily backup command configured.
- One restore drill completed on staging/disposable path.

Recommended backup command:

```bash
DATA_DIR=/data \
UPLOAD_DIR=/data/uploads \
BACKUP_DIR=/data/backups \
BACKUP_RETENTION_DAYS=14 \
npm run backup:data
```

### 5. High-risk actions

Recommendation for first launch:

- Keep disabled.

This means these remain blocked even for authenticated users:

- sending through the OpenClaw gateway
- running cron jobs
- fetching SelfTape diagnostics access token

Telegram remains the command path.

### 6. Old exposed GitHub token

Required:

- Revoke/rotate the old GitHub PAT that was embedded in the previous remote URL.

Current repo remote is cleaned, but the old token should still be treated as compromised until revoked in GitHub.

## Approval I need before acting

A clear approval can be as simple as:

> Approve private Mission Control staging deploy at mission.companytheatre.ca behind Cloudflare Access. Keep high-risk actions disabled.

If Philip wants to defer public DNS but allow a private staging resource without final DNS, say:

> Approve private staging deploy only, no public DNS yet.

## What I will do after approval

1. Re-run local preflight:
   - repo clean
   - `npm run lint`
   - `npm run build`
   - `git diff --check`
   - `npm run smoke:public-boundary`
2. Configure/create the Coolify/Docker resource.
3. Set env/secrets without exposing raw tokens.
4. Mount persistent `/data` volume.
5. Configure Cloudflare Access policy.
6. Deploy staging.
7. Smoke test:
   - unauthenticated browser blocked
   - authorized access works
   - API auth works
   - WebSocket auth works
   - high-risk endpoints return 403
   - data persists across restart
   - no secrets in logs
8. Report verified status and any blocker.

## What I will not do without separate approval

- Enable high-risk controls.
- Expose OpenClaw Gateway directly.
- Send commands from Mission Control to agents.
- Add additional users broadly.
- Replace Telegram as command surface.
- Make sponsor/project/client data public.
