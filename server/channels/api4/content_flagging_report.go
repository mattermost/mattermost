// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"fmt"
	"net/http"
	"os"

	"github.com/mattermost/mattermost/server/v8/channels/app"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func generateFlaggedPostReport(c *Context, w http.ResponseWriter, r *http.Request) {
	if c.Err != nil {
		return
	}

	c.RequirePostId()
	if c.Err != nil {
		return
	}

	postId := c.Params.PostId
	userId := c.AppContext.Session().UserId

	auditRec := c.MakeAuditRecord(model.AuditEventGenerateFlaggedPostReport, model.AuditStatusFail)
	defer c.LogAuditRecWithLevel(auditRec, app.LevelContent)
	model.AddEventParameterToAuditRec(auditRec, "postId", postId)
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

	requireTeamContentReviewer(c, userId, channel.TeamId)
	if c.Err != nil {
		return
	}

	// This validates that the post is flagged
	requireFlaggedPost(c, postId)
	if c.Err != nil {
		return
	}

	reportPath, appErr := c.App.GenerateFlaggedPostReport(c.AppContext, postId, userId)
	if appErr != nil {
		c.Err = appErr
		return
	}
	defer func() {
		if err := os.Remove(reportPath); err != nil && !os.IsNotExist(err) {
			c.Logger.Warn("Failed to remove flagged post report temp file", mlog.String("path", reportPath), mlog.Err(err))
		}
	}()

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

	// Notify all team reviewers that a report has been generated. Best-effort:
	// must run before http.ServeContent (which writes the response and may block).
	c.App.NotifyReviewersOfFlaggedPostReportGeneration(c.AppContext, postId, userId)

	filename := fmt.Sprintf("flagged-post-%s-%d.zip", postId, model.GetMillis())
	w.Header().Set("Content-Type", "application/zip")
	w.Header().Set("Content-Disposition", fmt.Sprintf(`attachment; filename="%s"`, filename))
	http.ServeContent(w, r, filename, stat.ModTime(), f)

	auditRec.Success()
}
