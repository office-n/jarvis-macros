#!/usr/bin/env bash
set -euo pipefail
SCHEMA="schema/macros.schema.json"
TARGET="${1:-macros.json}"

if [[ ! -f "$TARGET" ]]; then
  echo "❌ Error: target JSON file not found -> $TARGET" >&2
  exit 1
fi

python3 - <<PY
import json, sys
from jsonschema import validate, ValidationError
schema=json.load(open("$SCHEMA"))
data=json.load(open("$TARGET"))
try:
    validate(instance=data, schema=schema)
    print("✅ valid:", "$TARGET")
except ValidationError as e:
    print("❌ invalid:", e.message); sys.exit(1)
PY
