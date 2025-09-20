# End-to-End Testing with testRigor

This directory contains the end-to-end testing infrastructure for Mattermost project using testRigor.

## Overview

testRigor is an AI-powered end-to-end testing platform that allows you to write tests in plain English. This setup enables automated testing of the Mattermost application's user interface and functionality from a user's perspective.

## How it Works

1. **GitHub Actions**: Automated workflow in `.github/workflows/e2e-tests-tR.yml` that:
   - Sets up the Mattermost server locally
   - Runs a testRigor test suite through tR's CLI tool locally (using `localhost:8065`)
   - Uses GitHub secrets for authentication (`CI_TOKEN` and `SUITE_ID`)
2. **testRigor CLI**: Executes test suites written in plain English on the testRigor platform, in this case, this is the [test suite](https://app.testrigor.com/test-suites/ubQihbZ8Wu5Qi2hTj/test-cases) that's being triggered by the workflow file.

## Usage

### Local Testing
```bash
# Start mattermost server
sudo systemctl start mattermost.service

# Run testRigor tests (requires valid tokens)
testrigor test-suite run <SUITE_ID> --token <CI_TOKEN> --localhost --url http://localhost:8065
```

### CI/CD Testing
Tests automatically run via GitHub Actions when:
- Pushing to `tr-e2e-tests` or `main` branches
- Creating pull requests to `main` or `devel`
- Manual workflow dispatch

## Configuration

Set these GitHub repository secrets:
- `CI_TOKEN`: Your testRigor authentication token
- `SUITE_ID`: The testRigor test suite identifier

## Learn More

- [testRigor Documentation](https://testrigor.com/docs/)
- [testRigor CLI Reference](https://testrigor.com/command-line)
