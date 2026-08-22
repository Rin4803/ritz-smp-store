#!/bin/bash
# RitzSMP Database Backup Script
# Usage: ./backup.sh

BACKUP_DIR="/home/ubuntu/ritz-smp-store/backups"
DATE=$(date +%Y%m%d_%H%M%S)
CONTAINER_NAME="ritz_db"
DB_NAME="ritz_smp"
DB_USER="ritz_user"

# Read DB_PASSWORD from .env if available
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
fi

mkdir -p "$BACKUP_DIR"

echo "Starting backup for $DB_NAME..."
docker exec -i "$CONTAINER_NAME" mysqldump -u"$DB_USER" -p"${DB_PASSWORD:-secure_user_password}" "$DB_NAME" | gzip > "$BACKUP_DIR/ritz_smp_$DATE.sql.gz"

if [ $? -eq 0 ]; then
  echo "Backup completed successfully: backups/ritz_smp_$DATE.sql.gz"
  # Remove backups older than 7 days
  find "$BACKUP_DIR" -name "ritz_smp_*.sql.gz" -mtime +7 -delete
else
  echo "Backup failed!" >&2
  exit 1
fi
