// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"context"
	"testing"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/require"
)

// seedContentReviewRows writes a couple of copied delivery receipts (a user and a
// plugin target) for postID into the primary-DB content-review table.
func seedContentReviewRows(t *testing.T, th *TestHelper, postID string) {
	t.Helper()
	records := []model.UserPostDelivery{
		{PostID: postID, TargetID: th.BasicUser2.Id, TargetType: model.DeliveryTargetUser, Mechanism: model.DeliveryMechanismProduct, CreatedAt: model.GetMillis()},
		{PostID: postID, TargetID: "com.example.plugin", TargetType: model.DeliveryTargetPlugin, Mechanism: model.DeliveryMechanismPlugin, CreatedAt: model.GetMillis()},
	}
	require.NoError(t, th.App.Srv().Store().UserPostDeliveryContentReview().SaveBatch(context.Background(), records, model.NewId()))
}

func contentReviewCount(t *testing.T, th *TestHelper, postID string) int64 {
	t.Helper()
	count, err := th.App.Srv().Store().UserPostDeliveryContentReview().CountByPost(context.Background(), postID)
	require.NoError(t, err)
	return count
}

// requireContentReviewEventuallyEmpty waits for the async purge to remove all
// content-review rows for postID.
func requireContentReviewEventuallyEmpty(t *testing.T, th *TestHelper, postID string) {
	t.Helper()
	require.Eventually(t, func() bool {
		count, err := th.App.Srv().Store().UserPostDeliveryContentReview().CountByPost(context.Background(), postID)
		return err == nil && count == 0
	}, 10*time.Second, 100*time.Millisecond, "expected content-review rows for post %s to be purged", postID)
}

func TestKeepFlaggedPostPurgesDeliveryTrackingContentReview(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.Nil(t, setBaseConfig(th))
	enableDeliveryTracking(th)

	post := setupFlaggedPost(t, th)
	seedContentReviewRows(t, th, post.Id)
	require.Equal(t, int64(2), contentReviewCount(t, th, post.Id))

	actionRequest := &model.FlagContentActionRequest{Comment: "keeping this post"}
	appErr := th.App.KeepFlaggedPost(th.Context, actionRequest, th.SystemAdminUser.Id, post)
	require.Nil(t, appErr)

	requireContentReviewEventuallyEmpty(t, th, post.Id)
}

func TestPermanentDeleteFlaggedPostPurgesDeliveryTrackingContentReview(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.Nil(t, setBaseConfig(th))
	enableDeliveryTracking(th)

	post := setupFlaggedPost(t, th)
	seedContentReviewRows(t, th, post.Id)
	require.Equal(t, int64(2), contentReviewCount(t, th, post.Id))

	actionRequest := &model.FlagContentActionRequest{Comment: "removing this post"}
	appErr := th.App.PermanentDeleteFlaggedPost(th.Context, actionRequest, th.SystemAdminUser.Id, post)
	require.Nil(t, appErr)

	requireContentReviewEventuallyEmpty(t, th, post.Id)
}

// TestReviewerActionCancelsInFlightDeliveryTrackingJob verifies that a reviewer
// action cancels an in-flight copy job so it cannot re-insert rows after the purge.
func TestReviewerActionCancelsInFlightDeliveryTrackingJob(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuEnterpriseAdvanced))
	require.Nil(t, setBaseConfig(th))
	enableDeliveryTracking(th)

	post := setupFlaggedPost(t, th)
	seedContentReviewRows(t, th, post.Id)

	// Seed an in-progress copy job for the post. RequestCancellation transitions an
	// in-progress job to CancelRequested; the test advances it to Canceled below,
	// standing in for the worker acknowledging the cancel.
	job, err := th.App.Srv().Store().Job().Save(&model.Job{
		Id:       model.NewId(),
		Type:     model.JobTypeDeliveryTrackingContentReview,
		Status:   model.JobStatusInProgress,
		CreateAt: model.GetMillis(),
		Data:     model.StringMap{jobDataKeyPostId: post.Id},
	})
	require.NoError(t, err)

	actionRequest := &model.FlagContentActionRequest{Comment: "keeping this post"}
	appErr := th.App.KeepFlaggedPost(th.Context, actionRequest, th.SystemAdminUser.Id, post)
	require.Nil(t, appErr)

	require.Eventually(t, func() bool {
		updated, jErr := th.App.Srv().Store().Job().Get(th.Context, job.Id)
		return jErr == nil && updated.Status == model.JobStatusCancelRequested
	}, 10*time.Second, 100*time.Millisecond, "expected in-flight copy job to be cancel-requested")

	_, err = th.App.Srv().Store().Job().UpdateStatus(job.Id, model.JobStatusCanceled)
	require.NoError(t, err)

	requireContentReviewEventuallyEmpty(t, th, post.Id)
}
