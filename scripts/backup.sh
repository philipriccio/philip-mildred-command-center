#!/bin/bash
# Database backup script
# Run daily via cron: 0 2 * * * /path/to/command-center/scripts/backup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${PROJECT_DIR}/backups"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Generate timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/data_${TIMESTAMP}.db"

# Copy database
if [ -f "${PROJECT_DIR}/server/data.db" ]; then
    cp "${PROJECT_DIR}/server/data.db" "$BACKUP_FILE"
    echo "Database backed up to: $BACKUP_FILE"
    
    # Also backup uploads if exists
    if [ -d "${PROJECT_DIR}/uploads" ]; then
        UPLOADS_BACKUP="${BACKUP_DIR}/uploads_${TIMESTAMP}.tar.gz"
        tar -czf "$UPLOADS_BACKUP" -C "$PROJECT_DIR" uploads
        echo "Uploads backed up to: $UPLOADS_BACKUP"
    fi
    
    # Keep only last 7 days of backups
    find "$BACKUP_DIR" -name "data_*.db" -mtime +7 -delete
    find "$BACKUP_DIR" -name "uploads_*.tar.gz" -mtime +7 -delete
    
    echo "Backup complete!"
else
    echo "Error: Database file not found at ${PROJECT_DIR}/server/data.db"
    exit 1
fi
