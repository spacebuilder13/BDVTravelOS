#!/usr/bin/env python3
"""
Backend API Test Suite for BDV TravelOS - Pass 1 Migration Testing
Tests migration endpoint idempotency and new collections (places, trip_components, tax_profiles, quote_terms_template)
"""

import requests
import sys
import os
from datetime import datetime

class MigrationTester:
    def __init__(self, base_url=None):
        base_url = base_url or os.environ.get("BDV_API_BASE_URL", "http://localhost:8000")
        self.base_url = f"{base_url}/api"
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def log(self, message, status="info"):
        """Log test messages"""
        prefix = {
            "info": "ℹ️ ",
            "success": "✅",
            "fail": "❌",
            "test": "🔍"
        }.get(status, "")
        print(f"{prefix} {message}")

    def run_test(self, name, method, endpoint, expected_status, data=None, params=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        headers = {'Content-Type': 'application/json'}
        if self.token:
            headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        self.log(f"Testing {name}...", "test")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=headers, params=params, timeout=15)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=15)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=15)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=15)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                self.log(f"Passed - Status: {response.status_code}", "success")
                self.test_results.append({"test": name, "status": "PASS", "code": response.status_code})
            else:
                self.log(f"Failed - Expected {expected_status}, got {response.status_code}", "fail")
                try:
                    error_detail = response.json()
                    self.log(f"Error detail: {error_detail}", "fail")
                except Exception:
                    self.log(f"Response text: {response.text[:200]}", "fail")
                self.test_results.append({"test": name, "status": "FAIL", "code": response.status_code, "expected": expected_status})

            return success, response.json() if success and response.text else {}

        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": name, "status": "ERROR", "error": str(e)})
            return False, {}

    def test_login(self):
        """Test login with PIN 0000 for Yash Doshi"""
        self.log("\n=== AUTH TESTS ===", "info")
        
        # First get staff list
        success, staff_list = self.run_test(
            "Get Staff List",
            "GET",
            "auth/staff",
            200
        )
        
        if not success or not staff_list:
            self.log("Failed to get staff list", "fail")
            return False
        
        # Find Yash Doshi
        yash = None
        for s in staff_list:
            if s.get('name') == 'Yash Doshi':
                yash = s
                break
        
        if not yash:
            self.log("Yash Doshi not found in staff list", "fail")
            return False
        
        # Login with PIN 0000
        success, response = self.run_test(
            "Login with PIN 0000",
            "POST",
            "auth/login",
            200,
            data={"staff_id": yash['id'], "pin": "0000"}
        )
        
        if success and 'token' in response:
            self.token = response['token']
            self.log(f"Logged in as {response['user']['name']} ({response['user']['role']})", "success")
            return True
        return False

    def test_existing_quotes(self):
        """Test that existing quotes still work with QT-2026-04x format"""
        self.log("\n=== EXISTING QUOTES TEST ===", "info")
        
        success, quotes = self.run_test(
            "GET /api/quotes - List existing quotes",
            "GET",
            "quotes",
            200
        )
        
        if success:
            self.log(f"Found {len(quotes)} quotes", "info")
            
            # Check for QT-2026-04x format quotes
            qt_2026_quotes = [q for q in quotes if q.get('quote_no', '').startswith('QT-2026-')]
            
            if qt_2026_quotes:
                self.log(f"✓ Found {len(qt_2026_quotes)} quotes with QT-2026-xxx format", "success")
                
                # Test opening one of them
                test_quote = qt_2026_quotes[0]
                quote_id = test_quote.get('id')
                quote_no = test_quote.get('quote_no')
                
                success, quote_detail = self.run_test(
                    f"GET /api/quotes/{quote_id} - Open existing quote {quote_no}",
                    "GET",
                    f"quotes/{quote_id}",
                    200
                )
                
                if success and quote_detail.get('quote_no') == quote_no:
                    self.log(f"✓ Successfully opened quote {quote_no}", "success")
                    return True
            else:
                self.log("⚠️  No QT-2026-04x quotes found (may be expected if DB is fresh)", "info")
                return True
        
        return False

    def test_migration_first_run(self):
        """Test POST /api/admin/run-migration - First run"""
        self.log("\n=== MIGRATION FIRST RUN TEST ===", "info")
        
        success, report = self.run_test(
            "POST /api/admin/run-migration - First run",
            "POST",
            "admin/run-migration",
            200
        )
        
        if success:
            self.log("Migration completed successfully", "success")
            self.log(f"Report: {report}", "info")
            
            # Check report structure
            required_fields = [
                'migrated_pins', 'migrated_quotes', 'migrated_quote_items',
                'migrated_legs', 'migrated_stays', 'skipped_pins', 'skipped_quotes',
                'skipped_legs', 'skipped_stays', 'seeded_tax_profiles',
                'seeded_quote_terms', 'errors'
            ]
            
            all_fields_present = all(field in report for field in required_fields)
            if all_fields_present:
                self.log("✓ Report has all required fields", "success")
            else:
                missing = [f for f in required_fields if f not in report]
                self.log(f"✗ Report missing fields: {missing}", "fail")
            
            # Log migration stats
            self.log(f"  Migrated pins: {report.get('migrated_pins', 0)}", "info")
            self.log(f"  Migrated quotes: {report.get('migrated_quotes', 0)}", "info")
            self.log(f"  Migrated quote items: {report.get('migrated_quote_items', 0)}", "info")
            self.log(f"  Migrated legs: {report.get('migrated_legs', 0)}", "info")
            self.log(f"  Migrated stays: {report.get('migrated_stays', 0)}", "info")
            self.log(f"  Seeded tax profiles: {report.get('seeded_tax_profiles', 0)}", "info")
            self.log(f"  Seeded quote terms: {report.get('seeded_quote_terms', False)}", "info")
            
            # Check for errors
            errors = report.get('errors', [])
            if errors:
                self.log(f"⚠️  Migration had {len(errors)} errors:", "fail")
                for err in errors[:5]:  # Show first 5 errors
                    self.log(f"    {err}", "fail")
            else:
                self.log("✓ No migration errors", "success")
            
            # Verify tax profiles were seeded
            if report.get('seeded_tax_profiles', 0) == 2:
                self.log("✓ Seeded 2 tax profiles (GST and TCS)", "success")
            elif report.get('seeded_tax_profiles', 0) == 0:
                self.log("ℹ️  Tax profiles already existed (0 seeded)", "info")
            
            return report
        
        return None

    def test_migration_idempotency(self, first_report):
        """Test POST /api/admin/run-migration - Second run (idempotency)"""
        self.log("\n=== MIGRATION IDEMPOTENCY TEST ===", "info")
        
        success, report = self.run_test(
            "POST /api/admin/run-migration - Second run (idempotency check)",
            "POST",
            "admin/run-migration",
            200
        )
        
        if success:
            self.log("Second migration run completed", "success")
            
            # Check idempotency - should have 0 new migrations
            migrated_quotes = report.get('migrated_quotes', -1)
            migrated_pins = report.get('migrated_pins', -1)
            migrated_legs = report.get('migrated_legs', -1)
            migrated_stays = report.get('migrated_stays', -1)
            
            if migrated_quotes == 0:
                self.log("✓ Idempotent: 0 new quotes migrated on second run", "success")
            else:
                self.log(f"✗ NOT idempotent: {migrated_quotes} quotes migrated on second run", "fail")
            
            if migrated_pins == 0:
                self.log("✓ Idempotent: 0 new pins migrated on second run", "success")
            else:
                self.log(f"✗ NOT idempotent: {migrated_pins} pins migrated on second run", "fail")
            
            if migrated_legs == 0:
                self.log("✓ Idempotent: 0 new legs migrated on second run", "success")
            else:
                self.log(f"✗ NOT idempotent: {migrated_legs} legs migrated on second run", "fail")
            
            if migrated_stays == 0:
                self.log("✓ Idempotent: 0 new stays migrated on second run", "success")
            else:
                self.log(f"✗ NOT idempotent: {migrated_stays} stays migrated on second run", "fail")
            
            # Check skipped counts match first run's migrated counts
            if first_report:
                expected_skipped_quotes = first_report.get('migrated_quotes', 0)
                actual_skipped_quotes = report.get('skipped_quotes', 0)
                
                if actual_skipped_quotes >= expected_skipped_quotes:
                    self.log(f"✓ Skipped {actual_skipped_quotes} quotes (previously migrated)", "success")
                else:
                    self.log(f"⚠️  Expected to skip {expected_skipped_quotes} quotes, skipped {actual_skipped_quotes}", "fail")
            
            return True
        
        return False

    def test_tax_profiles(self):
        """Test GET /api/tax-profiles - Should return GST and TCS"""
        self.log("\n=== TAX PROFILES TEST ===", "info")
        
        success, profiles = self.run_test(
            "GET /api/tax-profiles - List tax profiles",
            "GET",
            "tax-profiles",
            200
        )
        
        if success:
            self.log(f"Found {len(profiles)} tax profiles", "info")
            
            # Check for GST profile
            gst = next((p for p in profiles if p.get('label') == 'GST'), None)
            if gst:
                self.log(f"✓ GST profile found: rate={gst.get('rate')}%, applies_to={gst.get('applies_to')}", "success")
                if gst.get('rate') == 5.0 and gst.get('applies_to') == 'all':
                    self.log("✓ GST profile has correct values", "success")
            else:
                self.log("✗ GST profile not found", "fail")
            
            # Check for TCS profile
            tcs = next((p for p in profiles if p.get('label') == 'TCS'), None)
            if tcs:
                self.log(f"✓ TCS profile found: rate={tcs.get('rate')}%, applies_to={tcs.get('applies_to')}", "success")
                if tcs.get('rate') == 5.0 and tcs.get('applies_to') == 'international':
                    self.log("✓ TCS profile has correct values", "success")
            else:
                self.log("✗ TCS profile not found", "fail")
            
            # Verify no hardcoded rates in source (this is a manual check, but we can verify the API works)
            if len(profiles) >= 2:
                self.log("✓ At least 2 tax profiles exist", "success")
                return True
        
        return False

    def test_tax_profiles_crud(self):
        """Test CRUD operations on tax profiles"""
        self.log("\n=== TAX PROFILES CRUD TEST ===", "info")
        
        # POST - Create new tax profile
        new_profile = {
            "label": "Test VAT",
            "rate": 10.0,
            "applies_to": "domestic",
            "is_enabled": True,
            "description": "Test VAT profile"
        }
        
        success, created = self.run_test(
            "POST /api/tax-profiles - Create new profile",
            "POST",
            "tax-profiles",
            200,
            data=new_profile
        )
        
        profile_id = None
        if success and created.get('id'):
            profile_id = created['id']
            self.log(f"✓ Created profile with ID: {profile_id}", "success")
            
            # PUT - Update profile
            success, updated = self.run_test(
                f"PUT /api/tax-profiles/{profile_id} - Update profile",
                "PUT",
                f"tax-profiles/{profile_id}",
                200,
                data={"rate": 12.0}
            )
            
            if success and updated.get('rate') == 12.0:
                self.log("✓ Profile updated successfully", "success")
            
            # DELETE - Remove profile
            success, _ = self.run_test(
                f"DELETE /api/tax-profiles/{profile_id} - Delete profile",
                "DELETE",
                f"tax-profiles/{profile_id}",
                200
            )
            
            if success:
                self.log("✓ Profile deleted successfully", "success")
                return True
        
        return False

    def test_quote_terms_template(self):
        """Test GET /api/quote-terms-template"""
        self.log("\n=== QUOTE TERMS TEMPLATE TEST ===", "info")
        
        success, template = self.run_test(
            "GET /api/quote-terms-template - Get template",
            "GET",
            "quote-terms-template",
            200
        )
        
        if success:
            self.log("Quote terms template retrieved", "success")
            
            # Check required fields
            required_fields = ['inclusions', 'exclusions', 'terms_and_conditions', 'validity_days']
            all_present = all(field in template for field in required_fields)
            
            if all_present:
                self.log("✓ Template has all required fields", "success")
                self.log(f"  Inclusions: {len(template.get('inclusions', []))} items", "info")
                self.log(f"  Exclusions: {len(template.get('exclusions', []))} items", "info")
                self.log(f"  Validity days: {template.get('validity_days')}", "info")
                return template
            else:
                missing = [f for f in required_fields if f not in template]
                self.log(f"✗ Template missing fields: {missing}", "fail")
        
        return None

    def test_quote_terms_template_update(self):
        """Test PUT /api/quote-terms-template"""
        self.log("\n=== QUOTE TERMS TEMPLATE UPDATE TEST ===", "info")
        
        update_data = {
            "inclusions": ["Test inclusion 1", "Test inclusion 2"],
            "exclusions": ["Test exclusion 1"],
            "terms_and_conditions": "Test terms and conditions",
            "validity_days": 10
        }
        
        success, updated = self.run_test(
            "PUT /api/quote-terms-template - Update template",
            "PUT",
            "quote-terms-template",
            200,
            data=update_data
        )
        
        if success:
            if updated.get('validity_days') == 10:
                self.log("✓ Template updated successfully", "success")
                return True
        
        return False

    def test_places(self):
        """Test GET /api/places - Should return places (may be empty)"""
        self.log("\n=== PLACES TEST ===", "info")
        
        success, places = self.run_test(
            "GET /api/places - List all places",
            "GET",
            "places",
            200
        )
        
        if success:
            self.log(f"Found {len(places)} places", "info")
            
            # Check for favourites
            favourites = [p for p in places if p.get('is_favourite')]
            self.log(f"  Favourites: {len(favourites)}", "info")
            
            # Test favourites filter
            success, fav_only = self.run_test(
                "GET /api/places?favourites_only=true - Filter favourites",
                "GET",
                "places",
                200,
                params={"favourites_only": "true"}
            )
            
            if success:
                self.log(f"✓ Favourites filter returned {len(fav_only)} places", "success")
            
            return True
        
        return False

    def test_places_crud(self):
        """Test CRUD operations on places"""
        self.log("\n=== PLACES CRUD TEST ===", "info")
        
        # POST - Create new place
        new_place = {
            "name": "Test Place",
            "country": "India",
            "city": "Mumbai",
            "latitude": 19.0760,
            "longitude": 72.8777,
            "category": "hotel",
            "notes": "Test place for API testing",
            "is_favourite": True
        }
        
        success, created = self.run_test(
            "POST /api/places - Create new place",
            "POST",
            "places",
            200,
            data=new_place
        )
        
        place_id = None
        if success and created.get('id'):
            place_id = created['id']
            self.log(f"✓ Created place with ID: {place_id}", "success")
            
            # PUT - Update place
            success, updated = self.run_test(
                f"PUT /api/places/{place_id} - Update place",
                "PUT",
                f"places/{place_id}",
                200,
                data={"notes": "Updated notes"}
            )
            
            if success and updated.get('notes') == "Updated notes":
                self.log("✓ Place updated successfully", "success")
            
            # DELETE - Remove place
            success, _ = self.run_test(
                f"DELETE /api/places/{place_id} - Delete place",
                "DELETE",
                f"places/{place_id}",
                200
            )
            
            if success:
                self.log("✓ Place deleted successfully", "success")
                return True
        
        return False

    def test_trip_components(self):
        """Test trip components endpoints"""
        self.log("\n=== TRIP COMPONENTS TEST ===", "info")
        
        # First, get a trip to test with
        success, trips = self.run_test(
            "GET /api/trips - Get trips for component testing",
            "GET",
            "trips",
            200
        )
        
        if not success or not trips:
            self.log("No trips found, creating a test trip", "info")
            
            # Create a test trip
            trip_data = {
                "trip_title": "Test Trip for Components",
                "origin_name": "Mumbai",
                "start_date": "2025-09-01",
                "end_date": "2025-09-05",
                "adults": 2,
                "children": [],
                "rooms": 1,
                "currency": "INR",
                "status": "draft"
            }
            
            success, trip = self.run_test(
                "POST /api/trips - Create test trip",
                "POST",
                "trips",
                200,
                data=trip_data
            )
            
            if not success or not trip.get('id'):
                self.log("Failed to create test trip", "fail")
                return False
            
            trip_id = trip['id']
        else:
            trip_id = trips[0]['id']
            self.log(f"Using existing trip: {trip_id}", "info")
        
        # GET trip components
        success, components = self.run_test(
            f"GET /api/trips/{trip_id}/components - List components",
            "GET",
            f"trips/{trip_id}/components",
            200
        )
        
        if success:
            self.log(f"Found {len(components)} components for trip", "info")
            
            # POST - Create new component
            new_component = {
                "trip_id": trip_id,
                "type": "flight",
                "title": "Test Flight Component",
                "net_cost": 10000,
                "net_currency": "INR",
                "fx_rate": 1.0,
                "markup_type": "percentage",
                "markup_value": 10,
                "sell_currency": "INR",
                "status": "draft"
            }
            
            success, created = self.run_test(
                f"POST /api/trips/{trip_id}/components - Create component",
                "POST",
                f"trips/{trip_id}/components",
                200,
                data=new_component
            )
            
            component_id = None
            if success and created.get('id'):
                component_id = created['id']
                self.log(f"✓ Created component with ID: {component_id}", "success")
                
                # Verify sell_price was auto-computed
                sell_price = created.get('sell_price')
                expected_sell = 10000 * 1.1  # 10% markup
                if sell_price and abs(sell_price - expected_sell) < 1:
                    self.log(f"✓ Sell price auto-computed correctly: {sell_price}", "success")
                else:
                    self.log(f"⚠️  Sell price: {sell_price}, expected: {expected_sell}", "fail")
                
                # PUT - Update component
                success, updated = self.run_test(
                    f"PUT /api/trips/{trip_id}/components/{component_id} - Update component",
                    "PUT",
                    f"trips/{trip_id}/components/{component_id}",
                    200,
                    data={"net_cost": 12000, "markup_value": 15}
                )
                
                if success:
                    new_sell = updated.get('sell_price')
                    expected_new_sell = 12000 * 1.15  # 15% markup
                    if new_sell and abs(new_sell - expected_new_sell) < 1:
                        self.log(f"✓ Sell price recomputed correctly: {new_sell}", "success")
                
                # DELETE - Remove component
                success, _ = self.run_test(
                    f"DELETE /api/trips/{trip_id}/components/{component_id} - Delete component",
                    "DELETE",
                    f"trips/{trip_id}/components/{component_id}",
                    200
                )
                
                if success:
                    self.log("✓ Component deleted successfully", "success")
                    return True
        
        return False

    def test_existing_trip_endpoints(self):
        """Test that existing trip endpoints still work"""
        self.log("\n=== EXISTING TRIP ENDPOINTS TEST ===", "info")
        
        # GET /api/trips
        success, trips = self.run_test(
            "GET /api/trips - List trips",
            "GET",
            "trips",
            200
        )
        
        if success:
            self.log(f"✓ Found {len(trips)} trips", "success")
            
            # Test POST /api/trips with new status values
            new_trip = {
                "trip_title": "Test Trip with New Status",
                "client_name": "Test Client",
                "origin_name": "Delhi",
                "start_date": "2025-10-01",
                "end_date": "2025-10-05",
                "adults": 2,
                "children": [],
                "rooms": 1,
                "currency": "INR",
                "status": "quoted"  # New status value
            }
            
            success, created = self.run_test(
                "POST /api/trips - Create trip with new status 'quoted'",
                "POST",
                "trips",
                200,
                data=new_trip
            )
            
            if success and created.get('status') == 'quoted':
                self.log("✓ New status value 'quoted' accepted", "success")
                return True
        
        return False

    def print_summary(self):
        """Print test summary"""
        self.log("\n" + "="*60, "info")
        self.log("TEST SUMMARY", "info")
        self.log("="*60, "info")
        self.log(f"Total tests run: {self.tests_run}", "info")
        self.log(f"Tests passed: {self.tests_passed}", "success")
        self.log(f"Tests failed: {self.tests_run - self.tests_passed}", "fail")
        self.log(f"Success rate: {(self.tests_passed/self.tests_run*100):.1f}%", "info")
        
        # Show failed tests
        failed = [t for t in self.test_results if t['status'] in ['FAIL', 'ERROR']]
        if failed:
            self.log(f"\nFailed tests ({len(failed)}):", "fail")
            for t in failed:
                self.log(f"  - {t['test']}", "fail")


def main():
    tester = MigrationTester()
    
    # Login
    if not tester.test_login():
        print("❌ Login failed, stopping tests")
        return 1
    
    # Test existing quotes still work
    tester.test_existing_quotes()
    
    # Run migration first time
    first_report = tester.test_migration_first_run()
    
    # Test idempotency
    tester.test_migration_idempotency(first_report)
    
    # Test new collections
    tester.test_tax_profiles()
    tester.test_tax_profiles_crud()
    tester.test_quote_terms_template()
    tester.test_quote_terms_template_update()
    tester.test_places()
    tester.test_places_crud()
    tester.test_trip_components()
    
    # Test existing endpoints still work
    tester.test_existing_trip_endpoints()
    
    # Print summary
    tester.print_summary()
    
    return 0 if tester.tests_passed == tester.tests_run else 1


if __name__ == "__main__":
    sys.exit(main())
