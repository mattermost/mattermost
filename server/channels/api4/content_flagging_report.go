// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// reportSHA256Header carries the hex SHA-256 of a downloaded report so API clients can
// verify the download against the checksum posted to reviewers.
const reportSHA256Header = "X-Report-SHA256"

func generateFlaggedPostReport(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	var actionRequest model.FlagContentActionRequest
	if err := json.NewDecoder(r.Body).Decode(&actionRequest); err != nil && !errors.Is(err, io.EOF) {
		c.SetInvalidParamWithErr("flagContentActionRequestBody", err)
		return
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventGenerateFlaggedPostReport, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "flaggedPostId", postId)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)
	model.AddEventParameterToAuditRec(auditRec, "comment", actionRequest.Comment)
	model.AddEventParameterToAuditRec(auditRec, "action", actionRequest.Action)

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !requireChannelReadAccess(c, channel) {
		return
	}

	checkChannelFlaggable(c, channel)
	if c.Err != nil {
		return
	}

	requireTeamContentReviewer(c, userId, channel.TeamId)
	if c.Err != nil {
		return
	}

	// This validates that the post is flagged
	requireFlaggedPost(c, postId)
	if c.Err != nil {
		return
	}

	includeAttachments := c.App.HasPermissionToChannelAction(c.AppContext, userId, c.AppContext.Session().Roles, channel.Id, model.AccessControlPolicyActionDownloadFileAttachment)

	reportPath, omittedAttachments, appErr := c.App.GenerateFlaggedPostReport(c.AppContext, postId, userId, actionRequest.Comment, actionRequest.Action, includeAttachments)
	if appErr != nil {
		c.Err = appErr
		return
	}
	defer func() {
		if err := os.Remove(reportPath); err != nil && !os.IsNotExist(err) {
			c.Logger.Warn("Failed to remove flagged post report temp file", mlog.String("path", reportPath), mlog.Err(err))
		}
	}()

	if omittedAttachments > 0 {
		model.AddEventParameterToAuditRec(auditRec, "omitted_attachment_count", omittedAttachments)
	}

	f, err := os.Open(reportPath)
	if err != nil {
		c.Err = model.NewAppError("generateFlaggedPostReport", "api.data_spillage.report.open.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	defer f.Close()

	stat, err := f.Stat()
	if err != nil {
		c.Err = model.NewAppError("generateFlaggedPostReport", "api.data_spillage.report.stat.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	hash := sha256.New()
	if _, err := io.Copy(hash, f); err != nil {
		c.Err = model.NewAppError("generateFlaggedPostReport", "api.data_spillage.report.hash.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	if _, err := f.Seek(0, io.SeekStart); err != nil {
		c.Err = model.NewAppError("generateFlaggedPostReport", "api.data_spillage.report.hash.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}
	checksum := hex.EncodeToString(hash.Sum(nil))

	filename := fmt.Sprintf("flagged-post-%s-%d.zip", postId, model.GetMillis())
	model.AddEventParameterToAuditRec(auditRec, "filename", filename)
	model.AddEventParameterToAuditRec(auditRec, "sha256", checksum)

	// Must run before http.ServeContent (which writes the response and may block). A failure
	// does not block the download; the checksum stays on the audit record and in the log.
	if appErr := c.App.NotifyReviewersOfFlaggedPostReportGeneration(c.AppContext, postId, userId, filename, checksum); appErr != nil {
		logReportChecksumNotPosted(c, postId, filename, checksum, appErr)
	}
	if omittedAttachments > 0 {
		c.App.NotifyRequestingReviewerOfSkippedAttachments(c.AppContext, postId, userId)
	}

	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set(reportSHA256Header, checksum)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeContent(w, r, filename, stat.ModTime(), f)

	auditRec.Success()
}

func generatePostExposureReport(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventGeneratePostExposureReport, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "flaggedPostId", postId)
	model.AddEventParameterToAuditRec(auditRec, "userId", userId)

	post, appErr := c.App.GetSinglePost(c.AppContext, postId, true)
	if appErr != nil {
		c.Err = appErr
		return
	}

	channel, appErr := c.App.GetChannel(c.AppContext, post.ChannelId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	if !requireChannelReadAccess(c, channel) {
		return
	}

	requireTeamContentReviewer(c, userId, channel.TeamId)
	if c.Err != nil {
		return
	}

	requireFlaggedPost(c, postId)
	if c.Err != nil {
		return
	}

	report, appErr := c.App.ComputePostExposure(c.AppContext, postId)
	if appErr != nil {
		c.Err = appErr
		return
	}

	var buf bytes.Buffer
	if err := app.WritePostExposureCSV(&buf, report, c.AppContext.GetT()); err != nil {
		c.Err = model.NewAppError("generatePostExposureReport", "api.data_spillage.exposure.write.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		return
	}

	sum := sha256.Sum256(buf.Bytes())
	checksum := hex.EncodeToString(sum[:])

	filename := fmt.Sprintf("post-exposure-%s-%d.csv", postId, model.GetMillis())
	model.AddEventParameterToAuditRec(auditRec, "filename", filename)
	model.AddEventParameterToAuditRec(auditRec, "sha256", checksum)

	if appErr := c.App.NotifyReviewersOfPostExposureReportGeneration(c.AppContext, postId, userId, filename, checksum); appErr != nil {
		logReportChecksumNotPosted(c, postId, filename, checksum, appErr)
	}

	w.Header().Set("Content-Type", "text/csv; charset=utf-8")
	w.Header().Set(reportSHA256Header, checksum)
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	if _, err := w.Write(buf.Bytes()); err != nil {
		c.Logger.Warn("Failed to write post exposure report response", mlog.String("post_id", postId), mlog.Err(err))
		return
	}

	auditRec.Success()
}

func logReportChecksumNotPosted(c *Context, flaggedPostID, filename, checksum string, appErr *model.AppError) {
	c.Logger.Error("Failed to post report checksum to reviewers; serving the report without a reviewer-visible checksum",
		mlog.String("flagged_post_id", flaggedPostID),
		mlog.String("filename", filename),
		mlog.String("sha256", checksum),
		mlog.Err(appErr),
	)
}
