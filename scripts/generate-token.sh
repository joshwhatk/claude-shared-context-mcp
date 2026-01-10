#!/bin/bash
# =============================================================================
# Generate Auth Token
# =============================================================================
# Generates a secure random token for MCP_AUTH_TOKEN.
#
# Usage:
#   ./scripts/generate-token.sh
# =============================================================================

echo "Generating secure auth token..."
echo ""
TOKEN=$(openssl rand -base64 32)
echo "MCP_AUTH_TOKEN=$TOKEN"
echo ""
echo "Add this to your Railway environment variables or .env file."
