# Mission Control Online Runbook

This is the execution runbook for making Mission Control available online. It is prep only until Philip explicitly approves deployment/DNS/public exposure.

## Approval checklist

Short Philip-facing approval sheet: `docs/MISSION-CONTROL-APPROVAL-CHECKLIST.md`

## Hard boundary

Do **not** proceed past staging prep without Philip approval for:

- public deploy
- DNS change
- tunnel
- exposing OpenClaw Gateway
- enabling high-risk Mission Control actions

## Preferred launch shape

- URL: `https://mission.companytheatre.ca`
- Hosting: Coolify/Docker resource to be selected
- Auth: Cloudflare Access in front of the app
- App auth: `COMMAND_CENTER_REQUIRE_AUTH=1`
- Data: persistent volume mounted at `/data`
- Mode: read-mostly dashboard
- Command surface: Telegram remains authoritative
- High-risk actions: disabled with `COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS=0`

## Preflight before deployment approval request

1. Confirm repo is clean and on intended branch.
2. Confirm latest safe-prep commits are present:
   - API/WS auth boundary
   - high-risk action lockdown
   - public-boundary smoke script
   - backup/restore readiness
3. Confirm local gates:
   - `npm run lint`
   - `npm run build`
   - `git diff --check`
4. Confirm local production auth smoke:
   - `npm run smoke:public-boundary`
5. Confirm token registry:
   - raw smoke/auth token is in Keychain or deployment secrets only
   - no raw token in `.env.production.template`, docs, `PROJECT.md`, or git
6. Confirm old GitHub PAT from previous remote URL has been rotated/revoked.

## Coolify resource shape

Create/use a Dockerfile app resource.

Required settings:

- Build pack: Dockerfile
- Dockerfile path: `/Dockerfile`
- Exposed port: `3001`
- Domain: `mission.companytheatre.ca` only after approval
- Persistent volume: mount host/managed volume to `/data`
- Restart policy: unless-stopped / default Coolify rolling deploy

Required env values are documented in `.env.production.template`.

Do not enable `COMMAND_CENTER_ENABLE_HIGH_RISK_ACTIONS` for first launch.

## Cloudflare Access shape

Create an Access application for `mission.companytheatre.ca`.

Minimum policy:

- allow Philip's approved Company Theatre email
- optionally allow Mildred/service testing email if needed
- block everyone else

Headers expected by app auth:

- `cf-access-authenticated-user-email`

If Cloudflare Access is active, unauthenticated visitors should be stopped before Mission Control HTML loads.

## First staging smoke

Before DNS/public announcement, verify:

```bash
COMMAND_CENTER_SMOKE_URL=https://mission.companytheatre.ca \
COMMAND_CENTER_SMOKE_EMAIL=<approved-email> \
npm run smoke:public-boundary
```

If using bearer token instead of proxy email for smoke:

```bash
COMMAND_CENTER_SMOKE_URL=https://mission.companytheatre.ca \
COMMAND_CENTER_SMOKE_TOKEN=<from Keychain/secret store> \
npm run smoke:public-boundary
```

Also verify manually:

- browser not logged into Cloudflare Access cannot load the app
- approved user can load the dashboard
- WebSocket connects after auth
- no high-risk buttons/actions are available or effective
- `/data/data.db` exists on volume
- `/data/uploads` exists on volume

## Backup setup

Inside deployed environment or host cron:

```bash
DATA_DIR=/data \
UPLOAD_DIR=/data/uploads \
BACKUP_DIR=/data/backups \
BACKUP_RETENTION_DAYS=14 \
npm run backup:data
```

Before relying on public instance, do one restore drill against a disposable data directory or staging copy.

## Rollback shape

If staging smoke fails:

1. Do not announce URL.
2. Remove/disable DNS route or Cloudflare app if needed.
3. Keep high-risk actions disabled.
4. Inspect logs for auth/CORS/volume errors without printing secrets.
5. Revert deployment to previous image or stop resource if exposure risk exists.

## Known remaining blocker

The GitHub PAT previously embedded in the local remote URL must be treated as compromised until Philip revokes/rotates it in GitHub. The local remote has been cleaned, but token revocation is still required before any public launch confidence claim.
