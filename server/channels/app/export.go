// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"archive/zip"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/app/imports"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/shared/filestore"
)

const warningsFilename = "warnings.txt"

// We use this map to identify the exportable preferences.
// Here we link the preference category and name, to the name of the relevant field in the import struct.
var exportablePreferences = map[imports.ComparablePreference]string{
	{
		Category: model.PreferenceCategoryTheme,
		Name:     "",
	}: "Theme",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "feature_enabled_markdown_preview",
	}: "UseMarkdownPreview",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "formatting",
	}: "UseFormatting",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "send_on_ctrl_enter",
	}: "SendOnCtrlEnter",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "code_block_ctrl_enter",
	}: "CodeBlockCtrlEnter",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "join_leave",
	}: "ShowJoinLeave",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "unread_scroll_position",
	}: "ShowUnreadScrollPosition",
	{
		Category: model.PreferenceCategoryAdvancedSettings,
		Name:     "sync_drafts",
	}: "SyncDrafts",
	{
		Category: model.PreferenceCategorySidebarSettings,
		Name:     model.PreferenceNameShowUnreadSection,
	}: "ShowUnreadSection",
	{
		Category: model.PreferenceCategorySidebarSettings,
		Name:     model.PreferenceLimitVisibleDmsGms,
	}: "LimitVisibleDmsGms",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameUseMilitaryTime,
	}: "UseMilitaryTime",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameCollapseSetting,
	}: "CollapsePreviews",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameMessageDisplay,
	}: "MessageDisplay",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameChannelDisplayMode,
	}: "ChannelDisplayMode",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameCollapseConsecutive,
	}: "CollapseConsecutive",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameColorizeUsernames,
	}: "ColorizeUsernames",
	{
		Category: model.PreferenceCategoryDisplaySettings,
		Name:     model.PreferenceNameNameFormat,
	}: "NameFormat",
	{
		Category: model.PreferenceCategoryTutorialSteps,
		Name:     "",
	}: "TutorialStep",
	{
		Category: model.PreferenceCategoryNotifications,
		Name:     model.PreferenceNameEmailInterval,
	}: "EmailInterval",
}

func (a *App) BulkExport(ctx request.CTX, writer io.Writer, outPath string, job *model.Job, opts model.BulkExportOpts) *model.AppError {
	var zipWr *zip.Writer
	if opts.CreateArchive {
		var err error
		zipWr = zip.NewWriter(writer)
		defer func() {
			if err = zipWr.Close(); err != nil {
				ctx.Logger().Error("Error closing zip writer", mlog.Err(err))
			}
		}()
		writer, err = zipWr.Create("import.jsonl")
		if err != nil {
			return model.NewAppError("BulkExport", "app.export.zip_create.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	}

	if job == nil {
		job = &model.Job{
			Data: make(model.StringMap),
		}
	} else if job.Data == nil {
		job.Data = make(model.StringMap)
	}

	ctx.Logger().Info("Bulk export: exporting version")
	if err := a.exportVersion(writer); err != nil {
		return err
	}

	if opts.IncludeRolesAndSchemes {
		if err := a.exportRolesAndSchemes(ctx, job, writer); err != nil {
			return err
		}
	}

	ctx.Logger().Info("Bulk export: exporting teams")
	teamNames, appErr := a.exportAllTeams(ctx, job, writer)
	if appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting channels")
	if appErr = a.exportAllChannels(ctx, job, writer, teamNames, opts.IncludeArchivedChannels); appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting users")
	profilePictures, appErr := a.exportAllUsers(ctx, job, writer, opts.IncludeArchivedChannels, opts.IncludeProfilePictures)
	if appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting bots")
	botPPs, appErr := a.exportAllBots(ctx, job, writer, opts.IncludeProfilePictures)
	if appErr != nil {
		return appErr
	}
	profilePictures = append(profilePictures, botPPs...)

	ctx.Logger().Info("Bulk export: exporting posts")
	attachments, appErr := a.exportAllPosts(ctx, job, writer, opts.IncludeAttachments, opts.IncludeArchivedChannels)
	if appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting emoji")
	emojiPaths, appErr := a.exportCustomEmoji(ctx, job, writer, outPath, "exported_emoji", !opts.CreateArchive)
	if appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting direct channels")
	if appErr = a.exportAllDirectChannels(ctx, job, writer, opts.IncludeArchivedChannels); appErr != nil {
		return appErr
	}

	ctx.Logger().Info("Bulk export: exporting direct posts")
	directAttachments, appErr := a.exportAllDirectPosts(ctx, job, writer, opts.IncludeAttachments, opts.IncludeArchivedChannels)
	if appErr != nil {
		return appErr
	}

	if opts.IncludeAttachments {
		ctx.Logger().Info("Bulk export: exporting file attachments")
		warnings, appErr := a.exportAttachments(ctx, attachments, outPath, zipWr)
		if appErr != nil {
			return appErr
		}

		ctx.Logger().Info("Bulk export: exporting direct file attachments")
		newWarnings, appErr := a.exportAttachments(ctx, directAttachments, outPath, zipWr)
		if appErr != nil {
			return appErr
		}
		warnings = append(warnings, newWarnings...)

		totalExportedEmojis := 0
		emojisLen := len(emojiPaths)
		ctx.Logger().Info("Bulk export: exporting custom emojis")
		for _, emojiPath := range emojiPaths {
			if err := a.exportFile(ctx, outPath, emojiPath, zipWr); err != nil {
				ctx.Logger().Warn("Unable to export emoji", mlog.String("emoji_path", emojiPath), mlog.Err(err))
			} else {
				totalExportedEmojis++
			}
			if totalExportedEmojis%10 == 0 {
				ctx.Logger().Info("Bulk export: exporting emojis progress", mlog.Int("total_successfully_exported_emojis", totalExportedEmojis), mlog.Int("total_emojis_to_export", emojisLen))
			}
		}

		if len(warnings) > 0 {
			warningsFile, _ := zipWr.Create(warningsFilename)
			for _, warning := range warnings {
				_, err := warningsFile.Write([]byte(warning + "\n"))
				if err != nil {
					return model.NewAppError("BulkExport", "app.export.zip_create.error",
						nil, "err="+err.Error(), http.StatusInternalServerError)
				}
			}
			updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "num_warnings", len(warnings))
		}

		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "attachments_exported", len(attachments)+len(directAttachments)+len(emojiPaths))
	}

	if opts.IncludeProfilePictures {
		ctx.Logger().Info("Bulk export: exporting profile pictures")
		for _, profilePicture := range profilePictures {
			if err := a.exportFile(ctx, outPath, profilePicture, zipWr); err != nil {
				ctx.Logger().Warn("Unable to export profile picture", mlog.String("profile_picture", profilePicture), mlog.Err(err))
			}
		}
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "profile_pictures_exported", len(profilePictures))
	}

	return nil
}

func (a *App) exportAttachments(ctx request.CTX, attachments []imports.AttachmentImportData, outPath string,
	zipWr *zip.Writer) ([]string, *model.AppError) {
	totalExportedFiles := 0
	attachmentsLen := len(attachments)
	var warnings []string
	for _, attachment := range attachments {
		if err := a.exportFile(ctx, outPath, *attachment.Path, zipWr); err != nil {
			ctx.Logger().Warn("Unable to export file attachment", mlog.String("attachment_path", *attachment.Path), mlog.Err(err))
			warnings = append(warnings, fmt.Sprintf("Unable to export file attachment, attachment path: %s , error: %s", *attachment.Path, err.Error()))
		} else {
			totalExportedFiles++
		}
		if totalExportedFiles%10 == 0 {
			ctx.Logger().Info("Bulk export: exporting file attachments progress", mlog.Int("total_successfully_exported_files", totalExportedFiles), mlog.Int("total_files_to_export", attachmentsLen))
		}
	}
	return warnings, nil
}

func (a *App) exportWriteLine(w io.Writer, line *imports.LineImportData) *model.AppError {
	b, err := json.Marshal(line)
	if err != nil {
		return model.NewAppError("BulkExport", "app.export.export_write_line.json_marshall.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if _, err := w.Write(append(b, '\n')); err != nil {
		return model.NewAppError("BulkExport", "app.export.export_write_line.io_writer.error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	return nil
}

func (a *App) exportVersion(writer io.Writer) *model.AppError {
	version := 1

	info := &imports.VersionInfoImportData{
		Generator: "mattermost-server",
		Version:   fmt.Sprintf("%s (%s, enterprise: %s)", model.CurrentVersion, model.BuildHash, model.BuildEnterpriseReady),
		Created:   time.Now().Format(time.RFC3339Nano),
	}

	versionLine := &imports.LineImportData{
		Type:    "version",
		Version: &version,
		Info:    info,
	}

	return a.exportWriteLine(writer, versionLine)
}

func (a *App) exportRolesAndSchemes(ctx request.CTX, job *model.Job, writer io.Writer) *model.AppError {
	// We export schemes first since they'll already include their attached roles
	// which we map to avoid exporting them twice later in exportRoles.
	schemeRolesMap := make(map[string]bool)

	roles, appErr := a.Srv().Store().Role().GetAll()
	if appErr != nil {
		return model.NewAppError("exportRolesAndSchemes", "app.role.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(appErr)
	}

	ctx.Logger().Info("Bulk export: exporting team schemes")
	if err := a.exportSchemes(ctx, job, writer, model.SchemeScopeTeam, schemeRolesMap, roles); err != nil {
		return err
	}

	ctx.Logger().Info("Bulk export: exporting channel schemes")
	if err := a.exportSchemes(ctx, job, writer, model.SchemeScopeChannel, schemeRolesMap, roles); err != nil {
		return err
	}

	ctx.Logger().Info("Bulk export: exporting roles")
	if err := a.exportRoles(ctx, job, writer, schemeRolesMap, roles); err != nil {
		return err
	}

	return nil
}

func (a *App) exportRoles(ctx request.CTX, job *model.Job, writer io.Writer, schemeRoles map[string]bool, allRoles []*model.Role) *model.AppError {
	var cnt int
	for _, role := range allRoles {
		// We skip any roles that will be included as part of custom schemes.
		if !schemeRoles[role.Name] {
			if err := a.exportWriteLine(writer, importLineFromRole(role)); err != nil {
				return err
			}
			cnt++
		}
	}

	updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "roles_exported", cnt)

	return nil
}

func (a *App) exportSchemes(ctx request.CTX, job *model.Job, writer io.Writer, scope string, schemeRolesMap map[string]bool, allRoles []*model.Role) *model.AppError {
	rolesMap := make(map[string]*model.Role, len(allRoles))
	for _, role := range allRoles {
		rolesMap[role.Name] = role
	}

	var cnt int
	pageSize := 100

	for {
		schemes, err := a.Srv().Store().Scheme().GetAllPage(scope, cnt, pageSize)
		if err != nil {
			return model.NewAppError("exportSchemes", "app.scheme.get_all_page.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		for _, scheme := range schemes {
			if ok := scheme.IsValid(); !ok {
				return model.NewAppError("exportSchemes", "model.scheme.is_valid.app_error", nil, "", http.StatusInternalServerError)
			}

			if scheme.Scope == model.SchemeScopeTeam {
				schemeRolesMap[scheme.DefaultTeamAdminRole] = true
				schemeRolesMap[scheme.DefaultTeamUserRole] = true
				schemeRolesMap[scheme.DefaultTeamGuestRole] = true

				// Playbooks
				// At the moment this is only needed to avoid exporting and
				// importing spurious roles.
				schemeRolesMap[scheme.DefaultPlaybookAdminRole] = true
				schemeRolesMap[scheme.DefaultPlaybookMemberRole] = true
				schemeRolesMap[scheme.DefaultRunAdminRole] = true
				schemeRolesMap[scheme.DefaultRunMemberRole] = true
			}

			if scheme.Scope == model.SchemeScopeTeam || scheme.Scope == model.SchemeScopeChannel {
				schemeRolesMap[scheme.DefaultChannelAdminRole] = true
				schemeRolesMap[scheme.DefaultChannelUserRole] = true
				schemeRolesMap[scheme.DefaultChannelGuestRole] = true
			}

			if err := a.exportWriteLine(writer, importLineFromScheme(scheme, rolesMap)); err != nil {
				return err
			}
		}

		cnt += len(schemes)

		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, fmt.Sprintf("%s_schemes_exported", scope), cnt)

		if len(schemes) < pageSize {
			return nil
		}
	}
}

func (a *App) exportAllTeams(ctx request.CTX, job *model.Job, writer io.Writer) (map[string]bool, *model.AppError) {
	afterId := strings.Repeat("0", 26)
	teamNames := make(map[string]bool)
	cnt := 0
	for {
		teams, err := a.Srv().Store().Team().GetAllForExportAfter(1000, afterId)
		if err != nil {
			return nil, model.NewAppError("exportAllTeams", "app.team.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(teams) == 0 {
			break
		}
		cnt += len(teams)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "teams_exported", cnt)

		for _, team := range teams {
			afterId = team.Id

			// Skip deleted.
			if team.DeleteAt != 0 {
				continue
			}
			teamNames[team.Name] = true

			teamLine := importLineFromTeam(team)
			if err := a.exportWriteLine(writer, teamLine); err != nil {
				return nil, err
			}
		}
	}

	return teamNames, nil
}

func (a *App) exportAllChannels(ctx request.CTX, job *model.Job, writer io.Writer, teamNames map[string]bool, withArchived bool) *model.AppError {
	afterId := strings.Repeat("0", 26)
	cnt := 0
	for {
		channels, err := a.Srv().Store().Channel().GetAllChannelsForExportAfter(1000, afterId)
		if err != nil {
			return model.NewAppError("exportAllChannels", "app.channel.get_all.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(channels) == 0 {
			break
		}
		cnt += len(channels)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "channels_exported", cnt)

		for _, channel := range channels {
			afterId = channel.Id

			// Skip deleted.
			if channel.DeleteAt != 0 && !withArchived {
				continue
			}
			// Skip channels on deleted teams.
			if ok := teamNames[channel.TeamName]; !ok {
				continue
			}

			channelLine := importLineFromChannel(channel)
			if err := a.exportWriteLine(writer, channelLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) exportAllUsers(ctx request.CTX, job *model.Job, writer io.Writer, includeArchivedChannels, includeProfilePictures bool) ([]string, *model.AppError) {
	afterId := strings.Repeat("0", 26)
	cnt := 0
	profilePictures := []string{}
	for {
		users, err := a.Srv().Store().User().GetAllAfter(1000, afterId)
		if err != nil {
			return profilePictures, model.NewAppError("exportAllUsers", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(users) == 0 {
			break
		}
		cnt += len(users)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "users_exported", cnt)

		for _, user := range users {
			afterId = user.Id

			// Skip bots as they are exported separately.
			if user.IsBot {
				continue
			}

			// Gathering here the exportable preferences to pass them on to importLineFromUser
			exportedPrefs := make(map[string]*string)
			allPrefs, err := a.GetPreferencesForUser(ctx, user.Id)
			if err != nil {
				return profilePictures, err
			}
			for _, pref := range allPrefs {
				// We need to manage the special cases
				// Here we manage Tutorial steps
				if pref.Category == model.PreferenceCategoryTutorialSteps {
					pref.Name = ""
					// Then the email interval
				} else if pref.Category == model.PreferenceCategoryNotifications && pref.Name == model.PreferenceNameEmailInterval {
					switch pref.Value {
					case model.PreferenceEmailIntervalNoBatchingSeconds:
						pref.Value = model.PreferenceEmailIntervalImmediately
					case model.PreferenceEmailIntervalFifteenAsSeconds:
						pref.Value = model.PreferenceEmailIntervalFifteen
					case model.PreferenceEmailIntervalHourAsSeconds:
						pref.Value = model.PreferenceEmailIntervalHour
					case "0":
						pref.Value = ""
					}
				}
				id, ok := exportablePreferences[imports.ComparablePreference{
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

			userLine := importLineFromUser(user, exportedPrefs)

			if includeProfilePictures {
				var pp string
				pp, err = a.GetProfileImagePath(user)
				if err != nil {
					return profilePictures, err
				}
				if pp != "" {
					userLine.User.ProfileImage = &pp
					profilePictures = append(profilePictures, pp)
				}
			}

			userLine.User.NotifyProps = a.buildUserNotifyProps(user.NotifyProps)

			// Adding custom status
			if cs := user.GetCustomStatus(); cs != nil {
				userLine.User.CustomStatus = cs
			}

			// Do the Team Memberships.
			members, err := a.buildUserTeamAndChannelMemberships(ctx, user.Id, includeArchivedChannels)
			if err != nil {
				return profilePictures, err
			}

			userLine.User.Teams = members

			if err := a.exportWriteLine(writer, userLine); err != nil {
				return profilePictures, err
			}
		}
	}

	return profilePictures, nil
}

func (a *App) exportAllBots(ctx request.CTX, job *model.Job, writer io.Writer, includeProfilePictures bool) ([]string, *model.AppError) {
	afterId := ""
	cnt := 0
	profilePictures := []string{}

	const pageSize = 1000

	for {
		bots, err := a.Srv().Store().Bot().GetAllAfter(pageSize, afterId)
		if err != nil {
			return profilePictures, model.NewAppError("exportAllBots", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		cnt += len(bots)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "bots_exported", cnt)

		for _, bot := range bots {
			afterId = bot.UserId

			var ownerUsername string
			owner, err := a.Srv().Store().User().Get(ctx.Context(), bot.OwnerId)
			if err != nil {
				var nfErr *store.ErrNotFound
				if errors.As(err, &nfErr) {
					ownerUsername = bot.OwnerId
				} else {
					return profilePictures, model.NewAppError("exportAllBots", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
				}
			} else {
				ownerUsername = owner.Username
			}

			botLine := importLineFromBot(bot, ownerUsername)

			if includeProfilePictures {
				pp, err := a.GetProfileImagePath(model.UserFromBot(bot))
				if err != nil {
					return profilePictures, err
				}
				if pp != "" {
					botLine.Bot.ProfileImage = &pp
					profilePictures = append(profilePictures, pp)
				}
			}

			if err := a.exportWriteLine(writer, botLine); err != nil {
				return profilePictures, err
			}
		}

		if len(bots) < pageSize {
			break
		}
	}

	return profilePictures, nil
}

func (a *App) buildUserTeamAndChannelMemberships(c request.CTX, userID string, includeArchivedChannels bool) (*[]imports.UserTeamImportData, *model.AppError) {
	var memberships []imports.UserTeamImportData

	members, err := a.Srv().Store().Team().GetTeamMembersForExport(userID)
	if err != nil {
		return nil, model.NewAppError("buildUserTeamAndChannelMemberships", "app.team.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	for _, member := range members {
		// Skip deleted.
		if member.DeleteAt != 0 {
			continue
		}

		memberData := importUserTeamDataFromTeamMember(member)

		// Do the Channel Memberships.
		channelMembers, err := a.buildUserChannelMemberships(c, userID, member.TeamId, includeArchivedChannels)
		if err != nil {
			return nil, err
		}

		// Get the user theme
		themePreference, nErr := a.Srv().Store().Preference().Get(member.UserId, model.PreferenceCategoryTheme, member.TeamId)
		if nErr == nil {
			memberData.Theme = &themePreference.Value
		}

		memberData.Channels = channelMembers

		memberships = append(memberships, *memberData)
	}

	return &memberships, nil
}

func (a *App) buildUserChannelMemberships(c request.CTX, userID string, teamID string, includeArchivedChannels bool) (*[]imports.UserChannelImportData, *model.AppError) {
	members, nErr := a.Srv().Store().Channel().GetChannelMembersForExport(userID, teamID, includeArchivedChannels)
	if nErr != nil {
		return nil, model.NewAppError("buildUserChannelMemberships", "app.channel.get_members.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	category := model.PreferenceCategoryFavoriteChannel
	preferences, err := a.GetPreferenceByCategoryForUser(c, userID, category)
	if err != nil && err.StatusCode != http.StatusNotFound {
		return nil, err
	}

	memberships := make([]imports.UserChannelImportData, len(members))
	for i, member := range members {
		memberships[i] = *importUserChannelDataFromChannelMemberAndPreferences(member, &preferences)
	}
	return &memberships, nil
}

func (a *App) buildUserNotifyProps(notifyProps model.StringMap) *imports.UserNotifyPropsImportData {
	getProp := func(key string) *string {
		if v, ok := notifyProps[key]; ok {
			return &v
		}
		return nil
	}

	return &imports.UserNotifyPropsImportData{
		Desktop:          getProp(model.DesktopNotifyProp),
		DesktopSound:     getProp(model.DesktopSoundNotifyProp),
		Email:            getProp(model.EmailNotifyProp),
		Mobile:           getProp(model.PushNotifyProp),
		MobilePushStatus: getProp(model.PushStatusNotifyProp),
		ChannelTrigger:   getProp(model.ChannelMentionsNotifyProp),
		CommentsTrigger:  getProp(model.CommentsNotifyProp),
		MentionKeys:      getProp(model.MentionKeysNotifyProp),
	}
}

func (a *App) exportAllPosts(ctx request.CTX, job *model.Job, writer io.Writer, withAttachments bool, includeArchivedChannels bool) ([]imports.AttachmentImportData, *model.AppError) {
	var attachments []imports.AttachmentImportData
	afterId := strings.Repeat("0", 26)
	var postProcessCount uint64
	logCheckpoint := time.Now()

	cnt := 0
	for {
		if time.Since(logCheckpoint) > 5*time.Minute {
			ctx.Logger().Debug(fmt.Sprintf("Bulk Export: processed %d posts", postProcessCount))
			logCheckpoint = time.Now()
		}

		posts, nErr := a.Srv().Store().Post().GetParentsForExportAfter(1000, afterId, includeArchivedChannels)
		if nErr != nil {
			return nil, model.NewAppError("exportAllPosts", "app.post.get_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
		}

		if len(posts) == 0 {
			return attachments, nil
		}
		cnt += len(posts)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "posts_exported", cnt)

		for _, post := range posts {
			afterId = post.Id
			postProcessCount++

			// Skip deleted.
			if post.DeleteAt != 0 {
				continue
			}

			postLine := importLineForPost(post)

			replies, replyAttachments, err := a.buildPostReplies(ctx, post.Id, withAttachments)
			if err != nil {
				return nil, err
			}

			followers, err := a.buildThreadFollowers(ctx, post.Id)
			if err != nil {
				return nil, err
			}

			if len(followers) > 0 {
				postLine.Post.ThreadFollowers = &followers
			}

			if withAttachments && len(replyAttachments) > 0 {
				attachments = append(attachments, replyAttachments...)
			}

			postLine.Post.Replies = &replies
			postLine.Post.Reactions = &[]imports.ReactionImportData{}
			if post.HasReactions {
				postLine.Post.Reactions, err = a.BuildPostReactions(ctx, post.Id)
				if err != nil {
					return nil, err
				}
			}

			if len(post.FileIds) > 0 {
				postAttachments, err := a.buildPostAttachments(post.Id)
				if err != nil {
					return nil, err
				}
				postLine.Post.Attachments = &postAttachments

				if withAttachments && len(postAttachments) > 0 {
					attachments = append(attachments, postAttachments...)
				}
			}

			if err := a.exportWriteLine(writer, postLine); err != nil {
				return nil, err
			}
		}
	}
}

func (a *App) buildPostReplies(ctx request.CTX, postID string, withAttachments bool) ([]imports.ReplyImportData, []imports.AttachmentImportData, *model.AppError) {
	var replies []imports.ReplyImportData
	var attachments []imports.AttachmentImportData

	replyPosts, nErr := a.Srv().Store().Post().GetRepliesForExport(postID)
	if nErr != nil {
		return nil, nil, model.NewAppError("buildPostReplies", "app.post.get_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, reply := range replyPosts {
		replyImportObject := importReplyFromPost(reply)
		if reply.HasReactions {
			var appErr *model.AppError
			replyImportObject.Reactions, appErr = a.BuildPostReactions(ctx, reply.Id)
			if appErr != nil {
				return nil, nil, appErr
			}
		}
		if len(reply.FileIds) > 0 {
			postAttachments, appErr := a.buildPostAttachments(reply.Id)
			if appErr != nil {
				return nil, nil, appErr
			}
			replyImportObject.Attachments = &postAttachments
			if withAttachments && len(postAttachments) > 0 {
				attachments = append(attachments, postAttachments...)
			}
		}

		replies = append(replies, *replyImportObject)
	}

	return replies, attachments, nil
}

func (a *App) buildThreadFollowers(_ request.CTX, postID string) ([]imports.ThreadFollowerImportData, *model.AppError) {
	var followers []imports.ThreadFollowerImportData

	threadFollowers, nErr := a.Srv().Store().Thread().GetThreadMembershipsForExport(postID)
	if nErr != nil {
		return nil, model.NewAppError("buildThreadFollowers", "app.thread.get_threadmembers_for_export.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, member := range threadFollowers {
		followers = append(followers, *importFollowerFromThreadMember(member))
	}

	return followers, nil
}

func (a *App) BuildPostReactions(ctx request.CTX, postID string) (*[]ReactionImportData, *model.AppError) {
	var reactionsOfPost []imports.ReactionImportData

	reactions, nErr := a.Srv().Store().Reaction().GetForPost(postID, true)
	if nErr != nil {
		return nil, model.NewAppError("BuildPostReactions", "app.reaction.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	for _, reaction := range reactions {
		user, err := a.Srv().Store().User().Get(context.Background(), reaction.UserId)
		if err != nil {
			var nfErr *store.ErrNotFound
			if errors.As(err, &nfErr) { // this is a valid case, the user that reacted might've been deleted by now
				ctx.Logger().Info("Skipping reactions by user since the entity doesn't exist anymore", mlog.String("user_id", reaction.UserId))
				continue
			}
			return nil, model.NewAppError("BuildPostReactions", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
		reactionsOfPost = append(reactionsOfPost, *importReactionFromPost(user, reaction))
	}

	return &reactionsOfPost, nil
}

func (a *App) buildPostAttachments(postID string) ([]imports.AttachmentImportData, *model.AppError) {
	infos, nErr := a.Srv().Store().FileInfo().GetForPost(postID, false, false, false)
	if nErr != nil {
		return nil, model.NewAppError("buildPostAttachments", "app.file_info.get_for_post.app_error", nil, "", http.StatusInternalServerError).Wrap(nErr)
	}

	attachments := make([]imports.AttachmentImportData, 0, len(infos))
	for _, info := range infos {
		attachments = append(attachments, imports.AttachmentImportData{Path: &info.Path})
	}

	return attachments, nil
}

func (a *App) exportCustomEmoji(rctx request.CTX, job *model.Job, writer io.Writer, outPath, exportDir string, exportFiles bool) ([]string, *model.AppError) {
	var emojiPaths []string
	pageNumber := 0
	cnt := 0
	for {
		customEmojiList, err := a.GetEmojiList(rctx, pageNumber, 100, model.EmojiSortByName)

		if err != nil {
			return nil, err
		}

		if len(customEmojiList) == 0 {
			break
		}
		cnt += len(customEmojiList)
		updateJobProgress(rctx.Logger(), a.Srv().Store(), job, "emojis_exported", cnt)

		pageNumber++

		emojiPath := filepath.Join(*a.Config().FileSettings.Directory, "emoji")
		pathToDir := filepath.Join(outPath, exportDir)
		if exportFiles {
			if _, err := os.Stat(pathToDir); os.IsNotExist(err) {
				if err := os.Mkdir(pathToDir, os.ModePerm); err != nil {
					return nil, model.NewAppError("BulkExport", "app.export.export_custom_emoji.mkdir.error", nil, "err="+err.Error(), http.StatusBadRequest)
				}
			}

			for _, emoji := range customEmojiList {
				emojiImagePath := filepath.Join(emojiPath, emoji.Id, "image")
				filePath := filepath.Join(exportDir, emoji.Id, "image")
				if exportFiles {
					err := a.copyEmojiImages(rctx, emoji.Id, emojiImagePath, pathToDir)
					if err != nil {
						return nil, model.NewAppError("BulkExport", "app.export.export_custom_emoji.copy_emoji_images.error", nil, "err="+err.Error(), http.StatusBadRequest)
					}
				} else {
					filePath = filepath.Join("emoji", emoji.Id, "image")
					emojiPaths = append(emojiPaths, filePath)
				}

				emojiImportObject := importLineFromEmoji(emoji, filePath)
				if err := a.exportWriteLine(writer, emojiImportObject); err != nil {
					return nil, err
				}
			}
		}
	}
	return emojiPaths, nil
}

// Copies emoji files from 'data/emoji' dir to 'exported_emoji' dir
func (a *App) copyEmojiImages(rctx request.CTX, emojiId string, emojiImagePath string, pathToDir string) error {
	fromPath, err := os.Open(emojiImagePath)
	if fromPath == nil || err != nil {
		return errors.New("Error reading " + emojiImagePath + " file")
	}
	defer func() {
		if err = fromPath.Close(); err != nil {
			rctx.Logger().Error("Error closing source file", mlog.String("path", emojiImagePath), mlog.Err(err))
		}
	}()

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
	defer func() {
		if err = toPath.Close(); err != nil {
			rctx.Logger().Error("Error closing destination file", mlog.String("path", emojiDir+"/image"), mlog.Err(err))
		}
	}()
	_, err = io.Copy(toPath, fromPath)
	if err != nil {
		return errors.New("Error copying emojis " + err.Error())
	}

	return nil
}

func (a *App) exportAllDirectChannels(ctx request.CTX, job *model.Job, writer io.Writer, includeArchivedChannels bool) *model.AppError {
	afterId := strings.Repeat("0", 26)
	cnt := 0
	for {
		channels, err := a.Srv().Store().Channel().GetAllDirectChannelsForExportAfter(1000, afterId, includeArchivedChannels)
		if err != nil {
			return model.NewAppError("exportAllDirectChannels", "app.channel.get_all_direct.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(channels) == 0 {
			break
		}
		cnt += len(channels)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "direct_channels_exported", cnt)

		for _, channel := range channels {
			afterId = channel.Id

			// Skip deleted.
			if channel.DeleteAt != 0 {
				continue
			}

			// Skip if there are no active members in the channel
			if len(channel.Members) == 0 {
				continue
			}

			// Skip if the channel member structure is not intact
			switch channel.Type {
			case model.ChannelTypeGroup:
				groupMembers := make([]string, len(channel.Members))
				for i, m := range channel.Members {
					groupMembers[i] = m.UserId
				}
				if channel.Name != model.GetGroupNameFromUserIds(groupMembers) {
					// this is the case of a group channel when other user is permanently deleted
					// we skip this channel and inform by logging it.
					job.Data["skipped_direct_channels"] = job.Data["skipped_direct_channels"] + "," + channel.Id
					ctx.Logger().Warn("Skipping group channels with partially deleted members", mlog.String("channel_id", channel.Id))
					continue
				}
			case model.ChannelTypeDirect:
				if _, u2 := channel.GetBothUsersForDM(); u2 != "" && len(channel.Members) == 1 {
					// this is the case of a direct channel when other user is permanently deleted
					// we skip this channel and inform by logging it.
					job.Data["skipped_direct_channels"] = job.Data["skipped_direct_channels"] + "," + channel.Id
					ctx.Logger().Info("Skipping direct channel with one active member", mlog.String("channel_id", channel.Id), mlog.String("user_id", channel.Members[0].UserId))
					continue
				}
			}

			favoritedBy, err := a.buildFavoritedByList(channel.Id)
			if err != nil {
				return err
			}

			shownBy, err := a.buildShownByList(channel)
			if err != nil {
				return err
			}

			channelLine := importLineFromDirectChannel(channel, favoritedBy, shownBy)
			if err := a.exportWriteLine(writer, channelLine); err != nil {
				return err
			}
		}
	}

	return nil
}

func (a *App) buildFavoritedByList(channelID string) ([]string, *model.AppError) {
	prefs, err := a.Srv().Store().Preference().GetCategoryAndName(model.PreferenceCategoryFavoriteChannel, channelID)
	if err != nil {
		return nil, model.NewAppError("buildFavoritedByList", "app.preference.get_category.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	userIDs := make([]string, 0, len(prefs))
	for _, pref := range prefs {
		if pref.Value != "true" {
			continue
		}

		user, err := a.Srv().Store().User().Get(context.Background(), pref.UserId)
		if err != nil {
			return nil, model.NewAppError("buildFavoritedByList", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		userIDs = append(userIDs, user.Username)
	}

	return userIDs, nil
}

func (a *App) buildShownByList(channel *model.DirectChannelForExport) ([]string, *model.AppError) {
	shownBy := make([]string, 0)
	switch channel.Type {
	case model.ChannelTypeGroup:
		for _, member := range channel.Members {
			prefs, err := a.Srv().Store().Preference().GetCategory(member.UserId, model.PreferenceCategoryGroupChannelShow)
			if err != nil {
				return nil, model.NewAppError("buildShownByList", "app.preference.get_category.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			for i := range prefs {
				if prefs[i].Name == channel.Id && prefs[i].Value == "true" {
					user, err := a.Srv().Store().User().Get(context.Background(), member.UserId)
					if err != nil {
						return nil, model.NewAppError("buildShownByList", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}

					shownBy = append(shownBy, user.Username)
				}
			}
		}
	case model.ChannelTypeDirect:
		for i, member := range channel.Members {
			otherMember := member // in case it's a channel with self
			if len(channel.Members) == 2 {
				// since the are only two members, the other member is should be the remainder of i+1/2
				otherMember = channel.Members[(i+1)%2]
			}
			prefs, err := a.Srv().Store().Preference().GetCategoryAndName(model.PreferenceCategoryDirectChannelShow, otherMember.UserId)
			if err != nil {
				return nil, model.NewAppError("buildShownByList", "app.preference.get_category.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
			}

			for _, pref := range prefs {
				if pref.Value == "true" && pref.UserId == member.UserId {
					user, err := a.Srv().Store().User().Get(context.Background(), member.UserId)
					if err != nil {
						return nil, model.NewAppError("buildShownByList", "app.user.get.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
					}

					shownBy = append(shownBy, user.Username)
				}
			}
		}
	}

	return shownBy, nil
}

func (a *App) exportAllDirectPosts(ctx request.CTX, job *model.Job, writer io.Writer, withAttachments, includeArchivedChannels bool) ([]imports.AttachmentImportData, *model.AppError) {
	var attachments []imports.AttachmentImportData
	afterId := strings.Repeat("0", 26)
	var postProcessCount uint64
	logCheckpoint := time.Now()

	cnt := 0
	for {
		if time.Since(logCheckpoint) > 5*time.Minute {
			ctx.Logger().Debug(fmt.Sprintf("Bulk Export: processed %d direct posts", postProcessCount))
			logCheckpoint = time.Now()
		}

		posts, err := a.Srv().Store().Post().GetDirectPostParentsForExportAfter(1000, afterId, includeArchivedChannels)
		if err != nil {
			return nil, model.NewAppError("exportAllDirectPosts", "app.post.get_direct_posts.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}

		if len(posts) == 0 {
			break
		}
		cnt += len(posts)
		updateJobProgress(ctx.Logger(), a.Srv().Store(), job, "direct_posts_exported", cnt)

		channelsToSkip := model.SliceToMapKey(strings.Split(job.Data["skipped_direct_channels"], ",")...)
		for _, post := range posts {
			afterId = post.Id
			postProcessCount++

			// Skip deleted.
			if post.DeleteAt != 0 {
				continue
			}

			if _, ok := channelsToSkip[post.ChannelId]; ok {
				continue
			}

			// Handle attachments.
			var postAttachments []imports.AttachmentImportData
			var err *model.AppError
			if len(post.FileIds) > 0 {
				postAttachments, err = a.buildPostAttachments(post.Id)
				if err != nil {
					return nil, err
				}

				if withAttachments && len(postAttachments) > 0 {
					attachments = append(attachments, postAttachments...)
				}
			}

			// Do the Replies.
			replies, replyAttachments, err := a.buildPostReplies(ctx, post.Id, withAttachments)
			if err != nil {
				return nil, err
			}

			if withAttachments && len(replyAttachments) > 0 {
				attachments = append(attachments, replyAttachments...)
			}

			postLine := importLineForDirectPost(post)
			postLine.DirectPost.Replies = &replies
			if len(postAttachments) > 0 {
				postLine.DirectPost.Attachments = &postAttachments
			}

			followers, err := a.buildThreadFollowers(ctx, post.Id)
			if err != nil {
				return nil, err
			}

			if len(followers) > 0 {
				postLine.DirectPost.ThreadFollowers = &followers
			}

			if err := a.exportWriteLine(writer, postLine); err != nil {
				return nil, err
			}
		}
	}
	return attachments, nil
}

func (a *App) exportFile(rctx request.CTX, outPath, filePath string, zipWr *zip.Writer) *model.AppError {
	rd, appErr := a.FileReader(filePath)
	if appErr != nil {
		return appErr
	}
	defer func() {
		if err := rd.Close(); err != nil {
			rctx.Logger().Error("Error closing file", mlog.Err(err))
		}
	}()

	if zipWr != nil {
		wr, err := zipWr.CreateHeader(&zip.FileHeader{
			Name:   filepath.Join(model.ExportDataDir, filePath),
			Method: zip.Store,
		})
		if err != nil {
			return model.NewAppError("exportFileAttachment", "app.export.export_attachment.zip_create_header.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		if _, err = io.Copy(wr, rd); err != nil {
			return model.NewAppError("exportFileAttachment", "app.export.export_attachment.copy_file.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	} else {
		filePath = filepath.Join(outPath, model.ExportDataDir, filePath)
		if err := os.MkdirAll(filepath.Dir(filePath), 0700); err != nil {
			return model.NewAppError("exportFileAttachment", "app.export.export_attachment.mkdirall.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}

		file, err := os.Create(filePath)
		if err != nil {
			return model.NewAppError("exportFileAttachment", "app.export.export_attachment.create_file.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}
		defer func() {
			if err = file.Close(); err != nil {
				rctx.Logger().Error("Error closing file", mlog.Err(err))
			}
		}()

		if _, err = io.Copy(file, rd); err != nil {
			return model.NewAppError("exportFileAttachment", "app.export.export_attachment.copy_file.error",
				nil, "err="+err.Error(), http.StatusInternalServerError)
		}
	}

	return nil
}

func (a *App) ListExports() ([]string, *model.AppError) {
	exports, appErr := a.ListExportDirectory(*a.Config().ExportSettings.Directory)
	if appErr != nil {
		return nil, appErr
	}

	results := make([]string, len(exports))
	for i := range exports {
		results[i] = filepath.Base(exports[i])
	}

	return results, nil
}

func (a *App) GeneratePresignURLForExport(name string) (*model.PresignURLResponse, *model.AppError) {
	if !a.Config().FeatureFlags.EnableExportDirectDownload {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.featureflag.app_error", nil, "", http.StatusInternalServerError)
	}

	if !*a.Config().FileSettings.DedicatedExportStore {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.config.app_error", nil, "", http.StatusInternalServerError)
	}

	b := a.ExportFileBackend()
	backend, ok := b.(filestore.FileBackendWithLinkGenerator)
	if !ok {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.driver.app_error", nil, "", http.StatusInternalServerError)
	}

	p := path.Join(*a.Config().ExportSettings.Directory, filepath.Base(name))
	found, err := b.FileExists(p)
	if err != nil {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.fileexist.app_error", nil, "", http.StatusInternalServerError)
	}
	if !found {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.notfound.app_error", nil, "", http.StatusInternalServerError)
	}

	link, exp, err := backend.GeneratePublicLink(p)
	if err != nil {
		return nil, model.NewAppError("GeneratePresignURLForExport", "app.eport.generate_presigned_url.link.app_error", nil, "", http.StatusInternalServerError)
	}

	return &model.PresignURLResponse{
		URL:        link,
		Expiration: exp,
	}, nil
}

func (a *App) DeleteExport(name string) *model.AppError {
	filePath := filepath.Join(*a.Config().ExportSettings.Directory, name)

	if ok, err := a.ExportFileExists(filePath); err != nil {
		return err
	} else if !ok {
		return nil
	}

	return a.RemoveExportFile(filePath)
}

func updateJobProgress(logger mlog.LoggerIFace, store store.Store, job *model.Job, key string, value int) {
	if job != nil {
		job.Data[key] = strconv.Itoa(value)
		if _, err2 := store.Job().UpdateOptimistically(job, model.JobStatusInProgress); err2 != nil {
			logger.Warn("Failed to update job status", mlog.Err(err2))
		}
	}
}
