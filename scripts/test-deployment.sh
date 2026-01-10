#!/bin/bash
# =============================================================================
# Test Deployment Script
# =============================================================================
# Tests the MCP server deployment with curl commands.
#
# Usage:
#   ./scripts/test-deployment.sh <BASE_URL> <AUTH_TOKEN>
#
# Example:
#   ./scripts/test-deployment.sh https://your-app.up.railway.app your-token-here
#   ./scripts/test-deployment.sh http://localhost:3000 local-dev-token
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Arguments
BASE_URL="${1:-http://localhost:3000}"
AUTH_TOKEN="${2:-local-dev-token-change-in-production}"

echo "============================================="
echo "MCP Server Deployment Test"
echo "============================================="
echo "Base URL: $BASE_URL"
echo "============================================="
echo ""

# Helper function
test_endpoint() {
    local name="$1"
    local expected_status="$2"
    local method="$3"
    local endpoint="$4"
    local data="$5"
    local auth="$6"

    echo -n "Testing $name... "

    if [ "$auth" = "yes" ]; then
        AUTH_HEADER="-H \"Authorization: Bearer $AUTH_TOKEN\""
    else
        AUTH_HEADER=""
    fi

    if [ "$method" = "GET" ]; then
        RESPONSE=$(curl -s -w "\n%{http_code}" $AUTH_HEADER "$BASE_URL$endpoint")
    else
        RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer $AUTH_TOKEN" \
            -d "$data" \
            "$BASE_URL$endpoint")
    fi

    HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
    BODY=$(echo "$RESPONSE" | sed '$d')

    if [ "$HTTP_CODE" = "$expected_status" ]; then
        echo -e "${GREEN}PASS${NC} (HTTP $HTTP_CODE)"
        return 0
    else
        echo -e "${RED}FAIL${NC} (Expected $expected_status, got $HTTP_CODE)"
        echo "Response: $BODY"
        return 1
    fi
}

# Track failures
FAILURES=0

echo "1. Health Check"
echo "---------------"
test_endpoint "Health endpoint" "200" "GET" "/health" "" "no" || ((FAILURES++))
echo ""

echo "2. Authentication"
echo "-----------------"
echo -n "Testing missing auth... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    "$BASE_URL/mcp")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "401" ]; then
    echo -e "${GREEN}PASS${NC} (correctly rejected)"
else
    echo -e "${RED}FAIL${NC} (Expected 401, got $HTTP_CODE)"
    ((FAILURES++))
fi

echo -n "Testing invalid token... "
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer wrong-token" \
    -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' \
    "$BASE_URL/mcp")
HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" = "403" ]; then
    echo -e "${GREEN}PASS${NC} (correctly rejected)"
else
    echo -e "${RED}FAIL${NC} (Expected 403, got $HTTP_CODE)"
    ((FAILURES++))
fi
echo ""

echo "3. MCP Protocol"
echo "---------------"

# Initialize session
echo -n "Initializing MCP session... "
INIT_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test-script","version":"1.0.0"}}}' \
    -D - \
    "$BASE_URL/mcp")

SESSION_ID=$(echo "$INIT_RESPONSE" | grep -i "mcp-session-id" | cut -d: -f2 | tr -d ' \r')
if [ -n "$SESSION_ID" ]; then
    echo -e "${GREEN}PASS${NC} (Session: ${SESSION_ID:0:8}...)"
else
    echo -e "${YELLOW}WARN${NC} (No session ID returned, continuing...)"
fi

# List tools
echo -n "Listing tools... "
TOOLS_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":2,"method":"tools/list"}' \
    "$BASE_URL/mcp")

if echo "$TOOLS_RESPONSE" | grep -q "read_context"; then
    TOOL_COUNT=$(echo "$TOOLS_RESPONSE" | grep -o '"name"' | wc -l | tr -d ' ')
    echo -e "${GREEN}PASS${NC} ($TOOL_COUNT tools found)"
else
    echo -e "${RED}FAIL${NC} (Tools not found in response)"
    ((FAILURES++))
fi
echo ""

echo "4. Tool Operations"
echo "------------------"

# Write context
echo -n "Writing context... "
WRITE_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"write_context","arguments":{"key":"test-deploy-key","content":"Hello from deployment test!"}}}' \
    "$BASE_URL/mcp")

if echo "$WRITE_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $WRITE_RESPONSE"
    ((FAILURES++))
fi

# Read context
echo -n "Reading context... "
READ_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":4,"method":"tools/call","params":{"name":"read_context","arguments":{"key":"test-deploy-key"}}}' \
    "$BASE_URL/mcp")

if echo "$READ_RESPONSE" | grep -q "Hello from deployment test"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $READ_RESPONSE"
    ((FAILURES++))
fi

# List context
echo -n "Listing context... "
LIST_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":5,"method":"tools/call","params":{"name":"list_context","arguments":{}}}' \
    "$BASE_URL/mcp")

if echo "$LIST_RESPONSE" | grep -q "test-deploy-key"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $LIST_RESPONSE"
    ((FAILURES++))
fi

# Delete context
echo -n "Deleting context... "
DELETE_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":6,"method":"tools/call","params":{"name":"delete_context","arguments":{"key":"test-deploy-key"}}}' \
    "$BASE_URL/mcp")

if echo "$DELETE_RESPONSE" | grep -q "success.*true"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $DELETE_RESPONSE"
    ((FAILURES++))
fi

# Verify deletion
echo -n "Verifying deletion... "
VERIFY_RESPONSE=$(curl -s -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $AUTH_TOKEN" \
    ${SESSION_ID:+-H "mcp-session-id: $SESSION_ID"} \
    -d '{"jsonrpc":"2.0","id":7,"method":"tools/call","params":{"name":"read_context","arguments":{"key":"test-deploy-key"}}}' \
    "$BASE_URL/mcp")

if echo "$VERIFY_RESPONSE" | grep -q "NOT_FOUND"; then
    echo -e "${GREEN}PASS${NC}"
else
    echo -e "${RED}FAIL${NC}"
    echo "Response: $VERIFY_RESPONSE"
    ((FAILURES++))
fi

echo ""
echo "============================================="
if [ $FAILURES -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}$FAILURES test(s) failed${NC}"
    exit 1
fi
