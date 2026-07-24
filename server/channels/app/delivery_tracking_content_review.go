// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	jobDataKeyPostId      = "post_id"
	jobDataKeyTeamId      = "team_id"
	jobDataKeyRequestedBy = "requested_by"

	deliveryTrackingPurgeJobWaitTimeout = 15 * time.Second
)

var (
	deliveryTrackingCompletionSuccessMessageKey = i18n.TranslationId("app.data_spillage.delivery_tracking.completion_success.message")
	deliveryTrackingCompletionFailureMessageKey = i18n.TranslationId("app.data_spillage.delivery_tracking.completion_failure.message")
)

func (a *App) CreateDeliveryTrackingContentReviewJob(rctx request.CTX, postID, teamID, requestedBy string) (*model.Job, *model.AppError) {
	if !a.Config().PostDeliveryTrackingEnabled() {
		return nil, model.NewAppError("CreateDeliveryTrackingContentReviewJob", "app.job.error", nil, "post delivery tracking is not enabled", http.StatusForbidden)
	}

	status, appErr := a.GetPostContentFlaggingPropertyValue(postID, ContentFlaggingPropertyNameStatus)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return nil, model.NewAppError("CreateDeliveryTrackingContentReviewJob", "app.job.error", nil, "post is not flagged", http.StatusBadRequest)
		}
		return nil, appErr
	}

	reviewStatus := strings.Trim(string(status.Value), `"`)
	if reviewStatus != model.ContentFlaggingStatusPending && reviewStatus != model.ContentFlaggingStatusAssigned {
		return nil, model.NewAppError("CreateDeliveryTrackingContentReviewJob", "app.job.error", nil, "post is not under review", http.StatusBadRequest)
	}

	job, appErr := a.Srv().Jobs.CreateJobOnceByTypeAndData(
		rctx,
		model.JobTypeDeliveryTrackingContentReview,
		map[string]string{jobDataKeyPostId: postID, jobDataKeyTeamId: teamID, jobDataKeyRequestedBy: requestedBy},
		map[string]string{jobDataKeyPostId: postID},
	)
	if appErr != nil {
		return nil, appErr
	}

	// CreateJobOnceByTypeAndData returns nil when a content-review job for this post
	// is already pending/in-progress (a dedupe hit). Fetch the in-flight job so this
	// requester is still recorded on it and returned to the caller.
	if job == nil {
		existing, err := a.Srv().Store().Job().GetByTypeAndData(rctx, model.JobTypeDeliveryTrackingContentReview, map[string]string{jobDataKeyPostId: postID}, true, model.JobStatusPending, model.JobStatusInProgress)
		if err != nil {
			return nil, model.NewAppError("CreateDeliveryTrackingContentReviewJob", "app.job.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(existing) == 0 {
			return nil, nil
		}
		job = existing[0]
	}

	merged, err := a.Srv().Store().Job().PatchJobData(job.Id, model.StringMap{jobDataKeyRequestedBy: requestedBy}, mergeRequestedBy)
	if err != nil {
		rctx.Logger().Warn("Failed to record content-review requester on job",
			mlog.String("job_id", job.Id), mlog.String("user_id", requestedBy), mlog.Err(err))
	} else if merged != nil {
		job.Data = merged
	}

	if appErr := a.setDeliveryTrackingStatus(rctx, postID, teamID, model.DeliveryTrackingStatusInProgress); appErr != nil {
		rctx.Logger().Warn("Failed to set delivery tracking status to in_progress",
			mlog.String("post_id", postID), mlog.Err(appErr))
	}

	return job, nil
}

func (a *App) setDeliveryTrackingStatus(rctx request.CTX, postID, teamID, status string) *model.AppError {
	groupID, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupID)
	if appErr != nil {
		return appErr
	}

	field, ok := mappedFields[contentFlaggingPropertyNameDeliveryTrackingStatus]
	if !ok {
		return model.NewAppError("setDeliveryTrackingStatus", "app.data_spillage.delivery_tracking.status_field_missing.app_error", nil, "", http.StatusInternalServerError)
	}

	value := &model.PropertyValue{
		TargetID:   postID,
		TargetType: model.PropertyValueTargetTypePost,
		GroupID:    groupID,
		FieldID:    field.ID,
		Value:      json.RawMessage(fmt.Sprintf(`"%s"`, status)),
	}

	if _, appErr = a.UpsertPropertyValue(rctx, value); appErr != nil {
		return appErr
	}

	// Notify the team's reviewers over websocket so the RHS updates live. Mirrors
	// the other content-flagging status-change sites, which publish off the
	// request path.
	a.Srv().Go(func() {
		if err := a.publishContentFlaggingReportUpdateEvent(postID, teamID, []*model.PropertyValue{value}); err != nil {
			rctx.Logger().Error("Failed to publish delivery tracking status change", mlog.Err(err), mlog.String("post_id", postID))
		}
	})

	return nil
}

// DeliveryTrackingContentReviewJobExists reports whether a delivery-tracking
// content-review job for the given post exists in any of the provided statuses.
func (a *App) DeliveryTrackingContentReviewJobExists(rctx request.CTX, postID string, statuses ...string) (bool, *model.AppError) {
	jobs, err := a.Srv().Store().Job().GetByTypeAndData(rctx, model.JobTypeDeliveryTrackingContentReview, map[string]string{jobDataKeyPostId: postID}, true, statuses...)
	if err != nil {
		return false, model.NewAppError("DeliveryTrackingContentReviewJobExists", "app.job.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return len(jobs) > 0, nil
}

func (a *App) purgeDeliveryTrackingContentReview(rctx request.CTX, postID string) {
	jobs, err := a.Srv().Store().Job().GetByTypeAndData(rctx, model.JobTypeDeliveryTrackingContentReview, map[string]string{jobDataKeyPostId: postID}, true, model.JobStatusPending, model.JobStatusInProgress)
	if err != nil {
		rctx.Logger().Error("purgeDeliveryTrackingContentReview: failed to look up in-flight copy jobs", mlog.String("post_id", postID), mlog.Err(err))
	}
	for _, job := range jobs {
		if appErr := a.Srv().Jobs.RequestCancellation(rctx, job.Id); appErr != nil {
			rctx.Logger().Warn("purgeDeliveryTrackingContentReview: failed to cancel in-flight copy job", mlog.String("post_id", postID), mlog.String("job_id", job.Id), mlog.Err(appErr))
		}
	}

	// A canceled in-progress job keeps writing batches until its CancellationWatcher
	// notices (polls every 5s) and finishes the in-flight batch. Deleting before then
	// leaves orphaned rows the worker re-inserts after the deletion. Wait (bounded) for
	// each job to actually stop before deleting; if we can't confirm it stopped, we
	// delete anyway.
	for _, job := range jobs {
		if err := a.Srv().Jobs.WaitForJobToStop(rctx, job.Id, deliveryTrackingPurgeJobWaitTimeout); err != nil {
			rctx.Logger().Warn("purgeDeliveryTrackingContentReview: could not confirm copy job stopped; deleting anyway", mlog.String("post_id", postID), mlog.String("job_id", job.Id), mlog.Err(err))
		}
	}

	if err := a.Srv().Store().UserPostDeliveryContentReview().DeleteByReviewPost(rctx.Context(), postID); err != nil {
		rctx.Logger().Error("purgeDeliveryTrackingContentReview: failed to delete content-review records", mlog.String("post_id", postID), mlog.Err(err))
	}
}

func (a *App) NotifyDeliveryTrackingContentReviewRequesters(rctx request.CTX, job *model.Job, succeeded bool) *model.AppError {
	postID := job.Data[jobDataKeyPostId]
	if postID == "" {
		return nil
	}

	deliveryStatus := model.DeliveryTrackingStatusCompleted
	if !succeeded {
		deliveryStatus = model.DeliveryTrackingStatusFailed
	}
	if appErr := a.setDeliveryTrackingStatus(rctx, postID, job.Data[jobDataKeyTeamId], deliveryStatus); appErr != nil {
		rctx.Logger().Warn("Failed to set delivery tracking status on job completion",
			mlog.String("post_id", postID), mlog.Err(appErr))
	}

	requesters := requestedBySet(job.Data[jobDataKeyRequestedBy])
	if len(requesters) == 0 {
		return nil
	}

	groupID, appErr := a.ContentFlaggingGroupId()
	if appErr != nil {
		return appErr
	}

	messageKey := deliveryTrackingCompletionSuccessMessageKey
	if !succeeded {
		messageKey = deliveryTrackingCompletionFailureMessageKey
	}
	localizeMessage := func(t i18n.TranslateFunc) string {
		return t(messageKey)
	}

	_, appErr = a.postReviewerMessage(rctx, "", groupID, postID, &reviewerMessageOptions{recipientFilter: requesters, localizeMessage: localizeMessage})
	return appErr
}

func requestedBySet(csv string) map[string]bool {
	if csv == "" {
		return nil
	}

	set := make(map[string]bool)
	for id := range strings.SplitSeq(csv, ",") {
		if id != "" {
			set[id] = true
		}
	}
	return set
}

// mergeRequestedBy adds the requester carried in patch to the requested_by CSV set
// of existing. It is a pure function of its inputs so it is safe to re-run on a
// serializable-transaction retry.
func mergeRequestedBy(existing, patch model.StringMap) model.StringMap {
	existing[jobDataKeyRequestedBy] = appendToCSVSet(existing[jobDataKeyRequestedBy], patch[jobDataKeyRequestedBy])
	return existing
}

func appendToCSVSet(csv, value string) string {
	if value == "" {
		return csv
	}
	if csv == "" {
		return value
	}
	if slices.Contains(strings.Split(csv, ","), value) {
		return csv
	}
	return csv + "," + value
}
