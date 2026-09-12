#!/usr/bin/env python3
"""
Backend API Test Suite for BDV TravelOS - Block 2 & 3: CRM & Quotations
Tests all CRM endpoints including clients, enquiries, stages, followups, notes, dashboard alerts.
Tests all Quote endpoints including CRUD, multi-currency, status workflow, PDF/Excel export, auto-numbering.
"""

import requests
import sys
from datetime import datetime, timedelta

class CRMAPITester:
    def __init__(self, base_url="https://travel-agency-os-4.preview.emergentagent.com"):
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
                response = requests.get(url, headers=headers, params=params, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=headers, timeout=10)
            elif method == 'PATCH':
                response = requests.patch(url, json=data, headers=headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=headers, timeout=10)

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

    def test_clients_api(self):
        """Test client endpoints"""
        self.log("\n=== CLIENT API TESTS ===", "info")
        
        # GET /api/clients
        success, clients = self.run_test(
            "GET /api/clients - List all clients",
            "GET",
            "clients",
            200
        )
        
        if success:
            self.log(f"Found {len(clients)} clients", "info")
        
        # POST /api/clients - Create new client
        new_client_data = {
            "full_name": "Test Client API",
            "phone": "9999888877",
            "email": "testclient@test.com",
            "nationality": "Indian",
            "passport_no": "T1234567",
            "passport_expiry": "2028-12-31",
            "notes": "Created by backend test"
        }
        
        success, new_client = self.run_test(
            "POST /api/clients - Create new client",
            "POST",
            "clients",
            200,
            data=new_client_data
        )
        
        if success and new_client.get('id'):
            self.log(f"Created client with ID: {new_client['id']}", "success")
            return new_client['id']
        
        return None

    def test_client_documents_api(self, client_id):
        """Test client categorized document upload endpoints"""
        self.log("\n=== CLIENT DOCUMENTS (CATEGORIZED UPLOAD) TESTS ===", "info")
        
        if not client_id:
            self.log("No client ID provided, skipping document tests", "fail")
            return False
        
        # Test categories
        categories = [
            "passport_identity",
            "financial",
            "cover_letter",
            "visa_application",
            "travel_proof",
            "photographs"
        ]
        
        # Create a test PDF file
        import io
        pdf_content = b"%PDF-1.4\n1 0 obj\n<<\n/Type /Catalog\n/Pages 2 0 R\n>>\nendobj\n2 0 obj\n<<\n/Type /Pages\n/Kids [3 0 R]\n/Count 1\n>>\nendobj\n3 0 obj\n<<\n/Type /Page\n/Parent 2 0 R\n/Resources <<\n/Font <<\n/F1 4 0 R\n>>\n>>\n/MediaBox [0 0 612 792]\n/Contents 5 0 R\n>>\nendobj\n4 0 obj\n<<\n/Type /Font\n/Subtype /Type1\n/BaseFont /Helvetica\n>>\nendobj\n5 0 obj\n<<\n/Length 44\n>>\nstream\nBT\n/F1 12 Tf\n100 700 Td\n(Test Document) Tj\nET\nendstream\nendobj\nxref\n0 6\n0000000000 65535 f\n0000000009 00000 n\n0000000058 00000 n\n0000000115 00000 n\n0000000262 00000 n\n0000000341 00000 n\ntrailer\n<<\n/Size 6\n/Root 1 0 R\n>>\nstartxref\n433\n%%EOF"
        
        uploaded_file_ids = []
        
        # Test 1: Upload file to passport_identity category
        url = f"{self.base_url}/clients/{client_id}/files"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        files = {
            'file': ('test_passport.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'category': 'passport_identity',
            'note': 'Test passport document'
        }
        
        self.tests_run += 1
        self.log("Testing POST /api/clients/{id}/files - Upload passport document...", "test")
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=10)
            
            if response.status_code == 200:
                file_data = response.json()
                file_id = file_data.get('id')
                uploaded_file_ids.append(file_id)
                
                self.tests_passed += 1
                self.log(f"Passed - File uploaded with ID: {file_id}", "success")
                self.test_results.append({"test": "Upload passport document", "status": "PASS", "file_id": file_id})
                
                # Verify file metadata
                if file_data.get('category') == 'passport_identity':
                    self.log("✓ Category correct: passport_identity", "success")
                if file_data.get('note') == 'Test passport document':
                    self.log("✓ Note correct", "success")
                if file_data.get('file_type') == 'application/pdf':
                    self.log("✓ File type correct: application/pdf", "success")
                if file_data.get('file_url'):
                    self.log(f"✓ File URL generated: {file_data.get('file_url')}", "success")
            else:
                self.log(f"Failed - Expected 200, got {response.status_code}", "fail")
                self.log(f"Response: {response.text[:200]}", "fail")
                self.test_results.append({"test": "Upload passport document", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "Upload passport document", "status": "ERROR", "error": str(e)})
        
        # Test 2: Upload file to financial category
        files = {
            'file': ('test_bank_statement.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'category': 'financial',
            'note': 'Test bank statement'
        }
        
        self.tests_run += 1
        self.log("Testing POST /api/clients/{id}/files - Upload financial document...", "test")
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=10)
            
            if response.status_code == 200:
                file_data = response.json()
                file_id = file_data.get('id')
                uploaded_file_ids.append(file_id)
                
                self.tests_passed += 1
                self.log(f"Passed - File uploaded with ID: {file_id}", "success")
                self.test_results.append({"test": "Upload financial document", "status": "PASS", "file_id": file_id})
            else:
                self.log(f"Failed - Expected 200, got {response.status_code}", "fail")
                self.test_results.append({"test": "Upload financial document", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "Upload financial document", "status": "ERROR", "error": str(e)})
        
        # Test 3: GET /api/clients/{id}/files - List all uploaded files
        success, files_list = self.run_test(
            f"GET /api/clients/{client_id}/files - List uploaded files",
            "GET",
            f"clients/{client_id}/files",
            200
        )
        
        if success:
            self.log(f"Found {len(files_list)} uploaded files", "info")
            
            # Verify uploaded files are in the list
            found_passport = any(f.get('category') == 'passport_identity' for f in files_list)
            found_financial = any(f.get('category') == 'financial' for f in files_list)
            
            if found_passport:
                self.log("✓ Passport document found in list", "success")
            else:
                self.log("✗ Passport document not found in list", "fail")
            
            if found_financial:
                self.log("✓ Financial document found in list", "success")
            else:
                self.log("✗ Financial document not found in list", "fail")
        
        # Test 4: Test invalid category (should fail with 400)
        files = {
            'file': ('test_invalid.pdf', io.BytesIO(pdf_content), 'application/pdf')
        }
        data = {
            'category': 'invalid_category',
            'note': 'Test invalid category'
        }
        
        self.tests_run += 1
        self.log("Testing POST /api/clients/{id}/files - Invalid category (should fail)...", "test")
        
        try:
            response = requests.post(url, headers=headers, files=files, data=data, timeout=10)
            
            if response.status_code == 400:
                self.tests_passed += 1
                self.log("Passed - Invalid category correctly rejected with 400", "success")
                self.test_results.append({"test": "Invalid category rejection", "status": "PASS"})
            else:
                self.log(f"Failed - Expected 400, got {response.status_code}", "fail")
                self.test_results.append({"test": "Invalid category rejection", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "Invalid category rejection", "status": "ERROR", "error": str(e)})
        
        # Test 5: DELETE /api/clients/{id}/files/{file_id} - Delete uploaded files
        for file_id in uploaded_file_ids:
            success, response = self.run_test(
                f"DELETE /api/clients/{client_id}/files/{file_id} - Delete file",
                "DELETE",
                f"clients/{client_id}/files/{file_id}",
                200
            )
            
            if success:
                self.log(f"✓ File {file_id} deleted successfully", "success")
        
        # Test 6: Verify files are deleted
        success, files_list_after = self.run_test(
            f"GET /api/clients/{client_id}/files - Verify files deleted",
            "GET",
            f"clients/{client_id}/files",
            200
        )
        
        if success:
            remaining_test_files = [f for f in files_list_after if f.get('id') in uploaded_file_ids]
            if len(remaining_test_files) == 0:
                self.log("✓ All test files successfully deleted", "success")
            else:
                self.log(f"✗ {len(remaining_test_files)} test files still remain", "fail")
        
        return True

    def test_enquiries_api(self):
        """Test enquiry endpoints with unified stages"""
        self.log("\n=== ENQUIRY API TESTS ===", "info")
        
        # GET /api/enquiries - List all enquiries
        success, enquiries = self.run_test(
            "GET /api/enquiries - List all enquiries",
            "GET",
            "enquiries",
            200
        )
        
        if success:
            self.log(f"Found {len(enquiries)} enquiries", "info")
            
            # Check for unified stages
            stages_found = set()
            for enq in enquiries:
                stage = enq.get('pipeline_stage')
                if stage:
                    stages_found.add(stage)
            
            self.log(f"Stages found: {', '.join(sorted(stages_found))}", "info")
            
            # Verify unified stages (New, Qualified, Quoted, Follow-up, Converted, Lost)
            expected_stages = {'New', 'Qualified', 'Quoted', 'Follow-up', 'Converted', 'Lost'}
            if stages_found.issubset(expected_stages):
                self.log("✓ All stages are from unified stage set", "success")
            else:
                unexpected = stages_found - expected_stages
                if unexpected:
                    self.log(f"⚠️  Found unexpected stages: {unexpected}", "fail")
        
        # Create a test enquiry
        new_enquiry_data = {
            "client_name": "Test Lead API",
            "phone": "9876543210",
            "destination": "Test Destination",
            "travel_date": "2025-09-15",
            "pax_adults": 2,
            "pax_children": 0,
            "service_type": "Tour",
            "pipeline_stage": "New",
            "source": "Manual",
            "notes": "Created by backend test"
        }
        
        success, new_enquiry = self.run_test(
            "POST /api/enquiries - Create new enquiry",
            "POST",
            "enquiries",
            200,
            data=new_enquiry_data
        )
        
        if success and new_enquiry.get('id'):
            enquiry_id = new_enquiry['id']
            self.log(f"Created enquiry with ID: {enquiry_id}", "success")
            return enquiry_id
        
        return None

    def test_enquiry_stage_updates(self, enquiry_id):
        """Test PATCH /api/enquiries/{id}/stage"""
        self.log("\n=== ENQUIRY STAGE UPDATE TESTS ===", "info")
        
        if not enquiry_id:
            self.log("No enquiry ID provided, skipping stage tests", "fail")
            return False
        
        # Test stage progression: New -> Qualified -> Quoted -> Follow-up
        stages_to_test = ['Qualified', 'Quoted', 'Follow-up']
        
        for stage in stages_to_test:
            success, updated = self.run_test(
                f"PATCH /api/enquiries/{enquiry_id}/stage - Update to {stage}",
                "PATCH",
                f"enquiries/{enquiry_id}/stage",
                200,
                data={"stage": stage}
            )
            
            if success and updated.get('pipeline_stage') == stage:
                self.log(f"Stage updated to {stage}", "success")
            else:
                self.log(f"Failed to update stage to {stage}", "fail")
                return False
        
        return True

    def test_enquiry_followup(self, enquiry_id):
        """Test PATCH /api/enquiries/{id}/followup"""
        self.log("\n=== ENQUIRY FOLLOW-UP TESTS ===", "info")
        
        if not enquiry_id:
            self.log("No enquiry ID provided, skipping followup tests", "fail")
            return False
        
        # Set follow-up date to tomorrow
        tomorrow = (datetime.now() + timedelta(days=1)).isoformat()
        
        success, updated = self.run_test(
            f"PATCH /api/enquiries/{enquiry_id}/followup - Set follow-up date",
            "PATCH",
            f"enquiries/{enquiry_id}/followup",
            200,
            data={"followup_at": tomorrow}
        )
        
        if success and updated.get('followup_at'):
            self.log(f"Follow-up date set to {updated['followup_at']}", "success")
            return True
        
        return False

    def test_enquiry_assign(self, enquiry_id):
        """Test PATCH /api/enquiries/{id}/assign"""
        self.log("\n=== ENQUIRY ASSIGN TESTS ===", "info")
        
        if not enquiry_id:
            self.log("No enquiry ID provided, skipping assign tests", "fail")
            return False
        
        # Get staff list
        success, staff_list = self.run_test(
            "Get Staff List for assignment",
            "GET",
            "staff",
            200
        )
        
        if not success or not staff_list:
            self.log("Failed to get staff list", "fail")
            return False
        
        # Assign to first staff member
        staff = staff_list[0]
        success, updated = self.run_test(
            f"PATCH /api/enquiries/{enquiry_id}/assign - Assign to {staff['name']}",
            "PATCH",
            f"enquiries/{enquiry_id}/assign",
            200,
            data={"staff_id": staff['id'], "staff_name": staff['name']}
        )
        
        if success and updated.get('assigned_to_staff_id') == staff['id']:
            self.log(f"Assigned to {staff['name']}", "success")
            return True
        
        return False

    def test_enquiry_notes(self, enquiry_id):
        """Test POST /api/enquiries/{id}/notes"""
        self.log("\n=== ENQUIRY NOTES TESTS ===", "info")
        
        if not enquiry_id:
            self.log("No enquiry ID provided, skipping notes tests", "fail")
            return False
        
        # Add a note
        success, note = self.run_test(
            f"POST /api/enquiries/{enquiry_id}/notes - Add note",
            "POST",
            f"enquiries/{enquiry_id}/notes",
            200,
            data={"note": "Test note from backend test"}
        )
        
        if success and note.get('id'):
            self.log(f"Note added with ID: {note['id']}", "success")
            
            # Get notes
            success, notes = self.run_test(
                f"GET /api/enquiries/{enquiry_id}/notes - Get notes",
                "GET",
                f"enquiries/{enquiry_id}/notes",
                200
            )
            
            if success:
                self.log(f"Retrieved {len(notes)} notes", "success")
                return True
        
        return False

    def test_enquiry_lost(self, enquiry_id):
        """Test PATCH /api/enquiries/{id}/lost"""
        self.log("\n=== ENQUIRY LOST TESTS ===", "info")
        
        if not enquiry_id:
            self.log("No enquiry ID provided, skipping lost tests", "fail")
            return False
        
        success, updated = self.run_test(
            f"PATCH /api/enquiries/{enquiry_id}/lost - Mark as lost",
            "PATCH",
            f"enquiries/{enquiry_id}/lost",
            200,
            data={"lost_reason": "Budget too high", "lost_notes": "Client found cheaper option"}
        )
        
        if success and updated.get('pipeline_stage') == 'Lost':
            self.log(f"Marked as Lost with reason: {updated.get('lost_reason')}", "success")
            return True
        
        return False

    def test_crm_followups(self):
        """Test GET /api/crm/followups"""
        self.log("\n=== CRM FOLLOW-UPS TESTS ===", "info")
        
        success, followups = self.run_test(
            "GET /api/crm/followups - Get due and overdue followups",
            "GET",
            "crm/followups",
            200
        )
        
        if success:
            due_today = followups.get('due_today', [])
            overdue = followups.get('overdue', [])
            self.log(f"Due today: {len(due_today)}, Overdue: {len(overdue)}", "info")
            return True
        
        return False

    def test_dashboard_alerts(self):
        """Test GET /api/dashboard/alerts - Check followups_due_today and followups_overdue"""
        self.log("\n=== DASHBOARD ALERTS TESTS ===", "info")
        
        success, alerts = self.run_test(
            "GET /api/dashboard/alerts - Get dashboard alerts",
            "GET",
            "dashboard/alerts",
            200
        )
        
        if success:
            # Check for followups fields
            if 'followups_due_today' in alerts:
                self.log(f"✓ followups_due_today present: {len(alerts['followups_due_today'])} items", "success")
            else:
                self.log("✗ followups_due_today missing", "fail")
            
            if 'followups_overdue' in alerts:
                self.log(f"✓ followups_overdue present: {len(alerts['followups_overdue'])} items", "success")
            else:
                self.log("✗ followups_overdue missing", "fail")
            
            # Log other alert types
            self.log(f"Departures: {len(alerts.get('departures', []))}", "info")
            self.log(f"Passport expiries: {len(alerts.get('passport_expiries', []))}", "info")
            self.log(f"Visa appointments: {len(alerts.get('visa_appointments', []))}", "info")
            
            return 'followups_due_today' in alerts and 'followups_overdue' in alerts
        
        return False

    # ========== BLOCK 3: QUOTATION TESTS ==========

    def test_quotes_create_advanced_costing(self):
        """Test POST /api/quotes - Create quote with advanced costing (markup, GST, TCS)"""
        self.log("\n=== QUOTE CREATION (ADVANCED COSTING) TESTS ===", "info")
        
        # Create quote with 1 flight + 1 hotel + markup 18% + GST 5%
        quote_data = {
            "quote_type": "International Tour",
            "base_currency": "INR",
            "client_name": "Test Advanced Costing",
            "phone": "9876543210",
            "email": "testadvanced@test.com",
            "destination": "Dubai, UAE",
            "travel_date": "2025-09-15",
            "return_date": "2025-09-20",
            "pax_adults": 2,
            "pax_children": 0,
            "validity_date": "2025-08-31",
            "notes": "Test quote with advanced costing",
            "markup_type": "percentage",
            "markup_value": 18,
            "gst_rate": 5,
            "tcs_enabled": False,
            "tcs_rate": 5,
            "items": [
                {
                    "category": "Flights",
                    "title": "BOM → DXB",
                    "description": "Round-trip flights",
                    "from_location": "BOM",
                    "to_location": "DXB",
                    "fare_adult": 25000,
                    "no_adults": 2,
                    "fare_child": 0,
                    "no_children": 0,
                    "fare_infant": 0,
                    "no_infants": 0,
                    "qty": 1,
                    "unit_price": 50000,
                    "currency": "INR",
                    "roe_to_base": 1.0
                },
                {
                    "category": "Hotels",
                    "title": "5-Star Hotel",
                    "description": "2 nights stay",
                    "hotel_name": "Burj Al Arab",
                    "check_in": "2025-09-15",
                    "check_out": "2025-09-17",
                    "nights": 2,
                    "no_of_rooms": 1,
                    "rate_per_night": 5000,
                    "qty": 2,
                    "unit_price": 5000,
                    "currency": "INR",
                    "roe_to_base": 1.0
                }
            ]
        }
        
        success, quote = self.run_test(
            "POST /api/quotes - Create quote with advanced costing",
            "POST",
            "quotes",
            200,
            data=quote_data
        )
        
        if success and quote.get('id'):
            quote_id = quote['id']
            quote_no = quote.get('quote_no', '')
            
            self.log(f"Created quote: {quote_no} (ID: {quote_id})", "success")
            
            # Verify cost breakdown
            oc = quote.get('operating_cost', 0)
            markup_amt = quote.get('markup_amount', 0)
            subtotal = quote.get('subtotal', 0)
            gst_amt = quote.get('gst_amount', 0)
            tcs_amt = quote.get('tcs_amount', 0)
            grand_total = quote.get('grand_total_base', 0)
            
            self.log(f"Operating Cost: {oc}", "info")
            self.log(f"Markup (18%): {markup_amt}", "info")
            self.log(f"Sub-total: {subtotal}", "info")
            self.log(f"GST (5%): {gst_amt}", "info")
            self.log(f"TCS: {tcs_amt}", "info")
            self.log(f"Grand Total: {grand_total}", "info")
            
            # Expected calculations:
            # OC = 50000 (flight) + 10000 (hotel 2×5000) = 60000
            # Markup = 60000 × 18% = 10800
            # Sub-total = 60000 + 10800 = 70800
            # GST = 70800 × 5% = 3540
            # TCS = 0 (disabled)
            # Grand Total = 70800 + 3540 = 74340
            
            expected_oc = 60000.0
            expected_markup = 10800.0
            expected_subtotal = 70800.0
            expected_gst = 3540.0
            expected_grand = 74340.0
            
            all_correct = True
            
            if abs(oc - expected_oc) < 1:
                self.log(f"✓ Operating Cost correct: {oc}", "success")
            else:
                self.log(f"✗ Operating Cost incorrect: {oc} (expected {expected_oc})", "fail")
                all_correct = False
            
            if abs(markup_amt - expected_markup) < 1:
                self.log(f"✓ Markup amount correct: {markup_amt}", "success")
            else:
                self.log(f"✗ Markup amount incorrect: {markup_amt} (expected {expected_markup})", "fail")
                all_correct = False
            
            if abs(subtotal - expected_subtotal) < 1:
                self.log(f"✓ Sub-total correct: {subtotal}", "success")
            else:
                self.log(f"✗ Sub-total incorrect: {subtotal} (expected {expected_subtotal})", "fail")
                all_correct = False
            
            if abs(gst_amt - expected_gst) < 1:
                self.log(f"✓ GST amount correct: {gst_amt}", "success")
            else:
                self.log(f"✗ GST amount incorrect: {gst_amt} (expected {expected_gst})", "fail")
                all_correct = False
            
            if abs(grand_total - expected_grand) < 1:
                self.log(f"✓ Grand Total correct: {grand_total}", "success")
            else:
                self.log(f"✗ Grand Total incorrect: {grand_total} (expected {expected_grand})", "fail")
                all_correct = False
            
            if all_correct:
                self.log("✓ All cost calculations verified!", "success")
            
            return quote_id, quote_no
        
        return None, None

    def test_quotes_create_multi_currency(self):
        """Test POST /api/quotes - Create quote with multi-currency items"""
        self.log("\n=== QUOTE CREATION (MULTI-CURRENCY) TESTS ===", "info")
        
        # Create quote with USD and INR items
        quote_data = {
            "quote_type": "International Tour",
            "base_currency": "INR",
            "client_name": "Test Client Quote",
            "phone": "9876543210",
            "email": "testquote@test.com",
            "destination": "Dubai, UAE",
            "travel_date": "2025-09-15",
            "return_date": "2025-09-20",
            "pax_adults": 2,
            "pax_children": 1,
            "validity_date": "2025-08-31",
            "notes": "Test quote with multi-currency items",
            "items": [
                {
                    "category": "Hotels",
                    "title": "5-Star Hotel 3N4D",
                    "description": "Burj Al Arab",
                    "qty": 3,
                    "unit_price": 500,
                    "currency": "USD",
                    "roe_to_base": 84.5
                },
                {
                    "category": "Flights",
                    "title": "Round-trip flights",
                    "description": "DEL-DXB-DEL",
                    "qty": 2,
                    "unit_price": 35000,
                    "currency": "INR",
                    "roe_to_base": 1.0
                },
                {
                    "category": "Visa Fees",
                    "title": "UAE Visa",
                    "qty": 2,
                    "unit_price": 5000,
                    "currency": "INR",
                    "roe_to_base": 1.0
                }
            ]
        }
        
        success, quote = self.run_test(
            "POST /api/quotes - Create quote with multi-currency",
            "POST",
            "quotes",
            200,
            data=quote_data
        )
        
        if success and quote.get('id'):
            quote_id = quote['id']
            quote_no = quote.get('quote_no', '')
            grand_total = quote.get('grand_total_base', 0)
            
            self.log(f"Created quote: {quote_no} (ID: {quote_id})", "success")
            self.log(f"Grand Total (INR): {grand_total}", "info")
            
            # Verify auto-numbering format (QT-YYYY-NNN)
            if quote_no.startswith('QT-2026-'):
                self.log(f"✓ Auto-numbering format correct: {quote_no}", "success")
            else:
                self.log(f"✗ Auto-numbering format incorrect: {quote_no} (expected QT-2026-NNN)", "fail")
            
            # Verify multi-currency computation
            # USD item: 3 * 500 * 84.5 = 126,750
            # INR items: (2 * 35000) + (2 * 5000) = 70,000 + 10,000 = 80,000
            # Expected total: 126,750 + 80,000 = 206,750
            expected_total = 206750.0
            if abs(grand_total - expected_total) < 1:
                self.log(f"✓ Multi-currency computation correct: {grand_total} ≈ {expected_total}", "success")
            else:
                self.log(f"✗ Multi-currency computation incorrect: {grand_total} (expected {expected_total})", "fail")
            
            # Verify items have computed amounts
            items = quote.get('items', [])
            if len(items) == 3:
                self.log("✓ All 3 items present", "success")
                for item in items:
                    if 'amount' in item and 'amount_base' in item:
                        self.log(f"  {item['category']}: {item['currency']} {item['amount']} → INR {item['amount_base']}", "info")
                    else:
                        self.log(f"✗ Item missing computed amounts: {item.get('category')}", "fail")
            else:
                self.log(f"✗ Expected 3 items, got {len(items)}", "fail")
            
            return quote_id, quote_no
        
        return None, None

    def test_quotes_list(self):
        """Test GET /api/quotes - List all quotes"""
        self.log("\n=== QUOTE LIST TESTS ===", "info")
        
        success, quotes = self.run_test(
            "GET /api/quotes - List all quotes",
            "GET",
            "quotes",
            200
        )
        
        if success:
            self.log(f"Found {len(quotes)} quotes", "info")
            
            # Test search filter
            success, filtered = self.run_test(
                "GET /api/quotes?q=Test - Search quotes",
                "GET",
                "quotes",
                200,
                params={"q": "Test"}
            )
            
            if success:
                self.log(f"Search returned {len(filtered)} quotes", "info")
            
            # Test status filter
            success, draft_quotes = self.run_test(
                "GET /api/quotes?status=Draft - Filter by status",
                "GET",
                "quotes",
                200,
                params={"status": "Draft"}
            )
            
            if success:
                self.log(f"Draft quotes: {len(draft_quotes)}", "info")
            
            return True
        
        return False

    def test_quote_get(self, quote_id):
        """Test GET /api/quotes/{id} - Get single quote"""
        self.log("\n=== QUOTE GET TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping get test", "fail")
            return False
        
        success, quote = self.run_test(
            f"GET /api/quotes/{quote_id} - Get single quote",
            "GET",
            f"quotes/{quote_id}",
            200
        )
        
        if success and quote.get('id') == quote_id:
            self.log(f"Retrieved quote: {quote.get('quote_no')}", "success")
            return True
        
        return False

    def test_quote_update(self, quote_id):
        """Test PUT /api/quotes/{id} - Update quote"""
        self.log("\n=== QUOTE UPDATE TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping update test", "fail")
            return False
        
        # Update quote with modified items
        update_data = {
            "quote_type": "International Tour",
            "base_currency": "INR",
            "client_name": "Test Client Quote UPDATED",
            "phone": "9876543210",
            "email": "testquote@test.com",
            "destination": "Dubai, UAE",
            "travel_date": "2025-09-15",
            "return_date": "2025-09-20",
            "pax_adults": 2,
            "pax_children": 1,
            "validity_date": "2025-08-31",
            "notes": "Updated quote notes",
            "items": [
                {
                    "category": "Hotels",
                    "title": "5-Star Hotel 4N5D UPDATED",
                    "description": "Burj Al Arab",
                    "qty": 4,
                    "unit_price": 500,
                    "currency": "USD",
                    "roe_to_base": 84.5
                }
            ]
        }
        
        success, updated = self.run_test(
            f"PUT /api/quotes/{quote_id} - Update quote",
            "PUT",
            f"quotes/{quote_id}",
            200,
            data=update_data
        )
        
        if success and updated.get('client_name') == "Test Client Quote UPDATED":
            self.log("Quote updated successfully", "success")
            self.log(f"New grand total: {updated.get('grand_total_base')}", "info")
            return True
        
        return False

    def test_quote_status_workflow(self, quote_id):
        """Test PATCH /api/quotes/{id}/status - Status workflow"""
        self.log("\n=== QUOTE STATUS WORKFLOW TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping status tests", "fail")
            return False
        
        # Test status progression: Draft → Sent → Accepted
        statuses = ['Sent', 'Accepted']
        
        for status in statuses:
            success, updated = self.run_test(
                f"PATCH /api/quotes/{quote_id}/status - Update to {status}",
                "PATCH",
                f"quotes/{quote_id}/status",
                200,
                data={"status": status}
            )
            
            if success and updated.get('status') == status:
                self.log(f"Status updated to {status}", "success")
            else:
                self.log(f"Failed to update status to {status}", "fail")
                return False
        
        # Test invalid status
        success, response = self.run_test(
            f"PATCH /api/quotes/{quote_id}/status - Invalid status (should fail)",
            "PATCH",
            f"quotes/{quote_id}/status",
            400,
            data={"status": "InvalidStatus"}
        )
        
        if success:
            self.log("✓ Invalid status correctly rejected", "success")
        
        return True

    def test_quote_export_pdf(self, quote_id):
        """Test GET /api/quotes/{id}/export/pdf - PDF export"""
        self.log("\n=== QUOTE PDF EXPORT TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping PDF export test", "fail")
            return False
        
        url = f"{self.base_url}/quotes/{quote_id}/export/pdf"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                # Check if response is PDF
                content_type = response.headers.get('Content-Type', '')
                if 'application/pdf' in content_type:
                    pdf_size = len(response.content)
                    self.log(f"✓ PDF export successful (size: {pdf_size} bytes)", "success")
                    self.tests_passed += 1
                    self.test_results.append({"test": "PDF Export", "status": "PASS", "size": pdf_size})
                    return True
                else:
                    self.log(f"✗ PDF export returned wrong content type: {content_type}", "fail")
                    self.test_results.append({"test": "PDF Export", "status": "FAIL", "error": "Wrong content type"})
            else:
                self.log(f"✗ PDF export failed with status {response.status_code}", "fail")
                self.test_results.append({"test": "PDF Export", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"✗ PDF export error: {str(e)}", "fail")
            self.test_results.append({"test": "PDF Export", "status": "ERROR", "error": str(e)})
            return False
        
        self.tests_run += 1
        return False

    def test_quote_export_excel(self, quote_id):
        """Test GET /api/quotes/{id}/export/excel - Excel export"""
        self.log("\n=== QUOTE EXCEL EXPORT TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping Excel export test", "fail")
            return False
        
        url = f"{self.base_url}/quotes/{quote_id}/export/excel"
        headers = {'Authorization': f'Bearer {self.token}'}
        
        try:
            response = requests.get(url, headers=headers, timeout=15)
            
            if response.status_code == 200:
                # Check if response is Excel
                content_type = response.headers.get('Content-Type', '')
                if 'spreadsheet' in content_type or 'excel' in content_type:
                    excel_size = len(response.content)
                    self.log(f"✓ Excel export successful (size: {excel_size} bytes)", "success")
                    self.tests_passed += 1
                    self.test_results.append({"test": "Excel Export", "status": "PASS", "size": excel_size})
                    return True
                else:
                    self.log(f"✗ Excel export returned wrong content type: {content_type}", "fail")
                    self.test_results.append({"test": "Excel Export", "status": "FAIL", "error": "Wrong content type"})
            else:
                self.log(f"✗ Excel export failed with status {response.status_code}", "fail")
                self.test_results.append({"test": "Excel Export", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"✗ Excel export error: {str(e)}", "fail")
            self.test_results.append({"test": "Excel Export", "status": "ERROR", "error": str(e)})
            return False
        
        self.tests_run += 1
        return False

    def test_quote_delete(self, quote_id):
        """Test DELETE /api/quotes/{id} - Delete quote"""
        self.log("\n=== QUOTE DELETE TESTS ===", "info")
        
        if not quote_id:
            self.log("No quote ID provided, skipping delete test", "fail")
            return False
        
        success, response = self.run_test(
            f"DELETE /api/quotes/{quote_id} - Delete quote",
            "DELETE",
            f"quotes/{quote_id}",
            200
        )
        
        if success:
            self.log("Quote deleted successfully", "success")
            
            # Verify deletion
            success, response = self.run_test(
                f"GET /api/quotes/{quote_id} - Verify deletion (should fail)",
                "GET",
                f"quotes/{quote_id}",
                404
            )
            
            if success:
                self.log("✓ Quote deletion verified", "success")
                return True
        
        return False

    # ========== BLOCK 4: ITINERARY DESIGNER TESTS ==========

    # ─────────────────────────────────────────────────────────────────────────
    # BLOCK 4: ITINERARY DESIGNER — split into single-scenario focused tests
    # ─────────────────────────────────────────────────────────────────────────

    def _itinerary_get_test_client(self):
        """Helper: fetch first client id/name for itinerary tests."""
        success, clients = self.run_test(
            "GET /api/clients - fetch client for itinerary fixture",
            "GET", "clients", 200
        )
        if success and clients:
            return clients[0].get('id'), clients[0].get('full_name') or "Test Client"
        return None, "Test Client"

    def test_itinerary_list(self):
        """Single-scenario: GET /api/itineraries returns 200 with a list."""
        self.log("\n--- Itinerary: list ---", "info")
        success, itineraries = self.run_test(
            "GET /api/itineraries - List all itineraries",
            "GET", "itineraries", 200
        )
        if success:
            self.log(f"Found {len(itineraries)} itineraries", "info")
        return success

    def test_itinerary_create_and_validate(self, client_id=None, client_name="Test Client"):
        """Single-scenario: POST /api/itineraries creates a record with correct structure."""
        self.log("\n--- Itinerary: create + validate structure ---", "info")
        payload = {
            "title": "Test Alps Dream Trip 2026",
            "client_id": client_id,
            "client_name": client_name,
            "destination": "Bavaria, Tyrol, Salzburg",
            "start_date": "17 June 2026",
            "end_date": "28 June 2026",
            "pax_adults": 2,
            "pax_children": 0,
            "meal_preference": "Vegetarian",
            "status": "draft",
            "days": [{
                "day_number": 1,
                "date": "17 June 2026",
                "day_label": "Touchdown in Bavaria!",
                "blocks": [
                    {"block_type": "FLIGHT", "status": "booked", "time": "05:40",
                     "data": {"airline": "Etihad Airways", "flight_no": "EY 247",
                              "from_airport": "AMD", "to_airport": "AUH",
                              "dep_time": "05:40", "arr_time": "07:10",
                              "flight_class": "Economy", "pnr": "83ZNG6"},
                     "order": 0},
                    {"block_type": "HOTEL", "status": "booked", "time": "15:00",
                     "data": {"hotel_name": "ADLERS Hotel Innsbruck", "star_rating": "4",
                              "city": "Innsbruck", "check_in_date": "18 June 2026",
                              "check_in_time": "From 15:00", "check_out_date": "20 June 2026",
                              "check_out_time": "Until 11:00", "nights": "2",
                              "room_type": "Panorama Classic", "meal_plan": "BB"},
                     "order": 1}
                ]
            }]
        }
        success, itin = self.run_test(
            "POST /api/itineraries - Create itinerary",
            "POST", "itineraries", 200, data=payload
        )
        if not success or not itin.get('id'):
            return None
        itin_id = itin['id']
        self.log(f"Created itinerary ID: {itin_id}", "success")
        # Validate structure
        assert itin.get('title') == "Test Alps Dream Trip 2026", "Title mismatch"
        assert itin.get('destination') == "Bavaria, Tyrol, Salzburg", "Destination mismatch"
        assert itin.get('status') == "draft", "Status mismatch"
        days = itin.get('days', [])
        assert len(days) == 1, f"Expected 1 day, got {len(days)}"
        blocks = days[0].get('blocks', [])
        assert len(blocks) == 2, f"Expected 2 blocks, got {len(blocks)}"
        block_types = {b.get('block_type') for b in blocks}
        assert 'FLIGHT' in block_types and 'HOTEL' in block_types, "Wrong block types"
        assert all(b.get('id') for b in blocks), "Some blocks missing IDs"
        self.log("✓ Itinerary structure valid (1 day, 2 blocks, correct types, IDs present)", "success")
        return itin_id

    def test_itinerary_get_by_id(self, itinerary_id):
        """Single-scenario: GET /api/itineraries/{id} returns correct record."""
        self.log("\n--- Itinerary: get by ID ---", "info")
        success, itin = self.run_test(
            f"GET /api/itineraries/{itinerary_id} - Retrieve single",
            "GET", f"itineraries/{itinerary_id}", 200
        )
        if success:
            assert itin.get('id') == itinerary_id, "ID mismatch in response"
            self.log(f"✓ Retrieved: {itin.get('title')}", "success")
        return success

    def test_itinerary_update_add_block(self, itinerary_id, client_id=None, client_name="Test Client"):
        """Single-scenario: PUT /api/itineraries/{id} adds a new EATERIES block."""
        self.log("\n--- Itinerary: update (add EATERIES block) ---", "info")
        update_payload = {
            "title": "Test Alps Dream Trip 2026 - UPDATED",
            "client_id": client_id, "client_name": client_name,
            "destination": "Bavaria, Tyrol, Salzburg",
            "start_date": "17 June 2026", "end_date": "28 June 2026",
            "pax_adults": 2, "pax_children": 0,
            "meal_preference": "Vegetarian", "status": "draft",
            "days": [{
                "day_number": 1, "date": "17 June 2026",
                "day_label": "Touchdown in Bavaria!",
                "blocks": [
                    {"block_type": "FLIGHT", "status": "booked", "time": "05:40",
                     "data": {"airline": "Etihad Airways", "flight_no": "EY 247",
                              "from_airport": "AMD", "to_airport": "AUH",
                              "dep_time": "05:40", "arr_time": "07:10",
                              "flight_class": "Economy", "pnr": "83ZNG6"}, "order": 0},
                    {"block_type": "HOTEL", "status": "booked", "time": "15:00",
                     "data": {"hotel_name": "ADLERS Hotel Innsbruck", "star_rating": "4",
                              "city": "Innsbruck", "check_in_date": "18 June 2026",
                              "check_in_time": "From 15:00", "check_out_date": "20 June 2026",
                              "check_out_time": "Until 11:00", "nights": "2",
                              "room_type": "Panorama Classic", "meal_plan": "BB"}, "order": 1},
                    {"block_type": "EATERIES", "status": "suggested", "time": "19:00",
                     "data": {"meal_type": "Dinner",
                              "restaurant_name": "Gasthof zur Goldenen Glocke",
                              "cuisine": "Austrian", "price_range": "€10-15/person"},
                     "order": 2},
                ]
            }]
        }
        success, updated = self.run_test(
            f"PUT /api/itineraries/{itinerary_id} - Add EATERIES block",
            "PUT", f"itineraries/{itinerary_id}", 200, data=update_payload
        )
        if success:
            assert updated.get('title') == "Test Alps Dream Trip 2026 - UPDATED", "Title not updated"
            blocks = updated.get('days', [{}])[0].get('blocks', [])
            assert len(blocks) == 3, f"Expected 3 blocks, got {len(blocks)}"
            eateries = next((b for b in blocks if b.get('block_type') == 'EATERIES'), None)
            assert eateries is not None, "EATERIES block not found"
            assert eateries['data'].get('restaurant_name') == "Gasthof zur Goldenen Glocke", "Wrong restaurant name"
            self.log("✓ Update OK: title changed, 3 blocks (FLIGHT+HOTEL+EATERIES)", "success")
        return success

    def test_itinerary_delete(self, itinerary_id):
        """Single-scenario: DELETE /api/itineraries/{id} removes record and 404 on re-fetch."""
        self.log("\n--- Itinerary: delete + verify ---", "info")
        success, _ = self.run_test(
            f"DELETE /api/itineraries/{itinerary_id}",
            "DELETE", f"itineraries/{itinerary_id}", 200
        )
        if success:
            ok404, _ = self.run_test(
                f"GET /api/itineraries/{itinerary_id} - confirm 404 after delete",
                "GET", f"itineraries/{itinerary_id}", 404
            )
            if ok404:
                self.log("✓ Deletion confirmed (404 on re-fetch)", "success")
        return success

    # ─────────────────────────────────────────────────────────────────────────
    # BLOCK 4 (legacy monolith kept for reference — superceded by above methods)
    # ─────────────────────────────────────────────────────────────────────────
    def test_itinerary_api(self):
        """Orchestrates individual itinerary tests (kept for backward-compat runner)."""
        self.log("\n=== ITINERARY DESIGNER API TESTS ===", "info")
        self.test_itinerary_list()
        client_id, client_name = self._itinerary_get_test_client()
        itinerary_id = self.test_itinerary_create_and_validate(client_id, client_name)
        if itinerary_id:
            self.test_itinerary_get_by_id(itinerary_id)
            self.test_itinerary_update_add_block(itinerary_id, client_id, client_name)
            self.test_itinerary_delete(itinerary_id)
        return True

    # ========== NEW FEATURES: TRANSPORT, QUICK LINKS, SETTINGS ==========

    def test_transport_api(self):
        """Test Transport API endpoints"""
        self.log("\n=== TRANSPORT API TESTS ===", "info")
        
        # GET /api/transport - List all transport bookings (may be empty)
        success, bookings = self.run_test(
            "GET /api/transport - List transport bookings",
            "GET",
            "transport",
            200
        )
        
        if success:
            self.log(f"Found {len(bookings)} transport bookings", "info")
        
        # POST /api/transport - Create flight booking
        booking_data = {
            "transport_type": "flight",
            "from_location": "BOM",
            "to_location": "DXB",
            "dep_date": "2025-12-25",
            "dep_time": "10:30",
            "arr_time": "12:45",
            "carrier_name": "Emirates",
            "carrier_code": "EK-501",
            "pax_adults": 2,
            "pax_children": 0,
            "amount": 50000,
            "currency": "INR",
            "status": "Confirmed",
            "booking_ref": "TEST123",
            "client_name": "Test Client"
        }
        
        success, booking = self.run_test(
            "POST /api/transport - Create flight booking",
            "POST",
            "transport",
            200,
            data=booking_data
        )
        
        booking_id = None
        if success and booking.get('id'):
            booking_id = booking['id']
            self.log(f"Created booking with ID: {booking_id}", "success")
            
            # Verify booking details
            if booking.get('from_location') == 'BOM' and booking.get('to_location') == 'DXB':
                self.log("✓ Booking details correct", "success")
            else:
                self.log("✗ Booking details incorrect", "fail")
        
        # GET /api/transport - Verify created booking appears
        if booking_id:
            success, bookings = self.run_test(
                "GET /api/transport - Verify created booking",
                "GET",
                "transport",
                200
            )
            
            if success:
                found = any(b.get('id') == booking_id for b in bookings)
                if found:
                    self.log("✓ Created booking found in list", "success")
                else:
                    self.log("✗ Created booking not found in list", "fail")
        
        # PUT /api/transport/{id} - Update status to Pending
        if booking_id:
            success, updated = self.run_test(
                f"PUT /api/transport/{booking_id} - Update status to Pending",
                "PUT",
                f"transport/{booking_id}",
                200,
                data={**booking_data, "status": "Pending"}
            )
            
            if success and updated.get('status') == 'Pending':
                self.log("✓ Status updated to Pending", "success")
            else:
                self.log("✗ Status update failed", "fail")
        
        # DELETE /api/transport/{id} - Delete booking
        if booking_id:
            success, response = self.run_test(
                f"DELETE /api/transport/{booking_id} - Delete booking",
                "DELETE",
                f"transport/{booking_id}",
                200
            )
            
            if success:
                self.log("✓ Booking deleted successfully", "success")
                
                # Verify deletion
                success, response = self.run_test(
                    f"GET /api/transport/{booking_id} - Verify deletion (should fail)",
                    "GET",
                    f"transport/{booking_id}",
                    404
                )
                
                if success:
                    self.log("✓ Booking deletion verified", "success")
        
        return True

    def test_quick_links_api(self):
        """Test Quick Links API endpoints"""
        self.log("\n=== QUICK LINKS API TESTS ===", "info")
        
        # GET /api/quick-links - List all quick links
        success, links = self.run_test(
            "GET /api/quick-links - List quick links",
            "GET",
            "quick-links",
            200
        )
        
        if success:
            self.log(f"Found {len(links)} quick links", "info")
        
        # POST /api/quick-links - Create new link
        link_data = {
            "label": "Skyscanner",
            "url": "https://skyscanner.com",
            "category": "Search",
            "icon": "🔍"
        }
        
        success, link = self.run_test(
            "POST /api/quick-links - Create Skyscanner link",
            "POST",
            "quick-links",
            200,
            data=link_data
        )
        
        link_id = None
        if success and link.get('id'):
            link_id = link['id']
            self.log(f"Created link with ID: {link_id}", "success")
            
            # Verify link details
            if link.get('label') == 'Skyscanner' and link.get('category') == 'Search':
                self.log("✓ Link details correct", "success")
            else:
                self.log("✗ Link details incorrect", "fail")
        
        # DELETE /api/quick-links/{id} - Delete link
        if link_id:
            success, response = self.run_test(
                f"DELETE /api/quick-links/{link_id} - Delete link",
                "DELETE",
                f"quick-links/{link_id}",
                200
            )
            
            if success:
                self.log("✓ Link deleted successfully", "success")
        
        return True

    def test_settings_brand_api(self):
        """Test Settings/Brand API endpoints"""
        self.log("\n=== SETTINGS/BRAND API TESTS ===", "info")
        
        # GET /api/settings/brand - Get BDVV brand settings
        success, settings = self.run_test(
            "GET /api/settings/brand - Get brand settings",
            "GET",
            "settings/brand",
            200
        )
        
        if success:
            self.log(f"Retrieved brand settings", "success")
            
            # Check for BDVV fields
            if 'company_name' in settings:
                self.log(f"  Company: {settings.get('company_name', 'N/A')}", "info")
            if 'gstin' in settings:
                self.log(f"  GSTIN: {settings.get('gstin', 'N/A')}", "info")
            if 'address_line1' in settings:
                self.log(f"  Address: {settings.get('address_line1', 'N/A')}", "info")
        
        # PUT /api/settings/brand - Update brand settings
        update_data = {
            "company_name": "Blue Diamond Voyage & Vision",
            "gstin": "27AAAAA0000A1Z5",
            "address_line1": "Test Address Line 1",
            "address_line2": "Test Address Line 2",
            "city": "Mumbai",
            "state": "Maharashtra",
            "pincode": "400001",
            "country": "India",
            "phone": "+91 98765 43210",
            "email": "info@bdvv.in"
        }
        
        success, updated = self.run_test(
            "PUT /api/settings/brand - Update brand settings",
            "PUT",
            "settings/brand",
            200,
            data=update_data
        )
        
        if success:
            self.log("✓ Brand settings updated successfully", "success")
            
            # Verify updated fields
            if updated.get('company_name') == update_data['company_name']:
                self.log("✓ Company name updated", "success")
            if updated.get('gstin') == update_data['gstin']:
                self.log("✓ GSTIN updated", "success")
            if updated.get('address_line1') == update_data['address_line1']:
                self.log("✓ Address updated", "success")
        
        return True


    # ── Staff Management Tests ─────────────────────────────────────────────
    
    def test_staff_management_api(self):
        """Test all staff management endpoints"""
        self.log("\n=== STAFF MANAGEMENT TESTS ===", "info")
        
        # 1. GET /api/staff - List all staff
        success, staff_list = self.run_test(
            "GET /api/staff - List all team members",
            "GET",
            "staff",
            200
        )
        
        if not success:
            self.log("Failed to get staff list", "fail")
            return None
        
        self.log(f"Found {len(staff_list)} staff members", "info")
        
        # Verify 8 team members exist (4 protected + 4 non-protected from seed)
        if len(staff_list) >= 8:
            self.log("✓ At least 8 team members found", "success")
        else:
            self.log(f"⚠️  Expected at least 8 staff, found {len(staff_list)}", "fail")
        
        # Verify protected admins exist
        protected_names = ["Yash Doshi", "Dolly Doshi", "Isha Doshi", "Neel Doshi"]
        found_protected = [s for s in staff_list if s.get('name') in protected_names]
        
        if len(found_protected) == 4:
            self.log(f"✓ All 4 protected admins found: {', '.join([s['name'] for s in found_protected])}", "success")
        else:
            self.log(f"⚠️  Expected 4 protected admins, found {len(found_protected)}", "fail")
        
        # Verify is_protected flag
        for admin in found_protected:
            if admin.get('is_protected'):
                self.log(f"✓ {admin['name']} has is_protected=true", "success")
            else:
                self.log(f"⚠️  {admin['name']} missing is_protected flag", "fail")
        
        # 2. POST /api/staff - Create new team member
        new_member_data = {
            "name": "Ravi Shah",
            "role": "operations",
            "pin": "1234"
        }
        
        success, new_member = self.run_test(
            "POST /api/staff - Create new team member (Ravi Shah)",
            "POST",
            "staff",
            200,
            data=new_member_data
        )
        
        if not success:
            self.log("Failed to create new staff member", "fail")
            return None
        
        new_member_id = new_member.get('id')
        self.log(f"✓ Created new member: {new_member.get('name')} (ID: {new_member_id})", "success")
        
        # Verify new member details
        if new_member.get('name') == "Ravi Shah":
            self.log("✓ Name matches", "success")
        if new_member.get('role') == "operations":
            self.log("✓ Role matches", "success")
        if new_member.get('initials'):
            self.log(f"✓ Initials generated: {new_member.get('initials')}", "success")
        if new_member.get('avatar_color'):
            self.log(f"✓ Avatar color assigned: {new_member.get('avatar_color')}", "success")
        
        # 3. PUT /api/staff/{id} - Update non-protected member
        update_data = {
            "name": "Ravi Shah",
            "role": "sales"
        }
        
        success, updated_member = self.run_test(
            f"PUT /api/staff/{new_member_id} - Update role to sales",
            "PUT",
            f"staff/{new_member_id}",
            200,
            data=update_data
        )
        
        if success and updated_member.get('role') == 'sales':
            self.log("✓ Role updated successfully", "success")
        else:
            self.log("⚠️  Role update failed", "fail")
        
        # 4. POST /api/staff/{id}/reset-pin - Reset PIN
        reset_pin_data = {
            "new_pin": "5678"
        }
        
        success, reset_response = self.run_test(
            f"POST /api/staff/{new_member_id}/reset-pin - Reset PIN",
            "POST",
            f"staff/{new_member_id}/reset-pin",
            200,
            data=reset_pin_data
        )
        
        if success:
            self.log("✓ PIN reset successfully", "success")
        
        # 5. Try to delete a protected admin (should fail with 400)
        protected_admin = found_protected[0] if found_protected else None
        if protected_admin:
            success, error_response = self.run_test(
                f"DELETE /api/staff/{protected_admin['id']} - Try to delete protected admin (should fail)",
                "DELETE",
                f"staff/{protected_admin['id']}",
                400  # Expecting 400 error
            )
            
            if success:
                self.log(f"✓ Protected admin {protected_admin['name']} cannot be deleted (400 error as expected)", "success")
            else:
                self.log(f"⚠️  Protected admin deletion should return 400 error", "fail")
        
        # 6. DELETE /api/staff/{id} - Delete non-protected member (should succeed)
        success, delete_response = self.run_test(
            f"DELETE /api/staff/{new_member_id} - Delete non-protected member",
            "DELETE",
            f"staff/{new_member_id}",
            200
        )
        
        if success:
            self.log(f"✓ Non-protected member deleted successfully", "success")
        else:
            self.log("⚠️  Failed to delete non-protected member", "fail")
        
        # 7. Verify deletion - GET staff list again
        success, final_staff_list = self.run_test(
            "GET /api/staff - Verify member was deleted",
            "GET",
            "staff",
            200
        )
        
        if success:
            deleted_member_exists = any(s.get('id') == new_member_id for s in final_staff_list)
            if not deleted_member_exists:
                self.log("✓ Deleted member no longer in staff list", "success")
            else:
                self.log("⚠️  Deleted member still appears in staff list", "fail")
        
        # 8. Try to update protected admin role (should fail)
        if protected_admin:
            protected_update = {
                "name": protected_admin['name'],
                "role": "sales"  # Try to change from admin to sales
            }
            
            success, error_response = self.run_test(
                f"PUT /api/staff/{protected_admin['id']} - Try to change protected admin role (should fail)",
                "PUT",
                f"staff/{protected_admin['id']}",
                400,  # Expecting 400 error
                data=protected_update
            )
            
            if success:
                self.log(f"✓ Protected admin role cannot be changed (400 error as expected)", "success")
            else:
                self.log(f"⚠️  Protected admin role change should return 400 error", "fail")
        
        return True

    # ========== TRIP PLANNER: CLONE ITINERARY TESTS ==========

    # ─────────────────────────────────────────────────────────────────────────
    # TRIP CLONE — split into single-scenario focused tests
    # ─────────────────────────────────────────────────────────────────────────

    def test_trip_clone_build_source_trip(self):
        """Single-scenario: create a fully-nested trip for clone testing.
        Returns (trip_id, stop1_id, stop2_id, client_name) or None on failure."""
        self.log("\n--- Trip Clone: build source trip with all nested entities ---", "info")
        trip_data = {
            "client_name": "Clone Test Client", "brand": "BDVV",
            "origin_name": "Mumbai", "origin_country": "India",
            "start_date": "2025-09-01", "end_date": "2025-09-10",
            "adults": 2, "children": [], "currency": "INR",
            "status": "Confirmed", "total_nights": 9
        }
        ok, trip = self.run_test("POST /api/trips - create clone source", "POST", "trips", 200, data=trip_data)
        if not ok or not trip.get('id'):
            self.log("Failed to create source trip", "fail"); return None
        trip_id = trip['id']

        # Stops
        ok1, s1 = self.run_test("Add stop 1", "POST", f"trips/{trip_id}/stops", 200,
            data={"trip_id": trip_id, "sequence": 1, "place_name": "Dubai", "country": "UAE",
                  "lat": 25.2048, "lng": 55.2708, "nights": 4,
                  "accommodation_needed": True, "transport_needed": True})
        ok2, s2 = self.run_test("Add stop 2", "POST", f"trips/{trip_id}/stops", 200,
            data={"trip_id": trip_id, "sequence": 2, "place_name": "Abu Dhabi", "country": "UAE",
                  "lat": 24.4539, "lng": 54.3773, "nights": 5,
                  "accommodation_needed": True, "transport_needed": True})
        stop1_id = s1.get('id') if ok1 else None
        stop2_id = s2.get('id') if ok2 else None
        if not stop1_id or not stop2_id:
            self.log("Failed to create stops", "fail"); return None
        self.log(f"Stops created: {stop1_id}, {stop2_id}", "success")

        # Legs
        self.run_test("Add leg 1", "POST", f"trips/{trip_id}/legs", 200,
            data={"trip_id": trip_id, "from_stop_id": "origin", "to_stop_id": stop1_id,
                  "mode": "flight", "operator": "Emirates",
                  "depart_datetime": "2025-09-01T10:00:00", "arrive_datetime": "2025-09-01T12:30:00"})
        self.run_test("Add leg 2", "POST", f"trips/{trip_id}/legs", 200,
            data={"trip_id": trip_id, "from_stop_id": stop1_id, "to_stop_id": stop2_id,
                  "mode": "car", "operator": "Rental Car",
                  "depart_datetime": "2025-09-05T09:00:00", "arrive_datetime": "2025-09-05T10:30:00"})

        # Stay
        self.run_test("Add stay", "POST", "stays", 200,
            data={"trip_id": trip_id, "stop_id": stop1_id, "hotel_name": "Burj Al Arab",
                  "stars": 5, "room_type": "Deluxe", "board": "BB"})

        # Restaurant
        self.run_test("Add restaurant", "POST", f"trips/{trip_id}/stops/{stop1_id}/restaurants", 200,
            data={"name": "Al Mahara", "cuisine": "Seafood", "address": "Burj Al Arab", "cost": 500.0})

        # Attraction
        self.run_test("Add attraction", "POST", f"trips/{trip_id}/stops/{stop1_id}/attractions", 200,
            data={"name": "Burj Khalifa", "category": "landmark", "address": "Downtown Dubai", "cost": 150.0})

        # Info point
        self.run_test("Add info point", "POST", f"trips/{trip_id}/stops/{stop1_id}/info_points", 200,
            data={"name": "Dubai Tourist Information", "address": "Dubai Mall", "phone": "+971-4-1234567"})

        # Meeting point
        self.run_test("Add meeting point", "POST", f"trips/{trip_id}/stops/{stop1_id}/meeting_points", 200,
            data={"name": "Airport Pickup", "address": "Dubai International Airport", "time": "12:30"})

        self.log("✓ Source trip built with 2 stops, 2 legs, 1 stay, 1 restaurant, 1 attraction, 1 info point, 1 meeting point", "success")
        return trip_id, stop1_id, stop2_id, trip_data['client_name']

    def test_trip_clone_execute(self, trip_id):
        """Single-scenario: POST /api/trips/{id}/clone returns a new trip ID."""
        self.log("\n--- Trip Clone: execute clone ---", "info")
        ok, cloned = self.run_test(
            f"POST /api/trips/{trip_id}/clone", "POST", f"trips/{trip_id}/clone", 200)
        if not ok or not cloned.get('id'):
            self.log("Clone failed", "fail"); return None
        cloned_id = cloned['id']
        assert cloned_id != trip_id, "Cloned ID must differ from original"
        self.log(f"✓ Clone created: {cloned_id}", "success")
        return cloned_id, cloned

    def test_trip_clone_verify_basic_fields(self, cloned_id, cloned_trip, original_client_name):
        """Single-scenario: verify cloned trip has status=Draft and correct client name."""
        self.log("\n--- Trip Clone: verify basic fields ---", "info")
        assert cloned_trip.get('status') == 'Draft', \
            f"Expected status Draft, got {cloned_trip.get('status')}"
        expected_name = f"{original_client_name} (Copy)"
        assert cloned_trip.get('client_name') == expected_name, \
            f"Expected '{expected_name}', got '{cloned_trip.get('client_name')}'"
        self.log("✓ status=Draft, client_name has (Copy) suffix", "success")

    def test_trip_clone_verify_nested_entities(self, cloned_id, original_stop_ids):
        """Single-scenario: verify all nested entities were deep-cloned with new IDs."""
        self.log("\n--- Trip Clone: verify nested entities ---", "info")
        ok, full = self.run_test(
            f"GET /api/trips/{cloned_id}/full", "GET", f"trips/{cloned_id}/full", 200)
        if not ok:
            self.log("Could not fetch full cloned trip", "fail"); return

        cloned_stops      = full.get('stops', [])
        cloned_legs       = full.get('legs', [])
        cloned_stays      = full.get('stays', [])
        cloned_rests      = full.get('restaurants', [])
        cloned_attrs      = full.get('attractions', [])
        cloned_info       = full.get('info_points', [])
        cloned_meetings   = full.get('meeting_points', [])

        assert len(cloned_stops) == 2,   f"Stops: expected 2, got {len(cloned_stops)}"
        assert len(cloned_legs)  == 2,   f"Legs: expected 2, got {len(cloned_legs)}"
        assert len(cloned_stays) == 1,   f"Stays: expected 1, got {len(cloned_stays)}"
        assert len(cloned_rests) == 1,   f"Restaurants: expected 1, got {len(cloned_rests)}"
        assert len(cloned_attrs) == 1,   f"Attractions: expected 1, got {len(cloned_attrs)}"
        assert len(cloned_info)  == 1,   f"Info points: expected 1, got {len(cloned_info)}"
        assert len(cloned_meetings) == 1, f"Meeting points: expected 1, got {len(cloned_meetings)}"
        self.log("✓ All entity counts match (2+2+1+1+1+1+1)", "success")

        # Stop IDs must all be new
        cloned_stop_ids = {s['id'] for s in cloned_stops}
        assert cloned_stop_ids.isdisjoint(original_stop_ids), "Some stop IDs were NOT remapped"
        self.log("✓ All stop IDs are new (remapped)", "success")

        # Leg stop references must point to new stop IDs
        for leg in cloned_legs:
            from_id, to_id = leg.get('from_stop_id'), leg.get('to_stop_id')
            if from_id != "origin":
                assert from_id not in original_stop_ids, f"from_stop_id not remapped: {from_id}"
            assert to_id not in original_stop_ids, f"to_stop_id not remapped: {to_id}"
        self.log("✓ All leg stop references remapped correctly", "success")

    def test_trip_clone_verify_original_unchanged(self, trip_id, original_client_name):
        """Single-scenario: the original trip must remain in its Confirmed/original state."""
        self.log("\n--- Trip Clone: verify original unchanged ---", "info")
        ok, orig = self.run_test(
            f"GET /api/trips/{trip_id}/full - original unchanged", "GET", f"trips/{trip_id}/full", 200)
        if ok:
            assert orig.get('status') == 'Confirmed', \
                f"Original status changed to {orig.get('status')}"
            assert orig.get('client_name') == original_client_name, \
                "Original client_name changed"
            self.log("✓ Original trip unchanged (status=Confirmed, name intact)", "success")

    def test_trip_clone_full(self):
        """Orchestrates the full clone test suite (kept for backward-compat runner)."""
        self.log("\n=== TRIP CLONE (FULL) TESTS ===", "info")
        result = self.test_trip_clone_build_source_trip()
        if not result:
            return False
        trip_id, stop1_id, stop2_id, orig_name = result
        clone_result = self.test_trip_clone_execute(trip_id)
        if not clone_result:
            return False
        cloned_id, cloned_trip = clone_result
        self.test_trip_clone_verify_basic_fields(cloned_id, cloned_trip, orig_name)
        self.test_trip_clone_verify_nested_entities(cloned_id, {stop1_id, stop2_id})
        self.test_trip_clone_verify_original_unchanged(trip_id, orig_name)
        # Cleanup
        self.run_test("Cleanup original trip", "DELETE", f"trips/{trip_id}", 200)
        self.run_test("Cleanup cloned trip", "DELETE", f"trips/{cloned_id}", 200)
        return True

    def test_trip_clone_empty(self):
        """Test POST /api/trips/{id}/clone - Clone empty trip (zero stops/legs)"""
        self.log("\n=== TRIP CLONE (EMPTY) TESTS ===", "info")
        
        # Create an empty trip
        trip_data = {
            "client_name": "Empty Trip Test",
            "brand": "BDVV",
            "origin_name": "Delhi",
            "origin_country": "India",
            "start_date": "2025-10-01",
            "end_date": "2025-10-05",
            "adults": 1,
            "children": [],
            "currency": "INR",
            "status": "Draft",
            "total_nights": 4
        }
        
        success, trip = self.run_test(
            "POST /api/trips - Create empty trip",
            "POST",
            "trips",
            200,
            data=trip_data
        )
        
        if not success or not trip.get('id'):
            self.log("Failed to create empty trip", "fail")
            return False
        
        trip_id = trip['id']
        self.log(f"Created empty trip with ID: {trip_id}", "success")
        
        # Clone the empty trip
        success, cloned_trip = self.run_test(
            f"POST /api/trips/{trip_id}/clone - Clone empty trip",
            "POST",
            f"trips/{trip_id}/clone",
            200
        )
        
        if not success or not cloned_trip.get('id'):
            self.log("Failed to clone empty trip", "fail")
            return False
        
        cloned_trip_id = cloned_trip['id']
        self.log(f"Cloned empty trip created with ID: {cloned_trip_id}", "success")
        
        # Verify clone
        if cloned_trip_id != trip_id:
            self.log("✓ New trip ID differs from original", "success")
        
        if cloned_trip.get('status') == 'Draft':
            self.log("✓ Cloned trip status is Draft", "success")
        
        expected_name = f"{trip_data['client_name']} (Copy)"
        if cloned_trip.get('client_name') == expected_name:
            self.log(f"✓ Client name appended with (Copy)", "success")
        
        # Get full details
        success, full_trip = self.run_test(
            f"GET /api/trips/{cloned_trip_id}/full - Get cloned empty trip details",
            "GET",
            f"trips/{cloned_trip_id}/full",
            200
        )
        
        if success:
            stops = full_trip.get('stops', [])
            legs = full_trip.get('legs', [])
            
            if len(stops) == 0:
                self.log("✓ Cloned trip has 0 stops (as expected)", "success")
            else:
                self.log(f"✗ Cloned trip has {len(stops)} stops (expected 0)", "fail")
            
            if len(legs) == 0:
                self.log("✓ Cloned trip has 0 legs (as expected)", "success")
            else:
                self.log(f"✗ Cloned trip has {len(legs)} legs (expected 0)", "fail")
        
        # Cleanup
        self.run_test(f"DELETE /api/trips/{trip_id}", "DELETE", f"trips/{trip_id}", 200)
        self.run_test(f"DELETE /api/trips/{cloned_trip_id}", "DELETE", f"trips/{cloned_trip_id}", 200)
        
        return True


    # ========== SOURCES (RESEARCH-AND-CAPTURE) TESTS ==========


    # ========== COMPASS AI AUTO-BUILD TESTS ==========

    def test_ai_generate_itinerary(self):
        """Test POST /api/itinerary/ai-generate - Compass AI Auto-Build"""
        self.log("\n=== COMPASS AI AUTO-BUILD TESTS ===", "info")
        
        # Test 1: Without auth (should return 401)
        url = f"{self.base_url}/itinerary/ai-generate"
        headers = {'Content-Type': 'application/json'}
        
        self.tests_run += 1
        self.log("Testing POST /api/itinerary/ai-generate - Without auth (should fail)...", "test")
        
        try:
            response = requests.post(url, json={"text_input": "Test"}, headers=headers, timeout=10)
            
            if response.status_code == 401:
                self.tests_passed += 1
                self.log("Passed - Correctly rejected without auth (401)", "success")
                self.test_results.append({"test": "AI Generate - No Auth", "status": "PASS"})
            else:
                self.log(f"Failed - Expected 401, got {response.status_code}", "fail")
                self.test_results.append({"test": "AI Generate - No Auth", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "AI Generate - No Auth", "status": "ERROR", "error": str(e)})
        
        # Test 2: With auth but no input (should return error)
        self.tests_run += 1
        self.log("Testing POST /api/itinerary/ai-generate - No input (should fail)...", "test")
        
        headers = {
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {self.token}'
        }
        
        try:
            response = requests.post(url, json={}, headers=headers, timeout=10)
            
            # Should return 422 or similar error
            if response.status_code in [422, 400, 503]:
                self.tests_passed += 1
                self.log(f"Passed - Correctly rejected with no input ({response.status_code})", "success")
                self.test_results.append({"test": "AI Generate - No Input", "status": "PASS"})
            else:
                self.log(f"Failed - Expected 422/400/503, got {response.status_code}", "fail")
                self.test_results.append({"test": "AI Generate - No Input", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "AI Generate - No Input", "status": "ERROR", "error": str(e)})
        
        # Test 3: With auth and valid text input
        self.tests_run += 1
        self.log("Testing POST /api/itinerary/ai-generate - Valid text input...", "test")
        
        test_input = {
            "text_input": "Day 1: Arrive in Bangkok. Check into Novotel Sukhumvit. Evening walk at Khao San Road.\nDay 2: Morning flight to Chiang Mai at 07:30 (FD3116). Visit Doi Suthep temple.",
            "existing_meta": {
                "client_name": "Test Client",
                "destination": "Thailand",
                "start_date": "2025-09-15",
                "end_date": "2025-09-17"
            }
        }
        
        try:
            response = requests.post(url, json=test_input, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success') and result.get('itinerary'):
                    self.tests_passed += 1
                    self.log("Passed - AI generated itinerary successfully", "success")
                    self.test_results.append({"test": "AI Generate - Valid Input", "status": "PASS"})
                    
                    # Verify itinerary structure
                    itinerary = result['itinerary']
                    
                    if 'days' in itinerary:
                        days = itinerary['days']
                        self.log(f"✓ Generated {len(days)} days", "success")
                        
                        # Check if days have blocks
                        total_blocks = sum(len(day.get('blocks', [])) for day in days)
                        self.log(f"✓ Generated {total_blocks} total blocks", "success")
                        
                        # Verify block IDs are present
                        all_have_ids = all(
                            block.get('id') 
                            for day in days 
                            for block in day.get('blocks', [])
                        )
                        
                        if all_have_ids:
                            self.log("✓ All blocks have IDs", "success")
                        else:
                            self.log("✗ Some blocks missing IDs", "fail")
                    else:
                        self.log("✗ No days in generated itinerary", "fail")
                else:
                    self.log(f"Failed - Response missing success/itinerary fields", "fail")
                    self.test_results.append({"test": "AI Generate - Valid Input", "status": "FAIL", "error": "Missing fields"})
            elif response.status_code == 503:
                self.log("⚠️  LLM service not configured (EMERGENT_LLM_KEY missing)", "fail")
                self.test_results.append({"test": "AI Generate - Valid Input", "status": "SKIP", "reason": "LLM not configured"})
            else:
                self.log(f"Failed - Expected 200, got {response.status_code}", "fail")
                try:
                    error_detail = response.json()
                    self.log(f"Error detail: {error_detail}", "fail")
                except Exception:
                    self.log(f"Response text: {response.text[:200]}", "fail")
                self.test_results.append({"test": "AI Generate - Valid Input", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "AI Generate - Valid Input", "status": "ERROR", "error": str(e)})
        
        # Test 4: With image input (base64)
        self.tests_run += 1
        self.log("Testing POST /api/itinerary/ai-generate - With image input...", "test")
        
        # Create a small test image (1x1 pixel PNG)
        import base64
        test_image_b64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        
        test_input_with_image = {
            "text_input": "Generate a 3-day Bangkok itinerary",
            "image_b64": test_image_b64,
            "image_mime_type": "image/png"
        }
        
        try:
            response = requests.post(url, json=test_input_with_image, headers=headers, timeout=30)
            
            if response.status_code == 200:
                result = response.json()
                
                if result.get('success'):
                    self.tests_passed += 1
                    self.log("Passed - AI processed image input successfully", "success")
                    self.test_results.append({"test": "AI Generate - Image Input", "status": "PASS"})
                else:
                    self.log("Failed - AI did not return success", "fail")
                    self.test_results.append({"test": "AI Generate - Image Input", "status": "FAIL"})
            elif response.status_code == 503:
                self.log("⚠️  LLM service not configured", "fail")
                self.test_results.append({"test": "AI Generate - Image Input", "status": "SKIP", "reason": "LLM not configured"})
            else:
                self.log(f"Failed - Expected 200, got {response.status_code}", "fail")
                self.test_results.append({"test": "AI Generate - Image Input", "status": "FAIL", "code": response.status_code})
        except Exception as e:
            self.log(f"Failed - Error: {str(e)}", "fail")
            self.test_results.append({"test": "AI Generate - Image Input", "status": "ERROR", "error": str(e)})
        
        return True


    def test_sources_api(self):
        """Test Sources (Research-and-Capture) API endpoints"""
        self.log("\n=== SOURCES (RESEARCH-AND-CAPTURE) API TESTS ===", "info")
        
        # First, we need a trip to attach sources to
        # Get existing trips or create one
        success, trips = self.run_test(
            "GET /api/trips - Get trips for sources test",
            "GET",
            "trips",
            200
        )
        
        trip_id = None
        if success and len(trips) > 0:
            trip_id = trips[0].get('id')
            self.log(f"Using trip ID: {trip_id}", "info")
        else:
            # Create a test trip if none exist
            trip_data = {
                "client_name": "Test Client for Sources",
                "origin_name": "Mumbai",
                "start_date": "2025-09-01",
                "end_date": "2025-09-10",
                "pax_adults": 2,
                "pax_children": 0,
                "currency": "INR",
                "stops": []
            }
            success, trip = self.run_test(
                "POST /api/trips - Create trip for sources test",
                "POST",
                "trips",
                200,
                data=trip_data
            )
            if success and trip.get('id'):
                trip_id = trip['id']
                self.log(f"Created trip ID: {trip_id}", "success")
        
        if not trip_id:
            self.log("No trip available for sources test", "fail")
            return None
        
        # 1. GET /api/sources - List all sources (should be empty or return existing)
        success, sources = self.run_test(
            "GET /api/sources - List all sources",
            "GET",
            "sources",
            200
        )
        
        if success:
            self.log(f"Found {len(sources)} existing sources", "info")
        
        # 2. POST /api/sources - Create source with trip_id only
        source_data_1 = {
            "trip_id": trip_id,
            "component_id": None,
            "component_type": None,
            "url": "https://booking.com/hotel/test-hotel",
            "captured_price": 8500.0,
            "captured_currency": "INR",
            "screenshot_url": "https://example.com/screenshot1.png",
            "notes": "Test source - hotel option 1"
        }
        
        success, source1 = self.run_test(
            "POST /api/sources - Create source (trip-level)",
            "POST",
            "sources",
            200,
            data=source_data_1
        )
        
        source1_id = None
        if success and source1.get('id'):
            source1_id = source1['id']
            self.log(f"Created source with ID: {source1_id}", "success")
            
            # Verify source fields
            if source1.get('url') == source_data_1['url']:
                self.log("✓ URL correct", "success")
            if source1.get('captured_price') == source_data_1['captured_price']:
                self.log("✓ Price correct", "success")
            if source1.get('captured_currency') == source_data_1['captured_currency']:
                self.log("✓ Currency correct", "success")
            if source1.get('screenshot_url') == source_data_1['screenshot_url']:
                self.log("✓ Screenshot URL correct", "success")
            if source1.get('notes') == source_data_1['notes']:
                self.log("✓ Notes correct", "success")
            if 'captured_at' in source1:
                self.log(f"✓ Captured timestamp: {source1['captured_at']}", "success")
            if 'captured_by' in source1:
                self.log(f"✓ Captured by: {source1['captured_by']}", "success")
        
        # 3. POST /api/sources - Create another source
        source_data_2 = {
            "trip_id": trip_id,
            "component_id": None,
            "component_type": None,
            "url": "https://expedia.com/hotel/another-hotel",
            "captured_price": 9200.0,
            "captured_currency": "USD",
            "screenshot_url": None,
            "notes": "Test source - hotel option 2"
        }
        
        success, source2 = self.run_test(
            "POST /api/sources - Create second source",
            "POST",
            "sources",
            200,
            data=source_data_2
        )
        
        source2_id = None
        if success and source2.get('id'):
            source2_id = source2['id']
            self.log(f"Created second source with ID: {source2_id}", "success")
        
        # 4. GET /api/sources?trip_id=X - Filter sources by trip
        if trip_id:
            success, trip_sources = self.run_test(
                f"GET /api/sources?trip_id={trip_id} - Filter by trip",
                "GET",
                "sources",
                200,
                params={"trip_id": trip_id}
            )
            
            if success:
                self.log(f"Found {len(trip_sources)} sources for trip {trip_id}", "info")
                
                # Verify our created sources are in the list
                found_source1 = any(s.get('id') == source1_id for s in trip_sources)
                found_source2 = any(s.get('id') == source2_id for s in trip_sources)
                
                if found_source1:
                    self.log("✓ Source 1 found in trip sources", "success")
                else:
                    self.log("✗ Source 1 not found in trip sources", "fail")
                
                if found_source2:
                    self.log("✓ Source 2 found in trip sources", "success")
                else:
                    self.log("✗ Source 2 not found in trip sources", "fail")
        
        # 5. GET /api/trips/{id}/full - Verify sources array is included
        if trip_id:
            success, trip_full = self.run_test(
                f"GET /api/trips/{trip_id}/full - Verify sources in trip",
                "GET",
                f"trips/{trip_id}/full",
                200
            )
            
            if success:
                if 'sources' in trip_full:
                    sources_in_trip = trip_full['sources']
                    self.log(f"✓ Trip includes 'sources' array with {len(sources_in_trip)} items", "success")
                    
                    # Verify our sources are in the trip
                    found_in_full = any(s.get('id') == source1_id for s in sources_in_trip)
                    if found_in_full:
                        self.log("✓ Source 1 found in trip /full endpoint", "success")
                    else:
                        self.log("✗ Source 1 not found in trip /full endpoint", "fail")
                else:
                    self.log("✗ Trip /full endpoint missing 'sources' array", "fail")
        
        # 6. PUT /api/sources/{id} - Update source
        if source1_id:
            update_data = {
                "url": "https://booking.com/hotel/test-hotel-updated",
                "captured_price": 8800.0,
                "captured_currency": "INR",
                "screenshot_url": "https://example.com/screenshot1-updated.png",
                "notes": "Updated notes for source 1"
            }
            
            success, updated = self.run_test(
                f"PUT /api/sources/{source1_id} - Update source",
                "PUT",
                f"sources/{source1_id}",
                200,
                data=update_data
            )
            
            if success:
                if updated.get('url') == update_data['url']:
                    self.log("✓ URL updated", "success")
                if updated.get('captured_price') == update_data['captured_price']:
                    self.log("✓ Price updated", "success")
                if updated.get('notes') == update_data['notes']:
                    self.log("✓ Notes updated", "success")
        
        # 7. DELETE /api/sources/{id} - Delete source
        if source1_id:
            success, response = self.run_test(
                f"DELETE /api/sources/{source1_id} - Delete source 1",
                "DELETE",
                f"sources/{source1_id}",
                200
            )
            
            if success:
                self.log("✓ Source 1 deleted successfully", "success")
                
                # Verify deletion
                success, sources_after = self.run_test(
                    "GET /api/sources - Verify source 1 deleted",
                    "GET",
                    "sources",
                    200
                )
                
                if success:
                    still_exists = any(s.get('id') == source1_id for s in sources_after)
                    if not still_exists:
                        self.log("✓ Source 1 deletion verified", "success")
                    else:
                        self.log("✗ Source 1 still exists after deletion", "fail")
        
        # 8. DELETE second source for cleanup
        if source2_id:
            success, response = self.run_test(
                f"DELETE /api/sources/{source2_id} - Delete source 2 (cleanup)",
                "DELETE",
                f"sources/{source2_id}",
                200
            )
            
            if success:
                self.log("✓ Source 2 deleted (cleanup)", "success")
        
        return True


    def run_all_tests(self):
        """Run all CRM Block 2 & Quotation Block 3 tests + NEW FEATURES"""
        self.log("\n" + "="*60, "info")
        self.log("BDV TravelOS - Full API Test Suite", "info")
        self.log("="*60 + "\n", "info")
        
        # Login
        if not self.test_login():
            self.log("\n❌ Login failed, cannot proceed with tests", "fail")
            return 1
        
        # ===== NEW FEATURES TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("NEW FEATURES: TRANSPORT, QUICK LINKS, SETTINGS, STAFF MANAGEMENT", "info")
        self.log("="*60, "info")
        
        self.test_transport_api()
        self.test_quick_links_api()
        self.test_settings_brand_api()
        self.test_staff_management_api()
        
        # ===== BLOCK 2: CRM TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("BLOCK 2: CRM & LEAD MANAGEMENT", "info")
        self.log("="*60, "info")
        
        # Test clients API
        client_id = self.test_clients_api()
        
        # Test client documents API (categorized uploads)
        if client_id:
            self.test_client_documents_api(client_id)
        
        # Test enquiries API
        enquiry_id = self.test_enquiries_api()
        
        # Test enquiry operations
        if enquiry_id:
            self.test_enquiry_stage_updates(enquiry_id)
            self.test_enquiry_followup(enquiry_id)
            self.test_enquiry_assign(enquiry_id)
            self.test_enquiry_notes(enquiry_id)
            self.test_enquiry_lost(enquiry_id)
        
        # Test CRM endpoints
        self.test_crm_followups()
        self.test_dashboard_alerts()
        
        # ===== BLOCK 3: QUOTATION TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("BLOCK 3: QUOTATION & PACKAGE BUILDER (ADVANCED COSTING)", "info")
        self.log("="*60, "info")
        
        # Test quote creation with advanced costing (Block 3 specific)
        quote_id_advanced, quote_no_advanced = self.test_quotes_create_advanced_costing()
        
        # Test quote creation with multi-currency
        quote_id, quote_no = self.test_quotes_create_multi_currency()
        
        # Test quote listing and filters
        self.test_quotes_list()
        
        # Test quote operations
        if quote_id:
            self.test_quote_get(quote_id)
            self.test_quote_update(quote_id)
            self.test_quote_status_workflow(quote_id)
            self.test_quote_export_pdf(quote_id)
            self.test_quote_export_excel(quote_id)
            # Delete at the end
            self.test_quote_delete(quote_id)
        
        # Test advanced costing quote operations
        if quote_id_advanced:
            self.test_quote_export_pdf(quote_id_advanced)
            self.test_quote_export_excel(quote_id_advanced)
        
        # ===== BLOCK 4: ITINERARY DESIGNER TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("BLOCK 4: ITINERARY DESIGNER", "info")
        self.log("="*60, "info")
        
        self.test_itinerary_api()
        
        # ===== TRIP PLANNER: CLONE ITINERARY TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("TRIP PLANNER: CLONE ITINERARY FEATURE", "info")
        self.log("="*60, "info")
        
        self.test_trip_clone_full()
        self.test_trip_clone_empty()
        
        # ===== COMPASS AI AUTO-BUILD TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("COMPASS AI: AUTO-BUILD ITINERARY FEATURE", "info")
        self.log("="*60, "info")
        
        self.test_ai_generate_itinerary()
        
        # ===== SOURCES (RESEARCH-AND-CAPTURE) TESTS =====
        self.log("\n" + "="*60, "info")
        self.log("SOURCES: RESEARCH-AND-CAPTURE FEATURE", "info")
        self.log("="*60, "info")
        
        self.test_sources_api()
        
        # Print summary
        self.log("\n" + "="*60, "info")
        self.log(f"TESTS COMPLETED: {self.tests_passed}/{self.tests_run} passed", "info")
        self.log("="*60 + "\n", "info")
        
        if self.tests_passed == self.tests_run:
            self.log("🎉 All tests passed!", "success")
            return 0
        else:
            self.log(f"⚠️  {self.tests_run - self.tests_passed} test(s) failed", "fail")
            return 1

def main():
    tester = CRMAPITester()
    return tester.run_all_tests()

if __name__ == "__main__":
    sys.exit(main())
