#!/bin/sh
set -eu
test -n "$PT_SID"
psql -h invidious-db -U kemal -d invidious -v ON_ERROR_STOP=1 -v sid="$PT_SID" -f /bootstrap.sql
echo "Local Individuous account ready."
