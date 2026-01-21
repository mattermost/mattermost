# Phase 5: Enhanced Wizard - Research

**Researched:** 2026-01-21
**Domain:** React multi-step wizard with form validation, schedule configuration, and API integration
**Confidence:** HIGH

## Summary

This phase extends the existing `create_recap_modal` with schedule configuration capabilities. The codebase already has a well-established multi-step modal pattern, comprehensive form components, and timezone handling utilities. The primary work involves adding Step 3 (schedule configuration), enhancing Step 1 with a "Run once" toggle, and creating API actions for `createScheduledRecap` and `updateScheduledRecap`.

Key findings:
- **Existing modal pattern is extensible** — The current modal uses step state, conditional rendering, and navigation already works
- **Form components exist** — `Input` (with textarea support), `Toggle`, `DropdownInput`, and `CheckInput` are all available
- **Schedule display utilities exist** — `schedule_display.tsx` already has bitmask constants and formatting functions for day-of-week display
- **Time picker pattern exists** — `DateTimeInput` from `datetime_input.tsx` provides time selection with timezone support
- **Client4 API methods exist** — `createScheduledRecap` and `updateScheduledRecap` are already in client4.ts but redux actions need to be added

**Primary recommendation:** Extend the existing modal structure, reuse existing form components, and follow established patterns. Create a `DayOfWeekSelector` component for multi-day selection, and add missing redux actions.

## Standard Stack

The established libraries/tools for this domain:

### Core
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| React | 18.x | Component framework | Project standard |
| react-intl | 6.x | i18n formatting | Already used throughout, formatMessage pattern |
| moment-timezone | 0.5.x | Timezone handling | Used in datetime_input, timezone.ts |
| redux | 4.x | State management | Existing recap patterns use redux actions |

### Supporting
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| classnames | 2.x | Conditional CSS classes | Already imported in all components |
| @mattermost/compass-icons | - | Icon library | Used for ChevronLeftIcon, etc. |
| react-select | 5.x | Dropdown select | Used in DropdownInput |

### Not Needed (Already In Codebase)
| Instead of | Use | Location |
|------------|-----|----------|
| Custom modal | `GenericModal` | `@mattermost/components` |
| Custom input | `Input` from widgets | `components/widgets/inputs/input/input.tsx` |
| Custom toggle | `Toggle` | `components/toggle.tsx` |
| Custom checkbox | `CheckInput` | `components/widgets/inputs/check/index.tsx` |
| Custom dropdown | `DropdownInput` | `components/dropdown_input.tsx` |
| Custom time picker | `DateTimeInput` | `components/datetime_input/datetime_input.tsx` |

**Installation:** No new packages needed.

## Architecture Patterns

### Existing Modal Structure (Reference)
```
webapp/channels/src/components/create_recap_modal/
├── create_recap_modal.tsx      # Main modal with step navigation
├── create_recap_modal.scss     # Styles for all steps
├── channel_selector.tsx        # Step 2 content
├── channel_summary.tsx         # Step 3 content (current)
├── recap_configuration.tsx     # Step 1 content
└── index.ts
```

### Extended Structure (Phase 5)
```
webapp/channels/src/components/create_recap_modal/
├── create_recap_modal.tsx      # Add edit mode, run once toggle
├── create_recap_modal.scss     # Add Step 3 schedule styles
├── channel_selector.tsx        # Unchanged
├── channel_summary.tsx         # Move to Step 2 for "all unreads"
├── recap_configuration.tsx     # Add "run once" toggle near Next button
├── schedule_configuration.tsx  # NEW: Step 3 - schedule config
├── day_of_week_selector.tsx    # NEW: Multi-select day buttons
└── index.ts
```

### Pattern 1: Multi-Step Modal State Management
**What:** Track step, form data, and mode in parent state
**When to use:** Wizard flows with shared data across steps
**Example:**
```typescript
// Source: create_recap_modal.tsx lines 44-51
const [currentStep, setCurrentStep] = useState(1);
const [recapName, setRecapName] = useState('');
const [recapType, setRecapType] = useState<RecapType | null>(null);
const [selectedChannelIds, setSelectedChannelIds] = useState<string[]>([]);

// For Phase 5, add:
const [runOnce, setRunOnce] = useState(false);
const [daysOfWeek, setDaysOfWeek] = useState<number>(0);  // Bitmask
const [timeOfDay, setTimeOfDay] = useState<string>('09:00');
const [timePeriod, setTimePeriod] = useState<string>('last_24h');
const [customInstructions, setCustomInstructions] = useState<string>('');

// Edit mode props
type Props = {
    onExited: () => void;
    editScheduledRecap?: ScheduledRecap;  // When present, modal is in edit mode
};
```

### Pattern 2: Bitmask Day-of-Week Selection
**What:** Store selected days as a single integer using bitmask
**When to use:** Multiple day selection that needs efficient storage
**Example:**
```typescript
// Source: schedule_display.tsx lines 7-17
const Sunday = 1 << 0;    // 1
const Monday = 1 << 1;    // 2
const Tuesday = 1 << 2;   // 4
const Wednesday = 1 << 3; // 8
const Thursday = 1 << 4;  // 16
const Friday = 1 << 5;    // 32
const Saturday = 1 << 6;  // 64

const Weekdays = Monday | Tuesday | Wednesday | Thursday | Friday;  // 62
const Weekend = Saturday | Sunday;  // 65
const EveryDay = Weekdays | Weekend;  // 127

// Toggle a day
const toggleDay = (daysOfWeek: number, day: number): number => {
    return daysOfWeek ^ day;  // XOR to toggle
};

// Check if day is selected
const isDaySelected = (daysOfWeek: number, day: number): boolean => {
    return (daysOfWeek & day) !== 0;
};
```

### Pattern 3: Validation on Blur
**What:** Input component validates when focus leaves, shows error below
**When to use:** All form fields requiring validation
**Example:**
```typescript
// Source: widgets/inputs/input/input.tsx lines 131-150
const handleOnBlur = (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFocused(false);
    validateInput();  // Runs validation when blur occurs
    if (onBlur) {
        onBlur(event);
    }
};

const validateInput = () => {
    if (validate) {
        const validationError = validate(value);
        if (validationError) {
            setCustomInputLabel(validationError);
            return;
        }
    }
    // Required field validation
    if (required && (value === null || value === '')) {
        setCustomInputLabel({type: 'error', value: 'This field is required'});
    }
};
```

### Pattern 4: Edit Mode Pre-fill
**What:** Pass existing data to modal, pre-populate all fields
**When to use:** Edit functionality for existing scheduled recaps
**Example:**
```typescript
// In parent component (scheduled_recap_item.tsx):
const handleEdit = useCallback(() => {
    onEdit(scheduledRecap.id);  // Opens modal with edit mode
}, [onEdit, scheduledRecap.id]);

// In modal:
useEffect(() => {
    if (editScheduledRecap) {
        setRecapName(editScheduledRecap.title);
        setRecapType(editScheduledRecap.channel_mode === 'all_unreads' ? 'all_unreads' : 'selected');
        setSelectedChannelIds(editScheduledRecap.channel_ids || []);
        setDaysOfWeek(editScheduledRecap.days_of_week);
        setTimeOfDay(editScheduledRecap.time_of_day);
        setTimePeriod(editScheduledRecap.time_period);
        setCustomInstructions(editScheduledRecap.custom_instructions || '');
    }
}, [editScheduledRecap]);
```

### Anti-Patterns to Avoid
- **Don't create new form components** — Use existing `Input`, `Toggle`, `DropdownInput`
- **Don't duplicate bitmask constants** — Import from `schedule_display.tsx`
- **Don't bypass validation** — Always validate before step navigation
- **Don't hand-code time formatting** — Use `useIntl().formatTime()` for locale-aware display
- **Don't calculate next run client-side** — Server computes `next_run_at`, display with `useScheduleDisplay().formatNextRun()`

## Don't Hand-Roll

Problems that look simple but have existing solutions:

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Day-of-week display | Custom formatter | `useScheduleDisplay().formatDaysOfWeek()` | Already handles smart groupings (Weekdays, Weekend, Every day) |
| Time formatting | Manual string formatting | `useIntl().formatTime()` | Handles 12h/24h based on locale |
| Timezone display | Manual abbreviation | `getCurrentTimezoneLabel` selector | Returns proper IANA label |
| Next run preview | Client-side calculation | Server-provided `next_run_at` | Server handles DST, holidays correctly |
| Toggle switch | Custom checkbox | `<Toggle>` component | Consistent styling, accessibility |
| Textarea | Custom `<textarea>` | `<Input type="textarea">` | Built-in validation, error display |
| Modal structure | Custom modal | `<GenericModal>` | Focus trap, escape handling, consistent styling |
| Time selection | Custom time input | `DateTimeInput` (time portion) | Handles intervals, timezone |

**Key insight:** The codebase has mature patterns for forms, validation, and timezone handling. Custom solutions will be inconsistent and harder to maintain.

## Common Pitfalls

### Pitfall 1: Forgetting to Handle "Run Once" Flow
**What goes wrong:** User checks "run once" but wizard still shows schedule configuration
**Why it happens:** Conditional step logic not updated for new toggle
**How to avoid:** 
- When `runOnce` is true, skip Step 3 entirely
- Step 2 becomes final step with "Run recap" button
- After submission, redirect to unread recaps page
**Warning signs:** Schedule configuration appears when "run once" is checked

### Pitfall 2: Bitmask Off-by-One Errors
**What goes wrong:** Wrong days selected, Sunday/Saturday confused
**Why it happens:** JavaScript's `getDay()` returns 0-6 (Sun-Sat), bitmask uses 1-64
**How to avoid:**
- Use constants from `schedule_display.tsx`, not computed values
- Test with all days selected, individual days, and edge cases
**Warning signs:** Selecting Monday stores Sunday's bit

### Pitfall 3: Timezone Display Without User's Timezone
**What goes wrong:** Times shown without timezone, confusing users in different zones
**Why it happens:** Using raw Date formatting instead of timezone-aware formatting
**How to avoid:**
- Always use `getCurrentTimezone` selector for user's timezone
- Include timezone abbreviation in next run preview
- Pass timezone to `DateTimeInput` component
**Warning signs:** Times shown without "(EST)" or similar suffix

### Pitfall 4: Edit Mode Doesn't Update Existing Recap
**What goes wrong:** User edits recap but API creates new one instead of updating
**Why it happens:** Using `createScheduledRecap` instead of `updateScheduledRecap`
**How to avoid:**
- Check for `editScheduledRecap.id` presence
- Use different API action based on edit mode
- Dispatch `RECEIVED_SCHEDULED_RECAP` to update store
**Warning signs:** Duplicate scheduled recaps appear after edit

### Pitfall 5: Validation Doesn't Block Step Navigation
**What goes wrong:** User can navigate to next step with invalid data
**Why it happens:** `canProceed()` doesn't check all new fields
**How to avoid:**
- Update `canProceed()` for each step with new field requirements
- Step 3 requires: at least one day, time, time period
- Disable Next/Create button when validation fails
**Warning signs:** Empty schedule gets submitted

## Code Examples

Verified patterns from the existing codebase:

### Using Toggle Component
```typescript
// Source: scheduled_recap_item.tsx lines 105-113
<Toggle
    id={`toggle-${scheduledRecap.id}`}
    toggled={scheduledRecap.enabled}
    onToggle={handleToggle}
    disabled={isToggling}
    size='btn-sm'
    onText={formatMessage({id: 'recaps.scheduled.active', defaultMessage: 'Active'})}
    offText={formatMessage({id: 'recaps.scheduled.paused', defaultMessage: 'Paused'})}
/>
```

### Using Input with Textarea
```typescript
// Source: widgets/inputs/input/input.tsx - usage pattern
<Input
    type='textarea'
    name='customInstructions'
    label={formatMessage({id: 'recaps.modal.customInstructions', defaultMessage: 'Custom instructions (optional)'})}
    placeholder={formatMessage({id: 'recaps.modal.customInstructionsPlaceholder', defaultMessage: 'Add any specific instructions for the AI...'})}
    value={customInstructions}
    onChange={(e) => setCustomInstructions(e.target.value)}
    rows={3}
    limit={500}
/>
```

### Formatting Schedule Display
```typescript
// Source: schedule_display.tsx - using the hook
const {formatDaysOfWeek, formatTimeOfDay, formatNextRun} = useScheduleDisplay();

// In component:
const scheduleText = formatSchedule(daysOfWeek, timeOfDay);
// Returns: "Weekdays at 9:00 AM" or "Mon, Wed, Fri at 2:30 PM"

const nextRunText = formatNextRun(nextRunAt, enabled);
// Returns: "Next: Tomorrow at 9:00 AM" or "Next: Monday at 9:00 AM"
```

### Getting User's Timezone
```typescript
// Source: date_time_picker_modal.tsx lines 58-59
import {getCurrentTimezone} from 'mattermost-redux/selectors/entities/timezone';

const userTimezone = useSelector(getCurrentTimezone);
// Returns IANA string like "America/New_York"
```

### Using DateTimeInput (Time Only)
```typescript
// Source: datetime_input.tsx - extracting time picker pattern
// The DateTimeInput has both date and time - for time only, use the Menu.Container pattern:
<Menu.Container
    menuButton={{
        id: 'time_button',
        class: 'date-time-input',
        children: (
            <>
                <span className='date-time-input__label'>Time</span>
                <span className='date-time-input__icon'><i className='icon-clock-outline'/></span>
                <span className='date-time-input__value'>{formatTime(selectedTime)}</span>
            </>
        ),
    }}
    menu={{id: 'timeMenu', 'aria-label': 'Choose a time'}}
>
    {timeOptions.map((option, index) => (
        <Menu.Item
            key={index}
            labels={<Timestamp useRelative={false} useDate={false} value={option}/>}
            onClick={() => handleTimeChange(option)}
        />
    ))}
</Menu.Container>
```

### DropdownInput for Time Period Selection
```typescript
// Source: dropdown_input.tsx usage pattern
const timePeriodOptions = [
    {value: 'last_24h', label: formatMessage({id: 'recaps.timePeriod.last24h', defaultMessage: 'Previous day'})},
    {value: 'last_3_days', label: formatMessage({id: 'recaps.timePeriod.last3days', defaultMessage: 'Last 3 days'})},
    {value: 'last_7_days', label: formatMessage({id: 'recaps.timePeriod.last7days', defaultMessage: 'Last 7 days'})},
];

<DropdownInput
    name='timePeriod'
    legend={formatMessage({id: 'recaps.modal.timePeriod', defaultMessage: 'Time period to cover'})}
    value={timePeriodOptions.find(o => o.value === timePeriod)}
    options={timePeriodOptions}
    onChange={(val) => setTimePeriod(val.value)}
    required={true}
/>
```

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| moment.js only | moment-timezone | Project standard | Required for timezone-aware times |
| Manual i18n | react-intl hooks | Project standard | Use `useIntl()` hook pattern |
| Class components | Functional + hooks | React 18 | All new code uses hooks |
| Custom modals | GenericModal | Project standard | Consistent modal behavior |

**Deprecated/outdated:**
- `moment()` without timezone: Always use `moment.tz()` or the timezone utilities
- Direct DOM manipulation: Use React state and refs
- String concatenation for i18n: Use `formatMessage()` with placeholders

## Open Questions

Things that couldn't be fully resolved:

1. **Exact next run preview calculation**
   - What we know: Server provides `next_run_at` after creation
   - What's unclear: Should we calculate preview before submission?
   - Recommendation: Calculate client-side preview using same logic as `formatNextRun`, but treat as estimate. After create/update, server's `next_run_at` is authoritative.

2. **Time picker intervals**
   - What we know: `DateTimeInput` uses 30-minute intervals by default
   - What's unclear: Should scheduled recaps use different intervals?
   - Recommendation: Use 30-minute intervals (same as existing DND picker) for consistency

3. **Edit mode "type" change behavior**
   - What we know: User can switch between "selected channels" and "all unreads"
   - What's unclear: Should switching type clear selected channels?
   - Recommendation: Preserve channels when switching to "selected channels", clear when switching to "all unreads"

## Sources

### Primary (HIGH confidence)
- `webapp/channels/src/components/create_recap_modal/` - All existing modal files read
- `webapp/channels/src/components/recaps/schedule_display.tsx` - Bitmask and formatting
- `webapp/channels/src/components/widgets/inputs/input/input.tsx` - Input with validation
- `webapp/channels/src/components/datetime_input/datetime_input.tsx` - Time picker pattern
- `webapp/channels/src/components/toggle.tsx` - Toggle component
- `webapp/platform/types/src/recaps.ts` - ScheduledRecap and ScheduledRecapInput types
- `webapp/platform/client/src/client4.ts` - API methods exist (lines 3352-3396)

### Secondary (MEDIUM confidence)
- `webapp/channels/src/components/dropdown_input.tsx` - Dropdown with validation
- `webapp/channels/src/packages/mattermost-redux/src/actions/recaps.ts` - Existing patterns for new actions
- `webapp/channels/src/packages/mattermost-redux/src/selectors/entities/timezone.ts` - Timezone selectors

### Tertiary (LOW confidence)
- Next run preview calculation approach (needs validation against server behavior)

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH - All components exist in codebase
- Architecture: HIGH - Extends well-documented existing patterns
- Pitfalls: HIGH - Based on direct code review of existing implementation

**Research date:** 2026-01-21
**Valid until:** 2026-02-21 (30 days - stable patterns, internal codebase)
