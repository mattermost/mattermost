// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"fmt"

	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
	"github.com/sirupsen/logrus"
)

type PlaybookResolver struct {
	app.Playbook
}

func (r *PlaybookResolver) ChannelMode(ctx context.Context) string {
	return fmt.Sprint(r.Playbook.ChannelMode)
}

func (r *PlaybookResolver) IsFavorite(ctx context.Context) (bool, error) {
	c, err := getContext(ctx)
	if err != nil {
		return false, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")
	thunk := c.favoritesLoader.Load(ctx, favoriteInfo{
		TeamID: r.TeamID,
		UserID: userID,
		Type:   app.PlaybookItemType,
		ID:     r.ID,
	})

	result, err := thunk()
	if err != nil {
		return false, err
	}
	return result, nil
}

func (r *PlaybookResolver) DeleteAt() float64 {
	return float64(r.Playbook.DeleteAt)
}

func (r *PlaybookResolver) LastRunAt() float64 {
	return float64(r.Playbook.LastRunAt)
}

func (r *PlaybookResolver) NumRuns() int32 {
	return int32(r.Playbook.NumRuns)
}

func (r *PlaybookResolver) ActiveRuns() int32 {
	return int32(r.Playbook.ActiveRuns)
}

func (r *PlaybookResolver) RetrospectiveReminderIntervalSeconds() float64 {
	return float64(r.Playbook.RetrospectiveReminderIntervalSeconds)
}

func (r *PlaybookResolver) ReminderTimerDefaultSeconds() float64 {
	return float64(r.Playbook.ReminderTimerDefaultSeconds)
}

func (r *PlaybookResolver) Metrics() []*MetricConfigResolver {
	metricConfigResolvers := make([]*MetricConfigResolver, 0, len(r.Playbook.Metrics))
	for _, metricConfig := range r.Playbook.Metrics {
		metricConfigResolvers = append(metricConfigResolvers, &MetricConfigResolver{metricConfig})
	}

	return metricConfigResolvers
}

type MetricConfigResolver struct {
	app.PlaybookMetricConfig
}

func (r *MetricConfigResolver) Target() *int32 {
	if r.PlaybookMetricConfig.Target.Valid {
		intvalue := int32(r.PlaybookMetricConfig.Target.ValueOrZero())
		return &intvalue
	}
	return nil
}

func (r *PlaybookResolver) Checklists() []*ChecklistResolver {
	checklistResolvers := make([]*ChecklistResolver, 0, len(r.Playbook.Checklists))
	for _, checklist := range r.Playbook.Checklists {
		checklistResolvers = append(checklistResolvers, &ChecklistResolver{checklist})
	}

	return checklistResolvers
}

type ChecklistResolver struct {
	app.Checklist
}

func (r *ChecklistResolver) Items() []*ChecklistItemResolver {
	checklistItemResolvers := make([]*ChecklistItemResolver, 0, len(r.Checklist.Items))
	for _, items := range r.Checklist.Items {
		checklistItemResolvers = append(checklistItemResolvers, &ChecklistItemResolver{items})
	}

	return checklistItemResolvers
}

type ChecklistItemResolver struct {
	app.ChecklistItem
}

func (r *ChecklistItemResolver) StateModified() float64 {
	return float64(r.ChecklistItem.StateModified)
}

func (r *ChecklistItemResolver) AssigneeModified() float64 {
	return float64(r.ChecklistItem.AssigneeModified)
}

func (r *ChecklistItemResolver) CommandLastRun() float64 {
	return float64(r.ChecklistItem.CommandLastRun)
}

func (r *ChecklistItemResolver) DueDate() float64 {
	return float64(r.ChecklistItem.DueDate)
}

func (r *ChecklistItemResolver) TaskActions() []*TaskActionResolver {
	taskActionsResolvers := make([]*TaskActionResolver, 0, len(r.ChecklistItem.TaskActions))
	for _, taskAction := range r.ChecklistItem.TaskActions {
		taskActionsResolvers = append(taskActionsResolvers, &TaskActionResolver{taskAction})
	}

	return taskActionsResolvers
}

type TaskActionResolver struct {
	app.TaskAction
}

func (r *TaskActionResolver) Trigger() *TriggerResolver {
	return &TriggerResolver{r.TaskAction.Trigger}
}

func (r *TaskActionResolver) Actions() []*ActionResolver {
	actionsResolvers := make([]*ActionResolver, 0, len(r.TaskAction.Actions))
	for _, action := range r.TaskAction.Actions {
		actionsResolvers = append(actionsResolvers, &ActionResolver{action})
	}
	return actionsResolvers
}

type ActionResolver struct {
	app.Action
}

func (r *ActionResolver) Type() string {
	return string(r.Action.Type)
}

func (r *ActionResolver) Payload() string {
	var payload string
	switch r.Action.Type {
	case app.MarkItemAsDoneActionType:
		payload = r.Action.Payload
	default:
		logrus.WithField("task_action_type", r.Action.Type).Error("Unknown trigger type")
		payload = ""
	}
	return payload
}

type TriggerResolver struct {
	app.Trigger
}

func (r *TriggerResolver) Type() string {
	return string(r.Trigger.Type)
}

func (r *TriggerResolver) Payload() string {
	var payload string
	switch r.Trigger.Type {
	case app.KeywordsByUsersTriggerType:
		payload = r.Trigger.Payload
	default:
		logrus.WithField("task_trigger_type", r.Trigger.Type).Error("Unknown trigger type")
		payload = ""
	}
	return payload
}

type UpdateChecklist struct {
	Title string                `json:"title"`
	Items []UpdateChecklistItem `json:"items"`
}

func (c UpdateChecklist) GetItems() []app.ChecklistItemCommon {
	items := make([]app.ChecklistItemCommon, len(c.Items))
	for i := range c.Items {
		items[i] = &c.Items[i]
	}
	return items
}

type UpdateChecklistItem struct {
	Title            string            `json:"title"`
	State            string            `json:"state"`
	StateModified    float64           `json:"state_modified"`
	AssigneeID       string            `json:"assignee_id"`
	AssigneeModified float64           `json:"assignee_modified"`
	Command          string            `json:"command"`
	CommandLastRun   float64           `json:"command_last_run"`
	Description      string            `json:"description"`
	LastSkipped      float64           `json:"delete_at"`
	DueDate          float64           `json:"due_date"`
	TaskActions      *[]app.TaskAction `json:"task_actions"`
}

func (ci *UpdateChecklistItem) GetAssigneeID() string {
	return ci.AssigneeID
}

func (ci *UpdateChecklistItem) SetAssigneeModified(modified int64) {
	ci.AssigneeModified = float64(modified)
}

func (ci *UpdateChecklistItem) SetState(state string) {
	ci.State = state
}

func (ci *UpdateChecklistItem) SetStateModified(modified int64) {
	ci.StateModified = float64(modified)
}

func (ci *UpdateChecklistItem) SetCommandLastRun(lastRun int64) {
	ci.CommandLastRun = float64(lastRun)
}
