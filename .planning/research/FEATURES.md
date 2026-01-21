# Features Research: Scheduled Recaps

**Domain:** Scheduled digest/recap systems in collaboration tools
**Researched:** 2026-01-21
**Overall confidence:** MEDIUM (based on analysis of comparable products and established patterns)

## Comparable Products

### Direct Competitors (Digest/Recap Systems)

| Product | Feature | How It Works |
|---------|---------|--------------|
| **GitHub Scheduled Reminders** | PR review digests | Sends daily/weekly summaries of PRs needing review to Slack. Up to 5 repos per reminder. Configurable days and times. Real-time alerts optional. |
| **Slack Scheduled Messages** | Pre-scheduled sending | Schedule messages to send at specific times. Timezone-aware. Simple day/time picker. |
| **Notion AI** | Meeting notes summaries | AI-generated summaries of meeting content. Not scheduled — on-demand after meetings. |
| **Microsoft Teams Intelligent Recap** | Meeting summaries | AI-powered post-meeting recaps with action items. Triggered after meeting ends, not scheduled. |

### Adjacent Systems (Scheduling Patterns)

| Product | Scheduling Model | Relevant Pattern |
|---------|------------------|------------------|
| **Todoist** | Recurring dates | Natural language ("every Monday at 9am"), day-of-week selection, repeat intervals (daily/weekly/monthly), end dates |
| **GitHub** | Scheduled reminders | Days-of-week selector + time picker, timezone handling, limits per configuration |
| **Cron-job.org** | Full cron | Interval-based (minute/hour/day/week), predefined schedules, custom configurations |

### Key Insights from Comparable Products

1. **GitHub Scheduled Reminders** is the closest analog — it sends scheduled digests of activity (PRs) via Slack
   - Limits to 5 repos per reminder (avoids information overload)
   - Allows real-time alerts as optional addition
   - Integrates with existing notification channels (Slack)

2. **Most AI recap products are on-demand, not scheduled** — Mattermost scheduled recaps would be differentiated

3. **Scheduling UX follows consistent patterns**: Day-of-week checkboxes + time picker is standard (not full cron)

## Table Stakes

Features users expect in any scheduled digest/recap system. Missing = product feels incomplete or frustrating.

| Feature | Why Expected | Complexity | Notes |
|---------|--------------|------------|-------|
| **Day-of-week selection** | Universal pattern in scheduling UIs | Low | Checkboxes for Mon-Sun |
| **Time-of-day selection** | Users need control over when recap arrives | Low | Time picker with timezone display |
| **Timezone handling** | Remote teams span timezones; wrong time = useless | Medium | Store user timezone, display local times |
| **Pause/Resume** | Users go on vacation, change priorities | Low | Boolean toggle, no deletion needed |
| **Edit existing schedules** | Schedules need to change over time | Medium | Full edit capability, not just delete+recreate |
| **Delete schedules** | Users abandon use cases | Low | Confirmation dialog, soft delete |
| **View scheduled recaps list** | Users need to see what's configured | Low | List view with status indicators |
| **Time period selection** | Users need recaps of different durations | Low | Previous day, 3 days, 7 days options |
| **Source selection** | Users want to control what's summarized | Low | Channels or topics (already in scope) |
| **Immediate "run once" option** | Backwards compatibility with current behavior | Low | Checkbox or toggle to skip scheduling |
| **Status indicators** | Users need to know recap state (active/paused/failed) | Low | Visual badges on list items |
| **Next run preview** | Users want to know when recap will trigger | Low | Show "Next: Monday 9:00 AM" on scheduled item |

## Differentiators

Features that could set Mattermost scheduled recaps apart from competitors. Not expected, but add competitive value.

| Feature | Value Proposition | Complexity | Notes |
|---------|-------------------|------------|-------|
| **Topic-based recaps** | Summarize by concept, not just channel | High | Already in scope. Few competitors offer this. |
| **Custom AI instructions** | Personalize summary style/focus | Medium | Already in scope. "Focus on decisions" vs "focus on action items" |
| **AI agent selection** | Choose which AI generates recap | Low | Already exists. Unique to multi-agent systems. |
| **Historical recap archive** | Review past recaps, track what you've seen | Medium | Helps users prove they're "caught up" |
| **Recap sharing** | Share a recap summary with teammates | Medium | Turn personal tool into collaboration artifact |
| **Quiet hours** | Suppress notifications during off-hours | Medium | Respect work-life boundaries |
| **Catchup mode** | Auto-generate recap for days user was absent | High | Detect absence, summarize missed time |
| **Smart scheduling suggestions** | AI suggests optimal recap schedule based on activity | High | "Your design channel is most active Tue-Thu" |
| **Channel recommendation** | Suggest channels to add based on participation | Medium | "You read #frontend daily, add it to recap?" |
| **Recap effectiveness metrics** | Show which recaps are being read/acted on | Medium | Help users optimize their recap configs |

## Anti-Features

Features to explicitly NOT build. Common mistakes in this domain.

| Anti-Feature | Why Avoid | What to Do Instead |
|--------------|-----------|-------------------|
| **Full cron expression input** | Too complex for 99% of users, error-prone | Simple day/time picker covers all realistic use cases |
| **Unlimited channel selection** | Information overload makes recaps useless | Soft limit (e.g., 10 channels) with warning; or GitHub's approach of 5 per config |
| **Per-schedule notification preferences** | Complicates mental model | Use existing notification system; recap appears in recaps list |
| **Hourly/minute-level scheduling** | Recaps summarize activity over time; sub-daily frequency doesn't make sense | Minimum granularity = daily |
| **Complex repeat patterns** | "Every 3rd Tuesday of even months" rarely needed | Weekly patterns only; users can create multiple schedules |
| **Auto-delete old recaps** | Users want history for reference | Keep recaps; let users manually delete |
| **Forced channel grouping** | "Must select channels from same team" adds friction | Allow any channels user has access to |
| **Recap preview before scheduling** | Delays gratification; preview is the first run | Just create the schedule; first run shows the recap |
| **Email delivery option** | Fragments experience; users are already in Mattermost | Deliver in-app; users get notification badge |
| **Multiple schedules per recap config** | Complexity explosion; "different days, different times" | One schedule per config; create multiple configs |

## Feature Dependencies

Understanding what features depend on what helps with phase ordering.

```
┌─────────────────────────────────────────────────────────────────┐
│                     SCHEDULING FOUNDATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Database Schema ─────┬──────────────────────────────────────── │
│  (schedule config)    │                                          │
│                       ▼                                          │
│              Job Server Trigger ──────────────────────────────── │
│              (cron-like scheduler)                               │
│                       │                                          │
│                       ▼                                          │
│              API for Scheduled Recaps ────────────────────────── │
│              (CRUD operations)                                   │
│                       │                                          │
│         ┌─────────────┴─────────────┐                           │
│         ▼                           ▼                           │
│  Schedule Creation UI        Schedule Management UI              │
│  (wizard extension)          (list view + edit)                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                        ENHANCEMENTS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Topic-based Sources ─── (independent of scheduling)            │
│  Custom AI Instructions ─── (independent of scheduling)         │
│  Pause/Resume ─── (requires schedule management UI)             │
│  Next Run Preview ─── (requires schedule config in DB)          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Dependency Summary

| Feature | Depends On |
|---------|------------|
| Schedule creation UI | DB schema, API |
| Schedule management (list) | DB schema, API |
| Edit schedule | Schedule management UI |
| Pause/Resume | Schedule management UI, DB schema (status field) |
| Delete schedule | Schedule management UI, API |
| Job server trigger | DB schema (to read schedules) |
| Next run preview | Schedule config in DB + calculation logic |
| Topic-based recaps | Independent (but touches create UI) |
| Custom instructions | Independent (but touches create UI) |

## MVP Recommendation

Based on table stakes analysis, the MVP for scheduled recaps must include:

### Phase 1: Core Scheduling (Table Stakes)
1. **Schedule configuration** — Day-of-week + time picker + time period
2. **Schedule storage** — DB schema for recurring config
3. **Job server integration** — Trigger recaps at scheduled times
4. **"Run once" option** — Preserve existing behavior
5. **Scheduled recaps list** — View what's scheduled
6. **Basic management** — Edit, delete, pause/resume

### Phase 2: Enhancements
1. **Topic-based recaps** — Already in scope
2. **Custom AI instructions** — Already in scope
3. **Next run preview** — Nice UX polish

### Defer to Post-MVP
- Recap sharing
- Smart scheduling suggestions
- Channel recommendations
- Catchup mode
- Effectiveness metrics

## Sources

### HIGH Confidence (Official Documentation)
- GitHub Scheduled Reminders: https://docs.github.com/en/subscriptions-and-notifications/concepts/scheduled-reminders
- GitHub About Notifications: https://docs.github.com/en/subscriptions-and-notifications/concepts/about-notifications
- Slack Message Formatting: https://slack.dev/messaging/formatting-message-text (for delivery patterns)

### MEDIUM Confidence (Product Analysis)
- Notion AI product page: https://notion.so/product/ai
- Todoist recurring dates: https://todoist.com/help/articles/introduction-to-recurring-dates
- GitHub notification workflow customization: https://docs.github.com/en/subscriptions-and-notifications/tutorials/customizing-a-workflow-for-triaging-your-notifications

### LOW Confidence (General Patterns)
- Cron-job.org scheduling patterns: https://cron-job.org/en/ (reference for interval types)
- Industry standard day/time picker patterns (training data)
- Digest email best practices (training data — verify specific claims)

## Research Gaps

Areas that could not be fully verified and may need phase-specific research:

1. **Optimal recap limits** — GitHub uses 5 repos per reminder, 20 PRs per repo. What's the right limit for Mattermost channels? Needs user testing.

2. **Timezone edge cases** — How do competitors handle DST transitions? What happens if user changes timezone?

3. **Job server capacity** — What's the Mattermost job server's capacity for scheduled tasks? May need performance research.

4. **Notification patterns** — How should users be notified recap is ready? Badge sufficient? Needs UX validation.
