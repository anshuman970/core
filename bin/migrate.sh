#!/bin/zsh
# migrate.sh - Run database migrations for Altus4
# Usage: ./bin/migrate.sh [up|down|status]

MIGRATIONS_DIR="$(dirname "$0")/../migrations"
DB_HOST="localhost"
DB_PORT="3306"
DB_USER="root"
DB_PASS="password"
DB_NAME="altus4"

function run_migration_up() {
  for file in $MIGRATIONS_DIR/*.up.sql; do
    echo "Running migration: $file"
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < "$file"
  done
}

function run_migration_down() {
  for file in $MIGRATIONS_DIR/*.down.sql; do
    echo "Reverting migration: $file"
    mysql -h $DB_HOST -P $DB_PORT -u $DB_USER -p$DB_PASS $DB_NAME < "$file"
  done
}

function show_status() {
  echo "Migration status:"
  ls -1 $MIGRATIONS_DIR | grep -E '\.up\.sql|\.down\.sql'
}

case "$1" in
  up)
    run_migration_up
    ;;
  down)
    run_migration_down
    ;;
  status)
    show_status
    ;;
  *)
    echo "Usage: $0 [up|down|status]"
    exit 1
    ;;
esac
