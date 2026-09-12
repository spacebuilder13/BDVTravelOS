import requests
import sys
from datetime import datetime

class BDVTravelOSAPITester:
    def __init__(self, base_url="https://travel-agency-os-4.preview.emergentagent.com"):
        self.base_url = base_url
        self.token = None
        self.tests_run = 0
        self.tests_passed = 0
        self.test_results = []

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.base_url}/{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'
        if headers:
            test_headers.update(headers)

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                self.test_results.append({"test": name, "status": "PASSED", "code": response.status_code})
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                print(f"   Response: {response.text[:200]}")
                self.test_results.append({"test": name, "status": "FAILED", "code": response.status_code, "expected": expected_status})

            try:
                return success, response.json() if response.text else {}
            except Exception:
                return success, {}

        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            self.test_results.append({"test": name, "status": "ERROR", "error": str(e)})
            return False, {}

    def test_root(self):
        """Test root endpoint"""
        success, response = self.run_test(
            "Root API",
            "GET",
            "api/",
            200
        )
        return success

    def test_get_staff_list(self):
        """Test getting staff list (public endpoint)"""
        success, response = self.run_test(
            "Get Staff List",
            "GET",
            "api/auth/staff",
            200
        )
        if success:
            print(f"   Found {len(response)} staff members")
            if len(response) >= 5:
                print(f"   ✓ All 5 staff members present")
            else:
                print(f"   ⚠ Expected 5 staff, found {len(response)}")
        return success, response

    def test_login(self, staff_id, pin):
        """Test login and get token"""
        success, response = self.run_test(
            f"Login with PIN",
            "POST",
            "api/auth/login",
            200,
            data={"staff_id": staff_id, "pin": pin}
        )
        if success and 'token' in response:
            self.token = response['token']
            print(f"   ✓ Token received: {self.token[:20]}...")
            print(f"   ✓ User: {response.get('user', {}).get('name')}")
            return True, response
        return False, {}

    def test_wrong_pin(self, staff_id):
        """Test login with wrong PIN"""
        success, response = self.run_test(
            "Login with Wrong PIN",
            "POST",
            "api/auth/login",
            401,
            data={"staff_id": staff_id, "pin": "9999"}
        )
        return success

    def test_get_me(self):
        """Test get current user"""
        success, response = self.run_test(
            "Get Current User",
            "GET",
            "api/auth/me",
            200
        )
        if success:
            print(f"   ✓ User: {response.get('name')} ({response.get('role')})")
        return success

    def test_get_enquiries(self):
        """Get all enquiries"""
        success, response = self.run_test(
            "Get All Enquiries",
            "GET",
            "api/enquiries",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} enquiries")
        return success, response

    def test_create_enquiry(self):
        """Create a new enquiry"""
        enquiry_data = {
            "client_name": f"Test Client {datetime.now().strftime('%H%M%S')}",
            "phone": "9876543210",
            "email": "test@example.com",
            "destination": "Dubai",
            "travel_date": "2025-09-15",
            "return_date": "2025-09-20",
            "pax_adults": 2,
            "pax_children": 1,
            "budget": "2,00,000",
            "travel_type": "Family",
            "service_type": "Tour",
            "source": "Manual",
            "pipeline_stage": "New Enquiry",
            "notes": "Test enquiry from automated test",
            "company": "BDVV"
        }
        success, response = self.run_test(
            "Create New Enquiry",
            "POST",
            "api/enquiries",
            200,
            data=enquiry_data
        )
        if success and 'id' in response:
            print(f"   ✓ Created enquiry ID: {response['id']}")
            return success, response['id']
        return False, None

    def test_get_enquiry(self, enquiry_id):
        """Get a specific enquiry"""
        success, response = self.run_test(
            "Get Specific Enquiry",
            "GET",
            f"api/enquiries/{enquiry_id}",
            200
        )
        return success

    def test_update_enquiry_stage(self, enquiry_id):
        """Update enquiry stage"""
        success, response = self.run_test(
            "Update Enquiry Stage",
            "PATCH",
            f"api/enquiries/{enquiry_id}/stage",
            200,
            data={"stage": "Quoted"}
        )
        if success:
            print(f"   ✓ Stage updated to: {response.get('pipeline_stage')}")
        return success

    def test_delete_enquiry(self, enquiry_id):
        """Delete an enquiry"""
        success, response = self.run_test(
            "Delete Enquiry",
            "DELETE",
            f"api/enquiries/{enquiry_id}",
            200
        )
        return success

    def test_dashboard_stats(self):
        """Get dashboard stats"""
        success, response = self.run_test(
            "Get Dashboard Stats",
            "GET",
            "api/dashboard/stats",
            200
        )
        if success:
            print(f"   ✓ Total leads this month: {response.get('total_leads_month')}")
            print(f"   ✓ Conversions: {response.get('conversions')}")
            print(f"   ✓ Active bookings: {response.get('active_bookings')}")
        return success

    def test_dashboard_alerts(self):
        """Get dashboard alerts"""
        success, response = self.run_test(
            "Get Dashboard Alerts",
            "GET",
            "api/dashboard/alerts",
            200
        )
        if success:
            print(f"   ✓ Departures: {len(response.get('departures', []))}")
            print(f"   ✓ WhatsApp unread: {response.get('wa_unread', 0)}")
        return success

    def test_get_saved_sites(self):
        """Get saved sites"""
        success, response = self.run_test(
            "Get Saved Sites",
            "GET",
            "api/sites",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} saved sites")
        return success, response

    def test_get_staff(self):
        """Get all staff (authenticated)"""
        success, response = self.run_test(
            "Get All Staff",
            "GET",
            "api/staff",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} staff members")
        return success

    def test_get_activity(self):
        """Get activity log"""
        success, response = self.run_test(
            "Get Activity Log",
            "GET",
            "api/activity?limit=10",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} activities")
        return success

    def test_get_trips(self):
        """Get all trips"""
        success, response = self.run_test(
            "Get All Trips",
            "GET",
            "api/trips",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} trips")
        return success, response

    def test_create_trip(self):
        """Create a new trip"""
        trip_data = {
            "client_name": f"Test Trip Client {datetime.now().strftime('%H%M%S')}",
            "origin_name": "Mumbai",
            "start_date": "2025-09-15",
            "end_date": "2025-09-20",
            "adults": 2,
            "status": "draft"
        }
        success, response = self.run_test(
            "Create New Trip",
            "POST",
            "api/trips",
            200,
            data=trip_data
        )
        if success and 'id' in response:
            print(f"   ✓ Created trip ID: {response['id']}")
            return success, response['id']
        return False, None

    def test_get_trip_components(self, trip_id):
        """Get components for a trip"""
        success, response = self.run_test(
            "Get Trip Components",
            "GET",
            f"api/trips/{trip_id}/components",
            200
        )
        if success:
            print(f"   ✓ Found {len(response)} components")
        return success, response

    def test_create_component_with_location(self, trip_id):
        """Create a component with latitude/longitude"""
        component_data = {
            "trip_id": trip_id,
            "type": "activity",
            "title": "Burj Khalifa Visit",
            "latitude": 25.1972,
            "longitude": 55.2744,
            "start_datetime": "2025-09-16T10:00:00",
            "pax_count": 2,
            "net_cost": 500,
            "net_currency": "AED",
            "sell_price": 600,
            "sell_currency": "AED"
        }
        success, response = self.run_test(
            "Create Component with Location",
            "POST",
            f"api/trips/{trip_id}/components",
            200,
            data=component_data
        )
        if success and 'id' in response:
            print(f"   ✓ Created component ID: {response['id']}")
            print(f"   ✓ Location: {response.get('latitude')}, {response.get('longitude')}")
            return success, response['id']
        return False, None

    def test_update_component_location(self, trip_id, component_id):
        """Update component location"""
        update_data = {
            "latitude": 25.2048,
            "longitude": 55.2708
        }
        success, response = self.run_test(
            "Update Component Location",
            "PUT",
            f"api/trips/{trip_id}/components/{component_id}",
            200,
            data=update_data
        )
        if success:
            print(f"   ✓ Updated location: {response.get('latitude')}, {response.get('longitude')}")
        return success

    def test_delete_component(self, trip_id, component_id):
        """Delete a component"""
        success, response = self.run_test(
            "Delete Component",
            "DELETE",
            f"api/trips/{trip_id}/components/{component_id}",
            200
        )
        return success

    def test_delete_trip(self, trip_id):
        """Delete a trip"""
        success, response = self.run_test(
            "Delete Trip",
            "DELETE",
            f"api/trips/{trip_id}",
            200
        )
        return success

def main():
    print("=" * 60)
    print("BDV TravelOS - Backend API Testing")
    print("=" * 60)
    
    tester = BDVTravelOSAPITester()
    
    # Test 1: Root endpoint
    print("\n📋 SECTION 1: Basic Connectivity")
    print("-" * 60)
    tester.test_root()
    
    # Test 2: Get staff list (public)
    print("\n📋 SECTION 2: Authentication - Staff List")
    print("-" * 60)
    success, staff_list = tester.test_get_staff_list()
    if not success or not staff_list:
        print("\n❌ CRITICAL: Cannot get staff list. Stopping tests.")
        return 1
    
    # Find Yash Doshi (Admin) for login
    admin_staff = next((s for s in staff_list if s.get('name') == 'Yash Doshi'), None)
    if not admin_staff:
        print("\n❌ CRITICAL: Admin user 'Yash Doshi' not found. Stopping tests.")
        return 1
    
    # Test 3: Login with correct PIN
    print("\n📋 SECTION 3: Authentication - Login")
    print("-" * 60)
    success, login_response = tester.test_login(admin_staff['id'], "0000")
    if not success:
        print("\n❌ CRITICAL: Login failed. Stopping tests.")
        return 1
    
    # Test 4: Login with wrong PIN
    tester.test_wrong_pin(admin_staff['id'])
    
    # Test 5: Get current user
    print("\n📋 SECTION 4: User Profile")
    print("-" * 60)
    tester.test_get_me()
    
    # Test 6: Enquiries CRUD
    print("\n📋 SECTION 5: Enquiries Management")
    print("-" * 60)
    success, enquiries = tester.test_get_enquiries()
    
    # Create new enquiry
    success, new_enquiry_id = tester.test_create_enquiry()
    if success and new_enquiry_id:
        # Get the created enquiry
        tester.test_get_enquiry(new_enquiry_id)
        
        # Update stage
        tester.test_update_enquiry_stage(new_enquiry_id)
        
        # Delete enquiry
        tester.test_delete_enquiry(new_enquiry_id)
    
    # Test 7: Dashboard
    print("\n📋 SECTION 6: Dashboard Data")
    print("-" * 60)
    tester.test_dashboard_stats()
    tester.test_dashboard_alerts()
    
    # Test 8: Saved Sites
    print("\n📋 SECTION 7: Saved Sites")
    print("-" * 60)
    tester.test_get_saved_sites()
    
    # Test 9: Staff & Activity
    print("\n📋 SECTION 8: Staff & Activity")
    print("-" * 60)
    tester.test_get_staff()
    tester.test_get_activity()
    
    # Test 10: Trip Planner - Components with Location
    print("\n📋 SECTION 9: Trip Planner - Components with Location")
    print("-" * 60)
    success, trips = tester.test_get_trips()
    
    # Create new trip
    success, new_trip_id = tester.test_create_trip()
    if success and new_trip_id:
        # Get components (should be empty)
        tester.test_get_trip_components(new_trip_id)
        
        # Create component with location
        success, component_id = tester.test_create_component_with_location(new_trip_id)
        if success and component_id:
            # Update component location
            tester.test_update_component_location(new_trip_id, component_id)
            
            # Get components again (should have 1)
            tester.test_get_trip_components(new_trip_id)
            
            # Delete component
            tester.test_delete_component(new_trip_id, component_id)
        
        # Delete trip
        tester.test_delete_trip(new_trip_id)
    
    # Print summary
    print("\n" + "=" * 60)
    print("📊 TEST SUMMARY")
    print("=" * 60)
    print(f"Total Tests: {tester.tests_run}")
    print(f"Passed: {tester.tests_passed}")
    print(f"Failed: {tester.tests_run - tester.tests_passed}")
    print(f"Success Rate: {(tester.tests_passed / tester.tests_run * 100):.1f}%")
    
    if tester.tests_passed == tester.tests_run:
        print("\n✅ ALL TESTS PASSED!")
        return 0
    else:
        print(f"\n⚠️  {tester.tests_run - tester.tests_passed} TEST(S) FAILED")
        print("\nFailed tests:")
        for result in tester.test_results:
            if result['status'] in ['FAILED', 'ERROR']:
                error_msg = result.get('error', f"Expected {result.get('expected')}, got {result.get('code')}")
                print(f"  - {result['test']}: {error_msg}") 
        return 1

if __name__ == "__main__":
    sys.exit(main())
