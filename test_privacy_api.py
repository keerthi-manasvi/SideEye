#!/usr/bin/env python3
"""
Test script for Privacy API endpoints
"""

import requests
import json

BASE_URL = "http://127.0.0.1:8001/api/privacy"

def test_encryption_status():
    """Test encryption status endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/encryption_status/")
        print(f"Encryption Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Encryption enabled: {data.get('encryption_enabled')}")
            print(f"Local processing: {data.get('local_processing_only')}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def test_data_summary():
    """Test data summary endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/data_summary/")
        print(f"Data Summary: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Data counts: {data.get('data_counts', {})}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

def test_retention_policy():
    """Test retention policy endpoint"""
    try:
        response = requests.get(f"{BASE_URL}/retention_policy/")
        print(f"Retention Policy: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Retention days: {data.get('retention_days')}")
            return True
        else:
            print(f"Error: {response.text}")
            return False
    except Exception as e:
        print(f"Exception: {e}")
        return False

if __name__ == "__main__":
    print("Testing Privacy API endpoints...")
    
    success_count = 0
    total_tests = 3
    
    if test_encryption_status():
        success_count += 1
    
    if test_data_summary():
        success_count += 1
    
    if test_retention_policy():
        success_count += 1
    
    print(f"\nResults: {success_count}/{total_tests} tests passed")
    
    if success_count == total_tests:
        print("✅ All privacy API endpoints are working!")
    else:
        print("❌ Some privacy API endpoints failed")