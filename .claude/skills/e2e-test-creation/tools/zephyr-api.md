# Zephyr API Integration Tool

This tool provides programmatic access to Zephyr Scale Test Management API for creating, reading, and updating test cases.

## Configuration

Store credentials in `.claude/settings.local.json`:

```json
{
  "zephyr": {
    "baseUrl": "https://mattermost.atlassian.net",
    "jiraToken": "your-jira-personal-access-token",
    "zephyrToken": "your-zephyr-access-token",
    "projectKey": "MM",
    "folderId": "28243013"
  }
}
```

## API Operations

### 1. Create Test Case

**Endpoint:** `POST /rest/atm/1.0/testcase`

**Payload:**
```json
{
  "projectKey": "MM",
  "name": "Test successful login",
  "objective": "To verify user can login successfully",
  "precondition": "User account exists",
  "estimatedTime": 300000,
  "labels": ["automated", "e2e", "login"],
  "status": "Draft",
  "priority": "Normal",
  "folder": "/E2E Tests/Authentication",
  "customFields": {
    "Automation Status": "Automated",
    "Test Type": "E2E"
  },
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [
      {
        "description": "Go to base URL",
        "testData": "",
        "expectedResult": "Login page displays"
      },
      {
        "description": "Enter correct credentials",
        "testData": "username: testuser, password: testpass",
        "expectedResult": "Credentials accepted"
      },
      {
        "description": "Click Login button",
        "testData": "",
        "expectedResult": "User is redirected to dashboard"
      },
      {
        "description": "Verify successful login",
        "testData": "",
        "expectedResult": "User dashboard is visible with welcome message"
      }
    ]
  }
}
```

**Response:**
```json
{
  "id": 12345,
  "key": "MM-T1234",
  "name": "Test successful login",
  "projectKey": "MM"
}
```

### 2. Get Test Case Details

**Endpoint:** `GET /rest/atm/1.0/testcase/{testCaseKey}`

**Example:** `GET /rest/atm/1.0/testcase/MM-T1234`

**Response:**
```json
{
  "id": 12345,
  "key": "MM-T1234",
  "name": "Test successful login",
  "objective": "To verify user can login successfully",
  "precondition": "User account exists",
  "status": "Approved",
  "priority": "Normal",
  "labels": ["automated", "e2e", "login"],
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [
      {
        "id": 1,
        "description": "Go to base URL",
        "testData": "",
        "expectedResult": "Login page displays"
      }
    ]
  }
}
```

### 3. Update Test Case

**Endpoint:** `PUT /rest/atm/1.0/testcase/{testCaseKey}`

**Payload:**
```json
{
  "objective": "Updated objective",
  "statusId": 890281,
  "customFields": {
    "Automation Status": "Automated",
    "Automation File": "specs/functional/auth/login.spec.ts"
  },
  "testScript": {
    "type": "STEP_BY_STEP",
    "steps": [
      {
        "description": "Navigate to login page",
        "testData": "URL: https://example.com/login",
        "expectedResult": "Login form is visible"
      }
    ]
  }
}
```

**Note:** Use `statusId: 890281` to set status to "Active"

### 4. Search Test Cases

**Endpoint:** `POST /rest/atm/1.0/testcase/search`

**Payload:**
```json
{
  "query": "projectKey = \"MM\" AND folder = \"/E2E Tests/Authentication\"",
  "maxResults": 50
}
```

## Authentication

All requests require two headers:

```bash
Authorization: Bearer {jiraToken}
X-Zephyr-Token: {zephyrToken}
Content-Type: application/json
```

## Implementation Script

```bash
#!/bin/bash
# zephyr-cli.sh

ZEPHYR_BASE_URL="$1"
JIRA_TOKEN="$2"
ZEPHYR_TOKEN="$3"
OPERATION="$4"
TEST_KEY="$5"
PAYLOAD_FILE="$6"

case "$OPERATION" in
  create)
    curl -X POST "$ZEPHYR_BASE_URL/rest/atm/1.0/testcase" \
      -H "Authorization: Bearer $JIRA_TOKEN" \
      -H "X-Zephyr-Token: $ZEPHYR_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$PAYLOAD_FILE"
    ;;
  get)
    curl -X GET "$ZEPHYR_BASE_URL/rest/atm/1.0/testcase/$TEST_KEY" \
      -H "Authorization: Bearer $JIRA_TOKEN" \
      -H "X-Zephyr-Token: $ZEPHYR_TOKEN"
    ;;
  update)
    curl -X PUT "$ZEPHYR_BASE_URL/rest/atm/1.0/testcase/$TEST_KEY" \
      -H "Authorization: Bearer $JIRA_TOKEN" \
      -H "X-Zephyr-Token: $ZEPHYR_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$PAYLOAD_FILE"
    ;;
  search)
    curl -X POST "$ZEPHYR_BASE_URL/rest/atm/1.0/testcase/search" \
      -H "Authorization: Bearer $JIRA_TOKEN" \
      -H "X-Zephyr-Token: $ZEPHYR_TOKEN" \
      -H "Content-Type: application/json" \
      -d @"$PAYLOAD_FILE"
    ;;
  *)
    echo "Usage: $0 <base_url> <jira_token> <zephyr_token> <operation> [test_key] [payload_file]"
    echo "Operations: create, get, update, search"
    exit 1
    ;;
esac
```

## Usage Examples

### Create a test case:
```bash
./zephyr-cli.sh \
  "https://mattermost.atlassian.net" \
  "$JIRA_TOKEN" \
  "$ZEPHYR_TOKEN" \
  create \
  "" \
  "payload.json"
```

### Get test case details:
```bash
./zephyr-cli.sh \
  "https://mattermost.atlassian.net" \
  "$JIRA_TOKEN" \
  "$ZEPHYR_TOKEN" \
  get \
  "MM-T1234"
```

### Update test case:
```bash
./zephyr-cli.sh \
  "https://mattermost.atlassian.net" \
  "$JIRA_TOKEN" \
  "$ZEPHYR_TOKEN" \
  update \
  "MM-T1234" \
  "update-payload.json"
```

## Error Handling

Common error responses:

- **401 Unauthorized**: Invalid credentials
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Test case doesn't exist
- **400 Bad Request**: Invalid payload format

## Best Practices

1. **Batch Operations**: Create multiple test cases in sequence to avoid rate limiting
2. **Error Recovery**: Store failed operations and retry with exponential backoff
3. **Validation**: Validate payload structure before sending to API
4. **Logging**: Log all API calls with timestamps for debugging
5. **Credential Security**: Never log or expose tokens in error messages
