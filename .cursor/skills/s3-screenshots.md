---
name: s3-screenshots
description: Upload screenshots to S3 and get public URLs for embedding in Pull Request descriptions. Use when you need to share before/after screenshots, visual evidence of bug fixes, or any browser captures in GitHub PRs/issues.
---

# S3 Screenshot Uploads

Upload screenshots captured via `agent-browser` to an S3 bucket and get publicly accessible URLs suitable for embedding in Pull Request descriptions using Markdown image syntax.

## Prerequisites

- **AWS CLI**: Installed during environment setup (`.cursor/install.sh`)
- **Credentials**: `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` are injected as environment variables by Cursor Cloud Agent secrets
- **Bucket**: `AWS_S3_BUCKET_NAME` environment variable contains the target bucket name
- **Region**: Defaults to `us-east-1`; override with `AWS_DEFAULT_REGION` if needed

## Upload a Screenshot

```bash
# Capture a screenshot with agent-browser
agent-browser screenshot /tmp/screenshot.png

# Upload to S3 with a descriptive key
aws s3 cp /tmp/screenshot.png "s3://${AWS_S3_BUCKET_NAME}/screenshots/pr-1234/before.png"

# Get the public URL
echo "https://${AWS_S3_BUCKET_NAME}.s3.amazonaws.com/screenshots/pr-1234/before.png"
```

## Naming Convention

Use a consistent key structure so screenshots are organized and traceable:

```
screenshots/<pr-number>/<label>.png
```

Examples:
- `screenshots/pr-1234/before-login-page.png`
- `screenshots/pr-1234/after-login-page.png`
- `screenshots/pr-1234/bug-repro-step3.png`
- `screenshots/pr-1234/fix-verified.png`

When you don't yet have a PR number (e.g., working on a branch before opening the PR), use the branch name:

```
screenshots/<branch-name>/<label>.png
```

## Embedding in Pull Requests

Use standard Markdown image syntax with the S3 URL:

```markdown
## Before / After

| Before | After |
|--------|-------|
| ![Before](https://<bucket>.s3.amazonaws.com/screenshots/pr-1234/before.png) | ![After](https://<bucket>.s3.amazonaws.com/screenshots/pr-1234/after.png) |
```

Or inline:

```markdown
### Bug Reproduction
![Bug screenshot](https://<bucket>.s3.amazonaws.com/screenshots/pr-1234/bug-repro.png)

### After Fix
![Fix verified](https://<bucket>.s3.amazonaws.com/screenshots/pr-1234/fix-verified.png)
```

## Complete Workflow: Before/After Screenshots for a PR

```bash
# --- BEFORE: Capture current behavior ---
agent-browser open http://localhost:8065/login
agent-browser snapshot -i
# ... navigate to the relevant page/state ...
agent-browser screenshot /tmp/before.png

# --- Apply code changes ---
# ... edit source files ...

# --- Wait for rebuild (webpack ~3s, Air ~20s) ---
sleep 5

# --- AFTER: Capture new behavior ---
agent-browser reload
agent-browser wait --load networkidle
agent-browser screenshot /tmp/after.png

# --- Upload both ---
PR_NUM="1234"  # or use branch name
aws s3 cp /tmp/before.png "s3://${AWS_S3_BUCKET_NAME}/screenshots/pr-${PR_NUM}/before.png"
aws s3 cp /tmp/after.png "s3://${AWS_S3_BUCKET_NAME}/screenshots/pr-${PR_NUM}/after.png"

BUCKET="${AWS_S3_BUCKET_NAME}"
BEFORE_URL="https://${BUCKET}.s3.amazonaws.com/screenshots/pr-${PR_NUM}/before.png"
AFTER_URL="https://${BUCKET}.s3.amazonaws.com/screenshots/pr-${PR_NUM}/after.png"

echo "Before: ${BEFORE_URL}"
echo "After:  ${AFTER_URL}"
```

## Helper: Upload and Print URL

A one-liner pattern for quick uploads:

```bash
upload_screenshot() {
    local file="$1" key="$2"
    aws s3 cp "$file" "s3://${AWS_S3_BUCKET_NAME}/${key}" --quiet
    echo "https://${AWS_S3_BUCKET_NAME}.s3.amazonaws.com/${key}"
}

# Usage:
URL=$(upload_screenshot /tmp/before.png "screenshots/pr-1234/before.png")
echo "![Before](${URL})"
```

## Troubleshooting

### "Unable to locate credentials"
The `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY` environment variables are not set. These are injected by Cursor Cloud Agent secrets. Ask the user to configure them in the Cursor Dashboard under Cloud Agents > Secrets.

### "Access Denied" on upload
The IAM credentials don't have `s3:PutObject` permission on the target bucket, or `AWS_S3_BUCKET_NAME` is incorrect.

### "NoSuchBucket"
Check that `AWS_S3_BUCKET_NAME` is set correctly:
```bash
echo "Bucket: ${AWS_S3_BUCKET_NAME:-NOT SET}"
aws s3 ls "s3://${AWS_S3_BUCKET_NAME}/" --max-items 1
```
