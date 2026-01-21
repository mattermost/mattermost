# Requirements: Scheduled AI Recaps

**Defined:** 2026-01-21
**Core Value:** Users receive automated AI summaries of channel activity on their schedule

## v1 Requirements

Requirements for initial release. Each maps to roadmap phases.

### Scheduling

- [ ] **SCHED-01**: User can select specific days of week for scheduled recap (M/T/W/Th/F/Sa/Su)
- [ ] **SCHED-02**: User can set time of day for scheduled recap delivery
- [ ] **SCHED-03**: User can select time period to cover (previous day, last 3 days, last 7 days)
- [ ] **SCHED-04**: Scheduled recaps run at the correct time in user's timezone
- [ ] **SCHED-05**: User can create immediate "run once" recap (preserves existing behavior)
- [ ] **SCHED-06**: User can add custom instructions for the AI agent
- [ ] **SCHED-07**: User can see when scheduled recap will next run

### Management

- [ ] **MGMT-01**: User can view list of scheduled recaps in "Scheduled" tab
- [ ] **MGMT-02**: User can edit an existing scheduled recap
- [ ] **MGMT-03**: User can delete a scheduled recap
- [ ] **MGMT-04**: User can pause a scheduled recap
- [ ] **MGMT-05**: User can resume a paused scheduled recap
- [ ] **MGMT-06**: User can see status indicator (active/paused) for each scheduled recap
- [ ] **MGMT-07**: User can see when scheduled recap last ran
- [ ] **MGMT-08**: User can see total run count for scheduled recap

### Backend Infrastructure

- [x] **INFRA-01**: Database schema stores scheduled recap configuration
- [x] **INFRA-02**: Database schema stores schedule state (NextRunAt, LastRunAt, RunCount)
- [ ] **INFRA-03**: Job server polls for and executes due scheduled recaps
- [ ] **INFRA-04**: Job execution is cluster-aware (no duplicate runs)
- [x] **INFRA-05**: API endpoint to create scheduled recap
- [x] **INFRA-06**: API endpoint to update scheduled recap
- [x] **INFRA-07**: API endpoint to delete scheduled recap
- [x] **INFRA-08**: API endpoint to pause/resume scheduled recap
- [x] **INFRA-09**: API endpoint to list scheduled recaps
- [x] **INFRA-10**: NextRunAt is computed correctly with timezone/DST handling

### Frontend - Wizard

- [ ] **WIZD-01**: Step 1 shows recap name input and type selection
- [ ] **WIZD-02**: Step 2 shows channel selector (for "selected channels" type)
- [ ] **WIZD-03**: Step 2 shows unread channel list (for "all unreads" type)
- [ ] **WIZD-04**: Step 3 shows schedule configuration (day, time, period)
- [ ] **WIZD-05**: Step 3 shows "run once" checkbox option
- [ ] **WIZD-06**: Step 3 shows custom instructions textarea
- [ ] **WIZD-07**: Wizard submits and creates scheduled recap via API

### Frontend - Scheduled Tab

- [ ] **TAB-01**: "Scheduled" tab appears alongside "Unread" and "Read" tabs
- [ ] **TAB-02**: Scheduled tab displays list of user's scheduled recaps
- [ ] **TAB-03**: Each scheduled recap shows name, schedule, status, last run, run count
- [ ] **TAB-04**: Each scheduled recap has edit action
- [ ] **TAB-05**: Each scheduled recap has pause/resume toggle
- [ ] **TAB-06**: Each scheduled recap has delete action
- [ ] **TAB-07**: Edit action opens pre-filled wizard modal

## v2 Requirements

Deferred to future release. Tracked but not in current roadmap.

### Topic-Based Recaps

- **TOPIC-01**: User can create recaps based on topics instead of channels
- **TOPIC-02**: User can enter multiple topics for a single recap
- **TOPIC-03**: AI searches across channels for topic-relevant messages

### Advanced Features

- **ADV-01**: User receives push notification when scheduled recap is ready
- **ADV-02**: User can set channel limit per scheduled recap
- **ADV-03**: User can duplicate an existing scheduled recap

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Topic-based recaps | Deferred to v2; requires additional AI prompt engineering |
| Full cron expressions | Day/time picker covers 95% of use cases; cron adds complexity |
| Multiple schedules per recap | Users can create multiple scheduled recaps instead |
| Custom time periods | Three options (1d, 3d, 7d) cover typical needs |
| Real-time notifications | Existing unread badge pattern is sufficient for v1 |
| Mobile-specific UI | Web-first; mobile uses responsive web view |
| Catch-up for missed schedules | If server was down, just run next scheduled time |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| INFRA-01 | Phase 1 | Complete |
| INFRA-02 | Phase 1 | Complete |
| INFRA-10 | Phase 1 | Complete |
| INFRA-05 | Phase 2 | Complete |
| INFRA-06 | Phase 2 | Complete |
| INFRA-07 | Phase 2 | Complete |
| INFRA-08 | Phase 2 | Complete |
| INFRA-09 | Phase 2 | Complete |
| INFRA-03 | Phase 3 | Pending |
| INFRA-04 | Phase 3 | Pending |
| SCHED-04 | Phase 3 | Pending |
| TAB-01 | Phase 4 | Pending |
| TAB-02 | Phase 4 | Pending |
| TAB-03 | Phase 4 | Pending |
| TAB-04 | Phase 4 | Pending |
| TAB-05 | Phase 4 | Pending |
| TAB-06 | Phase 4 | Pending |
| TAB-07 | Phase 4 | Pending |
| MGMT-01 | Phase 4 | Pending |
| MGMT-02 | Phase 4 | Pending |
| MGMT-03 | Phase 4 | Pending |
| MGMT-04 | Phase 4 | Pending |
| MGMT-05 | Phase 4 | Pending |
| MGMT-06 | Phase 4 | Pending |
| MGMT-07 | Phase 4 | Pending |
| MGMT-08 | Phase 4 | Pending |
| WIZD-01 | Phase 5 | Pending |
| WIZD-02 | Phase 5 | Pending |
| WIZD-03 | Phase 5 | Pending |
| WIZD-04 | Phase 5 | Pending |
| WIZD-05 | Phase 5 | Pending |
| WIZD-06 | Phase 5 | Pending |
| WIZD-07 | Phase 5 | Pending |
| SCHED-01 | Phase 5 | Pending |
| SCHED-02 | Phase 5 | Pending |
| SCHED-03 | Phase 5 | Pending |
| SCHED-05 | Phase 5 | Pending |
| SCHED-06 | Phase 5 | Pending |
| SCHED-07 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 39 total
- Mapped to phases: 39 ✓
- Unmapped: 0

---
*Requirements defined: 2026-01-21*
*Last updated: 2026-01-21 (Phase 2 requirements complete)*
