// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"bytes"
	"encoding/json"
	"io"
	"os"
	"testing"

	"github.com/goccy/go-yaml"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

// readReportZip opens the ZIP archive at path and returns a map of entry name
// to contents. The temp file produced by GenerateFlaggedPostReport is also
// removed from disk after reading so individual tests don't have to clean up.
func readReportZip(t *testing.T, path string) map[string][]byte {
	t.Helper()
	defer func() {
		_ = os.Remove(path)
	}()

	zr, err := zip.OpenReader(path)
	require.NoError(t, err)
	defer zr.Close()

	out := map[string][]byte{}
	for _, f := range zr.File {
		rc, err := f.Open()
		require.NoError(t, err)
		b, err := io.ReadAll(rc)
		require.NoError(t, err)
		_ = rc.Close()
		out[f.Name] = b
	}
	return out
}

func TestGenerateFlaggedPostReport(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("returns error when post does not exist", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, model.NewId(), th.BasicUser.Id, "", "")
		require.NotNil(t, appErr)
		require.Empty(t, path)
	})

	t.Run("returns error when generator user does not exist", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, model.NewId(), "", "")
		require.NotNil(t, appErr)
		require.Empty(t, path)
	})

	t.Run("produces a zip with the expected entries for a basic flagged post", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.NotEmpty(t, path)

		_, statErr := os.Stat(path)
		require.NoError(t, statErr, "report temp file should exist on disk until caller removes it")

		entries := readReportZip(t, path)
		require.Contains(t, entries, "post/post.yaml")
		require.Contains(t, entries, "content_review.yaml")
		require.Contains(t, entries, "report_metadata.yaml")
	})

	t.Run("post.yaml contains channel, team, and author details", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var payload map[string]any
		require.NoError(t, yaml.Unmarshal(entries["post/post.yaml"], &payload))
		require.Equal(t, post.Id, payload["id"])
		require.Equal(t, post.UserId, payload["author_id"])
		require.Equal(t, th.BasicUser.Username, payload["author_name"])
		require.Equal(t, th.BasicChannel.DisplayName, payload["channel_display_name"])
		require.Equal(t, th.BasicTeam.Id, payload["team_id"])
		require.Equal(t, th.BasicTeam.DisplayName, payload["team_display_name"])
	})

	t.Run("report_metadata.yaml records the generating user and a non-zero timestamp", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var meta model.FlaggedPostReportMetadata
		require.NoError(t, yaml.Unmarshal(entries["report_metadata.yaml"], &meta))
		require.Equal(t, th.BasicUser.Id, meta.GeneratedByUserID)
		require.Equal(t, th.BasicUser.Username, meta.GeneratedByUsername)
		require.Equal(t, model.FlaggedPostReportVersion, meta.ReportVersion)
		require.Greater(t, meta.Timestamp, int64(0))
	})

	t.Run("content_review.yaml records reporter details", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		// setupFlaggedPost flags as BasicUser2 with reason "spam".
		require.Equal(t, th.BasicUser2.Id, review.ReporterUserID)
		require.Equal(t, th.BasicUser2.Username, review.ReporterUsername)
		require.Equal(t, "spam", review.ReporterReason)
		require.Equal(t, "This is spam content", review.ReporterComment)
		require.Greater(t, review.ReportTimestamp, int64(0))
		require.Empty(t, review.ActorDecision)
		require.Empty(t, review.ActorUserId)
		require.Empty(t, review.ActorUsername)
	})

	t.Run("content_review.yaml records remove decision and committed actor after permanent delete", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		appErr = th.App.PermanentDeleteFlaggedPost(th.Context, &model.FlagContentActionRequest{Comment: "violates policy"}, th.SystemAdminUser.Id, post)
		require.Nil(t, appErr)

		// Report is generated by BasicUser, but the committed actor on the post is SystemAdminUser.
		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		require.Equal(t, "remove", review.ActorDecision)
		require.Equal(t, th.SystemAdminUser.Id, review.ActorUserId)
		require.Equal(t, th.SystemAdminUser.Username, review.ActorUsername)
	})

	t.Run("content_review.yaml records keep decision and committed actor after keep action", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		appErr = th.App.KeepFlaggedPost(th.Context, &model.FlagContentActionRequest{Comment: "looks fine"}, th.SystemAdminUser.Id, post)
		require.Nil(t, appErr)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		require.Equal(t, "keep", review.ActorDecision)
		require.Equal(t, th.SystemAdminUser.Id, review.ActorUserId)
		require.Equal(t, th.SystemAdminUser.Username, review.ActorUsername)
	})

	t.Run("content_review.yaml prefers committed actor over pending action's generator", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		// Commit a keep action so the actor user id property is set to SystemAdminUser.
		appErr = th.App.KeepFlaggedPost(th.Context, &model.FlagContentActionRequest{Comment: "looks fine"}, th.SystemAdminUser.Id, post)
		require.Nil(t, appErr)

		// Even with a pending action supplied (and a different generator), the
		// committed actor on the post should win over the pending-action fallback.
		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", model.ContentFlaggingActionRemove)
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		require.Equal(t, th.SystemAdminUser.Id, review.ActorUserId)
		require.Equal(t, th.SystemAdminUser.Username, review.ActorUsername)
	})

	t.Run("content_review.yaml uses pending action when status is not yet committed", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", model.ContentFlaggingActionRemove)
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		require.Equal(t, "remove", review.ActorDecision)
		require.Equal(t, th.BasicUser.Id, review.ActorUserId)
		require.Equal(t, th.BasicUser.Username, review.ActorUsername)
	})

	t.Run("content_review.yaml ignores invalid pending action", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "bogus")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		var review model.FlaggedPostReportContentReview
		require.NoError(t, yaml.Unmarshal(entries["content_review.yaml"], &review))
		require.Empty(t, review.ActorDecision)
		// Actor details are still populated whenever a pending action is supplied,
		// even when the value isn't a recognised decision.
		require.Equal(t, th.BasicUser.Id, review.ActorUserId)
		require.Equal(t, th.BasicUser.Username, review.ActorUsername)
	})

	t.Run("includes file attachments for the base post", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t, th.BasicChannel)

		attachmentBody := []byte("hello attachment body")
		fileInfo := &model.FileInfo{
			Id:        model.NewId(),
			PostId:    post.Id,
			CreatorId: post.UserId,
			Path:      "test/" + model.NewId() + "/attachment.txt",
			Name:      "attachment.txt",
			Size:      int64(len(attachmentBody)),
		}
		_, appErr = th.App.WriteFile(bytes.NewReader(attachmentBody), fileInfo.Path)
		require.Nil(t, appErr)
		t.Cleanup(func() { _ = th.App.RemoveFile(fileInfo.Path) })

		_, err := th.App.Srv().Store().FileInfo().Save(th.Context, fileInfo)
		require.NoError(t, err)

		// Persist FileIds directly via the store. UpdatePost would route through
		// AttachToPost, which is a no-op here because the FileInfo row already has
		// PostId set, leaving post.FileIds empty in the DB.
		post.FileIds = []string{fileInfo.Id}
		_, err = th.App.Srv().Store().Post().Overwrite(th.Context, post)
		require.NoError(t, err)

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		entryName := "post/attachments/" + fileInfo.Id + "_" + fileInfo.Name
		require.Contains(t, entries, entryName)
		require.Equal(t, attachmentBody, entries[entryName])
		require.Contains(t, entries, "post/post.yaml")
		require.Contains(t, entries, "content_review.yaml")
		require.Contains(t, entries, "report_metadata.yaml")
	})

	t.Run("includes edit history entries when the post has been edited", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := th.CreatePost(t, th.BasicChannel)

		edited := post.Clone()
		edited.Message = "Edited message"
		edited.EditAt = model.GetMillis()
		_, _, appErr = th.App.UpdatePost(th.Context, edited, &model.UpdatePostOptions{})
		require.Nil(t, appErr)

		editHistory, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, editHistory)
		editID := editHistory[0].Id

		flagData := model.FlagContentRequest{
			Reason:  "spam",
			Comment: "This is spam content",
		}
		appErr = th.App.FlagPost(th.Context, post, th.BasicTeam.Id, th.BasicUser2.Id, flagData)
		require.Nil(t, appErr)

		path, appErr := th.App.GenerateFlaggedPostReport(th.Context, post.Id, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)

		entries := readReportZip(t, path)
		require.Contains(t, entries, "edit_history/"+editID+"/post.yaml")

		// The base post.yaml should also list the edit history order.
		var basePayload map[string]any
		require.NoError(t, yaml.Unmarshal(entries["post/post.yaml"], &basePayload))
		order, ok := basePayload["edit_history_order"].([]any)
		require.True(t, ok, "edit_history_order should be present on the base post payload")
		require.Contains(t, order, editID)
	})
}

// TestBuildContentReviewYAMLActorCommentFallback exercises the replica-lag
// fallback in buildContentReviewYAML: when the property-value read (which is
// served from a read replica) returns no actor_comment value, the function
// must fall back to the in-hand actorComment supplied by the caller so the
// generated report still reflects the comment the user just submitted.
func TestBuildContentReviewYAMLActorCommentFallback(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("falls back to in-hand comment when no actor_comment is persisted", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		// setupFlaggedPost only writes the reporting_* properties — no
		// actor_comment row exists yet, so the replica read returns "" for
		// that field and the fallback branch must take effect.
		review, appErr := th.App.buildContentReviewYAML(th.Context, post, th.BasicUser.Id, "fallback note", "")
		require.Nil(t, appErr)
		require.Equal(t, "fallback note", review.ReviewerComment)
	})

	t.Run("reviewer comment stays empty when both sources are empty", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		review, appErr := th.App.buildContentReviewYAML(th.Context, post, th.BasicUser.Id, "", "")
		require.Nil(t, appErr)
		require.Empty(t, review.ReviewerComment)
	})
}

func TestBuildPostYAML(t *testing.T) {
	channel := &model.Channel{Id: "channel-id", DisplayName: "Channel Name"}
	team := &model.Team{Id: "team-id", DisplayName: "Team Name"}
	author := &model.User{Id: "author-id", Username: "alice", Email: "alice@example.com"}

	t.Run("populates author, channel, and team fields", func(t *testing.T) {
		post := &model.Post{Id: "post-id", UserId: author.Id, ChannelId: channel.Id, Message: "hi"}

		got := buildPostYAML(post, channel, team, author, nil)

		require.Equal(t, "alice", got.AuthorName)
		require.Equal(t, "alice@example.com", got.AuthorEmail)
		require.Equal(t, "Channel Name", got.ChannelDisplayName)
		require.Equal(t, "team-id", got.TeamID)
		require.Equal(t, "Team Name", got.TeamDisplayName)
	})

	t.Run("omits team fields for DM/GM posts", func(t *testing.T) {
		post := &model.Post{Id: "post-id", UserId: author.Id, ChannelId: channel.Id}

		got := buildPostYAML(post, channel, nil, author, nil)

		require.Empty(t, got.TeamID)
		require.Empty(t, got.TeamDisplayName)
	})

	t.Run("omits author fields when author is nil", func(t *testing.T) {
		post := &model.Post{Id: "post-id", ChannelId: channel.Id}

		got := buildPostYAML(post, channel, team, nil, nil)

		require.Empty(t, got.AuthorName)
		require.Empty(t, got.AuthorEmail)
	})

	t.Run("populates reply count only for root posts", func(t *testing.T) {
		root := &model.Post{Id: "root", ChannelId: channel.Id, ReplyCount: 3}
		got := buildPostYAML(root, channel, team, author, nil)
		require.NotNil(t, got.ReplyCountPtr)
		require.Equal(t, int64(3), *got.ReplyCountPtr)

		reply := &model.Post{Id: "reply", ChannelId: channel.Id, RootId: "root", ReplyCount: 0}
		got = buildPostYAML(reply, channel, team, author, nil)
		require.Nil(t, got.ReplyCountPtr)
	})

	t.Run("preserves edit history order verbatim", func(t *testing.T) {
		post := &model.Post{Id: "post-id", ChannelId: channel.Id}
		order := []string{"edit-3", "edit-2", "edit-1"}

		got := buildPostYAML(post, channel, team, author, order)

		require.Equal(t, order, got.EditHistoryOrder)
	})
}

func TestAttachmentEntryName(t *testing.T) {
	t.Run("prefixes the file id and keeps the original name", func(t *testing.T) {
		fi := &model.FileInfo{Id: "abc123", Name: "report.pdf"}
		require.Equal(t, "abc123_report.pdf", attachmentEntryName(fi))
	})

	t.Run("strips forward and back slashes to prevent path traversal", func(t *testing.T) {
		fi := &model.FileInfo{Id: "abc123", Name: "../../etc/passwd"}
		require.Equal(t, "abc123_.._.._etc_passwd", attachmentEntryName(fi))

		fi = &model.FileInfo{Id: "abc123", Name: `..\..\windows\system32`}
		require.Equal(t, "abc123_.._.._windows_system32", attachmentEntryName(fi))
	})

	t.Run("falls back to a synthesised name when the original is empty", func(t *testing.T) {
		fi := &model.FileInfo{Id: "abc123", Name: "", Extension: "pdf"}
		require.Equal(t, "abc123_attachment.pdf", attachmentEntryName(fi))

		fi = &model.FileInfo{Id: "abc123", Name: "   ", Extension: ""}
		require.Equal(t, "abc123_attachment", attachmentEntryName(fi))
	})
}

func TestDecodePropertyString(t *testing.T) {
	rctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t))

	t.Run("returns empty string when key is missing", func(t *testing.T) {
		got := decodePropertyString(rctx, map[string]json.RawMessage{}, "missing")
		require.Empty(t, got)
	})

	t.Run("returns empty string for empty raw value", func(t *testing.T) {
		got := decodePropertyString(rctx, map[string]json.RawMessage{"k": []byte{}}, "k")
		require.Empty(t, got)
	})

	t.Run("decodes a JSON-encoded string", func(t *testing.T) {
		got := decodePropertyString(rctx, map[string]json.RawMessage{"k": json.RawMessage(`"hello \"world\""`)}, "k")
		require.Equal(t, `hello "world"`, got)
	})

	t.Run("returns empty string when the raw value is not valid JSON", func(t *testing.T) {
		got := decodePropertyString(rctx, map[string]json.RawMessage{"k": json.RawMessage("not-json")}, "k")
		require.Empty(t, got)
	})
}

func TestDecodePropertyInt64(t *testing.T) {
	rctx := request.EmptyContext(mlog.CreateConsoleTestLogger(t))

	t.Run("returns zero when key is missing", func(t *testing.T) {
		got := decodePropertyInt64(rctx, map[string]json.RawMessage{}, "missing")
		require.Equal(t, int64(0), got)
	})

	t.Run("returns zero for empty raw value", func(t *testing.T) {
		got := decodePropertyInt64(rctx, map[string]json.RawMessage{"k": []byte{}}, "k")
		require.Equal(t, int64(0), got)
	})

	t.Run("decodes a JSON-encoded number", func(t *testing.T) {
		got := decodePropertyInt64(rctx, map[string]json.RawMessage{"k": json.RawMessage("12345")}, "k")
		require.Equal(t, int64(12345), got)
	})

	t.Run("returns zero when the raw value is not a JSON number", func(t *testing.T) {
		got := decodePropertyInt64(rctx, map[string]json.RawMessage{"k": json.RawMessage(`"12345"`)}, "k")
		require.Equal(t, int64(0), got)
	})
}

func TestNotifyReviewersOfFlaggedPostReportGeneration(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	t.Run("does not panic when called for a non-flagged post", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		// Use a random post id to exercise the best-effort error path. The function
		// should swallow any errors and return without raising.
		require.NotPanics(t, func() {
			th.App.NotifyReviewersOfFlaggedPostReportGeneration(th.Context, model.NewId(), th.BasicUser.Id)
		})
	})

	t.Run("does not panic when generator user does not exist", func(t *testing.T) {
		appErr := setBaseConfig(th)
		require.Nil(t, appErr)

		post := setupFlaggedPost(t, th)

		require.NotPanics(t, func() {
			th.App.NotifyReviewersOfFlaggedPostReportGeneration(th.Context, post.Id, model.NewId())
		})
	})
}
