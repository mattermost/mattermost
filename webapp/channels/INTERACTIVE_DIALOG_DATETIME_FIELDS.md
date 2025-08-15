# Interactive Dialog Date and DateTime Fields

This document provides comprehensive documentation for the new `date` and `datetime` field types in Mattermost Interactive Dialogs.

## Overview

Interactive Dialogs now support dedicated `date` and `datetime` field types that provide native date picker functionality with advanced configuration options. These field types replace the need for custom text input handling for date/time data.

## Field Types

### `date` Field Type

Provides a date-only picker for selecting dates without time information.

```json
{
    "display_name": "Event Date",
    "name": "event_date", 
    "type": "date",
    "default": "2024-03-15",
    "placeholder": "Select a date",
    "help_text": "Choose the date for your event",
    "optional": false,
    "min_date": "today",
    "max_date": "+30d"
}
```

### `datetime` Field Type

Provides a combined date and time picker for selecting both date and time.

```json
{
    "display_name": "Meeting Time",
    "name": "meeting_time",
    "type": "datetime", 
    "default": "2024-03-15T14:30:00Z",
    "placeholder": "Select date and time",
    "help_text": "Choose when the meeting should start",
    "optional": false,
    "time_interval": 30,
    "min_date": "today",
    "max_date": "+7d"
}
```

## Field Properties

### Standard Properties

All standard Interactive Dialog field properties are supported:

- `display_name` (string): Label shown to the user
- `name` (string): Field identifier for form submission  
- `type` (string): Must be `"date"` or `"datetime"`
- `default` (string): Default value (see Default Values section)
- `placeholder` (string): Placeholder text in the input
- `help_text` (string): Help text displayed below the field
- `optional` (boolean): Whether the field is required

### Date/DateTime-Specific Properties

#### `min_date` (string, optional)
Specifies the earliest selectable date. Supports multiple formats:

**ISO Date Format:**
```json
"min_date": "2024-03-01"
```

**Relative Date Keywords:**
```json
"min_date": "today"      // Current date
"min_date": "tomorrow"   // Next day
"min_date": "yesterday"  // Previous day
```

**Dynamic Relative Patterns:**
```json
"min_date": "+1d"    // 1 day from today
"min_date": "+7d"    // 1 week from today
"min_date": "+1w"    // 1 week from today (alternative)
"min_date": "+1M"    // 1 month from today
"min_date": "+1y"    // 1 year from today
"min_date": "-7d"    // 1 week ago
```

#### `max_date` (string, optional)
Specifies the latest selectable date. Uses the same format options as `min_date`.

```json
"max_date": "+30d"   // 30 days from today
"max_date": "2024-12-31"  // Specific end date
```

#### `time_interval` (number, optional)
**Applies to `datetime` fields only.** Specifies the interval in minutes between selectable time options.

```json
"time_interval": 15   // 15-minute intervals (1:00, 1:15, 1:30, 1:45)
"time_interval": 30   // 30-minute intervals (1:00, 1:30, 2:00)
"time_interval": 60   // 60-minute intervals (default)
```

**Constraints:**
- Must be a positive integer
- Must be between 1 and 1440 (24 hours)
- Defaults to 60 if not specified or invalid

## Default Values

### Static Defaults

**Date fields:**
```json
"default": "2024-03-15"          // ISO date format (YYYY-MM-DD)
```

**DateTime fields:**  
```json
"default": "2024-03-15T14:30:00Z"  // ISO datetime format (RFC3339)
```

### Relative Defaults

Both field types support relative default values:

```json
"default": "today"      // Today's date
"default": "tomorrow"   // Tomorrow's date  
"default": "+1d"        // 1 day from today
"default": "+1w"        // 1 week from today
"default": "+1M"        // 1 month from today
```

**DateTime with Relative Dates:**
For `datetime` fields, relative dates default to noon (12:00 PM):
```json
{
    "type": "datetime",
    "default": "today"    // Results in today at 12:00 PM
}
```

### Empty Defaults

```json
"default": ""  // No default value, field starts empty
```

## Validation

### Client-Side Validation

The webapp automatically validates:

1. **Date Format:** Ensures dates conform to ISO format
2. **Date Range:** Validates against `min_date` and `max_date` constraints  
3. **Time Interval:** Ensures `time_interval` is within valid range
4. **Required Fields:** Validates required fields are not empty

### Server-Side Validation

The server validates:

1. **Date Format:** Uses Go's `time.Parse()` with ISO formats
2. **Relative Date Resolution:** Validates relative date patterns
3. **Field Configuration:** Validates `min_date`/`max_date` formats

### Error Messages

Common validation error scenarios:

```json
// Invalid date format
{
    "id": "interactive_dialog.error.invalid_date",
    "defaultMessage": "Invalid date format"
}

// Date outside allowed range  
{
    "id": "interactive_dialog.error.date_out_of_range", 
    "defaultMessage": "Date must be between {minDate} and {maxDate}"
}

// Invalid time interval
{
    "id": "interactive_dialog.error.invalid_time_interval",
    "defaultMessage": "time_interval must be between 1 and 1440 minutes"
}
```

## Form Submission

### Date Field Submission

Date fields submit in ISO date format:

```json
{
    "submission": {
        "event_date": "2024-03-15"
    }
}
```

### DateTime Field Submission

DateTime fields submit in RFC3339 format with timezone:

```json
{
    "submission": {
        "meeting_time": "2024-03-15T14:30:00-05:00"  
    }
}
```

The timezone reflects the user's local timezone setting.

## Localization

### Date Display

Date fields automatically format dates according to the user's locale:

- **en-US:** "Mar 15, 2024"
- **en-GB:** "15 Mar 2024"  
- **de-DE:** "15. Mär 2024"

### Time Display

DateTime fields respect the user's 12/24 hour preference and locale-specific time formatting.

## Usage Examples

### Event Scheduling

```json
{
    "elements": [
        {
            "display_name": "Event Date",
            "name": "event_date",
            "type": "date", 
            "help_text": "When is your event?",
            "min_date": "today",
            "max_date": "+90d",
            "optional": false
        },
        {
            "display_name": "Start Time", 
            "name": "start_time",
            "type": "datetime",
            "help_text": "What time does it start?",
            "time_interval": 15,
            "min_date": "today",
            "optional": false
        }
    ]
}
```

### Meeting Scheduler with Business Hours

```json
{
    "display_name": "Meeting Time",
    "name": "meeting_time", 
    "type": "datetime",
    "help_text": "Select a time during business hours",
    "time_interval": 30,
    "min_date": "+1d",      // Tomorrow or later
    "max_date": "+14d",     // Within 2 weeks
    "optional": false
}
```

### Deadline with Past Date Restriction

```json
{
    "display_name": "Project Deadline", 
    "name": "deadline",
    "type": "date",
    "help_text": "When is this due? Must be in the future.",
    "min_date": "tomorrow", 
    "optional": false
}
```

### Flexible Date Range

```json
{
    "display_name": "Flexible Date",
    "name": "any_date",
    "type": "date", 
    "help_text": "Any date within the next year",
    "min_date": "today",
    "max_date": "+1y",
    "default": "+1w",       // Default to next week
    "optional": true
}
```

## Implementation Notes

### Timezone Handling

- **Client:** Uses user's browser/system timezone for display
- **Server:** Receives dates in user's timezone 
- **Storage:** Recommend storing in UTC with timezone metadata

### Browser Compatibility  

Date/datetime fields use standard HTML5 date inputs with React DatePicker fallback:

- **Modern Browsers:** Native date picker controls
- **Older Browsers:** JavaScript-based fallback picker
- **Mobile:** Native mobile date pickers

### Performance Considerations

- Date validation is performed on both client and server
- Large date ranges (years) may impact picker performance  
- Consider reasonable `min_date`/`max_date` bounds

## Migration from Text Fields

### Existing Text-Based Date Fields

To migrate from text-based date input to native date fields:

**Before:**
```json
{
    "display_name": "Date",
    "name": "date_field", 
    "type": "text",
    "placeholder": "YYYY-MM-DD",
    "help_text": "Enter date in YYYY-MM-DD format"
}
```

**After:** 
```json
{
    "display_name": "Date",
    "name": "date_field",
    "type": "date", 
    "placeholder": "Select a date",
    "help_text": "Choose your preferred date"
}
```

### Data Format Consistency

Ensure your backend can handle both formats during migration:

- **Text field:** Any user-entered string format
- **Date field:** Consistent ISO format

## Troubleshooting

### Common Issues

**Date not appearing in picker:**
- Verify `default` is in correct ISO format
- Check that `default` falls within `min_date`/`max_date` range

**Time intervals not working:**
- Ensure `time_interval` is a number, not a string
- Verify value is between 1 and 1440

**Validation errors:**
- Check server-side date parsing logic handles ISO formats
- Verify client and server timezone handling is consistent

**Date picker not opening:**
- Check for JavaScript errors in browser console
- Ensure all required dependencies are loaded

### Debugging Tips

1. **Check browser network tab** for form submission data format
2. **Verify server logs** for date parsing errors
3. **Test with different locales** to ensure proper formatting
4. **Test edge cases** like leap years, month boundaries, timezone changes

For additional support, refer to the Interactive Dialog API documentation or the Mattermost Developer Community.