// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
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

const flaggedPostReportTempPattern = "mm-flag-report-*.zip"

// flaggedPostReportContext bundles the entities needed to build the report so
// the per-section writers can be unit-tested in isolation.
type flaggedPostReportContext struct {
	post        *model.Post
	channel     *model.Channel
	team        *model.Team
	author      *model.User
	editHistory []*model.Post
}

// GenerateFlaggedPostReport builds a ZIP archive of a flagged post's data into a
// temporary file and returns the file path. The caller is responsible for
// removing the file when the response has been served.
func (a *App) GenerateFlaggedPostReport(rctx request.CTX, postID, generatedByUserID string) (string, *model.AppError) {
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

	if appErr := a.writeFlaggedPostReport(rctx, zw, postID, generatedByUserID); appErr != nil {
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

func (a *App) writeFlaggedPostReport(rctx request.CTX, zw *zip.Writer, postID, generatedByUserID string) *model.AppError {
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
	if appErr := a.writeContentReviewEntry(rctx, zw, rc.post); appErr != nil {
		return appErr
	}
	if appErr := a.writeReportMetadataEntry(zw, generatedByUserID); appErr != nil {
		return appErr
	}

	return nil
}

func (a *App) loadFlaggedPostReportContext(rctx request.CTX, postID string) (*flaggedPostReportContext, *model.AppError) {
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

	editHistory, appErr := a.GetEditHistoryForPost(postID)
	if appErr != nil {
		// Best-effort: don't fail the entire report if edit history can't be loaded.
		rctx.Logger().Warn("Failed to fetch edit history for flagged post report", mlog.String("post_id", postID), mlog.Err(appErr))
		editHistory = nil
	}

	return &flaggedPostReportContext{
		post:        post,
		channel:     channel,
		team:        team,
		author:      author,
		editHistory: editHistory,
	}, nil
}

func (a *App) writeBasePostSection(rctx request.CTX, zw *zip.Writer, rc *flaggedPostReportContext, seen map[string]bool) *model.AppError {
	editOrder := make([]string, 0, len(rc.editHistory))
	for _, e := range rc.editHistory {
		editOrder = append(editOrder, e.Id)
	}

	yamlPayload := buildPostYAML(rc.post, rc.channel, rc.team, rc.author, editOrder)
	if err := writeYAMLEntry(zw, "post/post.yaml", yamlPayload); err != nil {
		return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_post_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	baseFiles, _, appErr := a.GetFileInfosForPost(rctx, rc.post.Id, false, true)
	if appErr != nil {
		// Missing base attachments are logged, not fatal.
		rctx.Logger().Warn("Failed to fetch base post file infos for flagged post report", mlog.String("post_id", rc.post.Id), mlog.Err(appErr))
		baseFiles = nil
	}
	return a.writeAttachments(rctx, zw, "post/attachments", baseFiles, seen)
}

func (a *App) writeEditHistorySection(rctx request.CTX, zw *zip.Writer, rc *flaggedPostReportContext, seen map[string]bool) *model.AppError {
	for _, edit := range rc.editHistory {
		yamlPayload := buildPostYAML(edit, rc.channel, rc.team, rc.author, nil)
		entryPath := path.Join("edit_history", edit.Id, "post.yaml")
		if err := writeYAMLEntry(zw, entryPath, yamlPayload); err != nil {
			return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_edit_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		// FileInfos for an edit-history Post are populated on Post.Metadata.Files
		// by populateEditHistoryFileMetadata. See app.GetEditHistoryForPost.
		var editFiles []*model.FileInfo
		if edit.Metadata != nil {
			editFiles = edit.Metadata.Files
		}

		dir := path.Join("edit_history", edit.Id, "attachments")
		if appErr := a.writeAttachments(rctx, zw, dir, editFiles, seen); appErr != nil {
			return appErr
		}
	}
	return nil
}

func (a *App) writeContentReviewEntry(rctx request.CTX, zw *zip.Writer, post *model.Post) *model.AppError {
	payload, appErr := a.buildContentReviewYAML(rctx, post)
	if appErr != nil {
		return appErr
	}
	if err := writeYAMLEntry(zw, "content_review.yaml", payload); err != nil {
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
	if err := writeYAMLEntry(zw, "report_metadata.yaml", payload); err != nil {
		return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.write_metadata_yaml.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return nil
}

func buildPostYAML(post *model.Post, channel *model.Channel, team *model.Team, author *model.User, editHistoryOrder []string) model.FlaggedPostReportPost {
	out := model.FlaggedPostReportPost{
		ID:                 post.Id,
		AuthorID:           post.UserId,
		Message:            post.Message,
		ChannelID:          post.ChannelId,
		ChannelDisplayName: channel.DisplayName,
		CreateAt:           post.CreateAt,
		UpdateAt:           post.UpdateAt,
		IsPinned:           post.IsPinned,
		RootID:             post.RootId,
		Props:              post.GetProps(),
		Metadata:           post.Metadata,
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
		out.ReplyCount = &replyCount
	}

	return out
}

func (a *App) buildContentReviewYAML(rctx request.CTX, post *model.Post) (model.FlaggedPostReportContentReview, *model.AppError) {
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

	byName := make(map[string]string, len(values))
	for _, v := range values {
		name, ok := fieldIDToName[v.FieldID]
		if !ok {
			continue
		}
		byName[name] = unquoteJSONString(string(v.Value))
	}

	out.ReporterUserID = byName[contentFlaggingPropertyNameReportingUserID]
	out.ReporterReason = byName[contentFlaggingPropertyNameReportingReason]
	out.ReporterComment = byName[contentFlaggingPropertyNameReportingComment]
	out.ReportTimestamp = byName[contentFlaggingPropertyNameReportingTime]

	if cfg := a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent; cfg != nil {
		out.Hidden = *cfg
	}

	if reporterID := out.ReporterUserID; reporterID != "" {
		if u, uErr := a.GetUser(reporterID); uErr == nil {
			out.ReporterUsername = u.Username
		} else {
			rctx.Logger().Warn("Failed to fetch reporter user for flagged post report", mlog.String("user_id", reporterID), mlog.Err(uErr))
		}
	}

	// Reviewer details: prefer the actor (the one who took the keep/remove action)
	// when present, otherwise fall back to the assigned reviewer.
	reviewerID := byName[contentFlaggingPropertyNameActorUserID]
	if reviewerID == "" {
		reviewerID = byName[contentFlaggingPropertyNameReviewerUserID]
	}
	out.ReviewerUserID = reviewerID
	out.ReviewerComment = byName[contentFlaggingPropertyNameActorComment]
	out.ActionTime = byName[contentFlaggingPropertyNameActionTime]

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

		entryName := path.Join(dirPrefix, attachmentEntryName(fi))

		w, err := zw.Create(entryName)
		if err != nil {
			return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.zip_create.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		reader, appErr := a.FileReader(fi.Path)
		if appErr != nil {
			// Missing file content is logged but does not fail the report.
			rctx.Logger().Warn("Failed to read attachment for flagged post report", mlog.String("file_id", fi.Id), mlog.Err(appErr))
			if _, wErr := fmt.Fprintf(w, "# unable to read file %s: %s\n", fi.Id, appErr.Error()); wErr != nil {
				return model.NewAppError("GenerateFlaggedPostReport", "app.data_spillage.report.zip_write.app_error", nil, "", http.StatusInternalServerError).Wrap(wErr)
			}
			continue
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

func unquoteJSONString(s string) string {
	return strings.Trim(s, `"`)
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
	if _, appErr := a.postReviewerMessage(rctx, message, groupID, flaggedPostID); appErr != nil {
		rctx.Logger().Warn("Failed to post report generation notification to reviewers", mlog.String("flagged_post_id", flaggedPostID), mlog.Err(appErr))
	}
}
