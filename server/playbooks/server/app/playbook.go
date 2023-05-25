// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"net/url"
	"strings"

	"github.com/mattermost/mattermost-server/server/public/model"
	"gopkg.in/guregu/null.v4"

	"github.com/pkg/errors"
)

// Playbook represents a desired business outcome, from which playbook runs are started to solve
// a specific instance.
// The tag export supports the export/import feature. If the field makes sense for export, the value should be
// the JSON name of the item in the export format. If the field should not be exported the value should be "-".
// Fields should be exported if they are not server specific like InvitedUserIDs or are tracking metadata like CreateAt.
type Playbook struct {
	ID                                      string                 `json:"id" export:"-"`
	Title                                   string                 `json:"title" export:"title"`
	Description                             string                 `json:"description" export:"description"`
	Public                                  bool                   `json:"public" export:"-"`
	TeamID                                  string                 `json:"team_id" export:"-"`
	CreatePublicPlaybookRun                 bool                   `json:"create_public_playbook_run" export:"-"`
	CreateAt                                int64                  `json:"create_at" export:"-"`
	UpdateAt                                int64                  `json:"update_at" export:"-"`
	DeleteAt                                int64                  `json:"delete_at" export:"-"`
	NumStages                               int64                  `json:"num_stages" export:"-"`
	NumSteps                                int64                  `json:"num_steps" export:"-"`
	NumRuns                                 int64                  `json:"num_runs" export:"-"`
	NumActions                              int64                  `json:"num_actions" export:"-"`
	LastRunAt                               int64                  `json:"last_run_at" export:"-"`
	Checklists                              []Checklist            `json:"checklists" export:"-"`
	Members                                 []PlaybookMember       `json:"members" export:"-"`
	ReminderMessageTemplate                 string                 `json:"reminder_message_template" export:"reminder_message_template"`
	ReminderTimerDefaultSeconds             int64                  `json:"reminder_timer_default_seconds" export:"reminder_timer_default_seconds"`
	StatusUpdateEnabled                     bool                   `json:"status_update_enabled" export:"status_update_enabled"`
	InvitedUserIDs                          []string               `json:"invited_user_ids" export:"-"`
	InvitedGroupIDs                         []string               `json:"invited_group_ids" export:"-"`
	InviteUsersEnabled                      bool                   `json:"invite_users_enabled" export:"-"`
	DefaultOwnerID                          string                 `json:"default_owner_id" export:"-"`
	DefaultOwnerEnabled                     bool                   `json:"default_owner_enabled" export:"-"`
	BroadcastChannelIDs                     []string               `json:"broadcast_channel_ids" export:"-"`
	WebhookOnCreationURLs                   []string               `json:"webhook_on_creation_urls" export:"-"`
	WebhookOnCreationEnabled                bool                   `json:"webhook_on_creation_enabled" export:"-"`
	MessageOnJoin                           string                 `json:"message_on_join" export:"message_on_join"`
	MessageOnJoinEnabled                    bool                   `json:"message_on_join_enabled" export:"message_on_join_enabled"`
	RetrospectiveReminderIntervalSeconds    int64                  `json:"retrospective_reminder_interval_seconds" export:"retrospective_reminder_interval_seconds"`
	RetrospectiveTemplate                   string                 `json:"retrospective_template" export:"retrospective_template"`
	RetrospectiveEnabled                    bool                   `json:"retrospective_enabled" export:"retrospective_enabled"`
	WebhookOnStatusUpdateURLs               []string               `json:"webhook_on_status_update_urls" export:"-"`
	SignalAnyKeywords                       []string               `json:"signal_any_keywords" export:"signal_any_keywords"`
	SignalAnyKeywordsEnabled                bool                   `json:"signal_any_keywords_enabled" export:"signal_any_keywords_enabled"`
	CategorizeChannelEnabled                bool                   `json:"categorize_channel_enabled" export:"categorize_channel_enabled"`
	CategoryName                            string                 `json:"category_name" export:"category_name"`
	RunSummaryTemplateEnabled               bool                   `json:"run_summary_template_enabled" export:"run_summary_template_enabled"`
	RunSummaryTemplate                      string                 `json:"run_summary_template" export:"run_summary_template"`
	ChannelNameTemplate                     string                 `json:"channel_name_template" export:"channel_name_template"`
	DefaultPlaybookAdminRole                string                 `json:"default_playbook_admin_role" export:"-"`
	DefaultPlaybookMemberRole               string                 `json:"default_playbook_member_role" export:"-"`
	DefaultRunAdminRole                     string                 `json:"default_run_admin_role" export:"-"`
	DefaultRunMemberRole                    string                 `json:"default_run_member_role" export:"-"`
	Metrics                                 []PlaybookMetricConfig `json:"metrics" export:"metrics"`
	ActiveRuns                              int64                  `json:"active_runs" export:"-"`
	CreateChannelMemberOnNewParticipant     bool                   `json:"create_channel_member_on_new_participant" export:"create_channel_member_on_new_participant"`
	RemoveChannelMemberOnRemovedParticipant bool                   `json:"remove_channel_member_on_removed_participant" export:"create_channel_member_on_removed_participant"`

	// ChannelID is the identifier of the channel that would be -potentially- linked
	// to any new run of this playbook
	ChannelID string `json:"channel_id" export:"channel_id"`

	// ChannelMode is the playbook>run>channel flow used
	ChannelMode ChannelPlaybookMode `json:"channel_mode" export:"channel_mode"`

	// Deprecated: preserved for backwards compatibility with v1.27
	BroadcastEnabled             bool `json:"broadcast_enabled" export:"-"`
	WebhookOnStatusUpdateEnabled bool `json:"webhook_on_status_update_enabled" export:"-"`
}

const (
	PlaybookRoleMember = "playbook_member"
	PlaybookRoleAdmin  = "playbook_admin"
)

const (
	MetricTypeDuration = "metric_duration"
	MetricTypeCurrency = "metric_currency"
	MetricTypeInteger  = "metric_integer"
)

const MaxMetricsPerPlaybook = 4

type PlaybookMember struct {
	UserID      string   `json:"user_id"`
	Roles       []string `json:"roles"`
	SchemeRoles []string `json:"scheme_roles"`
}

type PlaybookMetricConfig struct {
	ID          string   `json:"id" export:"-"`
	PlaybookID  string   `json:"playbook_id" export:"-"`
	Title       string   `json:"title" export:"title"`
	Description string   `json:"description" export:"description"`
	Type        string   `json:"type" export:"type"`
	Target      null.Int `json:"target" export:"target"`
}

func (pm PlaybookMember) Clone() PlaybookMember {
	newPlaybookMember := pm
	if len(pm.Roles) != 0 {
		newPlaybookMember.Roles = append([]string(nil), pm.Roles...)
	}
	if len(pm.SchemeRoles) != 0 {
		newPlaybookMember.SchemeRoles = append([]string(nil), pm.SchemeRoles...)
	}
	return newPlaybookMember
}

func (p Playbook) Clone() Playbook {
	newPlaybook := p
	var newChecklists []Checklist
	for _, c := range p.Checklists {
		newChecklists = append(newChecklists, c.Clone())
	}
	newPlaybook.Checklists = newChecklists
	newPlaybook.Metrics = append([]PlaybookMetricConfig(nil), p.Metrics...)
	var newMembers []PlaybookMember
	for _, m := range p.Members {
		newMembers = append(newMembers, m.Clone())
	}
	newPlaybook.Members = newMembers
	if len(p.InvitedUserIDs) != 0 {
		newPlaybook.InvitedUserIDs = append([]string(nil), p.InvitedUserIDs...)
	}
	if len(p.InvitedGroupIDs) != 0 {
		newPlaybook.InvitedGroupIDs = append([]string(nil), p.InvitedGroupIDs...)
	}
	if len(p.SignalAnyKeywords) != 0 {
		newPlaybook.SignalAnyKeywords = append([]string(nil), p.SignalAnyKeywords...)
	}
	if len(p.BroadcastChannelIDs) != 0 {
		newPlaybook.BroadcastChannelIDs = append([]string(nil), p.BroadcastChannelIDs...)
	}
	if len(p.WebhookOnCreationURLs) != 0 {
		newPlaybook.WebhookOnCreationURLs = append([]string(nil), p.WebhookOnCreationURLs...)
	}
	if len(p.WebhookOnStatusUpdateURLs) != 0 {
		newPlaybook.WebhookOnStatusUpdateURLs = append([]string(nil), p.WebhookOnStatusUpdateURLs...)
	}
	return newPlaybook
}

func (p Playbook) MarshalJSON() ([]byte, error) {
	type Alias Playbook

	old := Alias(p.Clone())
	// replace nils with empty slices for the frontend
	if old.Checklists == nil {
		old.Checklists = []Checklist{}
	}
	for j, cl := range old.Checklists {
		if cl.Items == nil {
			old.Checklists[j].Items = []ChecklistItem{}
		}
	}
	if old.Members == nil {
		old.Members = []PlaybookMember{}
	}
	if old.Metrics == nil {
		old.Metrics = []PlaybookMetricConfig{}
	}
	if old.InvitedUserIDs == nil {
		old.InvitedUserIDs = []string{}
	}
	if old.InvitedGroupIDs == nil {
		old.InvitedGroupIDs = []string{}
	}
	if old.SignalAnyKeywords == nil {
		old.SignalAnyKeywords = []string{}
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

	return json.Marshal(old)
}

func (p Playbook) GetRunChannelID() string {
	if p.ChannelMode == PlaybookRunLinkExistingChannel {
		return p.ChannelID
	}
	return ""
}

// ChecklistCommon allows access on common fields of Checklist and api.UpdateChecklist
type ChecklistCommon interface {
	GetItems() []ChecklistItemCommon
}

// Checklist represents a checklist in a playbook.
type Checklist struct {
	// ID is the identifier of the checklist.
	ID string `json:"id" export:"-"`

	// Title is the name of the checklist.
	Title string `json:"title" export:"title"`

	// Items is an array of all the items in the checklist.
	Items []ChecklistItem `json:"items" export:"-"`
}

func (c Checklist) GetItems() []ChecklistItemCommon {
	items := make([]ChecklistItemCommon, len(c.Items))
	for i := range c.Items {
		items[i] = &c.Items[i]
	}
	return items
}

func (c Checklist) Clone() Checklist {
	newChecklist := c
	newChecklist.Items = append([]ChecklistItem(nil), c.Items...)
	return newChecklist
}

// ChecklistItemCommon allows access on common fields of ChecklistItem and api.UpdateChecklistItem
type ChecklistItemCommon interface {
	GetAssigneeID() string

	SetAssigneeModified(modified int64)
	SetState(state string)
	SetStateModified(modified int64)
	SetCommandLastRun(lastRun int64)
}

// ChecklistItem represents an item in a checklist.
type ChecklistItem struct {
	// ID is the identifier of the checklist item.
	ID string `json:"id" export:"-"`

	// Title is the content of the checklist item.
	Title string `json:"title" export:"title"`

	// State is the state of the checklist item: "closed" if it's checked, "skipped" if it has
	// been skipped, the empty string otherwise.
	State string `json:"state" export:"-"`

	// StateModified is the timestamp, in milliseconds since epoch, of the last time the item's
	// state was modified. 0 if it was never modified.
	StateModified int64 `json:"state_modified" export:"-"`

	// AssigneeID is the identifier of the user to whom this item is assigned.
	AssigneeID string `json:"assignee_id" export:"-"`

	// AssigneeModified is the timestamp, in milliseconds since epoch, of the last time the item's
	// assignee was modified. 0 if it was never modified.
	AssigneeModified int64 `json:"assignee_modified" export:"-"`

	// Command, if not empty, is the slash command that can be run as part of this item.
	Command string `json:"command" export:"command"`

	// CommandLastRun is the timestamp, in milliseconds since epoch, of the last time the item's
	// slash command was run. 0 if it was never run.
	CommandLastRun int64 `json:"command_last_run" export:"-"`

	// Description is a string with the markdown content of the long description of the item.
	Description string `json:"description" export:"description"`

	// LastSkipped is the timestamp, in milliseconds since epoch, of the last time the item
	// was skipped. 0 if it was never skipped.
	LastSkipped int64 `json:"delete_at" export:"-"`

	// DueDate is the timestamp, in milliseconds since epoch. indicates relative or absolute due date
	// of the checklist item. 0 if not set.
	// Playbook can have only relative timstamp, run can have only absolute timestamp.
	DueDate int64 `json:"due_date" export:"due_date"`

	// TaskActions is an array of all the task actions associated with this task.
	TaskActions []TaskAction `json:"task_actions" export:"-"`
}

func (ci *ChecklistItem) GetAssigneeID() string {
	return ci.AssigneeID
}

func (ci *ChecklistItem) SetAssigneeModified(modified int64) {
	ci.AssigneeModified = modified
}

func (ci *ChecklistItem) SetState(state string) {
	ci.State = state
}

func (ci *ChecklistItem) SetStateModified(modified int64) {
	ci.StateModified = modified
}

func (ci *ChecklistItem) SetCommandLastRun(lastRun int64) {
	ci.CommandLastRun = lastRun
}

type GetPlaybooksResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Playbook `json:"items"`
}

// MarshalJSON customizes the JSON marshalling for GetPlaybooksResults by rendering a nil Items as
// an empty slice instead.
func (r GetPlaybooksResults) MarshalJSON() ([]byte, error) {
	type Alias GetPlaybooksResults

	if r.Items == nil {
		r.Items = []Playbook{}
	}

	aux := &struct {
		*Alias
	}{
		Alias: (*Alias)(&r),
	}

	return json.Marshal(aux)
}

// PlaybookService is the playbook service for managing playbooks
// userID is the user initiating the event.
type PlaybookService interface {
	// Get retrieves a playbook. Returns ErrNotFound if not found.
	Get(id string) (Playbook, error)

	// Create creates a new playbook
	Create(playbook Playbook, userID string) (string, error)

	// Import imports a new playbook
	Import(playbook Playbook, userID string) (string, error)

	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)

	// GetPlaybooksForTeam retrieves all playbooks on the specified team given the provided options
	GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error)

	// Update updates a playbook
	Update(playbook Playbook, userID string) error

	// Archive archives a playbook
	Archive(playbook Playbook, userID string) error

	// Restores an archived playbook
	Restore(playbook Playbook, userID string) error

	// AutoFollow method lets user auto-follow all runs of a specific playbook
	AutoFollow(playbookID, userID string) error

	// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
	AutoUnfollow(playbookID, userID string) error

	// GetAutoFollows returns list of users who auto-follows a playbook
	GetAutoFollows(playbookID string) ([]string, error)

	// Duplicate duplicates a playbook
	Duplicate(playbook Playbook, userID string) (string, error)

	// Get top playbooks for teams
	GetTopPlaybooksForTeam(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error)

	// Get top playbooks for users
	GetTopPlaybooksForUser(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error)
}

// PlaybookStore is an interface for storing playbooks
type PlaybookStore interface {
	// Get retrieves a playbook
	Get(id string) (Playbook, error)

	// Create creates a new playbook
	Create(playbook Playbook) (string, error)

	// GetPlaybooks retrieves all playbooks
	GetPlaybooks() ([]Playbook, error)

	// GetPlaybooksForTeam retrieves all playbooks on the specified team
	GetPlaybooksForTeam(requesterInfo RequesterInfo, teamID string, opts PlaybookFilterOptions) (GetPlaybooksResults, error)

	// GetPlaybooksWithKeywords retrieves all playbooks with keywords enabled
	GetPlaybooksWithKeywords(opts PlaybookFilterOptions) ([]Playbook, error)

	// GetTimeLastUpdated retrieves time last playbook was updated at.
	// Passed argument determines whether to include playbooks with
	// SignalAnyKeywordsEnabled flag or not.
	GetTimeLastUpdated(onlyPlaybooksWithKeywordsEnabled bool) (int64, error)

	// GetPlaybookIDsForUser retrieves playbooks user can access
	GetPlaybookIDsForUser(userID, teamID string) ([]string, error)

	// Update updates a playbook
	Update(playbook Playbook) error

	// GraphqlUpdate taking a setmap for graphql
	GraphqlUpdate(id string, setmap map[string]interface{}) error

	// Archive archives a playbook
	Archive(id string) error

	// Restore restores a deleted playbook
	Restore(id string) error

	// AutoFollow method lets user auto-follow all runs of a specific playbook
	AutoFollow(playbookID, userID string) error

	// AutoUnfollow method lets user to not auto-follow the newly created playbook runs
	AutoUnfollow(playbookID, userID string) error

	// GetAutoFollows returns list of users who auto-follows a playbook
	GetAutoFollows(playbookID string) ([]string, error)

	// GetPlaybooksActiveTotal returns number of active playbooks
	GetPlaybooksActiveTotal() (int64, error)

	// GetMetric retrieves a metric by ID
	GetMetric(id string) (*PlaybookMetricConfig, error)

	// AddMetric adds a metric
	AddMetric(playbookID string, config PlaybookMetricConfig) error

	// UpdateMetric updates a metric
	UpdateMetric(id string, setmap map[string]interface{}) error

	// DeleteMetric deletes a metric
	DeleteMetric(id string) error

	// Get top playbooks for teams
	GetTopPlaybooksForTeam(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error)

	// Get top playbooks for users
	GetTopPlaybooksForUser(teamID, userID string, opts *model.InsightsOpts) (*PlaybooksInsightsList, error)

	// AddPlaybookMember adds a user as a member to a playbook
	AddPlaybookMember(id string, memberID string) error

	// RemovePlaybookMember removes a user from a playbook
	RemovePlaybookMember(id string, memberID string) error
}

// PlaybookTelemetry defines the methods that the Playbook service needs from the RudderTelemetry.
// userID is the user initiating the event.
type PlaybookTelemetry interface {
	// CreatePlaybook tracks the creation of a playbook.
	CreatePlaybook(playbook Playbook, userID string)

	// ImportPlaybook tracks the import of a playbook.
	ImportPlaybook(playbook Playbook, userID string)

	// UpdatePlaybook tracks the update of a playbook.
	UpdatePlaybook(playbook Playbook, userID string)

	// DeletePlaybook tracks the deletion of a playbook.
	DeletePlaybook(playbook Playbook, userID string)

	// RestorePlaybook tracks the restoration of a playbook.
	RestorePlaybook(playbook Playbook, userID string)

	// FrontendTelemetryForPlaybook tracks an event originating from the frontend
	FrontendTelemetryForPlaybook(playbook Playbook, userID, action string)

	// FrontendTelemetryForPlaybookTemplate tracks an event originating from the frontend
	FrontendTelemetryForPlaybookTemplate(templateName string, userID, action string)

	// AutoFollowPlaybook tracks the auto-follow of a playbook.
	AutoFollowPlaybook(playbook Playbook, userID string)

	// AutoUnfollowPlaybook tracks the auto-unfollow of a playbook.
	AutoUnfollowPlaybook(playbook Playbook, userID string)
}

const (
	ChecklistItemStateOpen       = ""
	ChecklistItemStateInProgress = "in_progress"
	ChecklistItemStateClosed     = "closed"
	ChecklistItemStateSkipped    = "skipped"
)

func IsValidChecklistItemState(state string) bool {
	return state == ChecklistItemStateClosed ||
		state == ChecklistItemStateInProgress ||
		state == ChecklistItemStateOpen ||
		state == ChecklistItemStateSkipped
}

func IsValidChecklistItemIndex(checklists []Checklist, checklistNum, itemNum int) bool {
	return checklists != nil && checklistNum >= 0 && itemNum >= 0 && checklistNum < len(checklists) && itemNum < len(checklists[checklistNum].Items)
}

// PlaybookFilterOptions specifies the parameters when getting playbooks.
type PlaybookFilterOptions struct {
	Sort               SortField
	Direction          SortDirection
	SearchTerm         string
	WithArchived       bool
	WithMembershipOnly bool //if true will return only playbooks you are a member of
	PlaybookIDs        []string

	// Pagination options.
	Page    int
	PerPage int
}

// Clone duplicates the given options.
func (o *PlaybookFilterOptions) Clone() PlaybookFilterOptions {
	return *o
}

// Validate returns a new, validated filter options or returns an error if invalid.
func (o PlaybookFilterOptions) Validate() (PlaybookFilterOptions, error) {
	options := o.Clone()

	if options.PerPage <= 0 {
		options.PerPage = PerPageDefault
	}

	options.Sort = SortField(strings.ToLower(string(options.Sort)))
	switch options.Sort {
	case SortByID:
	case SortByTitle:
	case SortByStages:
	case SortBySteps:
	case "": // default
		options.Sort = SortByID
	default:
		return PlaybookFilterOptions{}, errors.Errorf("unsupported sort '%s'", options.Sort)
	}

	options.Direction = SortDirection(strings.ToUpper(string(options.Direction)))
	switch options.Direction {
	case DirectionAsc:
	case DirectionDesc:
	case "": //default
		options.Direction = DirectionAsc
	default:
		return PlaybookFilterOptions{}, errors.Errorf("unsupported direction '%s'", options.Direction)
	}

	return options, nil
}

func ValidateWebhookURLs(urls []string) error {
	if len(urls) > 64 {
		return errors.New("too many registered urls, limit to less than 64")
	}

	for _, webhook := range urls {
		reqURL, err := url.ParseRequestURI(webhook)
		if err != nil {
			return errors.Wrapf(err, "unable to parse webhook: %v", webhook)
		}

		if reqURL.Scheme != "http" && reqURL.Scheme != "https" {
			return fmt.Errorf("protocol in webhook URL is %s; only HTTP and HTTPS are accepted", reqURL.Scheme)
		}
	}

	return nil
}

func ValidateCategoryName(categoryName string) error {
	categoryNameLength := len(categoryName)
	if categoryNameLength > 22 {
		msg := fmt.Sprintf("invalid category name: %s (maximum length is 22 characters)", categoryName)
		return errors.Errorf(msg)
	}
	return nil
}

// CleanUpChecklists sets empty values for checklist fields that are not editable
func CleanUpChecklists[T ChecklistCommon](checklists []T) {
	for listIndex := range checklists {
		items := checklists[listIndex].GetItems()
		for itemIndex := range items {
			items[itemIndex].SetAssigneeModified(0)
			items[itemIndex].SetState("")
			items[itemIndex].SetStateModified(0)
			items[itemIndex].SetCommandLastRun(0)
		}
	}
}

// ValidatePreAssignment checks if invitations are enabled and if all assignees are also invited
func ValidatePreAssignment(assignees []string, invitedUsers []string, inviteUsersEnabled bool) error {
	if len(assignees) > 0 && !inviteUsersEnabled {
		return errors.New("invitations are disabled")
	}
	if !assigneesAreInvited(assignees, invitedUsers) {
		return errors.New("users missing in invite user list")
	}
	return nil
}

// GetDistinctAssignees returns a list of distinct user ids that are assignees in the given checklists
func GetDistinctAssignees[T ChecklistCommon](checklists []T) []string {
	uMap := make(map[string]bool)
	for _, cl := range checklists {
		for _, ci := range cl.GetItems() {
			if id := ci.GetAssigneeID(); id != "" && !uMap[id] {
				uMap[id] = true
			}
		}
	}
	uIds := make([]string, 0, len(uMap))
	for k := range uMap {
		uIds = append(uIds, k)
	}
	return uIds
}

func assigneesAreInvited(assignees []string, invited []string) bool {
	for _, assignee := range assignees {
		found := false
		for _, user := range invited {
			if user == assignee {
				found = true
			}
		}
		if !found {
			return false
		}
	}
	return true
}

func removeDuplicates(a []string) []string {
	items := make(map[string]bool)
	for _, item := range a {
		if item != "" {
			items[item] = true
		}
	}
	res := make([]string, 0, len(items))
	for item := range items {
		res = append(res, item)
	}
	return res
}

func ProcessSignalAnyKeywords(keywords []string) []string {
	return removeDuplicates(keywords)
}

// models for playbooks-insights

// PlaybooksInsightsList is a response type with pagination support.
type PlaybooksInsightsList struct {
	HasNext bool               `json:"has_next"`
	Items   []*PlaybookInsight `json:"items"`
}

// PlaybookInsight gives insight into activities related to a playbook

type PlaybookInsight struct {
	// ID of the playbook
	// required: true
	PlaybookID string `json:"playbook_id"`

	// Run count of playbook
	// required: true
	NumRuns int `json:"num_runs"`

	// Title of playbook
	// required: true
	Title string `json:"title"`

	// Time the playbook was last run.
	// required: false
	LastRunAt int64 `json:"last_run_at"`
}

// ChannelPlaybookMode is a type alias to hold all possible
// modes for playbook > run > channel relation
type ChannelPlaybookMode int

const (
	PlaybookRunCreateNewChannel ChannelPlaybookMode = iota
	PlaybookRunLinkExistingChannel
)

var channelPlaybookTypes = [...]string{
	PlaybookRunCreateNewChannel:    "create_new_channel",
	PlaybookRunLinkExistingChannel: "link_existing_channel",
}

// String creates the string version of the TelemetryTrack
func (cpm ChannelPlaybookMode) String() string {
	return channelPlaybookTypes[cpm]
}

// MarshalText converts a ChannelPlaybookMode to a string for serializers (including JSON)
func (cpm ChannelPlaybookMode) MarshalText() ([]byte, error) {
	return []byte(channelPlaybookTypes[cpm]), nil
}

// UnmarshalText parses a ChannelPlaybookMode from text. For deserializers (including JSON)
func (cpm *ChannelPlaybookMode) UnmarshalText(text []byte) error {
	for i, st := range channelPlaybookTypes {
		if st == string(text) {
			*cpm = ChannelPlaybookMode(i)
			return nil
		}
	}
	return fmt.Errorf("unknown ChannelPlaybookMode: %s", string(text))
}

// Scan parses a ChannelPlaybookMode back from the DB
func (cpm *ChannelPlaybookMode) Scan(src interface{}) error {
	txt, ok := src.([]byte) // mysql
	if !ok {
		txt, ok := src.(string) //postgres
		if !ok {
			return fmt.Errorf("could not cast to string: %v", src)
		}
		return cpm.UnmarshalText([]byte(txt))
	}
	return cpm.UnmarshalText(txt)
}

// Value represents a ChannelPlaybookMode as a type writable into the DB
func (cpm ChannelPlaybookMode) Value() (driver.Value, error) {
	return cpm.MarshalText()
}
