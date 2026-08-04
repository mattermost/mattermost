// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"bytes"
	"encoding/csv"
	"net/http"
	"strconv"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
)

// flagPostInChannel creates a post in the given channel and flags it, returning the post.
// Unlike setupFlaggedPost it does not sleep: the content flagging property values, including
// reporting_time, are written synchronously by FlagPost.
func flagPostInChannel(t *testing.T, th *TestHelper, channel *model.Channel) *model.Post {
	t.Helper()

	post := th.CreatePost(t, channel)

	appErr := th.App.FlagPost(th.Context, post, channel.TeamId, th.BasicUser2.Id, model.FlagContentRequest{
		Reason:  "spam",
		Comment: "This is spam content",
	})
	require.Nil(t, appErr)

	return post
}

// setLastViewedAt writes an exact LastViewedAt for a channel member. The app-level paths all
// clamp with GREATEST or derive the value from Channels.LastPostAt, so none of them can set
// an arbitrary value.
func setLastViewedAt(t *testing.T, th *TestHelper, channelID, userID string, lastViewedAt int64) {
	t.Helper()

	_, err := th.SQLStore.GetMaster().Exec(
		`UPDATE ChannelMembers SET LastViewedAt = ? WHERE ChannelId = ? AND UserId = ?`,
		lastViewedAt, channelID, userID)
	require.NoError(t, err)
}

// seedOldChannelMemberHistory makes GetUsersInChannelDuring use ChannelMemberHistory rather
// than its current-membership fallback.
//
// The fallback triggers when MIN(JoinTime) across the whole ChannelMemberHistory table is
// later than the window start, and it returns only current members with synthesised join and
// leave times. On a production server the table stretches back far enough that this never
// happens, but a test database starts empty and TestHelper.CreatePost backdates posts by ten
// seconds, so every history row is newer than the post. Seeding one very old, already-closed
// row for a synthetic channel pins the accurate code path.
func seedOldChannelMemberHistory(t *testing.T, th *TestHelper) {
	t.Helper()

	_, err := th.SQLStore.GetMaster().Exec(
		`INSERT INTO ChannelMemberHistory (ChannelId, UserId, JoinTime, LeaveTime) VALUES (?, ?, ?, ?)`,
		model.NewId(), model.NewId(), int64(1), int64(2))
	require.NoError(t, err)
}

// setRemoteID marks a user as originating from a remote server. RemoteId is not a
// user-editable field, so UpdateUser silently drops it.
func setRemoteID(t *testing.T, th *TestHelper, userID, remoteID string) {
	t.Helper()

	_, err := th.SQLStore.GetMaster().Exec(`UPDATE Users SET RemoteId = ? WHERE Id = ?`, remoteID, userID)
	require.NoError(t, err)
	th.App.InvalidateCacheForUser(userID)
}

func entryFor(report *model.PostExposureReport, userID string) *model.PostExposureReportEntry {
	for _, e := range report.Entries {
		if e.UserID == userID {
			return e
		}
	}
	return nil
}

func entryUserIDs(report *model.PostExposureReport) []string {
	out := make([]string, 0, len(report.Entries))
	for _, e := range report.Entries {
		out = append(out, e.UserID)
	}
	return out
}

func TestComputePostExposure(t *testing.T) {
	mainHelper.Parallel(t)
	th := Setup(t).InitBasic(t)

	require.Nil(t, setBaseConfig(th))
	seedOldChannelMemberHistory(t, th)

	t.Run("reports a member who viewed the channel after the post", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		viewer := th.CreateUser(t)
		th.LinkUserToTeam(t, viewer, th.BasicTeam)
		th.AddUserToChannel(t, viewer, channel)

		post := flagPostInChannel(t, th, channel)
		setLastViewedAt(t, th, channel.Id, viewer.Id, post.CreateAt+1000)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, viewer.Id)
		require.NotNil(t, entry)
		require.True(t, entry.WasChannelMember)
		require.True(t, entry.LikelyReceivedPost)
		require.NotNil(t, entry.LastViewedAt)
		require.Equal(t, post.CreateAt+1000, *entry.LastViewedAt)
		require.Equal(t, viewer.Username, entry.Username)
		require.Equal(t, viewer.Email, entry.UserEmail)
	})

	t.Run("includes a member whose LastViewedAt equals the post CreateAt exactly", func(t *testing.T) {
		// UpdateLastViewedAt sets LastViewedAt to Channels.LastPostAt rather than to
		// wall-clock now, so reading a channel whose newest post is the flagged one lands
		// on exact equality. A strict > comparison would silently drop the single most
		// common real exposure.
		channel := th.CreateChannel(t, th.BasicTeam)
		viewer := th.CreateUser(t)
		th.LinkUserToTeam(t, viewer, th.BasicTeam)
		th.AddUserToChannel(t, viewer, channel)

		post := flagPostInChannel(t, th, channel)
		setLastViewedAt(t, th, channel.Id, viewer.Id, post.CreateAt)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, viewer.Id)
		require.NotNil(t, entry)
		require.True(t, entry.LikelyReceivedPost)
	})

	t.Run("reports a member who never viewed the channel as not having received the post", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		nonViewer := th.CreateUser(t)
		th.LinkUserToTeam(t, nonViewer, th.BasicTeam)
		th.AddUserToChannel(t, nonViewer, channel)

		post := flagPostInChannel(t, th, channel)
		setLastViewedAt(t, th, channel.Id, nonViewer.Id, post.CreateAt-1)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, nonViewer.Id)
		require.NotNil(t, entry)
		require.True(t, entry.WasChannelMember)
		require.False(t, entry.LikelyReceivedPost)
		require.NotNil(t, entry.LastViewedAt)
		require.Equal(t, post.CreateAt-1, *entry.LastViewedAt)
	})

	t.Run("leaves LastViewedAt unset for a member who has since left the channel", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		leaver := th.CreateUser(t)
		th.LinkUserToTeam(t, leaver, th.BasicTeam)
		th.AddUserToChannel(t, leaver, channel)

		post := flagPostInChannel(t, th, channel)
		require.Nil(t, th.RemoveUserFromChannel(t, leaver, channel))

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, leaver.Id)
		require.NotNil(t, entry, "a user who left after the post must still be reported as a member")
		require.True(t, entry.WasChannelMember)
		require.False(t, entry.LikelyReceivedPost)
		require.Nil(t, entry.LastViewedAt, "no read state survives for a former member")
	})

	t.Run("includes a deactivated user, flagged as such", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, channel)

		post := flagPostInChannel(t, th, channel)

		_, appErr := th.App.UpdateActive(th.Context, user, false)
		require.Nil(t, appErr)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, user.Id)
		require.NotNil(t, entry, "deactivating a user does not undo their exposure")
		require.True(t, entry.IsDeactivated)
	})

	t.Run("flags a guest user", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		guest := th.CreateGuest(t)
		th.LinkUserToTeam(t, guest, th.BasicTeam)
		th.AddUserToChannel(t, guest, channel)

		post := flagPostInChannel(t, th, channel)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, guest.Id)
		require.NotNil(t, entry)
		require.True(t, entry.IsGuest)
		require.False(t, entry.IsRemote)
	})

	t.Run("flags a remote user", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		remote := th.CreateUser(t)
		th.LinkUserToTeam(t, remote, th.BasicTeam)
		th.AddUserToChannel(t, remote, channel)

		setRemoteID(t, th, remote.Id, model.NewId())

		post := flagPostInChannel(t, th, channel)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, remote.Id)
		require.NotNil(t, entry)
		require.True(t, entry.IsRemote, "content on a remote server is beyond the reach of hiding the post")
	})

	t.Run("still reports members of an archived channel", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		user := th.CreateUser(t)
		th.LinkUserToTeam(t, user, th.BasicTeam)
		th.AddUserToChannel(t, user, channel)

		post := flagPostInChannel(t, th, channel)
		setLastViewedAt(t, th, channel.Id, user.Id, post.CreateAt+1)

		require.Nil(t, th.App.DeleteChannel(th.Context, channel, th.BasicUser.Id))

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		entry := entryFor(report, user.Id)
		require.NotNil(t, entry, "archiving is soft; membership and read state survive it")
		require.True(t, entry.LikelyReceivedPost)
	})

	t.Run("populates the report window and metadata", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		post := flagPostInChannel(t, th, channel)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		require.Equal(t, model.PostExposureReportVersion, report.Version)
		require.Equal(t, post.Id, report.PostID)
		require.Equal(t, channel.Id, report.ChannelID)
		require.Equal(t, channel.DisplayName, report.ChannelName)
		require.Equal(t, th.BasicTeam.Id, report.TeamID)
		require.Equal(t, post.CreateAt, report.WindowStart)

		// The window must end at the flag time, not at "now".
		values := searchPropertyValue(t, th, post.Id, contentFlaggingPropertyNameReportingTime)
		require.Len(t, values, 1)
		require.Equal(t, string(values[0].Value), strconv.FormatInt(report.WindowEnd, 10))
		require.NotZero(t, report.GeneratedAt)
	})

	t.Run("orders entries deterministically by username", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		for range 4 {
			u := th.CreateUser(t)
			th.LinkUserToTeam(t, u, th.BasicTeam)
			th.AddUserToChannel(t, u, channel)
		}

		post := flagPostInChannel(t, th, channel)

		first, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)
		second, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.Nil(t, appErr)

		require.Equal(t, entryUserIDs(first), entryUserIDs(second))

		usernames := make([]string, 0, len(first.Entries))
		for _, e := range first.Entries {
			usernames = append(usernames, e.Username)
		}
		require.IsIncreasing(t, usernames)
	})

	t.Run("returns an error when the post is not flagged", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		post := th.CreatePost(t, channel)

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.NotNil(t, appErr)
		require.Nil(t, report)
	})

	t.Run("returns an error when reporting_time is missing", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		post := flagPostInChannel(t, th, channel)

		values := searchPropertyValue(t, th, post.Id, contentFlaggingPropertyNameReportingTime)
		require.Len(t, values, 1)
		require.Nil(t, th.App.DeletePropertyValue(th.Context, values[0].GroupID, values[0].ID))

		report, appErr := th.App.ComputePostExposure(th.Context, post.Id)
		require.NotNil(t, appErr)
		require.Nil(t, report)
		require.Equal(t, "app.data_spillage.exposure.missing_reporting_time.app_error", appErr.Id)
	})

	t.Run("returns an error for a post that does not exist", func(t *testing.T) {
		report, appErr := th.App.ComputePostExposure(th.Context, model.NewId())
		require.NotNil(t, appErr)
		require.Nil(t, report)
	})

	t.Run("rejects direct and group message channels", func(t *testing.T) {
		other := th.CreateUser(t)

		dm := th.CreateDmChannel(t, other)
		dmPost := th.CreatePost(t, dm)
		appErr := th.App.FlagPost(th.Context, dmPost, "", th.BasicUser2.Id, model.FlagContentRequest{Reason: "spam", Comment: "c"})
		require.Nil(t, appErr)

		report, appErr := th.App.ComputePostExposure(th.Context, dmPost.Id)
		require.NotNil(t, appErr)
		require.Nil(t, report)
		require.Equal(t, "app.data_spillage.exposure.unsupported_channel_type.app_error", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)

		gm := th.CreateGroupChannel(t, th.BasicUser2, other)
		gmPost := th.CreatePost(t, gm)
		appErr = th.App.FlagPost(th.Context, gmPost, "", th.BasicUser2.Id, model.FlagContentRequest{Reason: "spam", Comment: "c"})
		require.Nil(t, appErr)

		report, appErr = th.App.ComputePostExposure(th.Context, gmPost.Id)
		require.NotNil(t, appErr)
		require.Nil(t, report)
		require.Equal(t, "app.data_spillage.exposure.unsupported_channel_type.app_error", appErr.Id)
	})

	t.Run("rejects an edit history revision", func(t *testing.T) {
		channel := th.CreateChannel(t, th.BasicTeam)
		post := flagPostInChannel(t, th, channel)

		patched, _, appErr := th.App.PatchPost(th.Context, post.Id, &model.PostPatch{Message: model.NewPointer("edited")}, &model.UpdatePostOptions{})
		require.Nil(t, appErr)
		require.NotNil(t, patched)

		history, appErr := th.App.GetEditHistoryForPost(post.Id)
		require.Nil(t, appErr)
		require.NotEmpty(t, history)

		report, appErr := th.App.ComputePostExposure(th.Context, history[0].Id)
		require.NotNil(t, appErr)
		require.Nil(t, report)
		require.Equal(t, "app.data_spillage.exposure.edit_history_post.app_error", appErr.Id)
		require.Equal(t, http.StatusBadRequest, appErr.StatusCode)
	})
}

func TestWritePostExposureCSV(t *testing.T) {
	mainHelper.Parallel(t)

	T := i18n.GetUserTranslations("en")

	baseReport := func() *model.PostExposureReport {
		return &model.PostExposureReport{
			Version:     model.PostExposureReportVersion,
			PostID:      "post1",
			ChannelID:   "channel1",
			ChannelName: "Town Square",
			ChannelType: model.ChannelTypeOpen,
			TeamID:      "team1",
			WindowStart: 1700000000000,
			WindowEnd:   1700000600000,
			GeneratedAt: 1700001000000,
			Entries:     []*model.PostExposureReportEntry{},
		}
	}

	// parseCSV strips the comment preamble and returns the remaining records.
	parseCSV := func(t *testing.T, b []byte) [][]string {
		t.Helper()
		r := csv.NewReader(bytes.NewReader(b))
		r.Comment = '#'
		records, err := r.ReadAll()
		require.NoError(t, err)
		return records
	}

	t.Run("writes a preamble and a header for an empty report", func(t *testing.T) {
		var buf bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&buf, baseReport(), T))

		out := buf.String()
		require.Contains(t, out, "# Post ID: post1")
		require.Contains(t, out, "# Channel: Town Square (channel1)")
		require.Contains(t, out, "# Post created at: 2023-11-14T22:13:20Z")
		require.Contains(t, out, "# Flagged at: 2023-11-14T22:23:20Z")
		require.Contains(t, out, "# Total users: 0")

		records := parseCSV(t, buf.Bytes())
		require.Len(t, records, 1, "an empty report is still a valid CSV with a header")
		require.Equal(t, model.PostExposureReportCSVHeader(T), records[0])
	})

	t.Run("renders every column", func(t *testing.T) {
		report := baseReport()
		report.Entries = append(report.Entries, &model.PostExposureReportEntry{
			UserID:             "user1",
			Username:           "alice",
			UserEmail:          "alice@example.com",
			IsGuest:            true,
			IsRemote:           false,
			IsDeactivated:      true,
			WasChannelMember:   true,
			LikelyReceivedPost: true,
			LastViewedAt:       model.NewPointer(int64(1700000300000)),
		})

		var buf bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&buf, report, T))

		records := parseCSV(t, buf.Bytes())
		require.Len(t, records, 2)
		require.Equal(t, []string{
			"user1", "alice", "alice@example.com",
			"Yes", "No", "Yes", "Yes", "Yes",
			"2023-11-14T22:18:20Z",
		}, records[1])
		require.Len(t, records[1], len(model.PostExposureReportCSVHeader(T)))
	})

	t.Run("renders missing read state as markers rather than the epoch", func(t *testing.T) {
		report := baseReport()
		report.Entries = append(report.Entries,
			&model.PostExposureReportEntry{UserID: "u1", Username: "aa", LastViewedAt: nil},
			&model.PostExposureReportEntry{UserID: "u2", Username: "bb", LastViewedAt: model.NewPointer(int64(0))},
		)

		var buf bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&buf, report, T))

		records := parseCSV(t, buf.Bytes())
		require.Len(t, records, 3)
		require.Equal(t, "Unknown", records[1][8])
		require.Equal(t, "Never viewed", records[2][8])
		require.NotContains(t, buf.String(), "1970-01-01")
	})

	t.Run("escapes separators and quotes in user data", func(t *testing.T) {
		report := baseReport()
		report.Entries = append(report.Entries, &model.PostExposureReportEntry{
			UserID:    "u1",
			Username:  `we,ird "name"`,
			UserEmail: "line\nbreak@example.com",
		})

		var buf bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&buf, report, T))

		records := parseCSV(t, buf.Bytes())
		require.Len(t, records, 2)
		require.Equal(t, `we,ird "name"`, records[1][1])
		require.Equal(t, "line\nbreak@example.com", records[1][2])
	})

	t.Run("collapses line breaks in preamble values", func(t *testing.T) {
		// A channel display name may contain line breaks: Channel.IsValid only bounds its
		// length and SanitizeUnicode leaves \n and \r alone. Written raw, the remainder of
		// the value would land on a line without a leading "#", which a comment-aware
		// reader parses as a data record and rejects for having the wrong field count.
		report := baseReport()
		report.ChannelName = "Town\nSquare\r\nAnnex\rWing"

		var buf bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&buf, report, T))

		out := buf.String()
		require.Contains(t, out, "# Channel: Town Square Annex Wing (channel1)")

		records := parseCSV(t, buf.Bytes())
		require.Len(t, records, 1, "the preamble must stay fully commented out")
		require.Equal(t, model.PostExposureReportCSVHeader(T), records[0])
	})

	t.Run("is byte-for-byte deterministic", func(t *testing.T) {
		report := baseReport()
		report.Entries = append(report.Entries,
			&model.PostExposureReportEntry{UserID: "u1", Username: "aa", WasChannelMember: true},
			&model.PostExposureReportEntry{UserID: "u2", Username: "bb", WasChannelMember: true},
		)

		var first, second bytes.Buffer
		require.NoError(t, WritePostExposureCSV(&first, report, T))
		require.NoError(t, WritePostExposureCSV(&second, report, T))
		require.Equal(t, first.Bytes(), second.Bytes())
	})
}
