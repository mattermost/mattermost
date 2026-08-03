// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"cmp"
	"encoding/csv"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"slices"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
)

const exposureProfileBatchSize = 1000

func (a *App) ComputePostExposure(rctx request.CTX, postID string) (*model.PostExposureReport, *model.AppError) {
	post, appErr := a.GetSinglePost(rctx, postID, true)
	if appErr != nil {
		return nil, appErr
	}

	if post.OriginalId != "" {
		return nil, model.NewAppError("ComputePostExposure", "app.data_spillage.exposure.edit_history_post.app_error", nil, "", http.StatusBadRequest)
	}

	channel, appErr := a.GetChannel(rctx, post.ChannelId)
	if appErr != nil {
		return nil, appErr
	}
	if channel.Type == model.ChannelTypeDirect || channel.Type == model.ChannelTypeGroup {
		return nil, model.NewAppError("ComputePostExposure", "app.data_spillage.exposure.unsupported_channel_type.app_error", nil, "", http.StatusBadRequest)
	}

	windowEnd, appErr := a.getPostFlagTime(post.Id)
	if appErr != nil {
		return nil, appErr
	}

	report := &model.PostExposureReport{
		Version:     model.PostExposureReportVersion,
		PostID:      post.Id,
		ChannelID:   channel.Id,
		ChannelName: channel.DisplayName,
		ChannelType: channel.Type,
		TeamID:      channel.TeamId,
		WindowStart: post.CreateAt,
		WindowEnd:   windowEnd,
		GeneratedAt: model.GetMillis(),
		Entries:     []*model.PostExposureReportEntry{},
	}

	// Data source 1: who was in the channel while the post was live.
	histories, err := a.Srv().Store().ChannelMemberHistory().GetUsersInChannelDuring(post.CreateAt, windowEnd, []string{channel.Id})
	if err != nil {
		return nil, model.NewAppError("ComputePostExposure", "app.data_spillage.exposure.get_channel_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// GetUsersInChannelDuring returns one row per membership interval, so a user who left
	// and rejoined appears more than once. The report is a list of users, so collapse them.
	memberUserIDs := make([]string, 0, len(histories))
	seen := make(map[string]bool, len(histories))
	for _, h := range histories {
		if seen[h.UserId] {
			continue
		}
		seen[h.UserId] = true
		memberUserIDs = append(memberUserIDs, h.UserId)
	}

	if len(memberUserIDs) == 0 {
		return report, nil
	}

	// Data source 2: channel read state.
	lastViewedByUser, appErr := a.getChannelLastViewedAt(rctx, channel.Id)
	if appErr != nil {
		return nil, appErr
	}

	users, appErr := a.getUsersProfiles(rctx, memberUserIDs)
	if appErr != nil {
		return nil, appErr
	}

	for _, userID := range memberUserIDs {
		user, ok := users[userID]
		if !ok {
			rctx.Logger().Warn("Skipping exposure report entry for a user that no longer exists", mlog.String("user_id", userID), mlog.String("post_id", post.Id))
			continue
		}

		entry := &model.PostExposureReportEntry{
			UserID:           user.Id,
			Username:         user.Username,
			UserEmail:        user.Email,
			IsGuest:          user.IsGuest(),
			IsRemote:         user.IsRemote(),
			IsDeactivated:    user.DeleteAt != 0,
			WasChannelMember: true,
		}

		if lastViewedAt, isMember := lastViewedByUser[userID]; isMember {
			entry.LastViewedAt = model.NewPointer(lastViewedAt)
			entry.LikelyReceivedPost = lastViewedAt >= post.CreateAt
		}

		report.Entries = append(report.Entries, entry)
	}

	slices.SortFunc(report.Entries, func(x, y *model.PostExposureReportEntry) int {
		return cmp.Or(cmp.Compare(x.Username, y.Username), cmp.Compare(x.UserID, y.UserID))
	})

	return report, nil
}

func (a *App) getPostFlagTime(postID string) (int64, *model.AppError) {
	value, appErr := a.GetPostContentFlaggingPropertyValue(postID, contentFlaggingPropertyNameReportingTime)
	if appErr != nil {
		if appErr.StatusCode == http.StatusNotFound {
			return 0, model.NewAppError("getPostFlagTime", "app.data_spillage.exposure.missing_reporting_time.app_error", nil, "", http.StatusInternalServerError)
		}
		return 0, appErr
	}

	var reportingTime int64
	if err := json.Unmarshal(value.Value, &reportingTime); err != nil {
		return 0, model.NewAppError("getPostFlagTime", "app.data_spillage.exposure.missing_reporting_time.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	if reportingTime <= 0 {
		return 0, model.NewAppError("getPostFlagTime", "app.data_spillage.exposure.missing_reporting_time.app_error", nil, "", http.StatusInternalServerError)
	}

	return reportingTime, nil
}

func (a *App) getChannelLastViewedAt(rctx request.CTX, channelID string) (map[string]int64, *model.AppError) {
	lastViewedByUser := map[string]int64{}

	afterUserID := ""
	for {
		members, err := a.Srv().Store().Channel().GetMembersWithLastViewedAtSince(rctx, channelID, 0, afterUserID, model.ChannelMemberLastViewedMaxPerPage)
		if err != nil {
			return nil, model.NewAppError("getChannelLastViewedAt", "app.data_spillage.exposure.get_possible_viewers.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		if len(members) == 0 {
			break
		}

		for _, m := range members {
			lastViewedByUser[m.UserId] = m.LastViewedAt
		}

		afterUserID = members[len(members)-1].UserId

		if len(members) < model.ChannelMemberLastViewedMaxPerPage {
			break
		}
	}

	return lastViewedByUser, nil
}

func (a *App) getUsersProfiles(rctx request.CTX, userIDs []string) (map[string]*model.User, *model.AppError) {
	profiles := make(map[string]*model.User, len(userIDs))

	for batch := range slices.Chunk(userIDs, exposureProfileBatchSize) {
		users, appErr := a.GetUsers(rctx, batch)
		if appErr != nil {
			return nil, appErr
		}
		for _, u := range users {
			profiles[u.Id] = u
		}
	}

	return profiles, nil
}

func WritePostExposureCSV(w io.Writer, report *model.PostExposureReport, T i18n.TranslateFunc) error {
	if err := writePostExposurePreamble(w, report, T); err != nil {
		return err
	}

	cw := csv.NewWriter(w)
	if err := cw.Write(model.PostExposureReportCSVHeader(T)); err != nil {
		return err
	}
	for _, entry := range report.Entries {
		if err := cw.Write(entry.ToCSVRow(T)); err != nil {
			return err
		}
	}

	cw.Flush()
	return cw.Error()
}

// writePostExposurePreamble writes the report metadata as CSV comment lines above the header
// row, so the artifact is self-describing without a sidecar file. Readers skip these with
// the standard comment option (Go's csv.Reader Comment: '#', pandas comment='#').
func writePostExposurePreamble(w io.Writer, report *model.PostExposureReport, T i18n.TranslateFunc) error {
	lines := [][2]string{
		{T("app.data_spillage.exposure.meta.report_version"), report.Version},
		{T("app.data_spillage.exposure.meta.post_id"), report.PostID},
		{T("app.data_spillage.exposure.meta.channel"), fmt.Sprintf("%s (%s)", report.ChannelName, report.ChannelID)},
		{T("app.data_spillage.exposure.meta.window_start"), model.FormatExposureTime(report.WindowStart)},
		{T("app.data_spillage.exposure.meta.window_end"), model.FormatExposureTime(report.WindowEnd)},
		{T("app.data_spillage.exposure.meta.generated_at"), model.FormatExposureTime(report.GeneratedAt)},
		{T("app.data_spillage.exposure.meta.total_users"), fmt.Sprintf("%d", len(report.Entries))},
	}

	for _, line := range lines {
		if _, err := fmt.Fprintf(w, "# %s: %s\n", line[0], line[1]); err != nil {
			return err
		}
	}

	return nil
}
