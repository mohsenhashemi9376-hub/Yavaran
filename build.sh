#!/usr/bin/env bash
# ساخت بسته cPanel روی کامپیوتر دارای PHP 8.2+، Composer و Node.js 20+
set -e
composer install --no-dev --optimize-autoloader --no-interaction
npm install --no-audit --no-fund
npm run build
rm -rf dist && mkdir -p dist/yavaran
rsync -a ./ dist/yavaran/ --exclude .git --exclude .github --exclude node_modules --exclude dist \
  --exclude resources/js --exclude database/tools --exclude database/database.sql --exclude .env
(cd dist/yavaran && zip -qr ../yavaran-cpanel.zip .)
cp database/database.sql dist/
echo "✅ dist/yavaran-cpanel.zip و dist/database.sql آماده است."
