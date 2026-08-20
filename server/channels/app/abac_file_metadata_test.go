// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"testing"

	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	eMocks "github.com/mattermost/mattermost/server/v8/einterfaces/mocks"
)

// The download_file_attachment action is enforced by the direct file endpoints and by
// sanitizeFileAttachmentsForUser for sent posts. These tests cover the paths that assemble
// PostMetadata.Files independently of that helper: drafts, scheduled posts and post edit
// history. Each one must not hand a denied user the file's metadata or its mini preview.
//
// The policy is switched to deny only after the file is uploaded and attached, which is the
// situation Access Control Policies are meant to handle: revoking access to content the user
// was previously eligible for.

// setFileDownloadPolicy enables ABAC and wires an access control service that returns the
// given decision for the download_file_attachment action on every channel.
func setFileDownloadPolicy(t *testing.T, th *TestHelper, allowed bool) *eMocks.AccessControlServiceInterface {
	t.Helper()

	th.App.UpdateConfig(func(cfg *model.Config) {
		*cfg.AccessControlSettings.EnableAttributeBasedAccessControl = true
	})

	mockACS := &eMocks.AccessControlServiceInterface{}
	original := th.App.Srv().ch.AccessControl
	th.App.Srv().ch.AccessControl = mockACS
	t.Cleanup(func() { th.App.Srv().ch.AccessControl = original })

	mockACS.On("AccessEvaluation", mock.Anything, mock.MatchedBy(func(req model.AccessRequest) bool {
		return req.Action == model.AccessControlPolicyActionDownloadFileAttachment
	})).Return(model.AccessDecision{Decision: allowed}, (*model.AppError)(nil))

	return mockACS
}

// uploadImage uploads a real PNG so the leaking paths have genuine image content to render a
// thumbnail from, rather than only metadata.
func uploadImage(t *testing.T, th *TestHelper, channelID, name string) *model.FileInfo {
	t.Helper()

	data, err := testutils.ReadTestFile("test.png")
	require.NoError(t, err)

	info, appErr := th.App.UploadFileForUserAndTeam(th.Context, data, channelID, name, th.BasicUser.Id, "")
	require.Nil(t, appErr)

	return info
}

// requireFileMetadataRedacted asserts that no file metadata and no thumbnail survived
// for a user denied the download action.
func requireFileMetadataRedacted(t *testing.T, metadata *model.PostMetadata, where string) {
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

func TestGetDraftsForUserABACDownloadDenied(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	info := uploadImage(t, th, th.BasicChannel.Id, "draft-attachment.png")

	_, appErr := th.App.UpsertDraft(th.Context, &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "draft with a gated attachment",
		FileIds:   model.StringArray{info.Id},
	}, "")
	require.Nil(t, appErr)

	setFileDownloadPolicy(t, th, false)

	// The direct file endpoints deny this user, so the draft must not serve the same file.
	require.False(t, th.App.HasPermissionToFileAction(th.Context, th.BasicUser.Id, th.BasicUser.Roles, th.BasicChannel.Id, model.AccessControlPolicyActionDownloadFileAttachment),
		"precondition: the policy should deny download_file_attachment")

	drafts, appErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
	require.Nil(t, appErr)
	require.Len(t, drafts, 1)

	requireFileMetadataRedacted(t, drafts[0].Metadata, "GetDraftsForUser")
}

// TestGetDraftsForUserABACDownloadAllowed documents what the denied case is leaking: the
// drafts path reads the file out of storage and renders a real JPEG thumbnail, so the leak is
// the image itself and not just its metadata. It also pins the other half of the contract —
// an allowed user must keep the metadata they are entitled to.
func TestGetDraftsForUserABACDownloadAllowed(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	info := uploadImage(t, th, th.BasicChannel.Id, "draft-allowed.png")
	require.Nil(t, info.MiniPreview, "precondition: the thumbnail should not exist yet, so the draft path is what renders it")

	_, appErr := th.App.UpsertDraft(th.Context, &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "draft with an allowed attachment",
		FileIds:   model.StringArray{info.Id},
	}, "")
	require.Nil(t, appErr)

	setFileDownloadPolicy(t, th, true)

	drafts, appErr := th.App.GetDraftsForUser(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
	require.Nil(t, appErr)
	require.Len(t, drafts, 1)
	require.Len(t, drafts[0].Metadata.Files, 1)
	require.Equal(t, info.Id, drafts[0].Metadata.Files[0].Id)

	miniPreview := drafts[0].Metadata.Files[0].MiniPreview
	require.NotNil(t, miniPreview, "the drafts path should have rendered a thumbnail from the stored image")
	require.NotEmpty(t, *miniPreview)
}

func TestUpsertDraftABACDownloadDenied(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	th.App.UpdateConfig(func(cfg *model.Config) { *cfg.ServiceSettings.AllowSyncedDrafts = true })

	info := uploadImage(t, th, th.BasicChannel.Id, "upsert-attachment.png")

	setFileDownloadPolicy(t, th, false)

	// UpsertDraft echoes the prepared draft back to the client (and over the websocket),
	// so it is a second read path for the same metadata.
	draft, appErr := th.App.UpsertDraft(th.Context, &model.Draft{
		UserId:    th.BasicUser.Id,
		ChannelId: th.BasicChannel.Id,
		Message:   "draft with a gated attachment",
		FileIds:   model.StringArray{info.Id},
	}, "")
	require.Nil(t, appErr)
	require.NotNil(t, draft)

	requireFileMetadataRedacted(t, draft.Metadata, "UpsertDraft")
}

func TestGetUserTeamScheduledPostsABACDownloadDenied(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	info := uploadImage(t, th, th.BasicChannel.Id, "scheduled-attachment.png")

	scheduledPost, appErr := th.App.SaveScheduledPost(th.Context, &model.ScheduledPost{
		Draft: model.Draft{
			CreateAt:  model.GetMillis(),
			UserId:    th.BasicUser.Id,
			ChannelId: th.BasicChannel.Id,
			Message:   "scheduled post with a gated attachment",
			FileIds:   model.StringArray{info.Id},
		},
		ScheduledAt: model.GetMillis() + 100000,
	}, "")
	require.Nil(t, appErr)
	t.Cleanup(func() {
		_ = th.Server.Store().ScheduledPost().PermanentlyDeleteScheduledPosts([]string{scheduledPost.Id})
	})

	setFileDownloadPolicy(t, th, false)

	scheduledPosts, appErr := th.App.GetUserTeamScheduledPosts(th.Context, th.BasicUser.Id, th.BasicTeam.Id)
	require.Nil(t, appErr)
	require.Len(t, scheduledPosts, 1)

	requireFileMetadataRedacted(t, scheduledPosts[0].Metadata, "GetUserTeamScheduledPosts")
}

func TestGetEditHistoryForPostABACDownloadDenied(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	info := uploadImage(t, th, th.BasicChannel.Id, "edit-history-attachment.png")

	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "post with a gated attachment",
		FileIds:   model.StringArray{info.Id},
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	_, _, appErr = th.App.PatchPost(th.Context, post.Id, &model.PostPatch{Message: new("post with a gated attachment, edited")}, nil)
	require.Nil(t, appErr)

	setFileDownloadPolicy(t, th, false)

	// The live post is redacted for this user, which is the behaviour the historical
	// versions are expected to match.
	live, appErr := th.App.GetSinglePost(th.Context, post.Id, false)
	require.Nil(t, appErr)
	live = th.App.PreparePostForClientWithEmbedsAndImages(th.Context, live, &model.PreparePostForClientOpts{})
	live, _, appErr = th.App.SanitizePostMetadataForUser(th.Context, live, th.BasicUser.Id)
	require.Nil(t, appErr)
	requireFileMetadataRedacted(t, live.Metadata, "live post (control)")

	edits, appErr := th.App.GetEditHistoryForPost(post.Id)
	require.Nil(t, appErr)
	require.NotEmpty(t, edits)

	for _, edit := range edits {
		requireFileMetadataRedacted(t, edit.Metadata, "GetEditHistoryForPost")
	}
}

// TestGetEditHistoryForPostABACDownloadAllowed pins the other half of the contract: an
// allowed user keeps the metadata they are entitled to, so a fix cannot simply drop files
// from every edit history response.
func TestGetEditHistoryForPostABACDownloadAllowed(t *testing.T) {
	mainHelper.Parallel(t)
	th := SetupConfig(t, func(cfg *model.Config) {
		cfg.FeatureFlags.PermissionPolicies = true
	}).InitBasic(t)

	info := uploadImage(t, th, th.BasicChannel.Id, "edit-history-allowed.png")

	post, _, appErr := th.App.CreatePost(th.Context, &model.Post{
		ChannelId: th.BasicChannel.Id,
		UserId:    th.BasicUser.Id,
		Message:   "post with an allowed attachment",
		FileIds:   model.StringArray{info.Id},
	}, th.BasicChannel, model.CreatePostFlags{SetOnline: true})
	require.Nil(t, appErr)

	_, _, appErr = th.App.PatchPost(th.Context, post.Id, &model.PostPatch{Message: new("post with an allowed attachment, edited")}, nil)
	require.Nil(t, appErr)

	setFileDownloadPolicy(t, th, true)

	edits, appErr := th.App.GetEditHistoryForPost(post.Id)
	require.Nil(t, appErr)
	require.NotEmpty(t, edits)

	for _, edit := range edits {
		require.Len(t, edit.Metadata.Files, 1)
		require.Equal(t, info.Id, edit.Metadata.Files[0].Id)
	}
}
