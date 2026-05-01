# Mission Control Deployment Readiness

Mission Control is not approved for public exposure yet. This document records the safe public shape and the checks required before Philip is asked to approve DNS/deployment.

## Current state

- Hardened branch: `feat/telegram-first-mission-control`
- Public boundary smoke: `npm run smoke:public-boundary`
- Data backup script: `scripts/backup.sh`
- Restore helper: `scripts/restore.sh`
- Raw auth token location: macOS Keychain item `openclaw / command-center/auth-token`
- Raw auth token must not be committed, pasted, or stored in docs.

## Preferred public shape

- Subdomain: `mission.companytheatre.ca`
- Access layer: Cloudflare Access before the app.
- App mode: read-mostly dashboard.
- Telegram remains the command and approval surface.
- High-risk actions remain disabled unless Philip explicitly approves enabling them later.

## Required production env

```bash
NODE_ENV=production
PORT=3001
DATA_DIR=/data
UPLOAD_DIR=/data/uploads
COMMAND_CENTER_REQUIRE_AUTH=1
COMMAND_CENTER_AUTH_EMAILS=<approved Cloudflare Access email list>
FRONTEND_ORIGINS=https://mission.companytheatre.ca
COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS=0
```

Optional smoke/API token should be injected from a deployment secret store or local Keychain, not stored in repo:

```bash
COMMAND_CENTER_AUTH_TOKEN=<from secret store or Keychain>
```

## Persistent storage

Mount a persistent volume at `/data`.

Expected contents:

- `/data/data.db`
- `/data/uploads/`

Do not bake either into the Docker image.

## Backup plan

Run backups from the deployed container/host with:

```bash
DATA_DIR=/data UPLOAD_DIR=/data/uploads BACKUP_DIR=/data/backups ./scripts/backup.sh
```

Recommended minimum before public use:

- daily DB backup
- upload archive backup
- backup retention set with `BACKUP_RETENTION_DAYS`
- at least one restore drill before relying on the instance
- ideally sync `/data/backups` off-host after local backup is written

Restore drill shape:

```bash
# Stop app first.
DATA_DIR=/data UPLOAD_DIR=/data/uploads ./scripts/restore.sh /data/backups/data_<timestamp>.db /data/backups/uploads_<timestamp>.tar.gz --force
# Restart app, then run smoke checks.
```

## Required smoke checks before DNS/public announcement

- Unauthenticated `/` blocked by Cloudflare Access before app loads.
- Unauthenticated `/api/health` blocked.
- Unauthenticated `/ws` blocked.
- Authorized Philip email can load app.
- Authorized API request works.
- `npm run smoke:public-boundary` passes against the staged URL.
- High-risk `/api/gateway/send` returns 403 while disabled.
- `/api/cron/run/:jobId` returns 403 while disabled.
- `/api/selftape/diagnostics/access-token` returns 403 while disabled.
- `/data/data.db` survives restart.
- `/data/uploads` survives restart.
- Logs do not print tokens/secrets.
- OpenClaw Gateway port `18789` is not public.


## Runbook and templates

- Production env template: `.env.production.template`
- Online execution runbook: `docs/MISSION-CONTROL-ONLINE-RUNBOOK.md`

These files contain placeholders only. Real tokens/secrets belong in Keychain, Cloudflare/Coolify secrets, or the deployment secret store.

## Still blocked before public launch

- Philip approval for DNS/public deploy.
- Host/Coolify resource selection.
- Cloudflare Access policy configuration.
- Persistent `/data` volume and backup location.
- Rotate/revoke the previously exposed GitHub PAT from the old remote URL.
