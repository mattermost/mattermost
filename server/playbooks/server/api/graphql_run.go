package api

import (
	"context"
	"strconv"

	"github.com/mattermost/mattermost-server/v6/server/playbooks/server/app"
	"github.com/pkg/errors"
)

type RunResolver struct {
	app.PlaybookRun
}

// NumTasks is a computed attribute (not stored in database) which
// returns the number of total tasks in a playbook run:
func (r *RunResolver) NumTasks() int32 {
	total := 0
	for _, checklist := range r.PlaybookRun.Checklists {
		total += len(checklist.Items)
	}
	return int32(total)
}

// NumTasksClosed is a computed attribute (not stored in database) which
// returns the number of tasks closed in a playbook run:
func (r *RunResolver) NumTasksClosed() int32 {
	closed := 0
	for _, checklist := range r.PlaybookRun.Checklists {
		for _, item := range checklist.Items {
			if item.State == app.ChecklistItemStateClosed || item.State == app.ChecklistItemStateSkipped {
				closed++
			}
		}
	}
	return int32(closed)
}

func (r *RunResolver) Type() string {
	return r.PlaybookRun.Type
}

func (r *RunResolver) CreateAt() float64 {
	return float64(r.PlaybookRun.CreateAt)
}

func (r *RunResolver) EndAt() float64 {
	return float64(r.PlaybookRun.EndAt)
}

func (r *RunResolver) SummaryModifiedAt() float64 {
	return float64(r.PlaybookRun.SummaryModifiedAt)
}
func (r *RunResolver) LastStatusUpdateAt() float64 {
	return float64(r.PlaybookRun.LastStatusUpdateAt)
}

func (r *RunResolver) RetrospectivePublishedAt() float64 {
	return float64(r.PlaybookRun.RetrospectivePublishedAt)
}

func (r *RunResolver) ReminderTimerDefaultSeconds() float64 {
	return float64(r.PlaybookRun.ReminderTimerDefaultSeconds)
}

func (r *RunResolver) PreviousReminder() float64 {
	return float64(r.PlaybookRun.PreviousReminder)
}

func (r *RunResolver) RetrospectiveReminderIntervalSeconds() float64 {
	return float64(r.PlaybookRun.RetrospectiveReminderIntervalSeconds)
}

func (r *RunResolver) Checklists() []*ChecklistResolver {
	checklistResolvers := make([]*ChecklistResolver, 0, len(r.PlaybookRun.Checklists))
	for _, checklist := range r.PlaybookRun.Checklists {
		checklistResolvers = append(checklistResolvers, &ChecklistResolver{checklist})
	}

	return checklistResolvers
}

func (r *RunResolver) StatusPosts() []*StatusPostResolver {
	statusPostResolvers := make([]*StatusPostResolver, 0, len(r.PlaybookRun.StatusPosts))
	for _, statusPost := range r.PlaybookRun.StatusPosts {
		statusPostResolvers = append(statusPostResolvers, &StatusPostResolver{statusPost})
	}

	return statusPostResolvers
}

func (r *RunResolver) TimelineEvents() []*TimelineEventResolver {
	timelineEventResolvers := make([]*TimelineEventResolver, 0, len(r.PlaybookRun.StatusPosts))
	for _, event := range r.PlaybookRun.TimelineEvents {
		timelineEventResolvers = append(timelineEventResolvers, &TimelineEventResolver{event})
	}

	return timelineEventResolvers
}

func (r *RunResolver) IsFavorite(ctx context.Context) (bool, error) {
	c, err := getContext(ctx)
	if err != nil {
		return false, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	thunk := c.favoritesLoader.Load(ctx, favoriteInfo{
		TeamID: r.TeamID,
		UserID: userID,
		Type:   app.RunItemType,
		ID:     r.ID,
	})

	result, err := thunk()
	if err != nil {
		return false, err
	}

	return result, nil
}

type StatusPostResolver struct {
	app.StatusPost
}

func (r *StatusPostResolver) CreateAt() float64 {
	return float64(r.StatusPost.CreateAt)
}

func (r *StatusPostResolver) DeleteAt() float64 {
	return float64(r.StatusPost.DeleteAt)
}

type TimelineEventResolver struct {
	app.TimelineEvent
}

func (r *TimelineEventResolver) CreateAt() float64 {
	return float64(r.TimelineEvent.CreateAt)
}

func (r *TimelineEventResolver) EventType() string {
	return string(r.TimelineEvent.EventType)
}

func (r *TimelineEventResolver) DeleteAt() float64 {
	return float64(r.TimelineEvent.DeleteAt)
}

func (r *RunResolver) Followers(ctx context.Context) ([]string, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}

	metadata, err := c.playbookRunService.GetPlaybookRunMetadata(r.ID)
	if err != nil {
		return nil, errors.Wrap(err, "can't get metadata")
	}

	return metadata.Followers, nil
}

func (r *RunResolver) Playbook(ctx context.Context) (*PlaybookResolver, error) {
	c, err := getContext(ctx)
	if err != nil {
		return nil, err
	}
	userID := c.r.Header.Get("Mattermost-User-ID")

	thunk := c.playbooksLoader.Load(ctx, playbookInfo{
		UserID: userID,
		ID:     r.PlaybookID,
		TeamID: r.TeamID,
	})

	result, err := thunk()
	if err != nil {
		return nil, err
	}

	if result == nil {
		return nil, nil
	}

	return &PlaybookResolver{*result}, nil
}

func (r *RunResolver) LastUpdatedAt(ctx context.Context) float64 {
	if len(r.PlaybookRun.TimelineEvents) < 1 {
		return float64(r.PlaybookRun.CreateAt)
	}
	return float64(r.PlaybookRun.TimelineEvents[len(r.PlaybookRun.TimelineEvents)-1].EventAt)
}

type RunConnectionResolver struct {
	results app.GetPlaybookRunsResults
	page    int
}

func (r *RunConnectionResolver) TotalCount() int32 {
	return int32(r.results.TotalCount)
}

func (r *RunConnectionResolver) Edges() []*RunEdgeResolver {
	ret := make([]*RunEdgeResolver, 0, len(r.results.Items))
	// Cursor is just the end cursor for the page for now
	cursor := r.results.PageCount
	for _, run := range r.results.Items {
		ret = append(ret, &RunEdgeResolver{run, cursor})
	}

	return ret
}

func (r *RunConnectionResolver) PageInfo() *PageInfoResolver {
	startCursor := ""
	endCursor := ""

	if len(r.results.Items) > 0 {
		// "Cursors" are just the page numbers
		startCursor = encodeRunConnectionCursor(r.page)
		endCursor = encodeRunConnectionCursor(r.page + 1)
	}

	return &PageInfoResolver{
		HasNextPage: r.results.HasMore,
		StartCursor: startCursor,
		EndCursor:   endCursor,
	}
}

func encodeRunConnectionCursor(cursor int) string {
	return strconv.Itoa(cursor)
}

func decodeRunConnectionCursor(cursor string) (int, error) {
	num, err := strconv.Atoi(cursor)
	if err != nil {
		return 0, errors.Wrap(err, "unable to decode cursor")
	}
	return num, nil
}

type RunEdgeResolver struct {
	run    app.PlaybookRun
	cursor int
}

func (r *RunEdgeResolver) Node() *RunResolver {
	return &RunResolver{r.run}
}

func (r *RunEdgeResolver) Cursor() string {
	return encodeRunConnectionCursor(r.cursor)
}

type PageInfoResolver struct {
	HasNextPage bool
	StartCursor string
	EndCursor   string
}
