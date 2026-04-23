// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"gopkg.in/yaml.v3"
)

// GenerateDataSpillageReport generates a ZIP archive containing the data spillage report
// for a flagged post and streams it to the provided writer.
func (a *App) GenerateDataSpillageReport(rctx request.CTX, flaggedPostID, reviewerID string, w io.Writer) *model.AppError {
	// Acquire per-post lock to prevent concurrent report generation
	lock := a.ch.getReportGenerationLock(flaggedPostID)
	lock.Lock()
	defer lock.Unlock()

	// Validate the post is flagged
	_, appErr := a.GetPostContentFlaggingPropertyValue(flaggedPostID, ContentFlaggingPropertyNameStatus)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.not_flagged", nil, "", http.StatusBadRequest).Wrap(appErr)
	}

	// Get the flagged post (include deleted posts)
	flaggedPost, appErr := a.GetSinglePost(rctx, flaggedPostID, true)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_post.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Get channel and team info
	channel, appErr := a.GetChannel(rctx, flaggedPost.ChannelId)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_channel.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	var team *model.Team
	if channel.TeamId != "" {
		team, appErr = a.GetTeam(channel.TeamId)
		if appErr != nil {
			rctx.Logger().Warn("Failed to get team for data spillage report", mlog.Err(appErr), mlog.String("team_id", channel.TeamId))
		}
	}

	// Get post author
	author, appErr := a.GetUser(flaggedPost.UserId)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_author.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Get edit history
	editHistories, editHistoryErr := a.GetEditHistoryForPost(flaggedPostID)
	if editHistoryErr != nil {
		// Edit history may not exist (already deleted or never edited) - log and continue
		rctx.Logger().Warn("Failed to get edit history for data spillage report", mlog.Err(editHistoryErr), mlog.String("post_id", flaggedPostID))
		editHistories = nil
	}

	// Get file infos for the post
	fileInfos, storeErr := a.Srv().Store().FileInfo().GetForPost(flaggedPostID, true, true, false)
	if storeErr != nil {
		rctx.Logger().Warn("Failed to get file infos for data spillage report", mlog.Err(storeErr), mlog.String("post_id", flaggedPostID))
		fileInfos = nil
	}

	// Get content flagging property values
	groupId, groupErr := a.ContentFlaggingGroupId()
	if groupErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_group.error", nil, "", http.StatusInternalServerError).Wrap(groupErr)
	}

	mappedFields, appErr := a.GetContentFlaggingMappedFields(groupId)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_fields.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	propertyValues, appErr := a.GetPostContentFlaggingPropertyValues(flaggedPostID)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_property_values.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Get reviewer info
	reviewer, appErr := a.GetUser(reviewerID)
	if appErr != nil {
		return model.NewAppError("GenerateDataSpillageReport", "app.data_spillage.report.get_reviewer.error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	// Build YAML structs
	postYAML := a.buildReportPostYAML(flaggedPost, author, channel, team, editHistories)
	contentReviewYAML := a.buildContentReviewYAML(rctx, propertyValues, mappedFields)
	reportMetadataYAML := buildReportMetadataYAML(reviewer)

	// Record "report generated" action
	a.appendContentFlaggingAction(rctx, flaggedPostID, model.DataSpillageReviewerAction{
		Action:       model.ContentFlaggingActionReportGenerated,
		ActorUserID:  reviewerID,
		ActorUsername: reviewer.Username,
		Timestamp:    model.GetMillis(),
	})

	// Stream ZIP to writer
	return a.writeDataSpillageReportZip(rctx, w, postYAML, contentReviewYAML, reportMetadataYAML, fileInfos, editHistories)
}

func (a *App) buildReportPostYAML(post *model.Post, author *model.User, channel *model.Channel, team *model.Team, editHistories []*model.Post) model.DataSpillageReportPost {
	teamID := ""
	teamDisplayName := ""
	if team != nil {
		teamID = team.Id
		teamDisplayName = team.DisplayName
	}

	editHistoryOrder := make([]string, 0, len(editHistories))
	for _, edit := range editHistories {
		editHistoryOrder = append(editHistoryOrder, edit.Id)
	}

	return model.DataSpillageReportPost{
		ID:                 post.Id,
		AuthorUserID:       post.UserId,
		AuthorUsername:     author.Username,
		AuthorEmail:        author.Email,
		Message:            post.Message,
		ChannelID:          post.ChannelId,
		ChannelDisplayName: channel.DisplayName,
		TeamID:             teamID,
		TeamDisplayName:    teamDisplayName,
		CreateAt:           post.CreateAt,
		UpdateAt:           post.UpdateAt,
		EditAt:             post.EditAt,
		DeleteAt:           post.DeleteAt,
		IsPinned:           post.IsPinned,
		RootID:             post.RootId,
		Props:              post.GetProps(),
		ReplyCount:         post.ReplyCount,
		Type:               post.Type,
		FileIDs:            post.FileIds,
		EditHistoryOrder:   editHistoryOrder,
	}
}

func (a *App) buildContentReviewYAML(rctx request.CTX, propertyValues []*model.PropertyValue, mappedFields map[string]*model.PropertyField) model.DataSpillageContentReview {
	review := model.DataSpillageContentReview{}

	// Build a field ID to name map for quick lookup
	fieldIDToName := make(map[string]string)
	for name, field := range mappedFields {
		fieldIDToName[field.ID] = name
	}

	for _, pv := range propertyValues {
		fieldName, ok := fieldIDToName[pv.FieldID]
		if !ok {
			continue
		}

		strValue := strings.Trim(string(pv.Value), `"`)

		switch fieldName {
		case contentFlaggingPropertyNameReportingUserID:
			review.ReporterUserID = strValue
			if user, err := a.GetUser(strValue); err == nil {
				review.ReporterUsername = user.Username
			}
		case contentFlaggingPropertyNameReportingReason:
			review.ReportingReason = strValue
		case contentFlaggingPropertyNameReportingComment:
			review.ReportingComment = strValue
		case contentFlaggingPropertyNameReportingTime:
			review.ReportedAt = parseTimestampValue(pv.Value)
		case contentFlaggingPropertyNameReviewerUserID:
			review.ReviewerUserID = strValue
			if user, err := a.GetUser(strValue); err == nil {
				review.ReviewerUsername = user.Username
			}
		case contentFlaggingPropertyNameActorComment:
			review.ReviewerComment = strValue
		case contentFlaggingPropertyNameReviewerActions:
			var actions []model.DataSpillageReviewerAction
			if jsonErr := json.Unmarshal(pv.Value, &actions); jsonErr == nil {
				review.ReviewerActions = actions
			} else {
				rctx.Logger().Warn("Failed to unmarshal reviewer actions for report", mlog.Err(jsonErr))
			}
		}
	}

	// Determine hidden status from config
	review.Hidden = a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent != nil &&
		*a.Config().ContentFlaggingSettings.AdditionalSettings.HideFlaggedContent

	return review
}

func buildReportMetadataYAML(reviewer *model.User) model.DataSpillageReportMetadata {
	return model.DataSpillageReportMetadata{
		GeneratedByUserID:  reviewer.Id,
		GeneratedByUsername: reviewer.Username,
		GeneratedAt:        model.GetMillis(),
		ReportVersion:      model.DataSpillageReportVersion,
	}
}

func (a *App) writeDataSpillageReportZip(rctx request.CTX, w io.Writer, postYAML model.DataSpillageReportPost, contentReviewYAML model.DataSpillageContentReview, reportMetadataYAML model.DataSpillageReportMetadata, fileInfos []*model.FileInfo, editHistories []*model.Post) *model.AppError {
	zipWriter := zip.NewWriter(w)
	defer zipWriter.Close()

	// Write post/post.yaml
	postYAMLBytes, err := yaml.Marshal(postYAML)
	if err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.marshal_post.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := writeZipEntry(zipWriter, "post/post.yaml", postYAMLBytes); err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.write_post_yaml.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Write post/attachments/
	seenFileIDs := make(map[string]bool)
	for _, fi := range fileInfos {
		if err := a.writeFileToZip(rctx, zipWriter, "post/attachments/"+fi.Name, fi.Path); err != nil {
			rctx.Logger().Warn("Failed to write attachment to report ZIP", mlog.Err(err), mlog.String("file_id", fi.Id), mlog.String("path", fi.Path))
			continue
		}
		seenFileIDs[fi.Id] = true
	}

	// Write edit_history/
	for _, editPost := range editHistories {
		editDir := fmt.Sprintf("edit_history/%s/", editPost.Id)

		editPostYAML := model.DataSpillageReportPost{
			ID:       editPost.Id,
			Message:  editPost.Message,
			CreateAt: editPost.CreateAt,
			UpdateAt: editPost.UpdateAt,
			EditAt:   editPost.EditAt,
			DeleteAt: editPost.DeleteAt,
			Props:    editPost.GetProps(),
			Type:     editPost.Type,
			FileIDs:  editPost.FileIds,
		}

		editYAMLBytes, marshalErr := yaml.Marshal(editPostYAML)
		if marshalErr != nil {
			rctx.Logger().Warn("Failed to marshal edit history post YAML", mlog.Err(marshalErr), mlog.String("edit_id", editPost.Id))
			continue
		}
		if writeErr := writeZipEntry(zipWriter, editDir+"post.yaml", editYAMLBytes); writeErr != nil {
			rctx.Logger().Warn("Failed to write edit history post YAML", mlog.Err(writeErr), mlog.String("edit_id", editPost.Id))
			continue
		}

		// Write deduplicated attachments for this edit
		if editPost.Metadata != nil && editPost.Metadata.Files != nil {
			for _, efi := range editPost.Metadata.Files {
				if seenFileIDs[efi.Id] {
					continue
				}
				if err := a.writeFileToZip(rctx, zipWriter, editDir+"attachments/"+efi.Name, efi.Path); err != nil {
					rctx.Logger().Warn("Failed to write edit history attachment to report ZIP", mlog.Err(err), mlog.String("file_id", efi.Id), mlog.String("path", efi.Path))
					continue
				}
				seenFileIDs[efi.Id] = true
			}
		}
	}

	// Write content_review.yaml
	contentReviewBytes, err := yaml.Marshal(contentReviewYAML)
	if err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.marshal_content_review.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := writeZipEntry(zipWriter, "content_review.yaml", contentReviewBytes); err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.write_content_review.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// Write report_metadata.yaml
	metadataBytes, err := yaml.Marshal(reportMetadataYAML)
	if err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.marshal_metadata.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}
	if err := writeZipEntry(zipWriter, "report_metadata.yaml", metadataBytes); err != nil {
		return model.NewAppError("writeDataSpillageReportZip", "app.data_spillage.report.write_metadata.error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	return nil
}

func writeZipEntry(zw *zip.Writer, name string, data []byte) error {
	header := &zip.FileHeader{
		Name:     name,
		Method:   zip.Deflate,
		Modified: time.Now(),
	}
	w, err := zw.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create zip entry %s: %w", name, err)
	}
	_, err = w.Write(data)
	if err != nil {
		return fmt.Errorf("failed to write zip entry %s: %w", name, err)
	}
	return nil
}

func (a *App) writeFileToZip(rctx request.CTX, zw *zip.Writer, zipPath, storagePath string) error {
	reader, appErr := a.FileReader(storagePath)
	if appErr != nil {
		return fmt.Errorf("failed to open file %s: %w", storagePath, appErr)
	}
	defer reader.Close()

	header := &zip.FileHeader{
		Name:     zipPath,
		Method:   zip.Deflate,
		Modified: time.Now(),
	}
	w, err := zw.CreateHeader(header)
	if err != nil {
		return fmt.Errorf("failed to create zip entry for file %s: %w", zipPath, err)
	}
	if _, err := io.Copy(w, reader); err != nil {
		return fmt.Errorf("failed to stream file %s to zip: %w", storagePath, err)
	}
	return nil
}

// sendReportGeneratedNotification sends a notification to all reviewers that a report was generated.
func (a *App) SendReportGeneratedNotification(rctx request.CTX, flaggedPostID, generatorUserID string) {
	groupId, err := a.ContentFlaggingGroupId()
	if err != nil {
		rctx.Logger().Error("Failed to get content flagging group ID for report notification", mlog.Err(err))
		return
	}

	generator, appErr := a.GetUser(generatorUserID)
	if appErr != nil {
		rctx.Logger().Error("Failed to get user for report notification", mlog.Err(appErr), mlog.String("user_id", generatorUserID))
		return
	}

	message := fmt.Sprintf("@%s has generated a data spillage report for this flagged post.", generator.Username)
	_, appErr = a.postReviewerMessage(rctx, message, groupId, flaggedPostID, nil, "")
	if appErr != nil {
		rctx.Logger().Error("Failed to send report generated notification", mlog.Err(appErr), mlog.String("flagged_post_id", flaggedPostID))
	}
}

// parseTimestampValue attempts to parse a property value as a millisecond timestamp.
func parseTimestampValue(value json.RawMessage) int64 {
	var ts int64
	if err := json.Unmarshal(value, &ts); err == nil {
		return ts
	}
	return 0
}
