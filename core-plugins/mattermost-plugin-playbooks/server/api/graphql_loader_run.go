// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"

	"github.com/graph-gophers/dataloader/v7"
	"github.com/mattermost/mattermost-plugin-playbooks/server/app"
)

func graphQLStatusPostsLoader[V []app.StatusPost](ctx context.Context, playbookRunIDs []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(playbookRunIDs))
	if len(playbookRunIDs) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	statusPostsByRunID, err := c.runStore.GetStatusPostsByIDs(playbookRunIDs)
	if err != nil {
		return populateResultWithError(err, result)
	}

	for i, runID := range playbookRunIDs {
		statusPosts, ok := statusPostsByRunID[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(statusPosts),
		}
	}

	return result
}

func graphQLTimelineEventsLoader[V []app.TimelineEvent](ctx context.Context, playbookRunIDs []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(playbookRunIDs))
	if len(playbookRunIDs) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	timelineEvents, err := c.runStore.GetTimelineEventsByIDs(playbookRunIDs)
	if err != nil {
		return populateResultWithError(err, result)
	}

	timelineEventsByRunID := make(map[string]V)
	for _, timelineEvent := range timelineEvents {
		timelineEventsByRunID[timelineEvent.PlaybookRunID] = append(timelineEventsByRunID[timelineEvent.PlaybookRunID], timelineEvent)
	}

	for i, runID := range playbookRunIDs {
		timelineEvents, ok := timelineEventsByRunID[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: timelineEvents,
		}
	}

	return result
}

func graphQLRunMetricsLoader[V []app.RunMetricData](ctx context.Context, playbookRunIDs []string) []*dataloader.Result[V] {
	result := make([]*dataloader.Result[V], len(playbookRunIDs))
	if len(playbookRunIDs) == 0 {
		return result
	}

	c, err := getContext(ctx)
	if err != nil {
		return populateResultWithError(err, result)
	}

	metrics, err := c.runStore.GetMetricsByIDs(playbookRunIDs)
	if err != nil {
		return populateResultWithError(err, result)
	}

	for i, runID := range playbookRunIDs {
		metrics, ok := metrics[runID]
		if !ok {
			result[i] = &dataloader.Result[V]{Data: nil}
			continue
		}
		result[i] = &dataloader.Result[V]{
			Data: V(metrics),
		}
	}

	return result
}
