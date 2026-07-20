// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"strings"

	"github.com/goccy/go-yaml"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const (
	flaggedPostReportPostDir           = "post"
	flaggedPostReportEditHistoryDir    = "edit_history"
	flaggedPostReportAttachmentsDir    = "attachments"
	flaggedPostReportPostYAMLFile      = "post.yaml"
	flaggedPostReportContentReviewFile = "content_review.yaml"
	flaggedPostReportMetadataFile      = "report_metadata.yaml"
	flaggedPostReportTempPattern       = "mm-flag-report-*.zip"
)

// GenerateFlaggedPostReport builds a ZIP archive of a flagged post's data into a
// temporary file and returns the file path. The caller is responsible for
// removing the file when the response has been served.
func (a *App) GenerateFlaggedPostReport(rctx request.CTX, postID, generatedByUserID, comment, action string) (string, *model.AppError) {
	tmp, err := os.CreateTemp("", flaggedPostReportTempPattern)
	if err != nil {
		return "", model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.tempfile.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	tmpPath := tmp.Name()

	cleanup := func() {
		_ = tmp.Close()
		_ = os.Remove(tmpPath)
	}

	zw := zip.NewWriter(tmp)

	if appErr := a.writeFlaggedPostReport(rctx, zw, postID, generatedByUserID, comment, action); appErr != nil {
		_ = zw.Close()
		cleanup()
		return "", appErr
	}

	if err := zw.Close(); err != nil {
		cleanup()
		return "", model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.zip_close.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := tmp.Sync(); err != nil {
		cleanup()
		return "", model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.sync.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := tmp.Close(); err != nil {
		_ = os.Remove(tmpPath)
		return "", model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.close.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return tmpPath, nil
}

func (a *App) writeFlaggedPostReport(rctx request.CTX, zw *zip.Writer, postID, generatedByUserID, comment, action string) *model.AppError {
	rc, appErr := a.loadFlaggedPostReportContext(rctx, postID)
	if appErr != nil {
		return appErr
	}

	// Track FileInfo.Id seen anywhere in the archive so each unique attachment is
	// included exactly once across the base post and all edit history entries.
	seenFiles := map[string]bool{}

	if appErr := a.writeBasePostSection(rctx, zw, rc, seenFiles); appErr != nil {
		return appErr
	}
	if appErr := a.writeEditHistorySection(rctx, zw, rc, seenFiles); appErr != nil {
		return appErr
	}
	if appErr := a.writeContentReviewEntry(rctx, zw, rc.Post, generatedByUserID, comment, action); appErr != nil {
		return appErr
	}
	if appErr := a.writeReportMetadataEntry(zw, generatedByUserID); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) loadFlaggedPostReportContext(rctx request.CTX, postID string) (*model.FlaggedPostReportContext, *model.AppError) {
	post, appErr := a.GetSinglePost(rctx, postID, true)
	if appErr != nil {
		return nil, appErr
	}

	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return nil, appErr
	}

	var team *model.Team
	if channel.TeamId != "" {
		team, appErr = a.GetTeam(channel.TeamId)
		if appErr != nil {
			return nil, appErr
		}
	}

	author, appErr := a.GetUser(post.UserId)
	if appErr != nil {
		return nil, appErr
	}

	// GetEditHistoryForPost returns a 404 AppError when the post has no edit
	// history rows. That is the normal case for an unedited post, so treat it
	// as an empty history rather than failing the whole report.
	editHistory, appErr := a.GetEditHistoryForPost(postID)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		return nil, appErr
	}

	return &model.FlaggedPostReportContext{
		Post:        post,
		Channel:     channel,
		Team:        team,
		Author:      author,
		EditHistory: editHistory,
	}, nil
}

func (a *App) writeBasePostSection(rctx request.CTX, zw *zip.Writer, rc *model.FlaggedPostReportContext, seen map[string]bool) *model.AppError {
	editOrder := make([]string, 0, len(rc.EditHistory))
	for _, e := range rc.EditHistory {
		editOrder = append(editOrder, e.Id)
	}

	yamlPayload := buildPostYAML(rc.Post, rc.Channel, rc.Team, rc.Author, editOrder)
	postYAMLPath := path.Join(flaggedPostReportPostDir, flaggedPostReportPostYAMLFile)
	if err := writeYAMLEntry(zw, postYAMLPath, yamlPayload); err != nil {
		return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_post_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	baseFiles, _, appErr := a.GetFileInfosForPost(rctx, rc.Post, false, true)
	if appErr != nil {
		return appErr
	}
	attachmentsDir := path.Join(flaggedPostReportPostDir, flaggedPostReportAttachmentsDir)
	return a.writeAttachments(rctx, zw, attachmentsDir, baseFiles, seen)
}

func (a *App) writeEditHistorySection(rctx request.CTX, zw *zip.Writer, rc *model.FlaggedPostReportContext, seen map[string]bool) *model.AppError {
	for _, edit := range rc.EditHistory {
		yamlPayload := buildPostYAML(edit, rc.Channel, rc.Team, rc.Author, nil)
		entryPath := path.Join(flaggedPostReportEditHistoryDir, edit.Id, flaggedPostReportPostYAMLFile)
		if err := writeYAMLEntry(zw, entryPath, yamlPayload); err != nil {
			return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_edit_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// FileInfos for an edit-history Post are populated on Post.Metadata.Files
		// by populateEditHistoryFileMetadata. See app.GetEditHistoryForPost.
		var editFiles []*model.FileInfo
		if edit.Metadata != nil {
			editFiles = edit.Metadata.Files
		}

		dir := path.Join(flaggedPostReportEditHistoryDir, edit.Id, flaggedPostReportAttachmentsDir)
		if appErr := a.writeAttachments(rctx, zw, dir, editFiles, seen); appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) writeContentReviewEntry(rctx request.CTX, zw *zip.Writer, post *model.Post, generatedByUserID, comment, action string) *model.AppError {
	payload, appErr := a.buildContentReviewYAML(rctx, post, generatedByUserID, comment, action)
	if appErr != nil {
		return appErr
	}
	if err := writeYAMLEntry(zw, flaggedPostReportContentReviewFile, payload); err != nil {
		return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_review_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func (a *App) writeReportMetadataEntry(zw *zip.Writer, generatedByUserID string) *model.AppError {
	generator, appErr := a.GetUser(generatedByUserID)
	if appErr != nil {
		return appErr
	}
	payload := model.FlaggedPostReportMetadata{
		GeneratedByUserID:   generator.Id,
		GeneratedByUsername: generator.Username,
		Timestamp:           model.GetMillis(),
		ReportVersion:       model.FlaggedPostReportVersion,
	}
	if err := writeYAMLEntry(zw, flaggedPostReportMetadataFile, payload); err != nil {
		return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_metadata_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func buildPostYAML(post *model.Post, channel *model.Channel, team *model.Team, author *model.User, editHistoryOrder []string) model.FlaggedPostReportPost {
	out := model.FlaggedPostReportPost{
		Post:               post,
		ChannelDisplayName: channel.DisplayName,
		EditHistoryOrder:   editHistoryOrder,
	}

	if author != nil {
		out.AuthorName = author.Username
		out.AuthorEmail = author.Email
	}
	if team != nil {
		out.TeamID = team.Id
		out.TeamDisplayName = team.DisplayName
	}
	if post.RootId == "" {
		replyCount := post.ReplyCount
		out.ReplyCountPtr = &replyCount
	}

	return out
}

func (a *App) buildContentReviewYAML(rctx request.CTX, post *model.Post, generatedByUserID, actorComment, pendingAction string) (model.FlaggedPostReportContentReview, *model.AppError) {
	out := model.FlaggedPostReportContentReview{}

	values, appErr := a.GetPostContentFlaggingPropertyValues(post.Id)
	if appErr != nil {
		return out, appErr
	}

	groupID, gErr := a.ContentFlaggingGroupId()
	if gErr != nil {
		return out, gErr
	}
	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupID)
	if appErr != nil {
		return out, appErr
	}

	// Index field ID -> field name so we can resolve property values by name.
	fieldIDToName := make(map[string]string, len(mappedFields))
	for name, f := range mappedFields {
		fieldIDToName[f.ID] = name
	}

	byName := make(map[string]json.RawMessage, len(values))
	for _, v := range values {
		name, ok := fieldIDToName[v.FieldID]
		if !ok {
			continue
		}
		byName[name] = v.Value
	}

	out.ReporterUserID = decodePropertyString(rctx, byName, contentFlaggingPropertyNameReportingUserID)
	out.ReporterReason = decodePropertyString(rctx, byName, contentFlaggingPropertyNameReportingReason)
	out.ReporterComment = decodePropertyString(rctx, byName, contentFlaggingPropertyNameReportingComment)
	out.ReportTimestamp = decodePropertyInt64(rctx, byName, contentFlaggingPropertyNameReportingTime)

	contentFlaggingManaged, appErr := a.GetPostContentFlaggingPropertyValue(post.Id, contentFlaggingPropertyManageByContentFlagging)
	if appErr != nil && appErr.StatusCode != http.StatusNotFound {
		return out, appErr
	}

	postHiddenByContentFlagging := contentFlaggingManaged != nil && string(contentFlaggingManaged.Value) == "true"
	out.Hidden = postHiddenByContentFlagging

	if reporterID := out.ReporterUserID; reporterID != "" {
		if u, uErr := a.GetUser(reporterID); uErr == nil {
			out.ReporterUsername = u.Username
		} else {
			rctx.Logger().Warn("Failed to fetch reporter user for flagged post report", mlog.String("user_id", reporterID), mlog.Err(uErr))
		}
	}

	reviewerID := decodePropertyString(rctx, byName, contentFlaggingPropertyNameReviewerUserID)
	out.ReviewerUserID = reviewerID

	// Use saved comment if available, else use incoming comment
	out.ReviewerComment = decodePropertyString(rctx, byName, contentFlaggingPropertyNameActorComment)
	if out.ReviewerComment == "" && actorComment != "" {
		out.ReviewerComment = actorComment
	}

	out.ActionTime = decodePropertyInt64(rctx, byName, contentFlaggingPropertyNameActionTime)

	// Use saved actor if available, else use calling user. The check for pending action is used
	// as the client passes a pending action when generating report just before performing an action.
	// All other flows do not pass an action.
	actorUserId := decodePropertyString(rctx, byName, contentFlaggingPropertyNameActorUserID)
	if actorUserId == "" && pendingAction != "" {
		actorUserId = generatedByUserID
	}

	if actorUserId != "" {
		if u, uErr := a.GetUser(actorUserId); uErr == nil {
			out.ActorUsername = u.Username
			out.ActorUserId = u.Id
		} else {
			rctx.Logger().Warn("Failed to fetch report generator user for flagged post report", mlog.String("actor_user_id", actorUserId), mlog.Err(uErr))
		}
	}

	switch decodePropertyString(rctx, byName, ContentFlaggingPropertyNameStatus) {
	case model.ContentFlaggingStatusRetained:
		out.ActorDecision = model.ContentFlaggingActionKeep
	case model.ContentFlaggingStatusRemoved:
		out.ActorDecision = model.ContentFlaggingActionRemove
	default:
		if pendingAction == model.ContentFlaggingActionKeep || pendingAction == model.ContentFlaggingActionRemove {
			out.ActorDecision = pendingAction
		}
	}

	if reviewerID != "" {
		if u, uErr := a.GetUser(reviewerID); uErr == nil {
			out.ReviewerUsername = u.Username
		} else {
			rctx.Logger().Warn("Failed to fetch reviewer user for flagged post report", mlog.String("user_id", reviewerID), mlog.Err(uErr))
		}
	}

	return out, nil
}

func (a *App) writeAttachments(rctx request.CTX, zw *zip.Writer, dirPrefix string, files []*model.FileInfo, seen map[string]bool) *model.AppError {
	for _, fi := range files {
		if fi == nil || seen[fi.Id] {
			continue
		}
		seen[fi.Id] = true

		reader, appErr := a.FileReader(fi.Path)
		if appErr != nil {
			return appErr
		}

		entryName := path.Join(dirPrefix, attachmentEntryName(fi))

		w, err := zw.Create(entryName)
		if err != nil {
			return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.zip_create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if _, err := io.Copy(w, reader); err != nil {
			_ = reader.Close()
			return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.zip_copy.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		_ = reader.Close()
	}
	return nil
}

// attachmentEntryName returns a zip-safe entry name for a FileInfo. We prefix the
// FileInfo.Id to guarantee uniqueness in case two attachments share the same Name,
// and strip path separators from the user-supplied Name to prevent path traversal.
func attachmentEntryName(fi *model.FileInfo) string {
	name := strings.ReplaceAll(fi.Name, "/", "_")
	name = strings.ReplaceAll(name, "\\", "_")
	name = strings.TrimSpace(name)
	if name == "" {
		name = "attachment"
		if fi.Extension != "" {
			name += "." + fi.Extension
		}
	}
	return fi.Id + "_" + name
}

func writeYAMLEntry(zw *zip.Writer, name string, payload any) error {
	w, err := zw.Create(name)
	if err != nil {
		return err
	}
	b, err := yaml.Marshal(payload)
	if err != nil {
		return err
	}
	_, err = w.Write(b)
	return err
}

// decodePropertyString returns the value for fieldName decoded as a JSON string.
// Property values are stored as json.RawMessage (e.g. `"hello \"world\""`); a
// naive Trim of quotes leaves backslash-escapes in place, so we round-trip
// through json.Unmarshal to get the cleartext value.
func decodePropertyString(rctx request.CTX, byName map[string]json.RawMessage, fieldName string) string {
	raw, ok := byName[fieldName]
	if !ok || len(raw) == 0 {
		return ""
	}
	var s string
	if err := json.Unmarshal(raw, &s); err != nil {
		rctx.Logger().Warn("Failed to decode content flagging property string value", mlog.String("field", fieldName), mlog.Err(err))
		return ""
	}
	return s
}

// decodePropertyInt64 returns the value for fieldName decoded as a JSON number.
// Some content flagging timestamps are stored as raw JSON numbers (e.g. `12345`).
func decodePropertyInt64(rctx request.CTX, byName map[string]json.RawMessage, fieldName string) int64 {
	raw, ok := byName[fieldName]
	if !ok || len(raw) == 0 {
		return 0
	}
	var n int64
	if err := json.Unmarshal(raw, &n); err != nil {
		rctx.Logger().Warn("Failed to decode content flagging property int value", mlog.String("field", fieldName), mlog.Err(err))
		return 0
	}
	return n
}

// NotifyReviewersOfFlaggedPostReportGeneration posts a notification reply on each
// reviewer's content review thread to record that a report was generated.
// Best-effort: errors are logged, never returned.
func (a *App) NotifyReviewersOfFlaggedPostReportGeneration(rctx request.CTX, flaggedPostID, generatedByUserID string) {
	groupID, err := a.ContentFlaggingGroupId()
	if err != nil {
		rctx.Logger().Warn("Failed to get content flagging group id for report generation notification", mlog.Err(err))
		return
	}

	generator, appErr := a.GetUser(generatedByUserID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to fetch generating user for report generation notification", mlog.Err(appErr))
		return
	}

	message := fmt.Sprintf("@%s generated a report for the quarantined message.", generator.Username)
	if _, appErr := a.postReviewerMessage(rctx, message, groupID, flaggedPostID, nil, ""); appErr != nil {
		rctx.Logger().Warn("Failed to post report generation notification to reviewers", mlog.String("flagged_post_id", flaggedPostID), mlog.Err(appErr))
	}
}
