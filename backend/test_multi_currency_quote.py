#!/usr/bin/env python3
import os

import requests

BASE_URL = os.environ.get("BDV_API_BASE_URL", "http://localhost:8000/api").rstrip("/")


def main():
    staff_response = requests.get(f"{BASE_URL}/auth/staff")
    staff_id = staff_response.json()[0]["id"]

    login_response = requests.post(
        f"{BASE_URL}/auth/login", json={"staff_id": staff_id, "pin": "0000"}
    )
    token = login_response.json()["token"]

    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}

    quote_data = {
        "quote_type": "International Tour",
        "base_currency": "INR",
        "client_name": "Test Multi-Currency",
        "phone": "9876543210",
        "destination": "Dubai",
        "travel_date": "2025-09-15",
        "pax_adults": 2,
        "items": [
            {
                "category": "Hotels",
                "title": "5-Star Hotel",
                "qty": 3,
                "unit_price": 500,
                "currency": "USD",
                "roe_to_base": 84.5,
            },
            {
                "category": "Flights",
                "title": "Round-trip",
                "qty": 2,
                "unit_price": 35000,
                "currency": "INR",
                "roe_to_base": 1.0,
            },
        ],
    }

    response = requests.post(f"{BASE_URL}/quotes", json=quote_data, headers=headers)
    print(f"Status: {response.status_code}")
    if response.status_code == 200:
        quote = response.json()
        print(f"Quote created: {quote.get('quote_no')}")
        print(f"Grand Total: {quote.get('grand_total_base')}")
        return

    print(f"Failed: {response.text}")


if __name__ == "__main__":
    main()
