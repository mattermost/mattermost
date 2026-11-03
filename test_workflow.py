# test_status.py - SolidX Agent Testing & Commit Status Verification

import os
import sys

def test_agent_environment():
    print("[Test] Verifying environment and configuration...")
    
    # Check essential environment variables used by solidctl agent
    database_url = os.getenv("DATABASE_URL")
    base_url = os.getenv("BASE_URL")
    
    assert database_url is not None, "DATABASE_URL is missing!"
    assert base_url is not None, "BASE_URL is missing!"
    
    print("[Test] Environment variables verified successfully.")

if __name__ == "__main__":
    print("--- Starting SolidX Automated Test ---")
    test_agent_environment()
    print("--- Test Completed Successfully ---")
