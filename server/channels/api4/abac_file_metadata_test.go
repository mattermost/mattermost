// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"context"
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// These tests reproduce the reported gap from the client's point of view: with the channel's
// Access Control Policy denying download_file_attachment, every direct file endpoint returns
// 403 while the drafts, scheduled posts and post edit history endpoints still hand back the
// file's metadata and its mini preview thumbnail for the same file, user and moment in time.
//
// The policy is switched to deny only after the upload, which is the case Access Control
// Policies exist to cover: revoking access to content the user could previously reach.

// setFileDownloadPolicy enables ABAC and installs an access control service that returns
// the given decision for download_file_attachment while allowing every other action.
func setFileDownloadPolicy(t *testing.T, th *TestHelper, allowed bool) *eMocks.AccessControlServiceInterface {
	t.Helper()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := &eMocks.AccessControlServiceInterface{}
	original := th.App.Srv().Channels().AccessControl
	th.App.Srv().Channels().AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().Channels().AccessControl = original })

	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
	})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))
	mockACS.On("AccessEvaluation", mock.Anything, mock.Anything).
		Return(model.AccessDecision{Decision: true}, (*model.AppError)(nil)).Maybe()

	// Channel teardown and policy reads touch the service without being part of the
	// behaviour under test.
	mockACS.On("GetPolicy", mock.Anything, mock.AnythingOfType("string")).
		Return(nil, (*model.AppError)(nil)).Maybe()
	mockACS.On("DeletePolicy", mock.Anything, mock.AnythingOfType("string")).
		Return((*model.AppError)(nil)).Maybe()

	return mockACS
}

// requireDirectFileEndpointsDenied is the precondition shared by every case below: the
// endpoints that already enforce the policy must reject this user for this file.
func requireDirectFileEndpointsDenied(t *testing.T, th *TestHelper, fileID string) {
	t.Helper()

	_, resp, err := th.Client.GetFile(context.Background(), fileID)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.GetFileThumbnail(context.Background(), fileID)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.GetFilePreview(context.Background(), fileID)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)

	_, resp, err = th.Client.GetFileInfo(context.Background(), fileID)
	require.Error(t, err)
	CheckForbiddenStatus(t, resp)
}

// requireNoLeakedFileMetadata asserts that a response carries neither file metadata nor a
// thumbnail for a user the policy denies.
func requireNoLeakedFileMetadata(t *testing.T, metadata *model.PostMetadata, where string) {
	t.Helper()

	if metadata == nil {
		return
	}

	for _, info := range metadata.Files {
		if info.MiniPreview != nil {
			require.Failf(t, "leaked a thumbnail", "%s: returned a %d byte mini preview for file %s", where, len(*info.MiniPreview), info.Id)
		}
	}
	require.Emptyf(t, metadata.Files, "%s: leaked file metadata to a user denied download_file_attachment", where)
}

func uploadTestImage(t *testing.T, th *TestHelper, channelID, name string) *model.FileInfo {
	t.Helper()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	uploaded, _, err := th.Client.UploadFile(context.Background(), data, channelID, name)
	require.NoError(t, err)
	require.Len(t, uploaded.FileInfos, 1)
	require.NotNil(t, uploaded.FileInfos[0].MiniPreview, "precondition: the uploaded image should have a mini preview to leak")

	return uploaded.FileInfos[0]
}

func TestGetDraftsDoesNotLeakFilesDeniedByPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	info := uploadTestImage(t, th, th.BasicChannel.Id, "draft-attachment.png")

	_, _, err := th.Client.UpsertDraft(context.Background(), &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "draft with a gated attachment",
		FileIds:   model.StringArray{info.Id},
	})
	require.NoError(t, err)

	setFileDownloadPolicy(t, th, false)
	requireDirectFileEndpointsDenied(t, th, info.Id)

	drafts, _, err := th.Client.GetDrafts(context.Background(), th.BasicUser.Id, th.BasicTeam.Id)
	require.NoError(t, err)
	require.Len(t, drafts, 1)

	requireNoLeakedFileMetadata(t, drafts[0].Metadata, "GET /users/me/teams/{team_id}/drafts")
}

func TestGetScheduledPostsDoesNotLeakFilesDeniedByPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))

	info := uploadTestImage(t, th, th.BasicChannel.Id, "scheduled-attachment.png")

	created, _, err := th.Client.CreateScheduledPost(context.Background(), &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "scheduled post with a gated attachment",
			FileIds:   model.StringArray{info.Id},
		},
		ScheduledAt: model.GetMillis() + 100000,
	})
	require.NoError(t, err)
	require.NotNil(t, created)

	setFileDownloadPolicy(t, th, false)
	requireDirectFileEndpointsDenied(t, th, info.Id)

	scheduledPosts, _, err := th.Client.GetUserScheduledPosts(context.Background(), th.BasicTeam.Id, false)
	require.NoError(t, err)
	require.NotEmpty(t, scheduledPosts[th.BasicTeam.Id])

	for _, scheduledPost := range scheduledPosts[th.BasicTeam.Id] {
		requireNoLeakedFileMetadata(t, scheduledPost.Metadata, "GET /posts/scheduled/team/{team_id}")
	}
}

func TestGetEditHistoryForPostDoesNotLeakFilesDeniedByPolicy(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	info := uploadTestImage(t, th, th.BasicChannel.Id, "edit-history-attachment.png")

	post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "post with a gated attachment",
		FileIds:   model.StringArray{info.Id},
	})
	require.NoError(t, err)

	_, _, err = th.Client.PatchPost(context.Background(), post.Id, &model.PostPatch{
		Message: new("post with a gated attachment, edited"),
	})
	require.NoError(t, err)

	setFileDownloadPolicy(t, th, false)
	requireDirectFileEndpointsDenied(t, th, info.Id)

	// The live post is redacted for this user. The historical versions of the same post are
	// expected to match that, and are the control that proves the redaction works at all.
	live, _, err := th.Client.GetPost(context.Background(), post.Id, "")
	require.NoError(t, err)
	requireNoLeakedFileMetadata(t, live.Metadata, "GET /posts/{post_id} (control)")
	require.Empty(t, live.FileIds, "control: the live post should not expose file ids either")

	history, _, err := th.Client.GetEditHistoryForPost(context.Background(), post.Id)
	require.NoError(t, err)
	require.NotEmpty(t, history)

	for _, version := range history {
		require.NotNil(t, version.Metadata)
		requireNoLeakedFileMetadata(t, version.Metadata, "GET /posts/{post_id}/edit_history")
		require.Empty(t, version.FileIds, "the historical version should not expose file ids either")
		require.Equal(t, 1, version.Metadata.RedactedFileCount)
	}
}

// TestFileMetadataServedWhenPolicyAllows is the other half of the contract. With a policy
// active but allowing the action, all three endpoints must still serve the metadata and the
// thumbnail, so enforcement cannot be satisfied by redacting unconditionally.
func TestFileMetadataServedWhenPolicyAllows(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.Srv().SetLicense(model.NewTestLicenseSKU(model.LicenseShortSkuProfessional))
	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	requireFileServed := func(metadata *model.PostMetadata, fileID, where string) {
		t.Helper()

		require.NotNil(t, metadata, where)
		require.Len(t, metadata.Files, 1, "%s: should serve the file metadata", where)
		require.Equal(t, fileID, metadata.Files[0].Id, where)
		require.NotNil(t, metadata.Files[0].MiniPreview, "%s: should serve the thumbnail", where)
		require.Zero(t, metadata.RedactedFileCount, where)
	}

	draftFile := uploadTestImage(t, th, th.BasicChannel.Id, "draft-allowed.png")
	_, _, err := th.Client.UpsertDraft(context.Background(), &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "draft with an allowed attachment",
		FileIds:   model.StringArray{draftFile.Id},
	})
	require.NoError(t, err)

	scheduledFile := uploadTestImage(t, th, th.BasicChannel.Id, "scheduled-allowed.png")
	_, _, err = th.Client.CreateScheduledPost(context.Background(), &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "scheduled post with an allowed attachment",
			FileIds:   model.StringArray{scheduledFile.Id},
		},
		ScheduledAt: model.GetMillis() + 100000,
	})
	require.NoError(t, err)

	postFile := uploadTestImage(t, th, th.BasicChannel.Id, "edit-history-allowed.png")
	post, _, err := th.Client.CreatePost(context.Background(), &model.Post{
		ChannelId: th.BasicChannel.Id,
		Message:   "post with an allowed attachment",
		FileIds:   model.StringArray{postFile.Id},
	})
	require.NoError(t, err)

	_, _, err = th.Client.PatchPost(context.Background(), post.Id, &model.PostPatch{
		Message: new("post with an allowed attachment, edited"),
	})
	require.NoError(t, err)

	setFileDownloadPolicy(t, th, true)

	_, _, err = th.Client.GetFileThumbnail(context.Background(), postFile.Id)
	require.NoError(t, err, "precondition: the policy should allow download_file_attachment")

	drafts, _, err := th.Client.GetDrafts(context.Background(), th.BasicUser.Id, th.BasicTeam.Id)
	require.NoError(t, err)
	require.Len(t, drafts, 1)
	requireFileServed(drafts[0].Metadata, draftFile.Id, "GET /users/me/teams/{team_id}/drafts")

	scheduledPosts, _, err := th.Client.GetUserScheduledPosts(context.Background(), th.BasicTeam.Id, false)
	require.NoError(t, err)
	require.Len(t, scheduledPosts[th.BasicTeam.Id], 1)
	requireFileServed(scheduledPosts[th.BasicTeam.Id][0].Metadata, scheduledFile.Id, "GET /posts/scheduled/team/{team_id}")

	history, _, err := th.Client.GetEditHistoryForPost(context.Background(), post.Id)
	require.NoError(t, err)
	require.NotEmpty(t, history)

	for _, version := range history {
		requireFileServed(version.Metadata, postFile.Id, "GET /posts/{post_id}/edit_history")
		require.Equal(t, model.StringArray{postFile.Id}, version.FileIds)
	}
}
