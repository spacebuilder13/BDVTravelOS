#!/usr/bin/env python3
import requests

BASE_URL = "https://travel-agency-os-4.preview.emergentagent.com/api"

# Login
staff_response = requests.get(f"{BASE_URL}/auth/staff")
staff_id = staff_response.json()[0]['id']
login_response = requests.post(f"{BASE_URL}/auth/login", json={"staff_id": staff_id, "pin": "0000"})
token = login_response.json()['token']
headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}

# Get existing trips
trips_response = requests.get(f"{BASE_URL}/trips", headers=headers)
print(f"Get trips status: {trips_response.status_code}")
if trips_response.status_code == 200:
    trips = trips_response.json()
    if trips:
        trip_id = trips[0]['id']
        print(f"Using existing trip: {trip_id}")
        
        # Clone the trip
        clone_response = requests.post(f"{BASE_URL}/trips/{trip_id}/clone", headers=headers)
        print(f"Clone status: {clone_response.status_code}")
        if clone_response.status_code == 200:
            cloned = clone_response.json()
            print(f"✅ Cloned trip ID: {cloned.get('id')}")
            print(f"   Title: {cloned.get('title')}")
            print(f"   Status: {cloned.get('status')}")
        else:
            print(f"❌ Clone failed: {clone_response.text}")
    else:
        print("No trips found")
else:
    print(f"Failed to get trips: {trips_response.text}")
