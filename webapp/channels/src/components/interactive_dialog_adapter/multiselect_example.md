# Multiselect Support in Interactive Dialog Apps Form Adapter

This document demonstrates how to use multiselect functionality with the Interactive Dialog Apps Form adapter.

## Overview

Multiselect is a powerful feature that's only available when using the Apps Form implementation. When the feature flag `FeatureFlagInteractiveDialogAppsForm` is enabled, Interactive Dialogs can leverage the full capabilities of Apps Forms, including multiselect support.

## Supported Field Types

Multiselect works with the following field types:

1. **Static Select** - Fixed list of options
2. **User Select** - User picker with multiselect
3. **Channel Select** - Channel picker with multiselect

## Usage Examples

### 1. Static Multiselect

```javascript
const dialog = {
  title: "Project Settings",
  elements: [
    {
      name: "priorities",
      display_name: "Project Priorities",
      type: "select",
      multiselect: true,
      help_text: "Select multiple priorities for this project",
      optional: false,
      options: [
        { text: "High Priority", value: "high" },
        { text: "Medium Priority", value: "medium" },
        { text: "Low Priority", value: "low" },
        { text: "Critical", value: "critical" }
      ],
      default: "high,medium" // Comma-separated defaults
    }
  ]
};
```

### 2. User Multiselect

```javascript
const dialog = {
  title: "Assign Task",
  elements: [
    {
      name: "assignees",
      display_name: "Assign to Users",
      type: "select",
      data_source: "users",
      multiselect: true,
      help_text: "Select multiple users to assign this task",
      optional: false
    }
  ]
};
```

### 3. Channel Multiselect

```javascript
const dialog = {
  title: "Notification Settings",
  elements: [
    {
      name: "notification_channels",
      display_name: "Notification Channels",
      type: "select",
      data_source: "channels",
      multiselect: true,
      help_text: "Select channels to receive notifications",
      optional: true
    }
  ]
};
```

### 4. Mixed Form with Multiselect

```javascript
const dialog = {
  title: "Create Release",
  elements: [
    {
      name: "version",
      display_name: "Version Number",
      type: "text",
      subtype: "text",
      placeholder: "e.g., 1.2.3",
      optional: false
    },
    {
      name: "features",
      display_name: "Included Features",
      type: "select",
      multiselect: true,
      help_text: "Select features included in this release",
      options: [
        { text: "New Dashboard", value: "dashboard" },
        { text: "API v2", value: "api_v2" },
        { text: "Mobile App", value: "mobile" },
        { text: "Performance Improvements", value: "performance" }
      ],
      default: "dashboard,api_v2"
    },
    {
      name: "reviewers",
      display_name: "Code Reviewers",
      type: "select",
      data_source: "users",
      multiselect: true,
      help_text: "Select users who will review this release"
    },
    {
      name: "announce_channels",
      display_name: "Announcement Channels",
      type: "select",
      data_source: "channels",
      multiselect: true,
      help_text: "Select channels to announce the release"
    }
  ]
};
```

## Default Values

For multiselect fields, default values are specified as comma-separated strings:

```javascript
{
  name: "tags",
  type: "select",
  multiselect: true,
  options: [
    { text: "Bug", value: "bug" },
    { text: "Feature", value: "feature" },
    { text: "Enhancement", value: "enhancement" }
  ],
  default: "bug,feature" // Will select both "bug" and "feature" by default
}
```

## Submission Format

When submitted, multiselect values are converted to arrays:

### Form Input (Apps Form format):
```javascript
{
  priorities: [
    { label: "High Priority", value: "high" },
    { label: "Critical", value: "critical" }
  ],
  assignees: [
    { label: "John Doe", value: "user1" },
    { label: "Jane Smith", value: "user2" }
  ]
}
```

### Submitted to Interactive Dialog API:
```javascript
{
  priorities: ["high", "critical"],
  assignees: ["user1", "user2"]
}
```

## Benefits of Multiselect

1. **Enhanced UX**: Users can select multiple items in a single field
2. **Reduced Form Complexity**: No need for multiple single-select fields
3. **Better Data Structure**: Submissions naturally produce arrays
4. **Consistent API**: Works seamlessly with existing Interactive Dialog handlers

## Feature Flag Control

Multiselect functionality is automatically available when:
- Feature flag `FeatureFlagInteractiveDialogAppsForm` is enabled
- Dialog contains fields with `multiselect: true`

When the feature flag is disabled, multiselect fields will fall back to single-select behavior in the legacy Interactive Dialog component.

## Implementation Notes

- Multiselect is only available with the Apps Form adapter, not the legacy Interactive Dialog
- Empty selections result in empty arrays `[]` in the submission
- Single selections in multiselect fields still return arrays `["value"]`
- Default values use comma-separated strings for simplicity
- All existing validation and error handling works with multiselect fields

This enhancement significantly improves the functionality available through Interactive Dialogs while maintaining full backward compatibility.