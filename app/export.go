// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"encoding/json"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/v5/store"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/pkg/errors"
)

// We use this map to identify the exportable preferences.
// Here we link the preference category and name, to the name of the relevant field in the import struct.
var exportablePreferences = map[ComparablePreference]string{{
	Category: model.PREFERENCE_CATEGORY_THEME,
	Name:     "",
}: "Theme", {
	Category: model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
	Name:     "feature_enabled_markdown_preview",
}: "UseMarkdownPreview", {
	Category: model.PREFERENCE_CATEGORY_ADVANCED_SETTINGS,
	Name:     "formatting",
}: "UseFormatting", {
	Category: model.PREFERENCE_CATEGORY_SIDEBAR_SETTINGS,
	Name:     "show_unread_section",
}: "ShowUnreadSection", {
	Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
	Name:     model.PREFERENCE_NAME_USE_MILITARY_TIME,
}: "UseMilitaryTime", {
	Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
	Name:     model.PREFERENCE_NAME_COLLAPSE_SETTING,
}: "CollapsePreviews", {
	Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
	Name:     model.PREFERENCE_NAME_MESSAGE_DISPLAY,
}: "MessageDisplay", {
	Category: model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS,
	Name:     "channel_display_mode",
}: "ChannelDisplayMode", {
	Category: model.PREFERENCE_CATEGORY_TUTORIAL_STEPS,
	Name:     "",
}: "TutorialStep", {
	Category: model.PREFERENCE_CATEGORY_NOTIFICATIONS,
	Name:     model.PREFERENCE_NAME_EMAIL_INTERVAL,
}: "EmailInterval",
}

func (a *App) BulkExport(writer io.Writer, file string, pathToEmojiDir string, dirNameToExportEmoji string) *model.AppError {
	mlog.Info("Bulk export: exporting version")
	if err := a.ExportVersion(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting teams")
	if err := a.ExportAllTeams(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting channels")
	if err := a.ExportAllChannels(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting users")
	if err := a.ExportAllUsers(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting posts")
	if err := a.ExportAllPosts(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting emoji")
	if err := a.ExportCustomEmoji(writer, file, pathToEmojiDir, dirNameToExportEmoji); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting direct channels")
	if err := a.ExportAllDirectChannels(writer); err != nil {
		return err
	}

	mlog.Info("Bulk export: exporting direct posts")
	if err := a.ExportAllDirectPosts(writer); err != nil {
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
		teams, err := a.Srv.Store.Team().GetAllForExportAfter(1000, afterId)

		if err != nil {
			return err
		}

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
		channels, err := a.Srv.Store.Channel().GetAllChannelsForExportAfter(1000, afterId)

		if err != nil {
			return err
		}

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
		users, err := a.Srv.Store.User().GetAllAfter(1000, afterId)

		if err != nil {
			return err
		}

		if len(users) == 0 {
			break
		}

		for _, user := range users {
			afterId = user.Id

			// Gathering here the exportable preferences to pass them on to ImportLineFromUser
			exportedPrefs := make(map[string]*string)
			allPrefs, err := a.GetPreferencesForUser(user.Id)
			if err != nil {
				return err
			}
			for _, pref := range allPrefs {
				// We need to manage the special cases
				// Here we manage Tutorial steps
				if pref.Category == model.PREFERENCE_CATEGORY_TUTORIAL_STEPS {
					pref.Name = ""
					// Then the email interval
				} else if pref.Category == model.PREFERENCE_CATEGORY_NOTIFICATIONS && pref.Name == model.PREFERENCE_NAME_EMAIL_INTERVAL {
					switch pref.Value {
					case model.PREFERENCE_EMAIL_INTERVAL_NO_BATCHING_SECONDS:
						pref.Value = model.PREFERENCE_EMAIL_INTERVAL_IMMEDIATELY
					case model.PREFERENCE_EMAIL_INTERVAL_FIFTEEN_AS_SECONDS:
						pref.Value = model.PREFERENCE_EMAIL_INTERVAL_FIFTEEN
					case model.PREFERENCE_EMAIL_INTERVAL_HOUR_AS_SECONDS:
						pref.Value = model.PREFERENCE_EMAIL_INTERVAL_HOUR
					case "0":
						pref.Value = ""
					}
				}
				id, ok := exportablePreferences[ComparablePreference{
					Category: pref.Category,
					Name:     pref.Name,
				}]
				if ok {
					prefPtr := pref.Value
					if prefPtr != "" {
						exportedPrefs[id] = &prefPtr
					} else {
						exportedPrefs[id] = nil
					}
				}
			}

			userLine := ImportLineFromUser(user, exportedPrefs)

			userLine.User.NotifyProps = a.buildUserNotifyProps(user.NotifyProps)

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

	members, err := a.Srv.Store.Team().GetTeamMembersForExport(userId)

	if err != nil {
		return nil, err
	}

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

		// Get the user theme
		themePreference, err := a.Srv.Store.Preference().Get(member.UserId, model.PREFERENCE_CATEGORY_THEME, member.TeamId)
		if err == nil {
			memberData.Theme = &themePreference.Value
		}

		memberData.Channels = channelMembers

		memberships = append(memberships, *memberData)
	}

	return &memberships, nil
}

func (a *App) buildUserChannelMemberships(userId string, teamId string) (*[]UserChannelImportData, *model.AppError) {
	var memberships []UserChannelImportData

	members, err := a.Srv.Store.Channel().GetChannelMembersForExport(userId, teamId)
	if err != nil {
		return nil, err
	}

	category := model.PREFERENCE_CATEGORY_FAVORITE_CHANNEL
	preferences, err := a.GetPreferenceByCategoryForUser(userId, category)
	if err != nil && err.StatusCode != http.StatusNotFound {
		return nil, err
	}

	for _, member := range members {
		memberships = append(memberships, *ImportUserChannelDataFromChannelMemberAndPreferences(member, &preferences))
	}
	return &memberships, nil
}

func (a *App) buildUserNotifyProps(notifyProps model.StringMap) *UserNotifyPropsImportData {

	getProp := func(key string) *string {
		if v, ok := notifyProps[key]; ok {
			return &v
		}
		return nil
	}

	return &UserNotifyPropsImportData{
		Desktop:          getProp(model.DESKTOP_NOTIFY_PROP),
		DesktopSound:     getProp(model.DESKTOP_SOUND_NOTIFY_PROP),
		Email:            getProp(model.EMAIL_NOTIFY_PROP),
		Mobile:           getProp(model.PUSH_NOTIFY_PROP),
		MobilePushStatus: getProp(model.PUSH_STATUS_NOTIFY_PROP),
		ChannelTrigger:   getProp(model.CHANNEL_MENTIONS_NOTIFY_PROP),
		CommentsTrigger:  getProp(model.COMMENTS_NOTIFY_PROP),
		MentionKeys:      getProp(model.MENTION_KEYS_NOTIFY_PROP),
	}
}

func (a *App) ExportAllPosts(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)

	for {
		posts, err := a.Srv.Store.Post().GetParentsForExportAfter(1000, afterId)
		if err != nil {
			return err
		}

		if len(posts) == 0 {
			return nil
		}

		for _, post := range posts {
			afterId = post.Id

			// Skip deleted.
			if post.DeleteAt != 0 {
				continue
			}

			postLine := ImportLineForPost(post)

			postLine.Post.Replies, err = a.buildPostReplies(post.Id)
			if err != nil {
				return err
			}

			postLine.Post.Reactions = &[]ReactionImportData{}
			if post.HasReactions {
				postLine.Post.Reactions, err = a.BuildPostReactions(post.Id)
				if err != nil {
					return err
				}
			}

			if err := a.ExportWriteLine(writer, postLine); err != nil {
				return err
			}
		}
	}
}

func (a *App) buildPostReplies(postId string) (*[]ReplyImportData, *model.AppError) {
	var replies []ReplyImportData

	replyPosts, err := a.Srv.Store.Post().GetRepliesForExport(postId)
	if err != nil {
		return nil, err
	}

	for _, reply := range replyPosts {
		replyImportObject := ImportReplyFromPost(reply)
		if reply.HasReactions {
			replyImportObject.Reactions, err = a.BuildPostReactions(reply.Id)
			if err != nil {
				return nil, err
			}
		}
		replies = append(replies, *replyImportObject)
	}

	return &replies, nil
}

func (a *App) BuildPostReactions(postId string) (*[]ReactionImportData, *model.AppError) {
	var reactionsOfPost []ReactionImportData

	reactions, err := a.Srv.Store.Reaction().GetForPost(postId, true)
	if err != nil {
		return nil, err
	}

	for _, reaction := range reactions {
		var user *model.User
		user, err = a.Srv.Store.User().Get(reaction.UserId)
		if err != nil {
			if err.Id == store.MISSING_ACCOUNT_ERROR { // this is a valid case, the user that reacted might've been deleted by now
				mlog.Info("Skipping reactions by user since the entity doesn't exist anymore", mlog.String("user_id", reaction.UserId))
				continue
			}
			return nil, err
		}
		reactionsOfPost = append(reactionsOfPost, *ImportReactionFromPost(user, reaction))
	}

	return &reactionsOfPost, nil

}

func (a *App) ExportCustomEmoji(writer io.Writer, file string, pathToEmojiDir string, dirNameToExportEmoji string) *model.AppError {
	pageNumber := 0
	for {
		customEmojiList, err := a.GetEmojiList(pageNumber, 100, model.EMOJI_SORT_BY_NAME)

		if err != nil {
			return err
		}

		if len(customEmojiList) == 0 {
			break
		}

		pageNumber++

		pathToDir := a.createDirForEmoji(file, dirNameToExportEmoji)

		for _, emoji := range customEmojiList {
			emojiImagePath := pathToEmojiDir + emoji.Id + "/image"
			err := a.copyEmojiImages(emoji.Id, emojiImagePath, pathToDir)
			if err != nil {
				return model.NewAppError("BulkExport", "app.export.export_custom_emoji.copy_emoji_images.error", nil, "err="+err.Error(), http.StatusBadRequest)
			}

			filePath := dirNameToExportEmoji + "/" + emoji.Id + "/image"

			emojiImportObject := ImportLineFromEmoji(emoji, filePath)

			if err := a.ExportWriteLine(writer, emojiImportObject); err != nil {
				return err
			}
		}
	}

	return nil
}

// Creates directory named 'exported_emoji' to copy the emoji files
// Directory and the file specified by admin share the same path
func (a *App) createDirForEmoji(file string, dirName string) string {
	pathToFile, _ := filepath.Abs(file)
	pathSlice := strings.Split(pathToFile, "/")
	if len(pathSlice) > 0 {
		pathSlice = pathSlice[:len(pathSlice)-1]
	}
	pathToDir := strings.Join(pathSlice, "/") + "/" + dirName

	if _, err := os.Stat(pathToDir); os.IsNotExist(err) {
		os.Mkdir(pathToDir, os.ModePerm)
	}
	return pathToDir
}

// Copies emoji files from 'data/emoji' dir to 'exported_emoji' dir
func (a *App) copyEmojiImages(emojiId string, emojiImagePath string, pathToDir string) error {
	fromPath, err := os.Open(emojiImagePath)
	if fromPath == nil || err != nil {
		return errors.New("Error reading " + emojiImagePath + "file")
	}
	defer fromPath.Close()

	emojiDir := pathToDir + "/" + emojiId

	if _, err = os.Stat(emojiDir); err != nil {
		if !os.IsNotExist(err) {
			return errors.Wrapf(err, "Error fetching file info of emoji directory %v", emojiDir)
		}

		if err = os.Mkdir(emojiDir, os.ModePerm); err != nil {
			return errors.Wrapf(err, "Error creating emoji directory %v", emojiDir)
		}
	}

	toPath, err := os.OpenFile(emojiDir+"/image", os.O_RDWR|os.O_CREATE, 0666)
	if err != nil {
		return errors.New("Error creating the image file " + err.Error())
	}
	defer toPath.Close()

	_, err = io.Copy(toPath, fromPath)
	if err != nil {
		return errors.New("Error copying emojis " + err.Error())
	}

	return nil
}

func (a *App) ExportAllDirectChannels(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		channels, err := a.Srv.Store.Channel().GetAllDirectChannelsForExportAfter(1000, afterId)
		if err != nil {
			return err
		}

		if len(channels) == 0 {
			break
		}

		for _, channel := range channels {
			afterId = channel.Id

			// Skip deleted.
			if channel.DeleteAt != 0 {
				continue
			}

			channelLine := ImportLineFromDirectChannel(channel)
			if err := a.ExportWriteLine(writer, channelLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) ExportAllDirectPosts(writer io.Writer) *model.AppError {
	afterId := strings.Repeat("0", 26)
	for {
		posts, err := a.Srv.Store.Post().GetDirectPostParentsForExportAfter(1000, afterId)
		if err != nil {
			return err
		}

		if len(posts) == 0 {
			break
		}

		for _, post := range posts {
			afterId = post.Id

			// Skip deleted.
			if post.DeleteAt != 0 {
				continue
			}

			// Do the Replies.
			replies, err := a.buildPostReplies(post.Id)
			if err != nil {
				return err
			}

			postLine := ImportLineForDirectPost(post)
			postLine.DirectPost.Replies = replies
			if err := a.ExportWriteLine(writer, postLine); err != nil {
				return err
			}
		}
	}
	return nil
}
