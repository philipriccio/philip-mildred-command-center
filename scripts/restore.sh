#!/usr/bin/env bash
set -euo pipefail

# Mission Control restore helper.
# Stop the app before restore. This script refuses to overwrite without --force.

if [[ $# -lt 1 ]]; then
  echo "Usage: $0 <data_backup.db> [uploads_backup.tar.gz] [--force]" >&2
  exit 2
fi

DB_BACKUP="$1"
UPLOADS_BACKUP=""
FORCE="0"
shift || true
for arg in "$@"; do
  case "$arg" in
    --force) FORCE="1" ;;
    *) UPLOADS_BACKUP="$arg" ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${DATA_DIR:-${PROJECT_DIR}/server}"
UPLOAD_DIR="${UPLOAD_DIR:-${PROJECT_DIR}/uploads}"
TARGET_DB="${DATA_DIR}/data.db"

if [[ ! -f "$DB_BACKUP" ]]; then
  echo "Error: database backup not found: $DB_BACKUP" >&2
  exit 1
fi

if [[ "$FORCE" != "1" ]]; then
  echo "Refusing to restore without --force. Stop the app first, then rerun with --force." >&2
  exit 3
fi

mkdir -p "$DATA_DIR"
if [[ -f "$TARGET_DB" ]]; then
  cp "$TARGET_DB" "${TARGET_DB}.pre-restore.$(date -u +%Y%m%dT%H%M%SZ)"
fi
cp "$DB_BACKUP" "$TARGET_DB"

if [[ -n "$UPLOADS_BACKUP" ]]; then
  if [[ ! -f "$UPLOADS_BACKUP" ]]; then
    echo "Error: uploads backup not found: $UPLOADS_BACKUP" >&2
    exit 1
  fi
  mkdir -p "$(dirname "$UPLOAD_DIR")"
  rm -rf "$UPLOAD_DIR"
  tar -xzf "$UPLOADS_BACKUP" -C "$(dirname "$UPLOAD_DIR")"
fi

echo "Mission Control restore complete"
echo "Database restored to: $TARGET_DB"
if [[ -n "$UPLOADS_BACKUP" ]]; then
  echo "Uploads restored under: $UPLOAD_DIR"
fi
