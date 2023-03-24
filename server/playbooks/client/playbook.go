// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package client

import (
	"fmt"

	"gopkg.in/guregu/null.v4"
)

// Playbook represents the planning before a playbook run is initiated.
type Playbook struct {
	ID                                      string                 `json:"id"`
	Title                                   string                 `json:"title"`
	Description                             string                 `json:"description"`
	Public                                  bool                   `json:"public"`
	TeamID                                  string                 `json:"team_id"`
	CreatePublicPlaybookRun                 bool                   `json:"create_public_playbook_run"`
	CreateAt                                int64                  `json:"create_at"`
	DeleteAt                                int64                  `json:"delete_at"`
	NumStages                               int64                  `json:"num_stages"`
	NumSteps                                int64                  `json:"num_steps"`
	Checklists                              []Checklist            `json:"checklists"`
	Members                                 []PlaybookMember       `json:"members"`
	ReminderMessageTemplate                 string                 `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds             int64                  `json:"reminder_timer_default_seconds"`
	InvitedUserIDs                          []string               `json:"invited_user_ids"`
	InvitedGroupIDs                         []string               `json:"invited_group_ids"`
	InviteUsersEnabled                      bool                   `json:"invite_users_enabled"`
	DefaultOwnerID                          string                 `json:"default_owner_id"`
	DefaultOwnerEnabled                     bool                   `json:"default_owner_enabled"`
	BroadcastChannelIDs                     []string               `json:"broadcast_channel_ids"`
	BroadcastEnabled                        bool                   `json:"broadcast_enabled"`
	WebhookOnCreationURLs                   []string               `json:"webhook_on_creation_urls"`
	WebhookOnCreationEnabled                bool                   `json:"webhook_on_creation_enabled"`
	Metrics                                 []PlaybookMetricConfig `json:"metrics"`
	CreateChannelMemberOnNewParticipant     bool                   `json:"create_channel_member_on_new_participant"`
	RemoveChannelMemberOnRemovedParticipant bool                   `json:"remove_channel_member_on_removed_participant"`
	ChannelID                               string                 `json:"channel_id" export:"channel_id"`
	ChannelMode                             ChannelPlaybookMode    `json:"channel_mode" export:"channel_mode"`
}

type PlaybookMember struct {
	UserID      string   `json:"user_id"`
	Roles       []string `json:"roles"`
	SchemeRoles []string `json:"scheme_roles"`
}

const (
	MetricTypeDuration = "metric_duration"
	MetricTypeCurrency = "metric_currency"
	MetricTypeInteger  = "metric_integer"
)

// Checklist represents a checklist in a playbook
type Checklist struct {
	ID    string          `json:"id"`
	Title string          `json:"title"`
	Items []ChecklistItem `json:"items"`
}

// ChecklistItem represents an item in a checklist
type ChecklistItem struct {
	ID               string       `json:"id"`
	Title            string       `json:"title"`
	State            string       `json:"state"`
	StateModified    int64        `json:"state_modified"`
	AssigneeID       string       `json:"assignee_id"`
	AssigneeModified int64        `json:"assignee_modified"`
	Command          string       `json:"command"`
	CommandLastRun   int64        `json:"command_last_run"`
	Description      string       `json:"description"`
	LastSkipped      int64        `json:"delete_at"`
	DueDate          int64        `json:"due_date"`
	TaskActions      []TaskAction `json:"task_actions"`
}

// TaskAction represents a task action in an item
type TaskAction struct {
	Trigger TriggerAction   `json:"trigger"`
	Actions []TriggerAction `json:"actions"`
}

// TriggerAction represents a trigger or action in a Task Action
type TriggerAction struct {
	Type    string `json:"type"`
	Payload string `json:"payload"`
}

// PlaybookCreateOptions specifies the parameters for PlaybooksService.Create method.
type PlaybookCreateOptions struct {
	Title                                   string                 `json:"title"`
	Description                             string                 `json:"description"`
	TeamID                                  string                 `json:"team_id"`
	Public                                  bool                   `json:"public"`
	CreatePublicPlaybookRun                 bool                   `json:"create_public_playbook_run"`
	Checklists                              []Checklist            `json:"checklists"`
	Members                                 []PlaybookMember       `json:"members"`
	BroadcastChannelID                      string                 `json:"broadcast_channel_id"`
	ReminderMessageTemplate                 string                 `json:"reminder_message_template"`
	ReminderTimerDefaultSeconds             int64                  `json:"reminder_timer_default_seconds"`
	InvitedUserIDs                          []string               `json:"invited_user_ids"`
	InvitedGroupIDs                         []string               `json:"invited_group_ids"`
	InviteUsersEnabled                      bool                   `json:"invite_users_enabled"`
	DefaultOwnerID                          string                 `json:"default_owner_id"`
	DefaultOwnerEnabled                     bool                   `json:"default_owner_enabled"`
	BroadcastChannelIDs                     []string               `json:"broadcast_channel_ids"`
	BroadcastEnabled                        bool                   `json:"broadcast_enabled"`
	Metrics                                 []PlaybookMetricConfig `json:"metrics"`
	CreateChannelMemberOnNewParticipant     bool                   `json:"create_channel_member_on_new_participant"`
	RemoveChannelMemberOnRemovedParticipant bool                   `json:"remove_channel_member_on_removed_participant"`
	ChannelID                               string                 `json:"channel_id" export:"channel_id"`
	ChannelMode                             ChannelPlaybookMode    `json:"channel_mode" export:"channel_mode"`
}

type PlaybookMetricConfig struct {
	ID          string   `json:"id"`
	PlaybookID  string   `json:"playbook_id"`
	Title       string   `json:"title"`
	Description string   `json:"description"`
	Type        string   `json:"type"`
	Target      null.Int `json:"target"`
}

// PlaybookListOptions specifies the optional parameters to the
// PlaybooksService.List method.
type PlaybookListOptions struct {
	Sort         Sort          `url:"sort,omitempty"`
	Direction    SortDirection `url:"direction,omitempty"`
	SearchTeam   string        `url:"search_term,omitempty"`
	WithArchived bool          `url:"with_archived,omitempty"`
}

type GetPlaybooksResults struct {
	TotalCount int        `json:"total_count"`
	PageCount  int        `json:"page_count"`
	HasMore    bool       `json:"has_more"`
	Items      []Playbook `json:"items"`
}

type PlaybookStats struct {
	RunsInProgress                int        `json:"runs_in_progress"`
	ParticipantsActive            int        `json:"participants_active"`
	RunsFinishedPrev30Days        int        `json:"runs_finished_prev_30_days"`
	RunsFinishedPercentageChange  int        `json:"runs_finished_percentage_change"`
	RunsStartedPerWeek            []int      `json:"runs_started_per_week"`
	RunsStartedPerWeekTimes       [][]int64  `json:"runs_started_per_week_times"`
	ActiveRunsPerDay              []int      `json:"active_runs_per_day"`
	ActiveRunsPerDayTimes         [][]int64  `json:"active_runs_per_day_times"`
	ActiveParticipantsPerDay      []int      `json:"active_participants_per_day"`
	ActiveParticipantsPerDayTimes [][]int64  `json:"active_participants_per_day_times"`
	MetricOverallAverage          []null.Int `json:"metric_overall_average"`
	MetricRollingAverage          []null.Int `json:"metric_rolling_average"`
	MetricRollingAverageChange    []null.Int `json:"metric_rolling_average_change"`
	MetricValueRange              [][]int64  `json:"metric_value_range"`
	MetricRollingValues           [][]int64  `json:"metric_rolling_values"`
	LastXRunNames                 []string   `json:"last_x_run_names"`
}

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
