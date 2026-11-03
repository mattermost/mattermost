
#!/usr/bin/env bash

set -euo pipefail

echo "Starting Mattermost deployment..."

# Validate required environment variables
: "${DB_HOST:?DB_HOST is required}"
: "${DB_PORT:?DB_PORT is required}"
: "${DB_NAME:?DB_NAME is required}"
: "${DB_USER:?DB_USER is required}"
: "${DB_PASSWORD:?DB_PASSWORD is required}"
: "${MM_SITE_URL:?MM_SITE_URL is required}"
: "${MATTERMOST_IMAGE:?MATTERMOST_IMAGE is required}"

# Move to application directory
cd /opt/mattermost

# Restrict permissions on newly created files
umask 077

# Generate environment file
cat > .env <<EOF
DB_HOST=${DB_HOST}
DB_PORT=${DB_PORT}
DB_NAME=${DB_NAME}
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASSWORD}
MM_SITE_URL=${MM_SITE_URL}
MATTERMOST_IMAGE=${MATTERMOST_IMAGE}
EOF

chmod 600 .env

echo "Environment file generated."

# Pull the specified Mattermost image
echo "Pulling Mattermost image..."
docker-compose pull mattermost

# Start or update Mattermost
echo "Starting Mattermost container..."
docker-compose up -d

echo "Mattermost deployment completed successfully."
