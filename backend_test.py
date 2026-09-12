#!/usr/bin/env python3
"""
Backend API Test Suite for Travel Agency OS - Pass 3 Changes
Tests AI generation endpoint and model configuration
"""

import requests
import sys
import json
from datetime import datetime

BASE_URL = "https://travel-agency-os-4.preview.emergentagent.com/api"

class TestRunner:
    def __init__(self):
        self.tests_run = 0
        self.tests_passed = 0
        self.token = None
        self.failures = []

    def log(self, message, level="INFO"):
        """Log test messages"""
        prefix = {
            "INFO": "ℹ️",
            "PASS": "✅",
            "FAIL": "❌",
            "WARN": "⚠️"
        }.get(level, "•")
        print(f"{prefix} {message}")

    def test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{BASE_URL}{endpoint}"
        self.tests_run += 1
        
        self.log(f"Testing: {name}", "INFO")
        
        try:
            req_headers = {'Content-Type': 'application/json'}
            if self.token:
                req_headers['Authorization'] = f'Bearer {self.token}'
            if headers:
                req_headers.update(headers)
            
            if method == 'GET':
                response = requests.get(url, headers=req_headers, timeout=30)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=req_headers, timeout=30)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=req_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=req_headers, timeout=10)
            else:
                raise ValueError(f"Unsupported method: {method}")
            
            if response.status_code == expected_status:
                self.tests_passed += 1
                self.log(f"PASSED - Status: {response.status_code}", "PASS")
                try:
                    return True, response.json()
                except Exception:
                    return True, response.text
            else:
                self.log(f"FAILED - Expected {expected_status}, got {response.status_code}", "FAIL")
                try:
                    error_detail = response.json()
                    self.log(f"Response: {json.dumps(error_detail, indent=2)}", "FAIL")
                except Exception:
                    self.log(f"Response: {response.text[:200]}", "FAIL")
                self.failures.append({
                    "test": name,
                    "expected": expected_status,
                    "actual": response.status_code,
                    "endpoint": endpoint
                })
                return False, None
                
        except Exception as e:
            self.log(f"FAILED - Exception: {str(e)}", "FAIL")
            self.failures.append({
                "test": name,
                "error": str(e),
                "endpoint": endpoint
            })
            return False, None

    def login(self):
        """Login and get auth token"""
        self.log("=== Authentication ===", "INFO")
        success, response = self.test(
            "Staff Login with PIN",
            "POST",
            "/auth/login",
            200,
            data={
                "staff_id": "887c1fdb-5888-447c-92e3-0d8248165672",
                "pin": "0000"
            }
        )
        
        if success and response and 'token' in response:
            self.token = response['token']
            self.log(f"Token obtained: {self.token[:20]}...", "PASS")
            return True
        else:
            self.log("Login failed - cannot proceed with authenticated tests", "FAIL")
            return False

    def test_ai_generate_endpoint(self):
        """Test AI generation endpoint"""
        self.log("\n=== AI Generation Endpoint Tests ===", "INFO")
        
        # Test 1: Without auth token (should return 403)
        self.log("Test 1: AI generate without auth token", "INFO")
        old_token = self.token
        self.token = None
        success, _ = self.test(
            "AI generate - No auth (expect 403)",
            "POST",
            "/itinerary/ai-generate",
            403,
            data={
                "text_input": "Create a 3-day Paris itinerary",
                "image_b64": None,
                "image_mime_type": None,
                "existing_meta": {}
            }
        )
        self.token = old_token
        
        # Test 2: With auth token but minimal data
        self.log("\nTest 2: AI generate with auth and minimal data", "INFO")
        success, response = self.test(
            "AI generate - With auth",
            "POST",
            "/itinerary/ai-generate",
            200,
            data={
                "text_input": "Create a simple 2-day Tokyo itinerary with hotels and sightseeing",
                "image_b64": None,
                "image_mime_type": None,
                "existing_meta": {
                    "client_name": "Test Client",
                    "destination": "Tokyo",
                    "start_date": "2025-09-01",
                    "end_date": "2025-09-02"
                }
            }
        )
        
        if success and response:
            self.log("AI generation response received", "PASS")
            if response.get("success"):
                self.log("Response indicates success", "PASS")
            if "itinerary" in response:
                self.log("Itinerary data present in response", "PASS")
                itin = response["itinerary"]
                if "days" in itin:
                    self.log(f"Generated {len(itin.get('days', []))} days", "PASS")
            else:
                self.log("No itinerary data in response", "FAIL")
        
        return success

    def verify_model_configuration(self):
        """Verify the backend uses claude-sonnet-4-5 via anthropic"""
        self.log("\n=== Model Configuration Verification ===", "INFO")
        
        # Read the server.py file to verify model configuration
        try:
            with open('/app/backend/server.py', 'r') as f:
                content = f.read()
                
            # Check for anthropic provider
            if 'with_model("anthropic"' in content:
                self.log("✓ Backend uses 'anthropic' provider", "PASS")
                self.tests_passed += 1
            else:
                self.log("✗ Backend does NOT use 'anthropic' provider", "FAIL")
                self.failures.append({
                    "test": "Model provider verification",
                    "issue": "anthropic provider not found"
                })
            
            # Check for claude-sonnet-4-5 model
            if '"claude-sonnet-4-5"' in content:
                self.log("✓ Backend uses 'claude-sonnet-4-5' model", "PASS")
                self.tests_passed += 1
            else:
                self.log("✗ Backend does NOT use 'claude-sonnet-4-5' model", "FAIL")
                self.failures.append({
                    "test": "Model name verification",
                    "issue": "claude-sonnet-4-5 not found"
                })
            
            # Check it's NOT using google/gemini
            if 'with_model("google"' not in content or 'gemini' not in content.lower():
                self.log("✓ Backend is NOT using google/gemini", "PASS")
                self.tests_passed += 1
            else:
                self.log("⚠️  Backend may still have google/gemini references", "WARN")
            
            self.tests_run += 3
            
        except Exception as e:
            self.log(f"Could not verify model configuration: {e}", "FAIL")
            self.failures.append({
                "test": "Model configuration file check",
                "error": str(e)
            })

    def print_summary(self):
        """Print test summary"""
        print("\n" + "="*60)
        print("TEST SUMMARY")
        print("="*60)
        print(f"Total Tests: {self.tests_run}")
        print(f"Passed: {self.tests_passed}")
        print(f"Failed: {self.tests_run - self.tests_passed}")
        print(f"Success Rate: {(self.tests_passed/self.tests_run*100):.1f}%")
        
        if self.failures:
            print("\n" + "="*60)
            print("FAILURES:")
            print("="*60)
            for i, failure in enumerate(self.failures, 1):
                print(f"\n{i}. {failure.get('test', 'Unknown test')}")
                for key, value in failure.items():
                    if key != 'test':
                        print(f"   {key}: {value}")
        
        print("\n" + "="*60)
        return 0 if self.tests_run == self.tests_passed else 1


def main():
    runner = TestRunner()
    
    print("="*60)
    print("Travel Agency OS - Backend API Tests")
    print("Pass 3: AI Generation & Model Configuration")
    print("="*60)
    print(f"Backend URL: {BASE_URL}")
    print(f"Test Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("="*60 + "\n")
    
    # Run tests
    if not runner.login():
        return 1
    
    runner.test_ai_generate_endpoint()
    runner.verify_model_configuration()
    
    return runner.print_summary()


if __name__ == "__main__":
    sys.exit(main())
