#!/bin/bash
cd "$(dirname "$0")/.."
exec bash ./scripts/remote-client-tunnel.sh
