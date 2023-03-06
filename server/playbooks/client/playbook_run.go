package client

import (
	"time"

	"gopkg.in/guregu/null.v4"
)

// Me is a constant that refers to the current user, and can be used in various APIs in place of
// explicitly specifying the current user's id.
const Me = "me"

// PlaybookRun represents a playbook run.
type PlaybookRun struct {
	ID                                      string          `json:"id"`
	Name                                    string          `json:"name"`
	Summary                                 string          `json:"summary"`
	SummaryModifiedAt                       int64           `json:"summary_modified_at"`
	OwnerUserID                             string          `json:"owner_user_id"`
	ReporterUserID                          string          `json:"reporter_user_id"`
	TeamID                                  string          `json:"team_id"`
	ChannelID                               string          `json:"channel_id"`
	CreateAt                                int64           `json:"create_at"`
	EndAt                                   int64           `json:"end_at"`
	DeleteAt                                int64           `json:"delete_at"`
	ActiveStage                             int             `json:"active_stage"`
	ActiveStageTitle                        string          `json:"active_stage_title"`
	PostID                                  string          `json:"post_id"`
	PlaybookID                              string          `json:"playbook_id"`
	Checklists                              []Checklist     `json:"checklists"`
	StatusPosts                             []StatusPost    `json:"status_posts"`
	CurrentStatus                           string          `json:"current_status"`
	LastStatusUpdateAt                      int64           `json:"last_status_update_at"`
	ReminderPostID                          string          `json:"reminder_post_id"`
	PreviousReminder                        time.Duration   `json:"previous_reminder"`
	ReminderTimerDefaultSeconds             int64           `json:"reminder_timer_default_seconds"`
	StatusUpdateEnabled                     bool            `json:"status_update_enabled"`
	BroadcastChannelIDs                     []string        `json:"broadcast_channel_ids"`
	WebhookOnStatusUpdateURLs               []string        `json:"webhook_on_status_update_urls"`
	StatusUpdateBroadcastChannelsEnabled    bool            `json:"status_update_broadcast_channels_enabled"`
	StatusUpdateBroadcastWebhooksEnabled    bool            `json:"status_update_broadcast_webhooks_enabled"`
	ReminderMessageTemplate                 string          `json:"reminder_message_template"`
	InvitedUserIDs                          []string        `json:"invited_user_ids"`
	InvitedGroupIDs                         []string        `json:"invited_group_ids"`
	TimelineEvents                          []TimelineEvent `json:"timeline_events"`
	DefaultOwnerID                          string          `json:"default_owner_id"`
	WebhookOnCreationURLs                   []string        `json:"webhook_on_creation_urls"`
	Retrospective                           string          `json:"retrospective"`
	RetrospectivePublishedAt                int64           `json:"retrospective_published_at"`
	RetrospectiveWasCanceled                bool            `json:"retrospective_was_canceled"`
	RetrospectiveReminderIntervalSeconds    int64           `json:"retrospective_reminder_interval_seconds"`
	RetrospectiveEnabled                    bool            `json:"retrospective_enabled"`
	MessageOnJoin                           string          `json:"message_on_join"`
	ParticipantIDs                          []string        `json:"participant_ids"`
	CategoryName                            string          `json:"category_name"`
	MetricsData                             []RunMetricData `json:"metrics_data"`
	CreateChannelMemberOnNewParticipant     bool            `json:"create_channel_member_on_new_participant"`
	RemoveChannelMemberOnRemovedParticipant bool            `json:"remove_channel_member_on_removed_participant"`
}

// StatusPost is information added to the playbook run when selecting from the db and sent to the
// client; it is not saved to the db.
type StatusPost struct {
	ID       string `json:"id"`
	CreateAt int64  `json:"create_at"`
	DeleteAt int64  `json:"delete_at"`
}

// StatusPostComplete is the complete status update (post)
// it's similar to StatusPost but with extended info.
type StatusPostComplete struct {
	Id             string `json:"id"`
	CreateAt       int64  `json:"create_at"`
	UpdateAt       int64  `json:"update_at"`
	DeleteAt       int64  `json:"delete_at"`
	Message        string `json:"message"`
	AuthorUserName string `json:"author_user_name"`
}

// Metadata tracks ancillary metadata about a playbook run.
type Metadata struct {
	ChannelName        string   `json:"channel_name"`
	ChannelDisplayName string   `json:"channel_display_name"`
	TeamName           string   `json:"team_name"`
	NumParticipants    int64    `json:"num_participants"`
	TotalPosts         int64    `json:"total_posts"`
	Followers          []string `json:"followers"`
}

// TimelineEventType describes a type of timeline event.
type TimelineEventType string

const (
	PlaybookRunCreated     TimelineEventType = "incident_created"
	TaskStateModified      TimelineEventType = "task_state_modified"
	StatusUpdated          TimelineEventType = "status_updated"
	StatusUpdateRequested  TimelineEventType = "status_update_requested"
	OwnerChanged           TimelineEventType = "owner_changed"
	AssigneeChanged        TimelineEventType = "assignee_changed"
	RanSlashCommand        TimelineEventType = "ran_slash_command"
	EventFromPost          TimelineEventType = "event_from_post"
	UserJoinedLeft         TimelineEventType = "user_joined_left"
	PublishedRetrospective TimelineEventType = "published_retrospective"
	CanceledRetrospective  TimelineEventType = "canceled_retrospective"
	RunFinished            TimelineEventType = "run_finished"
	RunRestored            TimelineEventType = "run_restored"
	StatusUpdatesEnabled   TimelineEventType = "status_updates_enabled"
	StatusUpdatesDisabled  TimelineEventType = "status_updates_disabled"
)

// TimelineEvent represents an event recorded to a playbook run's timeline.
type TimelineEvent struct {
	ID            string            `json:"id"`
	PlaybookRunID string            `json:"playbook_run"`
	CreateAt      int64             `json:"create_at"`
	DeleteAt      int64             `json:"delete_at"`
	EventAt       int64             `json:"event_at"`
	EventType     TimelineEventType `json:"event_type"`
	Summary       string            `json:"summary"`
	Details       string            `json:"details"`
	PostID        string            `json:"post_id"`
	SubjectUserID string            `json:"subject_user_id"`
	CreatorUserID string            `json:"creator_user_id"`
}

// PlaybookRunCreateOptions specifies the parameters for PlaybookRunService.Create method.
type PlaybookRunCreateOptions struct {
	Name            string `json:"name"`
	OwnerUserID     string `json:"owner_user_id"`
	TeamID          string `json:"team_id"`
	ChannelID       string `json:"channel_id"`
	Description     string `json:"description"`
	PostID          string `json:"post_id"`
	PlaybookID      string `json:"playbook_id"`
	CreatePublicRun *bool  `json:"create_public_run"`
	Type            string `json:"type"`
}

// RunAction represents the run action settings. Frontend passes this struct to update settings.
type RunAction struct {
	BroadcastChannelIDs       []string `json:"broadcast_channel_ids"`
	WebhookOnStatusUpdateURLs []string `json:"webhook_on_status_update_urls"`

	StatusUpdateBroadcastChannelsEnabled bool `json:"status_update_broadcast_channels_enabled"`
	StatusUpdateBroadcastWebhooksEnabled bool `json:"status_update_broadcast_webhooks_enabled"`
}

// RetrospectiveUpdate represents the run retrospective info
type RetrospectiveUpdate struct {
	Text    string          `json:"retrospective"`
	Metrics []RunMetricData `json:"metrics"`
}

// Sort enumerates the available fields we can sort on.
type Sort string

const (
	// SortByCreateAt sorts by the "create_at" field. It is the default.
	SortByCreateAt Sort = "create_at"

	// SortByID sorts by the "id" field.
	SortByID Sort = "id"

	// SortByName sorts by the "name" field.
	SortByName Sort = "name"

	// SortByOwnerUserID sorts by the "owner_user_id" field.
	SortByOwnerUserID Sort = "owner_user_id"

	// SortByTeamID sorts by the "team_id" field.
	SortByTeamID Sort = "team_id"

	// SortByEndAt sorts by the "end_at" field.
	SortByEndAt Sort = "end_at"

	// SortBySteps sorts playbooks by the number of steps in the playbook.
	SortBySteps Sort = "steps"

	// SortByStages sorts playbooks by the number of stages in the playbook.
	SortByStages Sort = "stages"

	// SortByTitle sorts by the "title" field.
	SortByTitle Sort = "title"

	// SortByRuns sorts by the number of times a playbook has been run.
	SortByRuns Sort = "runs"
)

// SortDirection determines whether results are sorted ascending or descending.
type SortDirection string

const (
	// Desc sorts the results in descending order.
	SortDesc SortDirection = "desc"

	// Asc sorts the results in ascending order.
	SortAsc SortDirection = "asc"
)

// PlaybookRunListOptions specifies the optional parameters to the
// PlaybookRunService.List method.
type PlaybookRunListOptions struct {
	// TeamID filters playbook runs to those in the given team.
	TeamID string `url:"team_id,omitempty"`

	Sort      Sort          `url:"sort,omitempty"`
	Direction SortDirection `url:"direction,omitempty"`

	// Statuses filters by InProgress or Ended; defaults to All when no status specified.
	Statuses []Status `url:"statuses,omitempty"`

	// OwnerID filters by owner's Mattermost user ID. Defaults to blank (no filter). Specify "me" for current user.
	OwnerID string `url:"owner_user_id,omitempty"`

	// ParticipantID filters playbook runs that have this user as a participant. Defaults to blank (no filter). Specify "me" for current user.
	ParticipantID string `url:"participant_id,omitempty"`

	// ParticipantOrFollowerID filters playbook runs that have this user as member or as follower. Defaults to blank (no filter). Specify "me" for current user.
	ParticipantOrFollowerID string `url:"participant_or_follower,omitempty"`

	// SearchTerm returns results of the search term and respecting the other header filter options.
	// The search term acts as a filter and respects the Sort and Direction fields (i.e., results are
	// not returned in relevance order).
	SearchTerm string `url:"search_term,omitempty"`

	// PlaybookID filters playbook runs that are derived from this playbook id.
	// Defaults to blank (no filter).
	PlaybookID string `url:"playbook_id,omitempty"`

	// ActiveGTE filters playbook runs that were active after (or equal) to the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	ActiveGTE int64 `url:"active_gte,omitempty"`

	// ActiveLT filters playbook runs that were active before the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	ActiveLT int64 `url:"active_lt,omitempty"`

	// StartedGTE filters playbook runs that were started after (or equal) to the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	StartedGTE int64 `url:"started_gte,omitempty"`

	// StartedLT filters playbook runs that were started before the unix time given (in millis).
	// A value of 0 means the filter is ignored (which is the default).
	StartedLT int64 `url:"started_lt,omitempty"`
}

// PlaybookRunList contains the paginated result.
type PlaybookRunList struct {
	TotalCount int  `json:"total_count"`
	PageCount  int  `json:"page_count"`
	HasMore    bool `json:"has_more"`
	Items      []*PlaybookRun
}

// Status is the type used to specify the activity status of the playbook run.
type Status string

const (
	StatusInProgress Status = "InProgress"
	StatusFinished   Status = "Finished"
)

type GetPlaybookRunsResults struct {
	TotalCount int           `json:"total_count"`
	PageCount  int           `json:"page_count"`
	HasMore    bool          `json:"has_more"`
	Items      []PlaybookRun `json:"items"`
}

// StatusUpdateOptions are the fields required to update a playbook run's status
type StatusUpdateOptions struct {
	Message   string        `json:"message"`
	Reminder  time.Duration `json:"reminder"`
	FinishRun bool          `json:"finish_run"`
}

type RunMetricData struct {
	MetricConfigID string   `json:"metric_config_id"`
	Value          null.Int `json:"value"`
}

// OwnerInfo holds the summary information of a owner.
type OwnerInfo struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
}
