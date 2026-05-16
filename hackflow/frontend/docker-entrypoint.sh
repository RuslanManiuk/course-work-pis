#!/bin/sh
set -e

BACKEND=${BACKEND_URL:-http://localhost:8000}
WS_BACKEND=$(echo "$BACKEND" | sed 's|https://|wss://|; s|http://|ws://|')

cat > /etc/nginx/conf.d/default.conf << EOF
server {
    listen 80;
    root /usr/share/nginx/html;
    index index.html;

    location /api {
        proxy_pass ${BACKEND};
        proxy_set_header Host \$http_host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }

    location /ws {
        proxy_pass ${WS_BACKEND};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host \$http_host;
    }

    location / {
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

exec nginx -g 'daemon off;'
