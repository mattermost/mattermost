// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package sqlstore

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/mattermost/mattermost-server/server/v8/playbooks/server/app"
)

func TestPlaybookRunStore_CreateTimelineEvent(t *testing.T) {
	db := setupTestDB(t)
	iStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	t.Run("Save and retrieve 4 timeline events", func(t *testing.T) {
		createAt := model.GetMillis()
		inc01 := NewBuilder(nil).
			WithName("playbook run 1").
			WithCreateAt(createAt).
			WithChecklists([]int{8}).
			ToPlaybookRun()

		playbookRun, err := iStore.CreatePlaybookRun(inc01)
		require.NoError(t, err)

		createPlaybookRunChannel(t, store, inc01)

		event1 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt,
			EventAt:       1234,
			EventType:     app.PlaybookRunCreated,
			Summary:       "this is a summary",
			Details:       "these are the details",
			PostID:        "testpostID",
			SubjectUserID: "testuserID",
			CreatorUserID: "testUserID2",
		}
		_, err = iStore.CreateTimelineEvent(event1)
		require.NoError(t, err)

		event2 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 1,
			EventAt:       1235,
			EventType:     app.AssigneeChanged,
			Summary:       "this is a summary",
			Details:       "these are the details",
			PostID:        "testpostID2",
			SubjectUserID: "testuserID",
			CreatorUserID: "testUserID2",
		}
		_, err = iStore.CreateTimelineEvent(event2)
		require.NoError(t, err)

		event3 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 2,
			EventAt:       1236,
			EventType:     app.StatusUpdated,
			Summary:       "this is a summary",
			Details:       "these are the details",
			PostID:        "testpostID3",
			SubjectUserID: "testuserID",
			CreatorUserID: "testUserID2",
		}
		_, err = iStore.CreateTimelineEvent(event3)
		require.NoError(t, err)

		event4 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 3,
			EventAt:       123734,
			EventType:     app.StatusUpdated,
			Summary:       "this is a summary",
			Details:       "these are the details",
			PostID:        "testpostID4",
			SubjectUserID: "testuserID",
			CreatorUserID: "testUserID2",
		}
		_, err = iStore.CreateTimelineEvent(event4)
		require.NoError(t, err)

		retPlaybookRun, err := iStore.GetPlaybookRun(playbookRun.ID)
		require.NoError(t, err)

		require.Len(t, retPlaybookRun.TimelineEvents, 4)
		require.Equal(t, *event1, retPlaybookRun.TimelineEvents[0])
		require.Equal(t, *event2, retPlaybookRun.TimelineEvents[1])
		require.Equal(t, *event3, retPlaybookRun.TimelineEvents[2])
		require.Equal(t, *event4, retPlaybookRun.TimelineEvents[3])
	})
}

func TestPlaybookRunStore_UpdateTimelineEvent(t *testing.T) {
	db := setupTestDB(t)
	iStore := setupPlaybookRunStore(t, db)
	store := setupSQLStore(t, db)
	setupChannelsTable(t, db)
	setupPostsTable(t, db)

	t.Run("Save 4 and delete 2 timeline events", func(t *testing.T) {
		createAt := model.GetMillis()
		inc01 := NewBuilder(nil).
			WithName("playbook run 1").
			WithCreateAt(createAt).
			WithChecklists([]int{8}).
			ToPlaybookRun()

		playbookRun, err := iStore.CreatePlaybookRun(inc01)
		require.NoError(t, err)

		createPlaybookRunChannel(t, store, inc01)

		event1 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt,
			EventAt:       createAt,
			EventType:     app.PlaybookRunCreated,
			PostID:        "testpostID",
			SubjectUserID: "testuserID",
		}
		_, err = iStore.CreateTimelineEvent(event1)
		require.NoError(t, err)

		event2 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 1,
			EventAt:       createAt + 1,
			EventType:     app.AssigneeChanged,
			PostID:        "testpostID2",
			SubjectUserID: "testuserID",
		}
		_, err = iStore.CreateTimelineEvent(event2)
		require.NoError(t, err)

		event3 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 2,
			EventAt:       createAt + 2,
			EventType:     app.StatusUpdated,
			Summary:       "this is a summary",
			Details:       "these are the details",
			PostID:        "testpostID3",
			SubjectUserID: "testuserID",
			CreatorUserID: "testUserID2",
		}
		_, err = iStore.CreateTimelineEvent(event3)
		require.NoError(t, err)

		event4 := &app.TimelineEvent{
			PlaybookRunID: playbookRun.ID,
			CreateAt:      createAt + 3,
			EventAt:       createAt + 3,
			EventType:     app.StatusUpdated,
			PostID:        "testpostID4",
			SubjectUserID: "testuserID",
		}
		_, err = iStore.CreateTimelineEvent(event4)
		require.NoError(t, err)

		retPlaybookRun, err := iStore.GetPlaybookRun(playbookRun.ID)
		require.NoError(t, err)

		require.Len(t, retPlaybookRun.TimelineEvents, 4)
		require.Equal(t, *event1, retPlaybookRun.TimelineEvents[0])
		require.Equal(t, *event2, retPlaybookRun.TimelineEvents[1])
		require.Equal(t, *event3, retPlaybookRun.TimelineEvents[2])
		require.Equal(t, *event4, retPlaybookRun.TimelineEvents[3])

		event3.DeleteAt = model.GetMillis()
		event3.EventType = app.AssigneeChanged
		event3.Summary = "new summary"
		event3.Details = "new details"
		event3.PostID = "23abc34"
		event3.SubjectUserID = "23409agbcef"
		event3.CreatorUserID = "someoneelse"
		err = iStore.UpdateTimelineEvent(event3)
		require.NoError(t, err)

		event4.DeleteAt = model.GetMillis()
		err = iStore.UpdateTimelineEvent(event4)
		require.NoError(t, err)

		retPlaybookRun, err = iStore.GetPlaybookRun(playbookRun.ID)
		require.NoError(t, err)

		require.Len(t, retPlaybookRun.TimelineEvents, 2)
		require.Equal(t, *event1, retPlaybookRun.TimelineEvents[0])
		require.Equal(t, *event2, retPlaybookRun.TimelineEvents[1])
	})
}
