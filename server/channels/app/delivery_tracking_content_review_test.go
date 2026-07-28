// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

func TestCreateDeliveryTrackingContentReviewJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	// Enable content flagging with BasicUser as a common reviewer so posts can be
	// flagged (which sets the "Pending" status the trigger requires).
	contentFlaggingConfig := model.ContentFlaggingSettingsRequest{}
	contentFlaggingConfig.SetDefaults(false)
	contentFlaggingConfig.ReviewerSettings.CommonReviewers = model.NewPointer(true)
	contentFlaggingConfig.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id}
	contentFlaggingConfig.AdditionalSettings.ReporterCommentRequired = model.NewPointer(false)
	contentFlaggingConfig.AdditionalSettings.HideFlaggedContent = model.NewPointer(false)
	contentFlaggingConfig.AdditionalSettings.Reasons = &[]string{"spam", "harassment", "inappropriate"}
	require.Nil(t, th.App.SaveContentFlaggingConfig(th.Context, contentFlaggingConfig))

	t.Run("returns forbidden when the feature is disabled", func(t *testing.T) {
		_, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, model.NewId(), th.BasicTeam.Id, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusForbidden, appErr.StatusCode)
	})

	enableDeliveryTracking(th)

	t.Run("rejects a post that is not flagged", func(t *testing.T) {
		post := th.CreatePost(t, th.BasicChannel)
		_, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("rejects a flagged post that is no longer under review", func(t *testing.T) {
		post := setupFlaggedPost(t, th)

		// Move the post to a terminal status so it is flagged but no longer in a
		// reviewable (Pending/Assigned) state.
		groupID, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)
		statusValue, appErr := th.App.GetPostContentFlaggingPropertyValue(post.Id, ContentFlaggingPropertyNameStatus)
		require.Nil(t, appErr)
		statusValue.Value = json.RawMessage(`"` + model.ContentFlaggingStatusRemoved + `"`)
		_, appErr = th.App.UpdatePropertyValue(th.Context, groupID, statusValue)
		require.Nil(t, appErr)

		_, appErr = th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser.Id)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})

	t.Run("creates a job for a flagged post and reuses it for concurrent triggers", func(t *testing.T) {
		post := setupFlaggedPost(t, th)

		job, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, appErr)
		require.NotNil(t, job)
		require.Equal(t, model.JobTypeDeliveryTrackingContentReview, job.Type)
		require.Equal(t, post.Id, job.Data["post_id"])
		require.Equal(t, th.BasicTeam.Id, job.Data["team_id"])
		require.Equal(t, th.BasicUser.Id, job.Data["requested_by"])

		// A second trigger (even by a different reviewer) while the first job is
		// still pending must return the same job, not create a duplicate.
		job2, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Equal(t, job.Id, job2.Id, "concurrent triggers should reuse the in-flight job")

		// Both reviewers are accumulated in requested_by (comma-separated, deduped)
		// so the completion notification can reach everyone who asked.
		refetched, err := th.App.Srv().Store().Job().Get(th.Context, job.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, strings.Split(refetched.Data["requested_by"], ","))

		// A repeat trigger by an existing requester does not duplicate the entry.
		_, appErr = th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		refetched, err = th.App.Srv().Store().Job().Get(th.Context, job.Id)
		require.NoError(t, err)
		require.ElementsMatch(t, []string{th.BasicUser.Id, th.BasicUser2.Id}, strings.Split(refetched.Data["requested_by"], ","))
	})

	t.Run("marks the flagged post's delivery tracking status in_progress", func(t *testing.T) {
		post := setupFlaggedPost(t, th)

		// A freshly flagged post starts at not_started.
		require.Equal(t, model.DeliveryTrackingStatusNotStarted, deliveryTrackingStatusValue(t, th, post.Id))

		_, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		require.Equal(t, model.DeliveryTrackingStatusInProgress, deliveryTrackingStatusValue(t, th, post.Id))
	})

	t.Run("still marks in_progress when the job it attached to is running", func(t *testing.T) {
		post := setupFlaggedPost(t, th)

		job, appErr := th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser.Id)
		require.Nil(t, appErr)

		_, err := th.App.Srv().Store().Job().UpdateStatus(job.Id, model.JobStatusInProgress)
		require.NoError(t, err)

		// A second reviewer attaching to a job that is still running gets the
		// in_progress announcement: the terminal-status guard must not suppress it.
		_, appErr = th.App.CreateDeliveryTrackingContentReviewJob(th.Context, post.Id, th.BasicTeam.Id, th.BasicUser2.Id)
		require.Nil(t, appErr)
		require.Equal(t, model.DeliveryTrackingStatusInProgress, deliveryTrackingStatusValue(t, th, post.Id))
	})
}

// deliveryTrackingStatusValue returns the current delivery_tracking_status property
// value for a flagged post, with the JSON quoting stripped.
func deliveryTrackingStatusValue(t *testing.T, th *TestHelper, postID string) string {
	t.Helper()
	value, appErr := th.App.GetPostContentFlaggingPropertyValue(postID, contentFlaggingPropertyNameDeliveryTrackingStatus)
	require.Nil(t, appErr)
	return strings.Trim(string(value.Value), `"`)
}

func TestDeliveryTrackingContentReviewJobExists(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	postID := model.NewId()

	t.Run("returns false when no job exists for the post", func(t *testing.T) {
		exists, appErr := th.App.DeliveryTrackingContentReviewJobExists(th.Context, postID, model.JobStatusPending, model.JobStatusInProgress, model.JobStatusSuccess)
		require.Nil(t, appErr)
		require.False(t, exists)
	})

	t.Run("matches an existing job only for the queried statuses", func(t *testing.T) {
		_, err := th.App.Srv().Store().Job().Save(&model.Job{
			Id:       model.NewId(),
			Type:     model.JobTypeDeliveryTrackingContentReview,
			Status:   model.JobStatusPending,
			CreateAt: model.GetMillis(),
			Data:     model.StringMap{jobDataKeyPostId: postID},
		})
		require.NoError(t, err)

		exists, appErr := th.App.DeliveryTrackingContentReviewJobExists(th.Context, postID, model.JobStatusPending)
		require.Nil(t, appErr)
		require.True(t, exists)

		exists, appErr = th.App.DeliveryTrackingContentReviewJobExists(th.Context, postID, model.JobStatusSuccess)
		require.Nil(t, appErr)
		require.False(t, exists)
	})
}

func TestAppendToCSVSet(t *testing.T) {
	tests := []struct {
		name       string
		csv, value string
		want       string
	}{
		{"empty csv seeds the value", "", "userA", "userA"},
		{"appends a new value", "userA", "userB", "userA,userB"},
		{"dedupes an existing value", "userA,userB", "userB", "userA,userB"},
		{"a substring is a distinct entry", "userA,userB", "user", "userA,userB,user"},
		{"empty value is a no-op", "userA", "", "userA"},
		{"empty value and empty csv", "", "", ""},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			require.Equal(t, tc.want, appendToCSVSet(tc.csv, tc.value))
		})
	}
}

func TestMergeRequestedBy(t *testing.T) {
	// The requester in patch is folded into existing's requested_by set; other keys
	// are preserved.
	merged := mergeRequestedBy(
		model.StringMap{"post_id": "p1", jobDataKeyRequestedBy: "userA"},
		model.StringMap{jobDataKeyRequestedBy: "userB"},
	)
	require.Equal(t, "userA,userB", merged[jobDataKeyRequestedBy])
	require.Equal(t, "p1", merged["post_id"], "unrelated keys are preserved")

	// Re-running with an already-present requester is a no-op, so it is safe for the
	// serializable transaction to retry the merge.
	merged = mergeRequestedBy(merged, model.StringMap{jobDataKeyRequestedBy: "userB"})
	require.Equal(t, "userA,userB", merged[jobDataKeyRequestedBy])
}

func TestRequestedBySet(t *testing.T) {
	require.Nil(t, requestedBySet(""), "an empty CSV yields no requesters")
	require.Equal(t, map[string]bool{"userA": true}, requestedBySet("userA"))
	require.Equal(t, map[string]bool{"userA": true, "userB": true}, requestedBySet("userA,userB"))
	require.Equal(t, map[string]bool{"userA": true, "userB": true}, requestedBySet("userA,,userB,"), "empty entries are ignored")
}

func TestNotifyDeliveryTrackingContentReviewRequesters(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))

	config := getBaseConfig(th)
	config.ReviewerSettings.CommonReviewerIds = []string{th.BasicUser.Id, th.BasicUser2.Id}
	require.Nil(t, th.App.SaveContentFlaggingConfig(th.Context, config))

	contentReviewBot, appErr := th.App.getContentReviewBot(th.Context)
	require.Nil(t, appErr)

	reviewerThreads := func(flaggedPostID string) map[string]string {
		groupID, appErr := th.App.ContentFlaggingGroupId()
		require.Nil(t, appErr)
		mappedFields, appErr := th.App.GetContentFlaggingMappedFields(groupID)
		require.Nil(t, appErr)
		fieldID := mappedFields[contentFlaggingPropertyNameFlaggedPostId].ID

		reviewerPostIDs, appErr := th.App.getReviewerPostsForFlaggedPost(groupID, flaggedPostID, fieldID)
		require.Nil(t, appErr)

		threads := make(map[string]string, len(reviewerPostIDs))
		for _, reviewerPostID := range reviewerPostIDs {
			reviewerPost, appErr := th.App.GetSinglePost(th.Context, reviewerPostID, false)
			require.Nil(t, appErr)
			channel, appErr := th.App.GetChannel(th.Context, reviewerPost.ChannelId)
			require.Nil(t, appErr)
			threads[channel.GetOtherUserIdForDM(contentReviewBot.UserId)] = reviewerPostID
		}
		return threads
	}

	botReplies := func(reviewerPostID string) []*model.Post {
		reviewerPost, appErr := th.App.GetSinglePost(th.Context, reviewerPostID, false)
		require.Nil(t, appErr)
		posts, appErr := th.App.GetPostsPage(th.Context, model.GetPostsOptions{ChannelId: reviewerPost.ChannelId, Page: 0, PerPage: 50})
		require.Nil(t, appErr)

		var replies []*model.Post
		for _, p := range posts.Posts {
			if p.RootId == reviewerPostID && p.UserId == contentReviewBot.UserId {
				replies = append(replies, p)
			}
		}
		return replies
	}

	localizedMessage := func(userID, key string) string {
		user, appErr := th.App.GetUser(userID)
		require.Nil(t, appErr)
		return i18n.GetUserTranslations(user.Locale)(key)
	}

	flagPost := func() *model.Post {
		post := th.CreatePost(t, th.BasicChannel)
		require.Nil(t, th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.SystemAdminUser.Id, model.FlagContentRequest{Reason: "spam", Comment: "This is spam content"}))
		time.Sleep(2 * time.Second)
		return post
	}

	// The notifier reads the job from the store, so every case needs a real row.
	saveJob := func(data model.StringMap) string {
		job := &model.Job{
			Id:       model.NewId(),
			Type:     model.JobTypeDeliveryTrackingContentReview,
			Status:   model.JobStatusInProgress,
			CreateAt: model.GetMillis(),
			Data:     data,
		}
		_, err := th.App.Srv().Store().Job().Save(job)
		require.NoError(t, err)
		return job.Id
	}

	t.Run("notifies only the reviewers who requested the job", func(t *testing.T) {
		post := flagPost()
		threads := reviewerThreads(post.Id)
		require.Len(t, threads, 2)

		jobID := saveJob(model.StringMap{jobDataKeyPostId: post.Id, jobDataKeyRequestedBy: th.BasicUser.Id})
		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, jobID, true))

		requesterReplies := botReplies(threads[th.BasicUser.Id])
		require.Len(t, requesterReplies, 1, "the requester is notified in their review thread")
		require.Equal(t, localizedMessage(th.BasicUser.Id, deliveryTrackingCompletionSuccessMessageKey), requesterReplies[0].Message)
		require.Empty(t, botReplies(threads[th.BasicUser2.Id]), "a reviewer who did not request the job is not notified")
	})

	t.Run("notifies every reviewer who requested the job", func(t *testing.T) {
		post := flagPost()
		threads := reviewerThreads(post.Id)
		require.Len(t, threads, 2)

		// Both reviewers are read from the stored row, including any who attached
		// after the worker took its own snapshot of the job.
		jobID := saveJob(model.StringMap{jobDataKeyPostId: post.Id, jobDataKeyRequestedBy: th.BasicUser.Id + "," + th.BasicUser2.Id})
		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, jobID, false))

		user1Replies := botReplies(threads[th.BasicUser.Id])
		require.Len(t, user1Replies, 1)
		require.Equal(t, localizedMessage(th.BasicUser.Id, deliveryTrackingCompletionFailureMessageKey), user1Replies[0].Message)
		require.Len(t, botReplies(threads[th.BasicUser2.Id]), 1)
	})

	t.Run("is a no-op when no reviewer requested the job", func(t *testing.T) {
		post := flagPost()
		threads := reviewerThreads(post.Id)

		jobID := saveJob(model.StringMap{jobDataKeyPostId: post.Id})
		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, jobID, true))

		for _, reviewerPostID := range threads {
			require.Empty(t, botReplies(reviewerPostID))
		}
	})

	t.Run("is a no-op when post_id is missing", func(t *testing.T) {
		jobID := saveJob(model.StringMap{jobDataKeyRequestedBy: th.BasicUser.Id})
		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, jobID, true))
	})

	t.Run("errors when the job does not exist", func(t *testing.T) {
		appErr := th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, model.NewId(), true)
		require.NotNil(t, appErr)
		require.Equal(t, http.StatusInternalServerError, appErr.StatusCode)
	})

	t.Run("sets the delivery tracking status to completed then failed", func(t *testing.T) {
		post := flagPost()
		require.Equal(t, model.DeliveryTrackingStatusNotStarted, deliveryTrackingStatusValue(t, th, post.Id))

		data := model.StringMap{jobDataKeyPostId: post.Id, jobDataKeyTeamId: th.BasicTeam.Id, jobDataKeyRequestedBy: th.BasicUser.Id}

		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, saveJob(data), true))
		require.Equal(t, model.DeliveryTrackingStatusCompleted, deliveryTrackingStatusValue(t, th, post.Id))

		require.Nil(t, th.App.NotifyDeliveryTrackingContentReviewRequesters(th.Context, saveJob(data), false))
		require.Equal(t, model.DeliveryTrackingStatusFailed, deliveryTrackingStatusValue(t, th, post.Id))
	})
}
