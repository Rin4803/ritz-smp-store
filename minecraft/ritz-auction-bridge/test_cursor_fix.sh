#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
SOURCE="$ROOT/src/main/java/com/ritzsmp/auctionbridge/RitzAuctionBridge.java"
JAR="$ROOT/build/RitzAuctionBridge.jar"

# Regression guard: a missing state file must initialize and persist the current log position.
grep -Fq 'if (cursor.fileName == null)' "$SOURCE"
grep -Fq 'cursor = new Cursor(log.getFileName().toString(), start);' "$SOURCE"
grep -Fq 'saveCursor();' "$SOURCE"

test -s "$JAR"
jar tf "$JAR" | grep -Fq 'com/ritzsmp/auctionbridge/RitzAuctionBridge.class'
printf 'RitzAuctionBridge cursor regression check passed\n'
