#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
BUILD="$ROOT/build"
PAPER_VERSION="1.21.4-R0.1-SNAPSHOT"
PAPER_METADATA="https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/${PAPER_VERSION}/maven-metadata.xml"
PAPER_VALUE="$(curl -fsSL --max-time 30 "$PAPER_METADATA" | awk -F'[<>]' '/<value>/{print $3}' | grep -v -- '-sources\|-javadoc' | head -n 1)"
if [[ -z "$PAPER_VALUE" ]]; then
  echo "Unable to resolve Paper API snapshot" >&2
  exit 1
fi
PAPER_JAR="${PAPER_JAR:-$BUILD/paper-api-${PAPER_VALUE}.jar}"
DISCORDSRV_JAR="${DISCORDSRV_JAR:-/tmp/DiscordSRV-1.30.5.jar}"
ADVENTURE_VERSION="4.17.0"
ADVENTURE_JAR="$BUILD/adventure-api-${ADVENTURE_VERSION}.jar"
ADVENTURE_URL="https://repo1.maven.org/maven2/net/kyori/adventure-api/${ADVENTURE_VERSION}/adventure-api-${ADVENTURE_VERSION}.jar"
PAPER_URL="https://repo.papermc.io/repository/maven-public/io/papermc/paper/paper-api/${PAPER_VERSION}/paper-api-${PAPER_VALUE}.jar"

mkdir -p "$BUILD/deps" "$BUILD/classes" "$BUILD/resources"
if [[ ! -s "$PAPER_JAR" ]]; then
  curl -fsSL --max-time 120 "$PAPER_URL" -o "$PAPER_JAR"
fi
if [[ ! -s "$DISCORDSRV_JAR" ]]; then
  echo "DiscordSRV jar not found: $DISCORDSRV_JAR" >&2
  exit 1
fi
if [[ ! -s "$ADVENTURE_JAR" ]]; then
  curl -fsSL --max-time 60 "$ADVENTURE_URL" -o "$ADVENTURE_JAR"
fi

find "$BUILD/classes" "$BUILD/resources" -mindepth 1 -delete
mapfile -t SOURCES < <(find "$ROOT/src/main/java" -name '*.java' -print | sort)
javac --release 21 -encoding UTF-8 \
  -cp "$PAPER_JAR:$DISCORDSRV_JAR:$ADVENTURE_JAR" \
  -d "$BUILD/classes" "${SOURCES[@]}"

sed "s/\${version}/1.0.0/g" "$ROOT/src/main/resources/plugin.yml" > "$BUILD/resources/plugin.yml"
cp "$ROOT/src/main/resources/config.yml" "$BUILD/resources/config.yml"
jar --create --file "$BUILD/RitzAuctionBridge.jar" -C "$BUILD/classes" . -C "$BUILD/resources" .
printf 'Built %s\n' "$BUILD/RitzAuctionBridge.jar"
