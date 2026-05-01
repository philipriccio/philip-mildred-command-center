#!/usr/bin/env bash
set -euo pipefail

# Mission Control backup script.
# Local default backs up server/data.db + uploads/.
# Production should set DATA_DIR=/data and BACKUP_DIR to a persistent/off-host backup path.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="${DATA_DIR:-${PROJECT_DIR}/server}"
UPLOAD_DIR="${UPLOAD_DIR:-${PROJECT_DIR}/uploads}"
BACKUP_DIR="${BACKUP_DIR:-${PROJECT_DIR}/backups}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP="$(date -u +%Y%m%dT%H%M%SZ)"
DB_FILE="${DATA_DIR}/data.db"
DB_BACKUP="${BACKUP_DIR}/data_${TIMESTAMP}.db"
UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
MANIFEST="${BACKUP_DIR}/manifest_${TIMESTAMP}.txt"

mkdir -p "$BACKUP_DIR"

if [[ ! -f "$DB_FILE" ]]; then
  echo "Error: database file not found: $DB_FILE" >&2
  exit 1
fi

# Use SQLite's online backup API when available so a live DB copy is consistent.
if command -v sqlite3 >/dev/null 2>&1; then
  sqlite3 "$DB_FILE" ".backup '${DB_BACKUP}'"
else
  cp "$DB_FILE" "$DB_BACKUP"
fi

{
  echo "created_at_utc=$TIMESTAMP"
  echo "data_dir=$DATA_DIR"
  echo "upload_dir=$UPLOAD_DIR"
  echo "db_backup=$DB_BACKUP"
  if command -v shasum >/dev/null 2>&1; then
    echo "db_sha256=$(shasum -a 256 "$DB_BACKUP" | awk '{print $1}')"
  fi
} > "$MANIFEST"

if [[ -d "$UPLOAD_DIR" ]]; then
  tar -czf "$UPLOADS_BACKUP" -C "$(dirname "$UPLOAD_DIR")" "$(basename "$UPLOAD_DIR")"
  echo "uploads_backup=$UPLOADS_BACKUP" >> "$MANIFEST"
  if command -v shasum >/dev/null 2>&1; then
    echo "uploads_sha256=$(shasum -a 256 "$UPLOADS_BACKUP" | awk '{print $1}')" >> "$MANIFEST"
  fi
else
  echo "uploads_backup=none" >> "$MANIFEST"
fi

find "$BACKUP_DIR" -name 'data_*.db' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'uploads_*.tar.gz' -mtime "+$RETENTION_DAYS" -delete
find "$BACKUP_DIR" -name 'manifest_*.txt' -mtime "+$RETENTION_DAYS" -delete

echo "Mission Control backup complete"
echo "Database: $DB_BACKUP"
echo "Manifest: $MANIFEST"
