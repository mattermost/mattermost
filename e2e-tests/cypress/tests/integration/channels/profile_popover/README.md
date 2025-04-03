# Custom Profile Attributes E2E Tests

This directory contains E2E tests for the custom profile attributes feature in Mattermost.

## Overview

The custom profile attributes feature allows users to have additional information displayed in their profile popover. These tests verify that:

1. Custom profile attributes are correctly displayed in the user profile popover
2. No attributes are shown when none exist
3. Attributes are properly updated when changed

## Test Environment Setup

### Prerequisites

- A running Mattermost server with the custom profile attributes feature enabled
- Cypress E2E testing environment set up according to the [Mattermost E2E testing documentation](https://developers.mattermost.com/contribute/more-info/webapp/e2e-testing/)

### Running the Tests

You can run these tests using the standard Cypress test commands:

```bash
# From the e2e-tests directory
cd mattermost/e2e-tests

# Run all profile popover tests
TEST_FILTER="channels/profile_popover" make test-cypress

# Run only custom attributes tests
TEST_FILTER="channels/profile_popover/custom_attributes_spec.js" make test-cypress
```

## Test Structure

The tests use the following approach:

1. **Setup**: Create test users and a channel for testing
2. **API Calls**: Use Mattermost API to create and manage custom profile attributes
3. **UI Interaction**: Verify the attributes appear correctly in the profile popover

## API Endpoints Used

The tests interact with the following API endpoints:

- `POST /api/v4/custom_profile_attributes/fields` - Create custom attribute fields
- `POST /api/v4/custom_profile_attributes/values` - Set values for custom attributes
- `GET /api/v4/users/{userId}/custom_profile_attributes/values` - Get custom attribute values for a user
- `DELETE /api/v4/custom_profile_attributes/values/{valueId}` - Delete custom attribute values

## Helper Functions

The test file includes helper functions to simplify working with custom profile attributes:

- `setupCustomProfileAttributes(userId, attributes)` - Creates and sets custom attributes for a user
- `clearCustomProfileAttributes(userId)` - Removes all custom attributes from a user

## Troubleshooting

If the tests fail, check the following:

1. Ensure the custom profile attributes feature is enabled on your Mattermost server
2. Verify that the API endpoints for property fields and values are accessible
3. Check that the test users have the necessary permissions
4. Inspect the Cypress logs for detailed error information

## Adding More Tests

When adding new tests for custom profile attributes, follow these guidelines:

1. Use the existing helper functions for setting up and clearing attributes
2. Follow the Mattermost E2E testing conventions (step indicators, assertions, etc.)
3. Ensure tests are independent and can run in isolation
4. Add appropriate test tags for categorization
