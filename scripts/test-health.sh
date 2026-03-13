#!/bin/bash

# Script para testar os health checks do Worker
# Uso: ./scripts/test-health.sh [BASE_URL]

BASE_URL="${1:-http://localhost:3000}"

echo "=========================================="
echo "Testing Worker Health Checks"
echo "Base URL: $BASE_URL"
echo "=========================================="
echo ""

# Cores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Função para testar endpoint
test_endpoint() {
  local name=$1
  local endpoint=$2
  local expected_status=$3

  echo "Testing: $name"
  echo "Endpoint: GET $endpoint"

  response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | sed '$d')

  echo "HTTP Status: $http_code"

  if [ "$http_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC}"
  else
    echo -e "${RED}✗ FAIL (expected $expected_status)${NC}"
  fi

  # Pretty print JSON
  if command -v jq &> /dev/null; then
    echo "$body" | jq '.'
  else
    echo "$body"
  fi

  echo ""
  echo "------------------------------------------"
  echo ""
}

# Testar todos os endpoints
test_endpoint "Basic Health Check" "/health" "200"
test_endpoint "Detailed Health Check" "/health/detailed" "200"
test_endpoint "Readiness Probe" "/health/readiness" "200"
test_endpoint "Liveness Probe" "/health/liveness" "200"

echo "=========================================="
echo "Health Check Tests Completed"
echo "=========================================="
