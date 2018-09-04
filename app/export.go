// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"strings"

	"github.com/mattermost/mattermost-server/model"
)

func (a *App) BulkExport(writer io.Writer) *model.AppError {
	if err := a.ExportVersion(writer); err != nil {
		return err
	}

	if err := a.ExportAllTeams(writer); err != nil {
		return err
	}

	if err := a.ExportAllChannels(writer); err != nil {
		return err
	}

	if err := a.ExportAllUsers(writer); err != nil {
		return err
	}

	if err := a.ExportAllPosts(writer); err != nil {
		return err
	}

	return nil
}

func (a *App) ExportWriteLine(writer io.Writer, line *LineImportData) *model.AppError {
	b, err := json.Marshal(line)
	if err != nil {
		return model.NewAppError("BulkExport", "app.export.export_write_line.json_marshall.error", nil, "err="+err.Error(), http.StatusBadRequest)
	}

	if _, err := writer.Write(append(b, '\n')); err != nil {
		return model.NewAppError("BulkExport", "app.export.export_write_line.io_writer.error", nil, "err="+err.Error(), http.StatusBadRequest)
	}

	return nil
}

func (a *App) ExportVersion(writer io.Writer) *model.AppError {
	version := 1
	versionLine := &LineImportData{
		Type:    "version",
		Version: &version,
	}

	return a.ExportWriteLine(writer, versionLine)
}

func (a *App) ExportAllTeams(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		result := <-a.Srv.Store.Team().GetAllForExportAfter(1000, afterId)

		if result.Err != nil {
			return result.Err
		}

		teams := result.Data.([]*model.TeamForExport)

		if len(teams) == 0 {
			break
		}

		for _, team := range teams {
			afterId = team.Id

			// Skip deleted.
			if team.DeleteAt != 0 {
				continue
			}

			teamLine := ImportLineFromTeam(team)
			if err := a.ExportWriteLine(writer, teamLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) ExportAllChannels(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		result := <-a.Srv.Store.Channel().GetAllChannelsForExportAfter(1000, afterId)

		if result.Err != nil {
			return result.Err
		}

		channels := result.Data.([]*model.ChannelForExport)

		if len(channels) == 0 {
			break
		}

		for _, channel := range channels {
			afterId = channel.Id

			// Skip deleted.
			if channel.DeleteAt != 0 {
				continue
			}

			channelLine := ImportLineFromChannel(channel)
			if err := a.ExportWriteLine(writer, channelLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) ExportAllUsers(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		result := <-a.Srv.Store.User().GetAllAfter(1000, afterId)

		if result.Err != nil {
			return result.Err
		}

		users := result.Data.([]*model.User)

		if len(users) == 0 {
			break
		}

		for _, user := range users {
			afterId = user.Id

			// Skip deleted.
			if user.DeleteAt != 0 {
				continue
			}

			userLine := ImportLineFromUser(user)

			// Do the Team Memberships.
			members, err := a.buildUserTeamAndChannelMemberships(user.Id)
			if err != nil {
				return err
			}

			userLine.User.Teams = members

			if err := a.ExportWriteLine(writer, userLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) buildUserTeamAndChannelMemberships(userId string) (*[]UserTeamImportData, *model.AppError) {
	var memberships []UserTeamImportData

	result := <-a.Srv.Store.Team().GetTeamMembersForExport(userId)

	if result.Err != nil {
		return nil, result.Err
	}

	members := result.Data.([]*model.TeamMemberForExport)

	for _, member := range members {
		// Skip deleted.
		if member.DeleteAt != 0 {
			continue
		}

		memberData := ImportUserTeamDataFromTeamMember(member)

		// Do the Channel Memberships.
		channelMembers, err := a.buildUserChannelMemberships(userId, member.TeamId)
		if err != nil {
			return nil, err
		}

		memberData.Channels = channelMembers

		memberships = append(memberships, *memberData)
	}

	return &memberships, nil
}

func (a *App) buildUserChannelMemberships(userId string, teamId string) (*[]UserChannelImportData, *model.AppError) {
	var memberships []UserChannelImportData

	result := <-a.Srv.Store.Channel().GetChannelMembersForExport(userId, teamId)

	if result.Err != nil {
		return nil, result.Err
	}

	members := result.Data.([]*model.ChannelMemberForExport)

	for _, member := range members {
		memberships = append(memberships, *ImportUserChannelDataFromChannelMember(member))
	}

	return &memberships, nil
}

func (a *App) ExportAllPosts(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		result := <-a.Srv.Store.Post().GetParentsForExportAfter(1000, afterId)

		if result.Err != nil {
			return result.Err
		}

		posts := result.Data.([]*model.PostForExport)

		if len(posts) == 0 {
			break
		}

		for _, post := range posts {
			afterId = post.Id

			// Skip deleted.
			if post.DeleteAt != 0 {
				continue
			}

			postLine := ImportLineForPost(post)

			// Do the Replies.
			replies, err := a.buildPostReplies(post.Id)
			if err != nil {
				return err
			}

			postLine.Post.Replies = replies

			if err := a.ExportWriteLine(writer, postLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) buildPostReplies(postId string) (*[]ReplyImportData, *model.AppError) {
	var replies []ReplyImportData

	result := <-a.Srv.Store.Post().GetRepliesForExport(postId)

	if result.Err != nil {
		return nil, result.Err
	}

	replyPosts := result.Data.([]*model.ReplyForExport)

	for _, reply := range replyPosts {
		replies = append(replies, *ImportReplyFromPost(reply))
	}

	return &replies, nil
}
