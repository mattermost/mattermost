# Interactive Dialog DateTime Range & Timezone Feature - Status Document

**Last Updated**: 2025-11-03
**Feature Branch**: `interactive-datetime-range`

## Overview

This document tracks the implementation status of the datetime range and timezone features for Mattermost Interactive Dialogs. These features allow plugins to create forms with:
- Date and datetime range pickers (start/end date selection)
- Timezone-aware datetime fields using `location_timezone`
- Advanced time exclusion rules and disabled days
- Flexible calendar layouts (horizontal/vertical)

## Implementation Status

### ✅ Completed Features

#### 1. DateTime Range Selection (`is_range: true`)
- **Status**: ✅ Complete and working
- **Files Modified**:
  - `webapp/channels/src/components/apps_form/apps_form_datetime_field/apps_form_datetime_field.tsx`
  - `webapp/channels/src/components/apps_form/apps_form_date_field/apps_form_date_field.tsx`
  - `webapp/channels/src/components/datetime_input/datetime_input.tsx`
  - `webapp/channels/src/utils/dialog_conversion.ts`

**Features**:
- Two-field date range picker (Start Date/Time and End Date/Time)
- Visual range selection in calendar popup
- Support for both horizontal and vertical layouts (`range_layout: "horizontal"` or `"vertical"`)
- `allow_single_day_range` option to permit/prevent same-day ranges
- Proper time preservation when selecting dates
- Range validation (end must be after start)

**API Fields**:
```go
type DialogElement struct {
    IsRange           bool   `json:"is_range"`           // Enable range mode
    RangeLayout       string `json:"range_layout"`       // "horizontal" or "vertical"
    AllowSingleDayRange bool `json:"allow_single_day_range"` // Allow start=end
}
```

#### 2. Location Timezone (`location_timezone`)
- **Status**: ✅ Complete and working
- **Files Modified**:
  - `webapp/channels/src/components/apps_form/apps_form_datetime_field/apps_form_datetime_field.tsx`
  - `webapp/channels/src/components/datetime_input/datetime_input.tsx`

**Features**:
- Display dates/times in a specific timezone regardless of user's local timezone
- Shows timezone indicator (e.g., "🌍 Times in JST")
- Correctly handles date display across timezone boundaries
- Stores values in UTC for consistent server processing

**Key Fixes Applied**:
- Disabled `relativeDate` formatting when `location_timezone` is set (prevents date shifting)
- Created `momentToLocalDate()` helper to preserve calendar dates across timezones
- Fixed `formatDate()` to use moment's timezone-aware formatting

**API Fields**:
```go
type DialogElement struct {
    LocationTimezone string `json:"location_timezone"` // IANA timezone (e.g., "Asia/Tokyo")
}
```

#### 3. Disabled Days (`disabled_days`)
- **Status**: ✅ Complete and working
- **Files Modified**:
  - `webapp/channels/src/utils/date_utils.ts`
  - `webapp/channels/src/utils/dialog_conversion.ts`
  - `webapp/channels/src/components/datetime_input/datetime_input.tsx`

**Features**:
- Flexible disabled day rules supporting all react-day-picker matchers
- Specific dates, date ranges, before/after dates, days of week
- Relative date references (e.g., `"+7d"`, `"today"`)
- Works with both date and datetime fields
- Properly combined with legacy `min_date`/`max_date` fields

**Supported Rules**:
```go
type DialogDisabledDayRule struct {
    Before     *string `json:"before"`      // Disable dates before (e.g., "2025-01-01", "+7d")
    After      *string `json:"after"`       // Disable dates after
    DaysOfWeek []int   `json:"days_of_week"` // 0=Sunday, 6=Saturday
    From       *string `json:"from"`        // Disable range from->to
    To         *string `json:"to"`
}
```

**Key Fixes Applied**:
- Added `disabled_days` passthrough in dialog conversion layer
- Changed `daysOfWeek` to `dayOfWeek` (singular) to match react-day-picker API
- Used react-day-picker's `Matcher` type instead of custom type

#### 4. Time Exclusions (`exclude_time`)
- **Status**: ✅ Complete and working
- **Files Modified**:
  - `webapp/channels/src/components/datetime_input/datetime_input.tsx`

**Features**:
- Exclude specific time ranges from the time picker dropdown
- Support for UTC or local timezone references
- Before/After rules and Start/End ranges
- Automatically filters available times and defaults to next available slot

**API Fields**:
```go
type DialogTimeExcludeConfig struct {
    TimezoneReference string                      `json:"timezone_reference"` // "UTC" or "local"
    Exclusions        []DialogTimeExclusionRule   `json:"exclusions"`
}

type DialogTimeExclusionRule struct {
    Before *string `json:"before"` // Exclude times before (HH:mm format)
    After  *string `json:"after"`  // Exclude times after
    Start  *string `json:"start"`  // Exclude range start->end
    End    *string `json:"end"`
}
```

**Key Fix Applied**:
- Fixed Tokyo Business Hours config from `{Before: "00:00", After: "08:00"}` (excluded everything) to `{Start: "08:00", End: "24:00"}` (excludes only after 8 AM UTC)

#### 5. Time Dropdown Smart Sorting
- **Status**: ✅ Complete and working
- **Files Modified**:
  - `webapp/channels/src/components/datetime_input/datetime_input.tsx` (lines 298-341)

**Features**:
- Automatically detects when available times wrap around midnight
- Rotates time list to show main contiguous block first
- Example: `5:00 PM, 5:30 PM, ..., 11:30 PM, 12:00 AM, 12:30 AM` instead of `12:00 AM, 12:30 AM, ..., 5:00 PM, ...`
- Only activates when there's a significant gap (> 2x interval)
- Maintains chronological order for normal time ranges

**Algorithm**:
1. Find largest gap between consecutive time intervals
2. If gap > 2× interval duration, rotate array after that gap
3. Otherwise keep times in chronological order

## Demo Plugin Examples

Location: `/Users/sbishel/go/src/github.com/mattermost/mattermost-plugin-demo/server/dialog_samples.go`

### Example: Date Range with Disabled Weekends
```go
{
    DisplayName: "Vacation Dates",
    Name:        "vacation_range",
    Type:        "date",
    IsRange:     true,
    DisabledDays: []model.DialogDisabledDayRule{
        {Before: strPtr("today")},  // No past dates
        {After: strPtr("+30d")},    // Max 30 days out
    },
}
```

### Example: DateTime Range with Vertical Layout
```go
{
    DisplayName: "Event Period",
    Name:        "event_range",
    Type:        "datetime",
    IsRange:     true,
    RangeLayout: "vertical",
    AllowSingleDayRange: true,
}
```

### Example: Timezone-Aware DateTime
```go
{
    DisplayName: "Tokyo Business Hours (Tokyo Time)",
    Name:        "tokyo_local_time",
    Type:        "datetime",
    LocationTimezone: "Asia/Tokyo",
    TimeInterval: 30,
    DisabledDays: []model.DialogDisabledDayRule{
        {DaysOfWeek: []int{0, 6}}, // Weekends disabled
    },
    ExcludeTime: &model.DialogTimeExcludeConfig{
        TimezoneReference: "local",
        Exclusions: []model.DialogTimeExclusionRule{
            {Before: "09:00"}, // Before 9 AM Tokyo
            {After: "17:00"},  // After 5 PM Tokyo
        },
    },
}
```

### Example: UTC Time Exclusion with Midnight Wrapping
```go
{
    DisplayName: "Tokyo Business Hours (Your Time)",
    Name:        "tokyo_utc_time",
    Type:        "datetime",
    TimeInterval: 30,
    DisabledDays: []model.DialogDisabledDayRule{
        {DaysOfWeek: []int{0, 6}}, // Weekends
    },
    ExcludeTime: &model.DialogTimeExcludeConfig{
        TimezoneReference: "UTC",
        Exclusions: []model.DialogTimeExclusionRule{
            {Start: "08:00", End: "24:00"}, // Exclude 8AM-midnight UTC
            // Keeps 00:00-08:00 UTC = 9 AM - 5 PM Tokyo
        },
    },
}
```

### Example: Locked Single Date
```go
{
    DisplayName: "Conference Arrival",
    Name:        "chicago_arrival",
    Type:        "datetime",
    LocationTimezone: "America/Chicago",
    DisabledDays: []model.DialogDisabledDayRule{
        {Before: strPtr("+7d")},  // Disable before +7d
        {After: strPtr("+7d")},   // Disable after +7d
        // Result: Only "+7d" is selectable
    },
}
```

## Key Technical Decisions

### 1. UTC Storage, Local Display
- All datetime values stored in UTC format: `YYYY-MM-DDTHH:mm:ssZ`
- Display timezone determined by `location_timezone` or user's timezone
- Conversion happens at display time, not storage time

### 2. React-Day-Picker Integration
- Used `Matcher` type from react-day-picker for consistency
- Property name is `dayOfWeek` (singular), not `daysOfWeek` (plural)
- Calendar shows dates in local timezone but preserves timezone-aware moment values

### 3. Time Wrapping Across Midnight
- When UTC exclusions span midnight in local timezone, use `Start/End` ranges
- Smart rotation algorithm keeps UI intuitive for users
- Example: UTC 00:00-08:00 in Denver (UTC-7) becomes 17:00 prev day - 01:00 current day

### 4. Relative Date References
- Support `today`, `tomorrow`, `yesterday`
- Support `+Nd` (days), `+Nw` (weeks), `+Nm` (months)
- Resolved at runtime based on user's timezone (or `location_timezone` if set)

## Known Issues / Edge Cases

### 1. ⚠️ Removed Debug Logging
- **Status**: TODO
- Extensive console.log statements added during debugging
- Should be removed before merging to production:
  - `datetime_input.tsx`: Lines with `console.log('handleDayChange...')`, `console.log('formatDate...')`, etc.
  - `apps_form_datetime_field.tsx`: Lines with `console.log('AppsFormDateTimeField...')`, `console.log('momentValue useMemo...')`
  - `date_utils.ts`: Lines with `console.log('parseDisabledDays...')`, `console.log('momentToString...')`
  - `datetime_input.tsx`: Lines with `console.log('isTimeExcluded...')`

### 2. ⚠️ Time Wrapping Complexity
- **Status**: Working but complex
- UTC time exclusions that wrap midnight in local timezone require careful configuration
- Use `Start/End` ranges instead of `Before/After` for wrapped ranges
- Documentation needed for plugin developers

### 3. ✅ Single Day Range Behavior
- **Status**: Working as designed
- When `allow_single_day_range: false`, clicking same day is ignored
- When `allow_single_day_range: true`, clicking start date collapses to single-day range
- This matches expected UX behavior

## Testing Checklist

### ✅ Completed Tests
- [x] Date range selection (horizontal layout)
- [x] Date range selection (vertical layout)
- [x] DateTime range with times preserved
- [x] Single day range allowed/disallowed
- [x] Location timezone displays correct date (Tokyo)
- [x] Location timezone displays correct time
- [x] Location timezone submits correct UTC value
- [x] Disabled days - weekends
- [x] Disabled days - specific days of week
- [x] Disabled days - before/after dates
- [x] Disabled days - relative dates (+7d)
- [x] Time exclusions - local timezone
- [x] Time exclusions - UTC timezone
- [x] Time exclusions with midnight wrapping
- [x] Time dropdown smart sorting
- [x] Legacy min_date/max_date compatibility

### 🔲 Future Tests
- [ ] DST boundary handling
- [ ] Leap year date selection
- [ ] Multiple time exclusion rules combined
- [ ] Very large date ranges (> 1 year)
- [ ] International date formats (non-US)

## Files Modified

### Core Implementation Files
```
webapp/channels/src/components/apps_form/
├── apps_form_date_field/apps_form_date_field.tsx
├── apps_form_datetime_field/apps_form_datetime_field.tsx
└── apps_form_component.tsx

webapp/channels/src/components/datetime_input/
└── datetime_input.tsx

webapp/channels/src/utils/
├── date_utils.ts
├── dialog_conversion.ts
└── timezone.ts
```

### Demo Plugin Files
```
server/
├── dialog_samples.go (getDialogDateTimeAdvanced function)
└── command_hooks.go (debug logging)
```

## Migration Notes

### For Plugin Developers

**Old Way (Legacy)**:
```go
{
    Type: "datetime",
    MinDate: "2025-01-01",  // Deprecated
    MaxDate: "2025-12-31",  // Deprecated
}
```

**New Way (Recommended)**:
```go
{
    Type: "datetime",
    DisabledDays: []model.DialogDisabledDayRule{
        {Before: "2025-01-01"},
        {After: "2025-12-31"},
    },
}
```

### Breaking Changes
- None - all changes are backward compatible
- Legacy `min_date`/`max_date` still work and are combined with `disabled_days`

## Future Enhancements

### Potential Improvements
1. **Time Range Selection**: Allow selecting a time range within a single day
2. **Recurring Event Patterns**: Disable dates based on recurring patterns
3. **Multi-Month Calendar View**: Show multiple months for long-range selection
4. **Preset Time Ranges**: Quick selection buttons (e.g., "Next Week", "Next Month")
5. **Time Zone Search**: Autocomplete timezone selector for `location_timezone`

### API Enhancements
1. **Field Grouping**: Visual grouping of related fields
2. **Conditional Fields**: Show/hide fields based on other field values
3. **Field Dependencies**: Make end date dependent on start date + duration

## Debugging Tips

### Common Issues

**Issue**: Date shows day before when using `location_timezone`
- **Cause**: `relativeDate` prop is `true`
- **Fix**: Set `relativeDate={!field.location_timezone}` in DateTimeInput

**Issue**: No times available in dropdown
- **Cause**: Exclusion rules exclude everything
- **Fix**: Check if Before/After rules conflict. Use Start/End for ranges instead.

**Issue**: Times not sorted intuitively
- **Cause**: Available times wrap midnight but aren't rotated
- **Fix**: Ensure rotation logic is enabled (lines 298-341 in datetime_input.tsx)

### Debug Logging
To enable debug logging, look for `console.log` statements in:
- `datetime_input.tsx` - Time generation and filtering
- `apps_form_datetime_field.tsx` - Field initialization and value changes
- `date_utils.ts` - Date parsing and disabled day calculations

## Contact

For questions or issues:
- File: `INTERACTIVE_DIALOG_DATETIME_RANGE_STATUS.md`
- Branch: `interactive-datetime-range`
- Related Docs: `INTERACTIVEDIALOG_DATETIME_STATUS.md`, `POSTS_TIME_RANGE_FEATURE.md`
