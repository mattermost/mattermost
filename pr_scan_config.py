# pr_scan_config.py - Pull Request Scan Configuration

import os

class PRScanConfig:
    def __init__(self):
        # Using BASE_URL instead of PR_SCAN_URL as per configuration update
        self.base_url = os.getenv("BASE_URL")
        self.enabled = os.getenv("PR_SCAN_ENABLED", "true").lower() == "true"

    def get_scan_endpoint(self):
        if not self.base_url:
            raise ValueError("BASE_URL is not configured in environment variables.")
        return f"{self.base_url.rstrip('/')}/api/v1/pr/scan"

if __name__ == "__main__":
    config = PRScanConfig()
    print(f"[Config] PR Scan Endpoint initialized at: {config.get_scan_endpoint()}")
