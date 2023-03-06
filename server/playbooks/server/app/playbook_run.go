package app

import (
	"encoding/json"
	"strings"
	"time"

	"gopkg.in/guregu/null.v4"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/product/pluginapi/cluster"
)

const (
	StatusInProgress = "InProgress"
	StatusFinished   = "Finished"
)

const (
	RunRoleMember = "run_member"
	RunRoleAdmin  = "run_admin"
)

const (
	RunSourcePost   = "post"
	RunSourceDialog = "dialog"
)

const (
	RunTypePlaybook         = "playbook"
	RunTypeChannelChecklist = "channelChecklist"
)

// PlaybookRun holds the detailed information of a playbook run.
//
// NOTE: When adding a column to the db, search for "When adding a PlaybookRun column" to see where
// that column needs to be added in the sqlstore code.
type PlaybookRun struct {
	// ID is the unique identifier of the playbook run.
	ID string `json:"id"`

	// Name is the name of the playbook run's channel.
	Name string `json:"name"`

	// Summary is a short string, in Markdown, describing what the run is.
	Summary string `json:"summary"`

	// SummaryModifiedAt is date when the summary was modified
	SummaryModifiedAt int64 `json:"summary_modified_at"`

	// OwnerUserID is the user identifier of the playbook run's owner.
	OwnerUserID string `json:"owner_user_id"`

	// ReporterUserID is the user identifier of the playbook run's reporter; i.e., the user that created the run.
	ReporterUserID string `json:"reporter_user_id"`

	// TeamID is the identifier of the team the playbook run lives in.
	TeamID string `json:"team_id"`

	// ChannelID is the identifier of the playbook run's channel.
	ChannelID string `json:"channel_id"`

	// CreateAt is the timestamp, in milliseconds since epoch, of when the playbook run was created.
	CreateAt int64 `json:"create_at"`

	// EndAt is the timestamp, in milliseconds since epoch, of when the playbook run was ended.
	// If 0, the run is still ongoing.
	EndAt int64 `json:"end_at"`

	// Deprecated: preserved for backwards compatibility with v1.2.
	DeleteAt int64 `json:"delete_at"`

	// Deprecated: preserved for backwards compatibility with v1.2.
	ActiveStage int `json:"active_stage"`

	// Deprecated: preserved for backwards compatibility with v1.2.
	ActiveStageTitle string `json:"active_stage_title"`

	// PostID, if not empty, is the identifier of the post from which this playbook run was originally created.
	PostID string `json:"post_id"`

	// PlaybookID is the identifier of the playbook from which this run was created.
	PlaybookID string `json:"playbook_id"`

	// Checklists is an array of the checklists in the run.
	Checklists []Checklist `json:"checklists"`

	// StatusPosts is an array of all the status updates posted in the run.
	StatusPosts []StatusPost `json:"status_posts"`

	// CurrentStatus is the current status of the playbook run.
	// It can be StatusInProgress ("InProgress") or StatusFinished ("Finished")
	CurrentStatus string `json:"current_status"`

	// LastStatusUpdateAt is the timestamp, in milliseconds since epoch, of the time the last
	// status update was posted.
	LastStatusUpdateAt int64 `json:"last_status_update_at"`

	// ReminderPostID, if not empty, is the identifier of the reminder posted to the channel to
	// update the status.
	ReminderPostID string `json:"reminder_post_id"`

	// PreviousReminder, if not empty, is the time.Duration (nanoseconds) at which the next
	// scheduled status update will be posted.
	PreviousReminder time.Duration `json:"previous_reminder"`

	// ReminderMessageTemplate, if not empty, is the template shown when updating the status of the
	// playbook run for the first time.
	ReminderMessageTemplate string `json:"reminder_message_template"`

	// ReminderTimerDefaultSeconds is the expected default interval, in seconds,
	// between every status update
	ReminderTimerDefaultSeconds int64 `json:"reminder_timer_default_seconds"`

	//Defines if status update functionality is enabled
	StatusUpdateEnabled bool `json:"status_update_enabled"`

	// InvitedUserIDs, if not empty, is an array containing the identifiers of the users that were
	// automatically invited to the playbook run when it was created.
	InvitedUserIDs []string `json:"invited_user_ids"`

	// InvitedGroupIDs, if not empty, is an array containing the identifiers of the user groups that
	// were automatically invited to the playbook run when it was created.
	InvitedGroupIDs []string `json:"invited_group_ids"`

	// TimelineEvents is an array of the events saved to the timeline of the playbook run.
	TimelineEvents []TimelineEvent `json:"timeline_events"`

	// DefaultOwnerID, if not empty, is the identifier of the user that was automatically assigned
	// as owner of the playbook run when it was created.
	DefaultOwnerID string `json:"default_owner_id"`

	// BroadcastChannelIDs is an array of the identifiers of the channels where the playbook run
	// creation and status updates are announced.
	BroadcastChannelIDs []string `json:"broadcast_channel_ids"`

	// WebhookOnCreationURLs, if not empty, is the URL to which a POST request is made with the whole
	// playbook run as payload when the run is created.
	WebhookOnCreationURLs []string `json:"webhook_on_creation_urls"`

	// WebhookOnStatusUpdateURLs, if not empty, is the URL to which a POST request is made with the
	// whole playbook run as payload every time the status of the playbook run is updated.
	WebhookOnStatusUpdateURLs []string `json:"webhook_on_status_update_urls"`

	// StatusUpdateBroadcastChannelsEnabled is true if the channels broadcast action is enabled for
	// the run status update event, false otherwise.
	StatusUpdateBroadcastChannelsEnabled bool `json:"status_update_broadcast_channels_enabled"`

	// StatusUpdateBroadcastWebhooksEnabled is true if the webhooks broadcast action is enabled for
	// the run status update event, false otherwise.
	StatusUpdateBroadcastWebhooksEnabled bool `json:"status_update_broadcast_webhooks_enabled"`

	// Retrospective is a string containing the currently saved retrospective.
	// If RetrospectivePublishedAt is different than 0, this is the final published retrospective.
	Retrospective string `json:"retrospective"`

	// RetrospectivePublishedAt is the timestamp, in milliseconds since epoch, of the last time a
	// retrospective was published. If 0, the retrospective has not been published yet.
	RetrospectivePublishedAt int64 `json:"retrospective_published_at"`

	// RetrospectiveWasCanceled is true if the retrospective was cancelled, false otherwise.
	RetrospectiveWasCanceled bool `json:"retrospective_was_canceled"`

	// RetrospectiveReminderIntervalSeconds is the interval, in seconds, between subsequent reminders
	// to fill the retrospective.
	RetrospectiveReminderIntervalSeconds int64 `json:"retrospective_reminder_interval_seconds"`

	// Defines if retrospective functionality is enabled
	RetrospectiveEnabled bool `json:"retrospective_enabled"`

	// MessageOnJoin, if not empty, is the message shown to every user that joins the channel of
	// the playbook run.
	MessageOnJoin string `json:"message_on_join"`

	// ParticipantIDs is an array of the identifiers of all the participants in the playbook run.
	// A participant is any member of the playbook run channel that isn't a bot.
	ParticipantIDs []string `json:"participant_ids"`

	// CategoryName, if not empty, is the name of the category where the run channel will live.
	CategoryName string `json:"category_name"`

	// Playbook run metric values
	MetricsData []RunMetricData `json:"metrics_data"`

	// CreateChannelMemberOnNewParticipant is the Run action flag that defines if a new channel member will be added
	// to the run's channel when a new participant is added to the run (by themselve or by other members).
	CreateChannelMemberOnNewParticipant bool `json:"create_channel_member_on_new_participant" export:"create_channel_member_on_new_participant"`

	// RemoveChannelMemberOnRemovedParticipant is the Run action flag that defines if an existent channel member will be removed
	// from the run's channel when a new participant is added to the run (by themselve or by other members).
	RemoveChannelMemberOnRemovedParticipant bool `json:"remove_channel_member_on_removed_participant" export:"create_channel_member_on_removed_participant"`

	// Type determines a type of a run.
	// It can be RunTypePlaybook ("playbook") or RunTypeChannelChecklist ("channel")
	Type string `json:"type"`
}

func (r *PlaybookRun) Clone() *PlaybookRun {
	newPlaybookRun := *r
	var newChecklists []Checklist
	for _, c := range r.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newPlaybookRun.Checklists = newChecklists

	newPlaybookRun.StatusPosts = append([]StatusPost(nil), r.StatusPosts...)
	newPlaybookRun.TimelineEvents = append([]TimelineEvent(nil), r.TimelineEvents...)
	newPlaybookRun.InvitedUserIDs = append([]string(nil), r.InvitedUserIDs...)
	newPlaybookRun.InvitedGroupIDs = append([]string(nil), r.InvitedGroupIDs...)
	newPlaybookRun.ParticipantIDs = append([]string(nil), r.ParticipantIDs...)
	newPlaybookRun.WebhookOnCreationURLs = append([]string(nil), r.WebhookOnCreationURLs...)
	newPlaybookRun.WebhookOnStatusUpdateURLs = append([]string(nil), r.WebhookOnStatusUpdateURLs...)
	newPlaybookRun.MetricsData = append([]RunMetricData(nil), r.MetricsData...)

	return &newPlaybookRun
}

func (r PlaybookRun) MarshalJSON() ([]byte, error) {
	type Alias PlaybookRun

	old := (*Alias)(r.Clone())
	// replace nils with empty slices for the frontend
	if old.Checklists == nil {
		old.Checklists = []Checklist{}
	}
	for j, cl := range old.Checklists {
		if cl.Items == nil {
			old.Checklists[j].Items = []ChecklistItem{}
		}
	}
	if old.StatusPosts == nil {
		old.StatusPosts = []StatusPost{}
	}
	if old.InvitedUserIDs == nil {
		old.InvitedUserIDs = []string{}
	}
	if old.InvitedGroupIDs == nil {
		old.InvitedGroupIDs = []string{}
	}
	if old.TimelineEvents == nil {
		old.TimelineEvents = []TimelineEvent{}
	}
	if old.ParticipantIDs == nil {
		old.ParticipantIDs = []string{}
	}
	if old.BroadcastChannelIDs == nil {
		old.BroadcastChannelIDs = []string{}
	}
	if old.WebhookOnCreationURLs == nil {
		old.WebhookOnCreationURLs = []string{}
	}
	if old.WebhookOnStatusUpdateURLs == nil {
		old.WebhookOnStatusUpdateURLs = []string{}
	}
	if old.MetricsData == nil {
		old.MetricsData = []RunMetricData{}
	}

	return json.Marshal(old)
}

// SetChecklistFromPlaybook overwrites this run's checklists with the ones in the provided playbook.
func (r *PlaybookRun) SetChecklistFromPlaybook(playbook Playbook) {
	r.Checklists = playbook.Checklists

	// Playbooks can only have due dates relative to when a run starts,
	// so we should convert them to absolute timestamp.
	now := model.GetMillis()
	for i := range r.Checklists {
		for j := range r.Checklists[i].Items {
			if r.Checklists[i].Items[j].DueDate > 0 {
				r.Checklists[i].Items[j].DueDate += now
			}
		}
	}
}

// SetConfigurationFromPlaybook overwrites this run's configuration with the data from the provided playbook,
// effectively snapshoting the playbook's configuration in this moment of time.
func (r *PlaybookRun) SetConfigurationFromPlaybook(playbook Playbook, source string) {
	// Runs created through managed dialog lack summary, and we should use the template (if enabled)
	// Runs created though new modal would have filled the summary in the webapp
	if playbook.RunSummaryTemplateEnabled && source == RunSourceDialog {
		r.Summary = playbook.RunSummaryTemplate
	}
	r.ReminderMessageTemplate = playbook.ReminderMessageTemplate
	r.StatusUpdateEnabled = playbook.StatusUpdateEnabled
	r.PreviousReminder = time.Duration(playbook.ReminderTimerDefaultSeconds) * time.Second
	r.ReminderTimerDefaultSeconds = playbook.ReminderTimerDefaultSeconds

	r.InvitedUserIDs = []string{}
	r.InvitedGroupIDs = []string{}
	if playbook.InviteUsersEnabled {
		r.InvitedUserIDs = playbook.InvitedUserIDs
		r.InvitedGroupIDs = playbook.InvitedGroupIDs
	}

	if playbook.DefaultOwnerEnabled {
		r.DefaultOwnerID = playbook.DefaultOwnerID
	}

	// Do not propagate StatusUpdateBroadcastChannelsEnabled as true if there are no channels in BroadcastChannelIDs
	r.StatusUpdateBroadcastChannelsEnabled = playbook.BroadcastEnabled && len(playbook.BroadcastChannelIDs) > 0
	r.BroadcastChannelIDs = playbook.BroadcastChannelIDs

	r.WebhookOnCreationURLs = []string{}
	if playbook.WebhookOnCreationEnabled {
		r.WebhookOnCreationURLs = playbook.WebhookOnCreationURLs
	}

	// Do not propagate StatusUpdateBroadcastWebhooksEnabled as true if there are no URLs
	r.StatusUpdateBroadcastWebhooksEnabled = playbook.WebhookOnStatusUpdateEnabled && len(playbook.WebhookOnStatusUpdateURLs) > 0
	r.WebhookOnStatusUpdateURLs = playbook.WebhookOnStatusUpdateURLs

	r.RetrospectiveEnabled = playbook.RetrospectiveEnabled
	if playbook.RetrospectiveEnabled {
		r.RetrospectiveReminderIntervalSeconds = playbook.RetrospectiveReminderIntervalSeconds
		r.Retrospective = playbook.RetrospectiveTemplate
	}

	r.CreateChannelMemberOnNewParticipant = playbook.CreateChannelMemberOnNewParticipant
	r.RemoveChannelMemberOnRemovedParticipant = playbook.RemoveChannelMemberOnRemovedParticipant

	r.Type = RunTypePlaybook
}

type StatusPost struct {
	// ID is the identifier of the post containing the status update.
	ID string `json:"id"`

	// CreateAt is the timestamp, in milliseconds since epoch, of the time this status update was
	// posted.
	CreateAt int64 `json:"create_at"`

	// DeleteAt is the timestamp, in milliseconds since epoch, of the time the post containing this
	// status update was deleted. 0 if it was never deleted.
	DeleteAt int64 `json:"delete_at"`
}

// StatusPostComplete is the "complete" representation of a status update
//
// This type is part of an effort to decopuple channels and playbooks, where
// status updates will stop being -only- Posts in a channel.
type StatusPostComplete struct {
	// ID is the identifier of the post containing the status update.
	ID string `json:"id"`

	// CreateAt is the timestamp, in milliseconds since epoch, of the time this status update was
	// posted.
	CreateAt int64 `json:"create_at"`

	// DeleteAt is the timestamp, in milliseconds since epoch, of the time the post containing this
	// status update was deleted. 0 if it was never deleted.
	DeleteAt int64 `json:"delete_at"`

	// Message is the content of the status update. It supports markdown.
	Message string `json:"message"`

	// AuthorUserName is the username of the user who sent the status update.
	AuthorUserName string `json:"author_user_name"`
}

// NewStatusPostComplete creates a StatusUpdate from a channel Post
func NewStatusPostComplete(post *model.Post) *StatusPostComplete {
	author, _ := post.GetProp("authorUsername").(string)
	return &StatusPostComplete{
		ID:             post.Id,
		CreateAt:       post.CreateAt,
		DeleteAt:       post.DeleteAt,
		Message:        post.Message,
		AuthorUserName: author,
	}
}

type UpdateOptions struct {
}

// StatusUpdateOptions encapsulates the fields that can be set when updating a playbook run's status
// NOTE: changes made to this should be reflected in the client package.
type StatusUpdateOptions struct {
	Message   string        `json:"message"`
	Reminder  time.Duration `json:"reminder"`
	FinishRun bool          `json:"finish_run"`
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

type timelineEventType string

const (
	PlaybookRunCreated     timelineEventType = "incident_created"
	TaskStateModified      timelineEventType = "task_state_modified"
	StatusUpdated          timelineEventType = "status_updated"
	StatusUpdateRequested  timelineEventType = "status_update_requested"
	OwnerChanged           timelineEventType = "owner_changed"
	AssigneeChanged        timelineEventType = "assignee_changed"
	RanSlashCommand        timelineEventType = "ran_slash_command"
	EventFromPost          timelineEventType = "event_from_post"
	UserJoinedLeft         timelineEventType = "user_joined_left"
	ParticipantsChanged    timelineEventType = "participants_changed"
	PublishedRetrospective timelineEventType = "published_retrospective"
	CanceledRetrospective  timelineEventType = "canceled_retrospective"
	RunFinished            timelineEventType = "run_finished"
	RunRestored            timelineEventType = "run_restored"
	StatusUpdateSnoozed    timelineEventType = "status_update_snoozed"
	StatusUpdatesEnabled   timelineEventType = "status_updates_enabled"
	StatusUpdatesDisabled  timelineEventType = "status_updates_disabled"
)

type TimelineEvent struct {
	// ID is the identifier of this event.
	ID string `json:"id"`

	// PlaybookRunID is the identifier of the playbook run this event lives in.
	PlaybookRunID string `json:"playbook_run_id"`

	// CreateAt is the timestamp, in milliseconds since epoch, of the time this event was created.
	CreateAt int64 `json:"create_at"`

	// DeleteAt is the timestamp, in milliseconds since epoch, of the time this event was deleted.
	// 0 if it was never deleted.
	DeleteAt int64 `json:"delete_at"`

	// EventAt is the timestamp, in milliseconds since epoch, of the actual situation this event is
	// describing.
	EventAt int64 `json:"event_at"`

	// EventType is the type of this event. It can be "incident_created", "task_state_modified",
	// "status_updated", "owner_changed", "assignee_changed", "ran_slash_command",
	// "event_from_post", "user_joined_left", "published_retrospective", "canceled_retrospective" or "status_update_snoozed".
	EventType timelineEventType `json:"event_type"`

	// Summary is a short description of the event.
	Summary string `json:"summary"`

	// Details is the longer description of the event.
	Details string `json:"details"`

	// PostID, if not empty, is the identifier of the post announcing in the channel this event
	// happened. If the event is of type "event_from_post", this is the identifier of that post.
	PostID string `json:"post_id"`

	// SubjectUserID is the identifier of the user involved in the event. For example, if the event
	// is of type "owner_changed", this is the identifier of the new owner.
	SubjectUserID string `json:"subject_user_id"`

	// CreatorUserID is the identifier of the user that created the event.
	CreatorUserID string `json:"creator_user_id"`
}

// GetPlaybookRunsResults collects the results of the GetPlaybookRuns call: the list of PlaybookRuns matching
// the HeaderFilterOptions, and the TotalCount of the matching playbook runs before paging was applied.
type GetPlaybookRunsResults struct {
	TotalCount int           `json:"total_count"`
	PageCount  int           `json:"page_count"`
	PerPage    int           `json:"per_page"`
	HasMore    bool          `json:"has_more"`
	Items      []PlaybookRun `json:"items"`
}

type SQLStatusPost struct {
	PlaybookRunID string
	PostID        string
	EndAt         int64
}

type RunMetricData struct {
	MetricConfigID string   `json:"metric_config_id"`
	Value          null.Int `json:"value"`
}

type RetrospectiveUpdate struct {
	Text    string          `json:"retrospective"`
	Metrics []RunMetricData `json:"metrics"`
}

func (r GetPlaybookRunsResults) Clone() GetPlaybookRunsResults {
	newGetPlaybookRunsResults := r

	newGetPlaybookRunsResults.Items = make([]PlaybookRun, 0, len(r.Items))
	for _, i := range r.Items {
		newGetPlaybookRunsResults.Items = append(newGetPlaybookRunsResults.Items, *i.Clone())
	}

	return newGetPlaybookRunsResults
}

func (r GetPlaybookRunsResults) MarshalJSON() ([]byte, error) {
	type Alias GetPlaybookRunsResults

	old := Alias(r.Clone())

	// replace nils with empty slices for the frontend
	if old.Items == nil {
		old.Items = []PlaybookRun{}
	}

	return json.Marshal(old)
}

// OwnerInfo holds the summary information of a owner.
type OwnerInfo struct {
	UserID    string `json:"user_id"`
	Username  string `json:"username"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Nickname  string `json:"nickname"`
}

// DialogState holds the start playbook run interactive dialog's state as it appears in the client
// and is submitted back to the server.
type DialogState struct {
	PostID       string `json:"post_id"`
	ClientID     string `json:"client_id"`
	PromptPostID string `json:"prompt_post_id"`
}

type DialogStateAddToTimeline struct {
	PostID string `json:"post_id"`
}

// RunLink represents the info needed to display and link to a run
type RunLink struct {
	PlaybookRunID string
	Name          string
}

// AssignedRun represents all the info needed to display a Run & ChecklistItem to a user
type AssignedRun struct {
	RunLink
	Tasks []AssignedTask
}

// AssignedTask represents a ChecklistItem + extra info needed to display to a user
type AssignedTask struct {
	// ID is the identifier of the containing checklist.
	ChecklistID string

	// Title is the name of the containing checklist.
	ChecklistTitle string

	ChecklistItem
}

// RunAction represents the run action settings. Frontend passes this struct to update settings.
type RunAction struct {
	BroadcastChannelIDs       []string `json:"broadcast_channel_ids"`
	WebhookOnStatusUpdateURLs []string `json:"webhook_on_status_update_urls"`

	StatusUpdateBroadcastChannelsEnabled bool `json:"status_update_broadcast_channels_enabled"`
	StatusUpdateBroadcastWebhooksEnabled bool `json:"status_update_broadcast_webhooks_enabled"`

	CreateChannelMemberOnNewParticipant     bool `json:"create_channel_member_on_new_participant"`
	RemoveChannelMemberOnRemovedParticipant bool `json:"remove_channel_member_on_removed_participant"`
}

type RunMetadata struct {
	ID     string
	Name   string
	TeamID string
}

type TopicMetadata struct {
	ID     string
	RunID  string
	TeamID string
}

const (
	ActionTypeBroadcastChannels = "broadcast_to_channels"
	ActionTypeBroadcastWebhooks = "broadcast_to_webhooks"

	TriggerTypeStatusUpdatePosted = "status_update_posted"
)

// PlaybookRunService is the playbook run service interface.
type PlaybookRunService interface {
	// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
	GetPlaybookRuns(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error)

	// CreatePlaybookRun creates a new playbook run. userID is the user who initiated the CreatePlaybookRun.
	CreatePlaybookRun(playbookRun *PlaybookRun, playbook *Playbook, userID string, public bool) (*PlaybookRun, error)

	// OpenCreatePlaybookRunDialog opens an interactive dialog to start a new playbook run.
	OpenCreatePlaybookRunDialog(teamID, ownerID, triggerID, postID, clientID string, playbooks []Playbook) error

	// OpenUpdateStatusDialog opens an interactive dialog so the user can update the playbook run's status.
	OpenUpdateStatusDialog(playbookRunID, userID, triggerID string) error

	// OpenAddToTimelineDialog opens an interactive dialog so the user can add a post to the playbook run timeline.
	OpenAddToTimelineDialog(requesterInfo RequesterInfo, postID, teamID, triggerID string) error

	// OpenAddChecklistItemDialog opens an interactive dialog so the user can add a post to the playbook run timeline.
	OpenAddChecklistItemDialog(triggerID, userID, playbookRunID string, checklist int) error

	// AddPostToTimeline adds an event based on a post to a playbook run's timeline.
	AddPostToTimeline(playbookRunID, userID, postID, summary string) error

	// RemoveTimelineEvent removes the timeline event (sets the DeleteAt to the current time).
	RemoveTimelineEvent(playbookRunID, userID, eventID string) error

	// UpdateStatus updates a playbook run's status.
	UpdateStatus(playbookRunID, userID string, options StatusUpdateOptions) error

	// OpenFinishPlaybookRunDialog opens the dialog to confirm the run should be finished.
	OpenFinishPlaybookRunDialog(playbookRunID, userID, triggerID string) error

	// FinishPlaybookRun changes a run's state to Finished. If run is already in Finished state, the call is a noop.
	FinishPlaybookRun(playbookRunID, userID string) error

	// ToggleStatusUpdates  enables or disables status update for the run
	ToggleStatusUpdates(playbookRunID, userID string, enable bool) error

	// GetPlaybookRun gets a playbook run by ID. Returns error if it could not be found.
	GetPlaybookRun(playbookRunID string) (*PlaybookRun, error)

	// GetPlaybookRunMetadata gets ancillary metadata about a playbook run.
	GetPlaybookRunMetadata(playbookRunID string) (*Metadata, error)

	// GetPlaybookRunsForChannelByUser get the playbookRuns associated with this channel and user.
	GetPlaybookRunsForChannelByUser(channelID string, userID string) ([]PlaybookRun, error)

	// GetOwners returns all the owners of playbook runs selected
	GetOwners(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) ([]OwnerInfo, error)

	// IsOwner returns true if the userID is the owner for playbookRunID.
	IsOwner(playbookRunID string, userID string) bool

	// ChangeOwner processes a request from userID to change the owner for playbookRunID
	// to ownerID. Changing to the same ownerID is a no-op.
	ChangeOwner(playbookRunID string, userID string, ownerID string) error

	// ModifyCheckedState modifies the state of the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already in the specified state
	ModifyCheckedState(playbookRunID, userID, newState string, checklistNumber int, itemNumber int) error

	// ToggleCheckedState checks or unchecks the specified checklist item
	ToggleCheckedState(playbookRunID, userID string, checklistNumber, itemNumber int) error

	// SetAssignee sets the assignee for the specified checklist item
	// Idempotent, will not perform any actions if the checklist item is already assigned to assigneeID
	SetAssignee(playbookRunID, userID, assigneeID string, checklistNumber, itemNumber int) error

	// SetCommandToChecklistItem sets command to checklist item
	SetCommandToChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int, newCommand string) error

	// SetDueDate sets absolute due date timestamp for the specified checklist item
	SetDueDate(playbookRunID, userID string, duedate int64, checklistNumber, itemNumber int) error

	// SetTaskActionsToChecklistItem sets Task Actions to checklist item
	SetTaskActionsToChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int, taskActions []TaskAction) error

	// RunChecklistItemSlashCommand executes the slash command associated with the specified checklist item.
	RunChecklistItemSlashCommand(playbookRunID, userID string, checklistNumber, itemNumber int) (string, error)

	// DuplicateChecklistItem duplicates the checklist item.
	DuplicateChecklistItem(playbookRunID, userID string, checklistNumber, itemNumber int) error

	// AddChecklistItem adds an item to the specified checklist
	AddChecklistItem(playbookRunID, userID string, checklistNumber int, checklistItem ChecklistItem) error

	// RemoveChecklistItem removes an item from the specified checklist
	RemoveChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int) error

	// DuplicateChecklist duplicates a checklist
	DuplicateChecklist(playbookRunID, userID string, checklistNumber int) error

	// SkipChecklist skips a checklist
	SkipChecklist(playbookRunID, userID string, checklistNumber int) error

	// RestoreChecklist restores a skipped checklist
	RestoreChecklist(playbookRunID, userID string, checklistNumber int) error

	// SkipChecklistItem removes an item from the specified checklist
	SkipChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int) error

	// RestoreChecklistItem restores a skipped item from the specified checklist
	RestoreChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int) error

	// EditChecklistItem changes the title, command and description of a specified checklist item.
	EditChecklistItem(playbookRunID, userID string, checklistNumber int, itemNumber int, newTitle, newCommand, newDescription string) error

	// MoveChecklistItem moves a checklist item from one position to another.
	MoveChecklist(playbookRunID, userID string, sourceChecklistIdx, destChecklistIdx int) error

	// MoveChecklistItem moves a checklist item from one position to another.
	MoveChecklistItem(playbookRunID, userID string, sourceChecklistIdx, sourceItemIdx, destChecklistIdx, destItemIdx int) error

	// GetChecklistItemAutocomplete returns the list of checklist items for playbookRuns to be used in autocomplete
	GetChecklistItemAutocomplete(playbookRuns []PlaybookRun) ([]model.AutocompleteListItem, error)

	// GetChecklistAutocomplete returns the list of checklists for playbookRuns to be used in autocomplete
	GetChecklistAutocomplete(playbookRuns []PlaybookRun) ([]model.AutocompleteListItem, error)

	// GetRunsAutocomplete returns the list of runs to be used in autocomplete
	GetRunsAutocomplete(playbookRuns []PlaybookRun) ([]model.AutocompleteListItem, error)

	// AddChecklist prepends a new checklist to the specified run
	AddChecklist(playbookRunID, userID string, checklist Checklist) error

	// RemoveChecklist removes the specified checklist.
	RemoveChecklist(playbookRunID, userID string, checklistNumber int) error

	// RenameChecklist renames the specified checklist
	RenameChecklist(playbookRunID, userID string, checklistNumber int, newTitle string) error

	// NukeDB removes all playbook run related data.
	NukeDB() error

	// SetReminder sets a reminder. After time.Now().Add(fromNow) in the future,
	// the owner will be reminded to update the playbook run's status.
	SetReminder(playbookRunID string, fromNow time.Duration) error

	// RemoveReminder removes the pending reminder for playbookRunID (if any).
	RemoveReminder(playbookRunID string)

	// HandleReminder is the handler for all reminder events.
	HandleReminder(key string)

	// SetNewReminder sets a new reminder for playbookRunID, removes any pending reminder, removes the
	// reminder post in the playbookRun's channel, and resets the PreviousReminder and
	// LastStatusUpdateAt (so the countdown timer to "update due" shows the correct time)
	SetNewReminder(playbookRunID string, newReminder time.Duration) error

	// ResetReminder records an event for snoozing a reminder, then calls SetNewReminder to create
	// the next reminder
	ResetReminder(playbookRunID string, newReminder time.Duration) error

	// ChangeCreationDate changes the creation date of the specified playbook run.
	ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error

	// UpdateRetrospective updates the retrospective for the given playbook run.
	UpdateRetrospective(playbookRunID, userID string, retrospective RetrospectiveUpdate) error

	// PublishRetrospective publishes the retrospective.
	PublishRetrospective(playbookRunID, userID string, retrospective RetrospectiveUpdate) error

	// CancelRetrospective cancels the retrospective.
	CancelRetrospective(playbookRunID, userID string) error

	// EphemeralPostTodoDigestToUser gathers the list of assigned tasks, participating runs, and overdue updates,
	// and sends an ephemeral post to userID on channelID. Use force = true to post even if there are no items.
	EphemeralPostTodoDigestToUser(userID string, channelID string, force bool, includeRunsInProgress bool) error

	// DMTodoDigestToUser gathers the list of assigned tasks, participating runs, and overdue updates,
	// and DMs the message to userID. Use force = true to DM even if there are no items.
	DMTodoDigestToUser(userID string, force bool, includeRunsInProgress bool) error

	// GetRunsWithAssignedTasks returns the list of runs that have tasks assigned to userID
	GetRunsWithAssignedTasks(userID string) ([]AssignedRun, error)

	// GetParticipatingRuns returns the list of active runs with userID as participant
	GetParticipatingRuns(userID string) ([]RunLink, error)

	// GetOverdueUpdateRuns returns the list of userID's runs that have overdue updates
	GetOverdueUpdateRuns(userID string) ([]RunLink, error)

	// Follow method lets user follow a specific playbook run
	Follow(playbookRunID, userID string) error

	// UnFollow method lets user unfollow a specific playbook run
	Unfollow(playbookRunID, userID string) error

	// GetFollowers returns list of followers for a specific playbook run
	GetFollowers(playbookRunID string) ([]string, error)

	// RestorePlaybookRun reverts a run from the Finished state. If run was not in Finished state, the call is a noop.
	RestorePlaybookRun(playbookRunID, userID string) error

	// RequestUpdate posts a status update request message in the run's channel
	RequestUpdate(playbookRunID, requesterID string) error

	// RequestJoinChannel posts a channel-join request message in the run's channel
	RequestJoinChannel(playbookRunID, requesterID string) error

	// RemoveParticipants removes users from the run's participants
	RemoveParticipants(playbookRunID string, userIDs []string, requesterUserID string) error

	// AddParticipants adds users to the participants list
	AddParticipants(playbookRunID string, userIDs []string, requesterUserID string, forceAddToChannel bool) error

	// GetPlaybookRunIDsForUser returns run ids where user is a participant or is following
	GetPlaybookRunIDsForUser(userID string) ([]string, error)

	// GetRunMetadataByIDs returns playbook runs metadata by passed run IDs.
	// Notice that order of passed ids and returned runs might not coincide
	GetRunMetadataByIDs(runIDs []string) ([]RunMetadata, error)

	// GetTaskMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by taskIDs
	GetTaskMetadataByIDs(taskIDs []string) ([]TopicMetadata, error)

	// GetStatusMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by statusIDs
	GetStatusMetadataByIDs(statusIDs []string) ([]TopicMetadata, error)

	// GraphqlUpdate taking a setmap for graphql
	GraphqlUpdate(id string, setmap map[string]interface{}) error

	// MessageHasBeenPosted checks posted messages for triggers that may trigger task actions
	MessageHasBeenPosted(post *model.Post)
}

// PlaybookRunStore defines the methods the PlaybookRunServiceImpl needs from the interfaceStore.
type PlaybookRunStore interface {
	// GetPlaybookRuns returns filtered playbook runs and the total count before paging.
	GetPlaybookRuns(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) (*GetPlaybookRunsResults, error)

	// CreatePlaybookRun creates a new playbook run. If playbook run has an ID, that ID will be used.
	CreatePlaybookRun(playbookRun *PlaybookRun) (*PlaybookRun, error)

	// UpdatePlaybookRun updates a playbook run.
	UpdatePlaybookRun(playbookRun *PlaybookRun) (*PlaybookRun, error)

	// GraphqlUpdate taking a setmap for graphql
	GraphqlUpdate(id string, setmap map[string]interface{}) error

	// UpdateStatus updates the status of a playbook run.
	UpdateStatus(statusPost *SQLStatusPost) error

	// FinishPlaybookRun finishes a run at endAt (in millis)
	FinishPlaybookRun(playbookRunID string, endAt int64) error

	// RestorePlaybookRun restores a run at restoreAt (in millis)
	RestorePlaybookRun(playbookRunID string, restoreAt int64) error

	// GetTimelineEvent returns the timeline event for playbookRunID by the timeline event ID.
	GetTimelineEvent(playbookRunID, eventID string) (*TimelineEvent, error)

	// CreateTimelineEvent inserts the timeline event into the DB and returns the new event ID
	CreateTimelineEvent(event *TimelineEvent) (*TimelineEvent, error)

	// UpdateTimelineEvent updates an existing timeline event
	UpdateTimelineEvent(event *TimelineEvent) error

	// GetPlaybookRun gets a playbook run by ID.
	GetPlaybookRun(playbookRunID string) (*PlaybookRun, error)

	// GetPlaybookRunIDsForChannel gets a playbook runs list associated with the given channel id.
	GetPlaybookRunIDsForChannel(channelID string) ([]string, error)

	// GetHistoricalPlaybookRunParticipantsCount returns the count of all participants of the
	// playbook run associated with the given channel id since the beginning of the
	// playbook run, excluding bots.
	GetHistoricalPlaybookRunParticipantsCount(channelID string) (int64, error)

	// GetOwners returns the owners of the playbook runs selected by options
	GetOwners(requesterInfo RequesterInfo, options PlaybookRunFilterOptions) ([]OwnerInfo, error)

	// NukeDB removes all playbook run related data.
	NukeDB() error

	// ChangeCreationDate changes the creation date of the specified playbook run.
	ChangeCreationDate(playbookRunID string, creationTimestamp time.Time) error

	// GetBroadcastChannelIDsToRootIDs takes a playbookRunID and returns the mapping of
	// broadcastChannelID->rootID (to keep track of the status updates thread in each of the
	// playbook's broadcast channels).
	GetBroadcastChannelIDsToRootIDs(playbookRunID string) (map[string]string, error)

	// SetBroadcastChannelIDsToRootID sets the broadcastChannelID->rootID mappings for playbookRunID
	SetBroadcastChannelIDsToRootID(playbookRunID string, channelIDsToRootIDs map[string]string) error

	// GetRunsWithAssignedTasks returns the list of runs that have tasks assigned to userID
	GetRunsWithAssignedTasks(userID string) ([]AssignedRun, error)

	// GetParticipatingRuns returns the list of active runs with userID as a participant
	GetParticipatingRuns(userID string) ([]RunLink, error)

	// GetOverdueUpdateRuns returns the list of runs that userID is participating in that have overdue updates
	GetOverdueUpdateRuns(userID string) ([]RunLink, error)

	// Follow method lets user follow a specific playbook run
	Follow(playbookRunID, userID string) error

	// UnFollow method lets user unfollow a specific playbook run
	Unfollow(playbookRunID, userID string) error

	// GetFollowers returns list of followers for a specific playbook run
	GetFollowers(playbookRunID string) ([]string, error)

	// GetRunsActiveTotal returns number of active runs
	GetRunsActiveTotal() (int64, error)

	// GetOverdueUpdateRunsTotal returns number of runs that have overdue status updates
	GetOverdueUpdateRunsTotal() (int64, error)

	// GetOverdueRetroRunsTotal returns the number of completed runs without retro and with reminder
	GetOverdueRetroRunsTotal() (int64, error)

	// GetFollowersActiveTotal returns total number of active followers, including duplicates
	// if a user is following more than one run, it will be counted multiple times
	GetFollowersActiveTotal() (int64, error)

	// GetParticipantsActiveTotal returns number of active participants
	// (i.e. members of the playbook run channel when the run is active)
	// if a user is member of more than one channel, it will be counted multiple times
	GetParticipantsActiveTotal() (int64, error)

	// AddParticipants adds particpants to the run
	AddParticipants(playbookRunID string, userIDs []string) error

	// RemoveParticipants removes participants from the run
	RemoveParticipants(playbookRunID string, userIDs []string) error

	// GetSchemeRolesForChannel scheme role ids for the channel
	GetSchemeRolesForChannel(channelID string) (string, string, string, error)

	// GetSchemeRolesForTeam scheme role ids for the team
	GetSchemeRolesForTeam(teamID string) (string, string, string, error)

	// GetPlaybookRunIDsForUser returns run ids where user is a participant or is following
	GetPlaybookRunIDsForUser(userID string) ([]string, error)

	// GetRunMetadataByIDs returns playbook runs metadata by passed run IDs.
	// Notice that order of passed ids and returned runs might not coincide
	GetRunMetadataByIDs(runIDs []string) ([]RunMetadata, error)

	// GetTaskAsTopicMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by taskIDs
	GetTaskAsTopicMetadataByIDs(taskIDs []string) ([]TopicMetadata, error)

	// GetStatusAsTopicMetadataByIDs gets PlaybookRunIDs and TeamIDs from runs by statusIDs
	GetStatusAsTopicMetadataByIDs(statusIDs []string) ([]TopicMetadata, error)
}

// PlaybookRunTelemetry defines the methods that the PlaybookRunServiceImpl needs from the RudderTelemetry.
// Unless otherwise noted, userID is the user initiating the event.
type PlaybookRunTelemetry interface {
	// CreatePlaybookRun tracks the creation of a new playbook run.
	CreatePlaybookRun(playbookRun *PlaybookRun, userID string, public bool)

	// FinishPlaybookRun tracks the end of a playbook run.
	FinishPlaybookRun(playbookRun *PlaybookRun, userID string)

	// RestorePlaybookRun tracks the restoration of a playbook run.
	RestorePlaybookRun(playbookRun *PlaybookRun, userID string)

	// RestartPlaybookRun tracks the restart of a playbook run.
	RestartPlaybookRun(playbookRun *PlaybookRun, userID string)

	// ChangeOwner tracks changes in owner.
	ChangeOwner(playbookRun *PlaybookRun, userID string)

	// UpdateStatus tracks when a playbook run's status has been updated
	UpdateStatus(playbookRun *PlaybookRun, userID string)

	// FrontendTelemetryForPlaybookRun tracks an event originating from the frontend
	FrontendTelemetryForPlaybookRun(playbookRun *PlaybookRun, userID, action string)

	// AddPostToTimeline tracks userID creating a timeline event from a post.
	AddPostToTimeline(playbookRun *PlaybookRun, userID string)

	// RemoveTimelineEvent tracks userID removing a timeline event.
	RemoveTimelineEvent(playbookRun *PlaybookRun, userID string)

	// ModifyCheckedState tracks the checking and unchecking of items.
	ModifyCheckedState(playbookRunID, userID string, task ChecklistItem, wasOwner bool)

	// SetAssignee tracks the changing of an assignee on an item.
	SetAssignee(playbookRunID, userID string, task ChecklistItem)

	// AddTask tracks the creation of a new checklist item.
	AddTask(playbookRunID, userID string, task ChecklistItem)

	// RemoveTask tracks the removal of a checklist item.
	RemoveTask(playbookRunID, userID string, task ChecklistItem)

	// SkipChecklist tracks the skipping of a checklist.
	SkipChecklist(playbookRunID, userID string, checklist Checklist)

	// RestoreChecklist tracks the restoring of a checklist.
	RestoreChecklist(playbookRunID, userID string, checklist Checklist)

	// SkipTask tracks the skipping of a checklist item.
	SkipTask(playbookRunID, userID string, task ChecklistItem)

	// RestoreTask tracks the restoring of a checklist item.
	RestoreTask(playbookRunID, userID string, task ChecklistItem)

	// RenameTask tracks the update of a checklist item.
	RenameTask(playbookRunID, userID string, task ChecklistItem)

	// MoveChecklist tracks the movement of a checklist
	MoveChecklist(playbookRunID, userID string, task Checklist)

	// MoveTask tracks the movement of a checklist item
	MoveTask(playbookRunID, userID string, task ChecklistItem)

	// RunTaskSlashCommand tracks the execution of a slash command attached to
	// a checklist item.
	RunTaskSlashCommand(playbookRunID, userID string, task ChecklistItem)

	// AddChecklsit tracks the creation of a new checklist.
	AddChecklist(playbookRunID, userID string, checklist Checklist)

	// RemoveChecklist tracks the removal of a checklist.
	RemoveChecklist(playbookRunID, userID string, checklist Checklist)

	// RenameChecklsit tracks the creation of a new checklist.
	RenameChecklist(playbookRunID, userID string, checklist Checklist)

	// UpdateRetrospective event
	UpdateRetrospective(playbookRun *PlaybookRun, userID string)

	// PublishRetrospective event
	PublishRetrospective(playbookRun *PlaybookRun, userID string)

	// Follow tracks userID following a playbook run.
	Follow(playbookRun *PlaybookRun, userID string)

	// Unfollow tracks userID following a playbook run.
	Unfollow(playbookRun *PlaybookRun, userID string)

	// RunAction tracks the run actions, i.e., status broadcast action
	RunAction(playbookRun *PlaybookRun, userID, triggerType, actionType string, numBroadcasts int)
}

type JobOnceScheduler interface {
	Start() error
	SetCallback(callback func(string)) error
	ListScheduledJobs() ([]cluster.JobOnceMetadata, error)
	ScheduleOnce(key string, runAt time.Time) (*cluster.JobOnce, error)
	Cancel(key string)
}

const PerPageDefault = 1000

// PlaybookRunFilterOptions specifies the optional parameters when getting playbook runs.
type PlaybookRunFilterOptions struct {
	// Gets all the headers with this TeamID.
	TeamID string `url:"team_id,omitempty"`

	// Pagination options.
	Page    int `url:"page,omitempty"`
	PerPage int `url:"per_page,omitempty"`

	// Sort sorts by this header field in json format (eg, "create_at", "end_at", "name", etc.);
	// defaults to "create_at".
	Sort SortField `url:"sort,omitempty"`

	// Direction orders by ascending or descending, defaulting to ascending.
	Direction SortDirection `url:"direction,omitempty"`

	// Statuses filters by all statuses in the list (inclusive)
	Statuses []string

	// OwnerID filters by owner's Mattermost user ID. Defaults to blank (no filter).
	OwnerID string `url:"owner_user_id,omitempty"`

	// ParticipantID filters playbook runs that have this member. Defaults to blank (no filter).
	ParticipantID string `url:"participant_id,omitempty"`

	// ParticipantOrFollowerID filters playbook runs that have this user as member or as follower. Defaults to blank (no filter).
	ParticipantOrFollowerID string `url:"participant_or_follower,omitempty"`

	// IncludeFavorites filters playbook runs that ParticipantOrFollowerID has marked as favorite.
	// There's no impact if ParticipantOrFollowerID is empty.
	IncludeFavorites bool `url:"include_favorites,omitempty"`

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

	// ChannelID filters to playbook runs that are associated with the given channel ID
	ChannelID string `url:"channel_id,omitempty"`

	// Types filters by all run types in the list (inclusive)
	Types []string
}

// Clone duplicates the given options.
func (o *PlaybookRunFilterOptions) Clone() PlaybookRunFilterOptions {
	newPlaybookRunFilterOptions := *o
	if len(o.Statuses) > 0 {
		newPlaybookRunFilterOptions.Statuses = append([]string{}, o.Statuses...)
	}
	if len(o.Types) > 0 {
		newPlaybookRunFilterOptions.Types = append([]string{}, o.Types...)
	}

	return newPlaybookRunFilterOptions
}

// Validate returns a new, validated filter options or returns an error if invalid.
func (o PlaybookRunFilterOptions) Validate() (PlaybookRunFilterOptions, error) {
	options := o.Clone()

	if options.PerPage <= 0 {
		options.PerPage = PerPageDefault
	}

	options.Sort = SortField(strings.ToLower(string(options.Sort)))
	switch options.Sort {
	case SortByCreateAt:
	case SortByID:
	case SortByName:
	case SortByOwnerUserID:
	case SortByTeamID:
	case SortByEndAt:
	case SortByStatus:
	case SortByLastStatusUpdateAt:
	case SortByMetric0, SortByMetric1, SortByMetric2, SortByMetric3:
	case "": // default
		options.Sort = SortByCreateAt
	default:
		return PlaybookRunFilterOptions{}, errors.Errorf("unsupported sort '%s'", options.Sort)
	}

	options.Direction = SortDirection(strings.ToUpper(string(options.Direction)))
	switch options.Direction {
	case DirectionAsc:
	case DirectionDesc:
	case "": //default
		options.Direction = DirectionAsc
	default:
		return PlaybookRunFilterOptions{}, errors.Errorf("unsupported direction '%s'", options.Direction)
	}

	if options.TeamID != "" && !model.IsValidId(options.TeamID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'team_id': must be 26 characters or blank")
	}

	if options.OwnerID != "" && !model.IsValidId(options.OwnerID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'owner_id': must be 26 characters or blank")
	}

	if options.ParticipantID != "" && !model.IsValidId(options.ParticipantID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'participant_id': must be 26 characters or blank")
	}

	if options.ParticipantOrFollowerID != "" && !model.IsValidId(options.ParticipantOrFollowerID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'participant_or_follower_id': must be 26 characters or blank")
	}

	if options.PlaybookID != "" && !model.IsValidId(options.PlaybookID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'playbook_id': must be 26 characters or blank")
	}

	if options.ActiveGTE < 0 {
		options.ActiveGTE = 0
	}
	if options.ActiveLT < 0 {
		options.ActiveLT = 0
	}
	if options.StartedGTE < 0 {
		options.StartedGTE = 0
	}
	if options.StartedLT < 0 {
		options.StartedLT = 0
	}

	if options.ChannelID != "" && !model.IsValidId(options.ChannelID) {
		return PlaybookRunFilterOptions{}, errors.New("bad parameter 'channel_id': must be 26 characters or blank")
	}

	for _, s := range options.Statuses {
		if !validStatus(s) {
			return PlaybookRunFilterOptions{}, errors.New("bad parameter in 'statuses': must be InProgress or Finished")
		}
	}

	for _, t := range options.Types {
		if !validType(t) {
			return PlaybookRunFilterOptions{}, errors.New("bad parameter in 'types': must be playbook or channel")
		}
	}

	return options, nil
}

func validStatus(status string) bool {
	return status == "" || status == StatusInProgress || status == StatusFinished
}

func validType(runType string) bool {
	return runType == RunTypePlaybook || runType == RunTypeChannelChecklist
}
