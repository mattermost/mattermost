Push Notification Rules for Status Log Dashboard

Overview

Add the ability for system admins to configure push notification rules in the Status Log Dashboard. When a watched user's status changes or activity is updated, specified recipients  
 receive push notifications.

User Requirements

- System admins can create/edit/delete notification rules
- Rules specify: watched user, single recipient, event types
- Granular event filtering - specific triggers like:
    - Status: "User went Online", "User went Offline", etc.
    - Activity: "User sent a message", "User viewed channel", etc.
- Push notifications sent to mobile devices when rules trigger
- Standard message format based on event type (no custom templates)

---

Implementation Plan

Phase 1: Database Schema

New Table: status_notification_rules

Create migration files:

- server/channels/db/migrations/postgres/000155_create_status_notification_rules.up.sql
- server/channels/db/migrations/postgres/000155_create_status_notification_rules.down.sql
- server/channels/db/migrations/mysql/000155_create_status_notification_rules.up.sql
- server/channels/db/migrations/mysql/000155_create_status_notification_rules.down.sql

CREATE TABLE statusnotificationrules (
id VARCHAR(26) PRIMARY KEY,
name VARCHAR(128) NOT NULL,
enabled BOOLEAN DEFAULT TRUE,
watcheduserid VARCHAR(26) NOT NULL, -- User to watch
recipientuserid VARCHAR(26) NOT NULL, -- Who gets notified
eventfilters VARCHAR(512) DEFAULT '', -- Comma-separated event types (see below)
createat BIGINT NOT NULL,
updateat BIGINT NOT NULL,
deleteat BIGINT DEFAULT 0,
createdby VARCHAR(26) NOT NULL
);

CREATE INDEX idx_statusnotificationrules_watcheduserid ON statusnotificationrules(watcheduserid);
CREATE INDEX idx_statusnotificationrules_enabled ON statusnotificationrules(enabled) WHERE deleteat = 0;

Event Filter Options (stored comma-separated in eventfilters):
┌───────────────────────┬───────────────────────┬───────────────────────────────────────────────────┐
│ Filter Value │ Description │ Matches │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ Status Changes │ │ │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ status_online │ User went Online │ LogType=status_change, NewStatus=online │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ status_away │ User went Away │ LogType=status_change, NewStatus=away │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ status_dnd │ User went DND │ LogType=status_change, NewStatus=dnd │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ status_offline │ User went Offline │ LogType=status_change, NewStatus=offline │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ status_any │ Any status change │ LogType=status_change │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ Activity Events │ │ │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ activity_message │ User sent a message │ LogType=activity, Trigger contains "Sent message" │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ activity_channel_view │ User viewed a channel │ LogType=activity, Trigger contains "Loaded #" │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ activity_window_focus │ User focused window │ LogType=activity, Reason=window_focus │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ activity_any │ Any activity event │ LogType=activity │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ Catch-all │ │ │
├───────────────────────┼───────────────────────┼───────────────────────────────────────────────────┤
│ all │ All events │ Any log entry │
└───────────────────────┴───────────────────────┴───────────────────────────────────────────────────┘
Example: eventfilters = "status_online,status_offline,activity_message" → Notify when user goes online, offline, or sends a message.

Phase 2: Data Model

New File: server/public/model/status_notification_rule.go

type StatusNotificationRule struct {
Id string `json:"id"`
Name string `json:"name"`
Enabled bool `json:"enabled"`
WatchedUserID string `json:"watched_user_id"`
RecipientUserID string `json:"recipient_user_id"`
EventFilters string `json:"event_filters"` // Comma-separated: "status_online,activity_message"
CreateAt int64 `json:"create_at"`
UpdateAt int64 `json:"update_at"`
DeleteAt int64 `json:"delete_at"`
CreatedBy string `json:"created_by"`
}

// Constants for event filters
const (
StatusNotificationFilterStatusOnline = "status_online"
StatusNotificationFilterStatusAway = "status_away"
StatusNotificationFilterStatusDND = "status_dnd"
StatusNotificationFilterStatusOffline = "status_offline"
StatusNotificationFilterStatusAny = "status_any"
StatusNotificationFilterActivityMessage = "activity_message"
StatusNotificationFilterActivityChannelView = "activity_channel_view"
StatusNotificationFilterActivityWindowFocus = "activity_window_focus"
StatusNotificationFilterActivityAny = "activity_any"
StatusNotificationFilterAll = "all"
)

// Helper methods
func (r *StatusNotificationRule) IsValid() *AppError
func (r *StatusNotificationRule) PreSave()
func (r *StatusNotificationRule) PreUpdate()
func (r *StatusNotificationRule) GetEventFilters() []string // Split comma-separated
func (r *StatusNotificationRule) MatchesLog(log \*StatusLog) bool // Check if log matches any filter

Phase 3: Store Layer

New File: server/channels/store/sqlstore/status_notification_rule_store.go

Interface methods:

- Save(rule *model.StatusNotificationRule) (*model.StatusNotificationRule, error)
- Update(rule *model.StatusNotificationRule) (*model.StatusNotificationRule, error)
- Get(id string) (\*model.StatusNotificationRule, error)
- GetAll() ([]\*model.StatusNotificationRule, error)
- GetByWatchedUser(userID string) ([]\*model.StatusNotificationRule, error) - Critical for performance
- Delete(id string) error (soft delete)

Store interface: server/channels/store/store.go - Add StatusNotificationRule() StatusNotificationRuleStore

Phase 4: App Layer

Modify: server/channels/app/platform/status_logs.go

Add rule checking in LogStatusChange() and LogActivityUpdate():

// After logging, check notification rules
rules, err := ps.Store.StatusNotificationRule().GetByWatchedUser(userID)
if err == nil && len(rules) > 0 {
go ps.processStatusNotificationRules(rctx, rules, statusLog)
}

func (ps *PlatformService) processStatusNotificationRules(rctx request.CTX, rules []*model.StatusNotificationRule, log \*model.StatusLog) {
for \_, rule := range rules {
if !rule.Enabled || rule.DeleteAt > 0 {
continue
}
if !rule.MatchesEvent(log.LogType, log.NewStatus) {
continue
}
ps.sendStatusNotificationPush(rctx, rule, log)
}
}

New method for sending push:
func (ps *PlatformService) sendStatusNotificationPush(rctx request.CTX, rule *model.StatusNotificationRule, log \*model.StatusLog) {
// Build message based on event type
var message string
switch log.LogType {
case "status_change":
message = fmt.Sprintf("%s is now %s", log.Username, log.NewStatus)
case "activity":
if strings.Contains(log.Trigger, "Sent message") {
message = fmt.Sprintf("%s sent a message", log.Username)
} else if strings.Contains(log.Trigger, "Loaded #") {
message = fmt.Sprintf("%s viewed a channel", log.Username)
} else {
message = fmt.Sprintf("%s: %s", log.Username, log.Trigger)
}
}

     msg := &model.PushNotification{
         Type:       model.PushTypeMessage,
         Version:    model.PushMessageV2,
         Message:    message,
         SenderName: "Status Alert",
         // ... other fields
     }
     ps.sendPushNotificationToAllSessions(rctx, msg, rule.RecipientUserID, "")

}

Phase 5: API Layer

Modify: server/channels/api4/status_log.go

Add CRUD endpoints:

// In InitStatusLog():
api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules", api.APISessionRequired(getStatusNotificationRules)).Methods("GET")
api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules", api.APISessionRequired(createStatusNotificationRule)).Methods("POST")
api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(getStatusNotificationRule)).Methods("GET")
api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(updateStatusNotificationRule)).Methods("PUT")
api.BaseRoutes.APIRoot.Handle("/status_logs/notification_rules/{rule_id:[A-Za-z0-9]+}", api.APISessionRequired(deleteStatusNotificationRule)).Methods("DELETE")

All endpoints require PermissionManageSystem.

Phase 6: Client API

Modify: webapp/platform/client/src/client4.ts

// Routes
getStatusNotificationRulesRoute = () => `${this.getStatusLogsRoute()}/notification_rules`;

// Methods
getStatusNotificationRules(): Promise<StatusNotificationRule[]>
createStatusNotificationRule(rule: StatusNotificationRule): Promise<StatusNotificationRule>
updateStatusNotificationRule(rule: StatusNotificationRule): Promise<StatusNotificationRule>
deleteStatusNotificationRule(ruleId: string): Promise<StatusOK>

Phase 7: Admin Console UI

Modify: webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.tsx

Add a "Notification Rules" tab/section with:

1.  Rules List Table

- Name, Watched User, Recipient, Event Types, Status Filters, Enabled toggle
- Edit/Delete actions per row

2.  Add Rule Dialog/Form

- Name input
- Watched User selector (user autocomplete)
- Recipient selector (user autocomplete)
- Event Filters (multi-select checkboxes grouped by category):

Status Changes:
[ ] Went Online
[ ] Went Away
[ ] Went DND
[ ] Went Offline
[ ] Any Status Change

Activity Events:
[ ] Sent a Message
[ ] Viewed a Channel
[ ] Focused Window
[ ] Any Activity

[ ] All Events (overrides above)

- Save/Cancel buttons

3.  Edit Rule Dialog (similar to Add)

UI can be a separate component: status_notification_rules.tsx

---

Key Files to Modify

Server
┌──────────────────────────────────────────────────────────────────┬──────────────────────────────┐
│ File │ Changes │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/db/migrations/postgres/000155*\*.sql │ New table schema │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/db/migrations/mysql/000155*\*.sql │ New table schema │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/public/model/status_notification_rule.go │ New model │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/store/store.go │ Add interface │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/store/sqlstore/status_notification_rule_store.go │ New store │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/store/sqlstore/store.go │ Register store │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/app/platform/status_logs.go │ Rule checking + push sending │
├──────────────────────────────────────────────────────────────────┼──────────────────────────────┤
│ server/channels/api4/status_log.go │ CRUD endpoints │
└──────────────────────────────────────────────────────────────────┴──────────────────────────────┘
Webapp
┌─────────────────────────────────────────────────────────────────────────────────────────────────┬─────────────────────┐
│ File │ Changes │
├─────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────┤
│ webapp/platform/client/src/client4.ts │ API methods │
├─────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────┤
│ webapp/channels/src/components/admin_console/status_log_dashboard/status_log_dashboard.tsx │ Add Rules tab │
├─────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────────────┤
│ webapp/channels/src/components/admin_console/status_log_dashboard/status_notification_rules.tsx │ New rules component │
└─────────────────────────────────────────────────────────────────────────────────────────────────┴─────────────────────┘

---

Configuration

Add to MattermostExtendedStatusesSettings:

- EnableStatusNotificationRules \*bool (default: true when EnableStatusLogs is true)
- MaxStatusNotificationRules \*int (default: 50, limit per instance)

---

Verification Plan

1.  Database: Run migrations, verify table exists with correct schema
2.  API Testing:

- Create rule via POST
- Get rules via GET
- Update rule via PUT
- Delete rule via DELETE

3.  Notification Testing:

- Create rule: watch User A, notify User B when User A goes offline
- Have User A go offline
- Verify User B receives push notification on mobile

4.  UI Testing:

- Navigate to System Console → Status Logs
- Create/edit/delete rules through UI
- Verify changes persist

---

Timeline Estimate

1.  Database schema + model: 30 min
2.  Store layer: 45 min
3.  App layer (rule checking + push): 1 hour
4.  API layer: 45 min
5.  Client API: 20 min
6.  Admin Console UI: 1.5 hours
7.  Testing & fixes: 1 hour

Total: ~5-6 hours
