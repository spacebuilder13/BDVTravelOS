#!/bin/bash

BASE_URL="${BDV_API_BASE_URL:-http://localhost:8000/api}"
COOKIE_FILE="/tmp/auth_cookies.txt"

echo "=== Testing Auth Cookie Migration ==="
echo ""

# 1. Get staff list
echo "1. GET /api/auth/staff - Get staff list"
STAFF_RESPONSE=$(curl -s "${BASE_URL}/auth/staff")
STAFF_ID=$(echo "$STAFF_RESPONSE" | grep -o '"id":"[^"]*"' | head -1 | cut -d'"' -f4)
echo "   Staff ID: $STAFF_ID"
echo ""

# 2. Login with PIN 0000 and save cookies
echo "2. POST /api/auth/login - Login with PIN 0000 (should set httpOnly cookie)"
LOGIN_RESPONSE=$(curl -s -c "$COOKIE_FILE" -X POST "${BASE_URL}/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"staff_id\":\"$STAFF_ID\",\"pin\":\"0000\"}")

echo "   Response contains token: $(echo "$LOGIN_RESPONSE" | grep -o '"token"' | head -1)"
echo "   Response contains user: $(echo "$LOGIN_RESPONSE" | grep -o '"user"' | head -1)"
echo ""

# Check if cookie was set
echo "3. Check if bdvv_token cookie was set"
if grep -q "bdvv_token" "$COOKIE_FILE"; then
  echo "   ✅ Cookie 'bdvv_token' found in cookie file"
  grep "bdvv_token" "$COOKIE_FILE"
else
  echo "   ❌ Cookie 'bdvv_token' NOT found"
fi
echo ""

# 4. Test GET /api/auth/me with cookie (no Authorization header)
echo "4. GET /api/auth/me - Using cookie only (no Authorization header)"
ME_RESPONSE=$(curl -s -b "$COOKIE_FILE" "${BASE_URL}/auth/me")
ME_STATUS=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "${BASE_URL}/auth/me")
echo "   Status: $ME_STATUS"
if [ "$ME_STATUS" = "200" ]; then
  echo "   ✅ Authentication via cookie successful"
  echo "   User: $(echo "$ME_RESPONSE" | grep -o '"name":"[^"]*"' | cut -d'"' -f4)"
else
  echo "   ❌ Authentication via cookie failed"
fi
echo ""

# 5. Test authenticated endpoint with cookie
echo "5. GET /api/itineraries - Using cookie for authenticated request"
ITIN_STATUS=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "${BASE_URL}/itineraries")
echo "   Status: $ITIN_STATUS"
if [ "$ITIN_STATUS" = "200" ]; then
  echo "   ✅ Authenticated endpoint works with cookie"
else
  echo "   ❌ Authenticated endpoint failed with cookie"
fi
echo ""

# 6. Test logout
echo "6. POST /api/auth/logout - Clear cookie"
LOGOUT_STATUS=$(curl -s -b "$COOKIE_FILE" -c "$COOKIE_FILE" -X POST -o /dev/null -w "%{http_code}" "${BASE_URL}/auth/logout")
echo "   Status: $LOGOUT_STATUS"
if [ "$LOGOUT_STATUS" = "200" ]; then
  echo "   ✅ Logout successful"
else
  echo "   ❌ Logout failed"
fi
echo ""

# 7. Test /api/auth/me after logout (should fail with 401)
echo "7. GET /api/auth/me - After logout (should fail with 401)"
ME_AFTER_LOGOUT=$(curl -s -b "$COOKIE_FILE" -o /dev/null -w "%{http_code}" "${BASE_URL}/auth/me")
echo "   Status: $ME_AFTER_LOGOUT"
if [ "$ME_AFTER_LOGOUT" = "401" ]; then
  echo "   ✅ Cookie cleared, authentication fails as expected"
else
  echo "   ❌ Still authenticated after logout (cookie not cleared)"
fi
echo ""

# Cleanup
rm -f "$COOKIE_FILE"

echo "=== Auth Cookie Tests Complete ==="
