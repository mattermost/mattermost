// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imports

import (
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"unicode/utf8"

	"github.com/mattermost/mattermost-server/server/v7/model"
	"github.com/mattermost/mattermost-server/server/v7/platform/shared/mlog"
)

func ValidateSchemeImportData(data *SchemeImportData) *model.AppError {

	if data.Scope == nil {
		return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.null_scope.error", nil, "", http.StatusBadRequest)
	}

	switch *data.Scope {
	case model.SchemeScopeTeam:
		if data.DefaultTeamAdminRole == nil || data.DefaultTeamUserRole == nil || data.DefaultChannelAdminRole == nil || data.DefaultChannelUserRole == nil {
			return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.wrong_roles_for_scope.error", nil, "", http.StatusBadRequest)
		}
	case model.SchemeScopeChannel:
		if data.DefaultTeamAdminRole != nil || data.DefaultTeamUserRole != nil || data.DefaultChannelAdminRole == nil || data.DefaultChannelUserRole == nil {
			return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.wrong_roles_for_scope.error", nil, "", http.StatusBadRequest)
		}
	default:
		return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.unknown_scheme.error", nil, "", http.StatusBadRequest)
	}

	if data.Name == nil || !model.IsValidSchemeName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.name_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil || *data.DisplayName == "" || len(*data.DisplayName) > model.SchemeDisplayNameMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.display_name_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Description != nil && len(*data.Description) > model.SchemeDescriptionMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_scheme_import_data.description_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.DefaultTeamAdminRole != nil {
		if err := ValidateRoleImportData(data.DefaultTeamAdminRole); err != nil {
			return err
		}
	}

	if data.DefaultTeamUserRole != nil {
		if err := ValidateRoleImportData(data.DefaultTeamUserRole); err != nil {
			return err
		}
	}

	if data.DefaultTeamGuestRole != nil {
		if err := ValidateRoleImportData(data.DefaultTeamGuestRole); err != nil {
			return err
		}
	}

	if data.DefaultChannelAdminRole != nil {
		if err := ValidateRoleImportData(data.DefaultChannelAdminRole); err != nil {
			return err
		}
	}

	if data.DefaultChannelUserRole != nil {
		if err := ValidateRoleImportData(data.DefaultChannelUserRole); err != nil {
			return err
		}
	}

	if data.DefaultChannelGuestRole != nil {
		if err := ValidateRoleImportData(data.DefaultChannelGuestRole); err != nil {
			return err
		}
	}

	return nil
}

func ValidateRoleImportData(data *RoleImportData) *model.AppError {

	if data.Name == nil || !model.IsValidRoleName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_role_import_data.name_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil || *data.DisplayName == "" || len(*data.DisplayName) > model.RoleDisplayNameMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_role_import_data.display_name_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Description != nil && len(*data.Description) > model.RoleDescriptionMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_role_import_data.description_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Permissions != nil {
		for _, permission := range *data.Permissions {
			permissionValidated := false
			for _, p := range append(model.AllPermissions, model.DeprecatedPermissions...) {
				if permission == p.Id {
					permissionValidated = true
					break
				}
			}

			if !permissionValidated {
				return model.NewAppError("BulkImport", "app.import.validate_role_import_data.invalid_permission.error", nil, "permission"+permission, http.StatusBadRequest)
			}
		}
	}

	return nil
}

func ValidateTeamImportData(data *TeamImportData) *model.AppError {

	if data.Name == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_missing.error", nil, "", http.StatusBadRequest)
	} else if len(*data.Name) > model.TeamNameMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_length.error", nil, "", http.StatusBadRequest)
	} else if model.IsReservedTeamName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_reserved.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidTeamName(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.name_characters.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.display_name_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.DisplayName) == 0 || utf8.RuneCountInString(*data.DisplayName) > model.TeamDisplayNameMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.display_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Type == nil {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.type_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.Type != model.TeamOpen && *data.Type != model.TeamInvite {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.type_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Description != nil && len(*data.Description) > model.TeamDescriptionMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.description_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Scheme != nil && !model.IsValidSchemeName(*data.Scheme) {
		return model.NewAppError("BulkImport", "app.import.validate_team_import_data.scheme_invalid.error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func ValidateChannelImportData(data *ChannelImportData) *model.AppError {

	if data.Team == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.team_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Name == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_missing.error", nil, "", http.StatusBadRequest)
	} else if len(*data.Name) > model.ChannelNameMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_length.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidChannelIdentifier(*data.Name) {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.name_characters.error", nil, "", http.StatusBadRequest)
	}

	if data.DisplayName == nil || utf8.RuneCountInString(*data.DisplayName) == 0 {
		data.DisplayName = data.Name // when displayName is missing we use name instead for displaying so we might as well convert it here.
	} else if utf8.RuneCountInString(*data.DisplayName) > model.ChannelDisplayNameMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.display_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Type == nil {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.type_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.Type != model.ChannelTypeOpen && *data.Type != model.ChannelTypePrivate {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.type_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Header != nil && utf8.RuneCountInString(*data.Header) > model.ChannelHeaderMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.header_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Purpose != nil && utf8.RuneCountInString(*data.Purpose) > model.ChannelPurposeMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.purpose_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Scheme != nil && !model.IsValidSchemeName(*data.Scheme) {
		return model.NewAppError("BulkImport", "app.import.validate_channel_import_data.scheme_invalid.error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func ValidateUserImportData(data *UserImportData) *model.AppError {
	if data.ProfileImage != nil {
		if _, err := os.Stat(*data.ProfileImage); os.IsNotExist(err) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.profile_image.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.Username == nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.username_missing.error", nil, "", http.StatusBadRequest)
	} else if !model.IsValidUsername(*data.Username) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.username_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.Email == nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.email_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.Email == "" || len(*data.Email) > model.UserEmailMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.email_length.error", nil, "", http.StatusBadRequest)
	}

	if data.AuthData != nil && data.Password != nil {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_and_password.error", nil, "", http.StatusBadRequest)
	}

	if data.AuthData != nil && len(*data.AuthData) > model.UserAuthDataMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_length.error", nil, "", http.StatusBadRequest)
	}

	blank := func(str *string) bool {
		if str == nil {
			return true
		}
		return *str == ""
	}

	if (!blank(data.AuthService) && blank(data.AuthData)) || (blank(data.AuthService) && !blank(data.AuthData)) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.auth_data_and_service_dependency.error", nil, "", http.StatusBadRequest)
	}

	if appErr := validateAuthService(data.AuthService); appErr != nil {
		return appErr
	}

	if data.Password != nil && *data.Password == "" {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.password_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Password != nil && len(*data.Password) > model.UserPasswordMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.password_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Nickname != nil && utf8.RuneCountInString(*data.Nickname) > model.UserNicknameMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.nickname_length.error", nil, "", http.StatusBadRequest)
	}

	if data.FirstName != nil && utf8.RuneCountInString(*data.FirstName) > model.UserFirstNameMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.first_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.LastName != nil && utf8.RuneCountInString(*data.LastName) > model.UserLastNameMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.last_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Position != nil && utf8.RuneCountInString(*data.Position) > model.UserPositionMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.position_length.error", nil, "", http.StatusBadRequest)
	}

	if data.Roles != nil && !model.IsValidUserRoles(*data.Roles) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.roles_invalid.error", nil, "", http.StatusBadRequest)
	}

	if data.NotifyProps != nil {
		if data.NotifyProps.Desktop != nil && !isValidUserNotifyLevel(*data.NotifyProps.Desktop) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_desktop_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.DesktopSound != nil && !isValidTrueOrFalseString(*data.NotifyProps.DesktopSound) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_desktop_sound_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.Email != nil && !isValidTrueOrFalseString(*data.NotifyProps.Email) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_email_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.Mobile != nil && !isValidUserNotifyLevel(*data.NotifyProps.Mobile) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_mobile_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.MobilePushStatus != nil && !isValidPushStatusNotifyLevel(*data.NotifyProps.MobilePushStatus) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_mobile_push_status_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.ChannelTrigger != nil && !isValidTrueOrFalseString(*data.NotifyProps.ChannelTrigger) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_channel_trigger_invalid.error", nil, "", http.StatusBadRequest)
		}

		if data.NotifyProps.CommentsTrigger != nil && !isValidCommentsNotifyLevel(*data.NotifyProps.CommentsTrigger) {
			return model.NewAppError("BulkImport", "app.import.validate_user_import_data.notify_props_comments_trigger_invalid.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.UseMarkdownPreview != nil && !isValidTrueOrFalseString(*data.UseMarkdownPreview) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.advanced_props_feature_markdown_preview.error", nil, "", http.StatusBadRequest)
	}

	if data.UseFormatting != nil && !isValidTrueOrFalseString(*data.UseFormatting) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.advanced_props_formatting.error", nil, "", http.StatusBadRequest)
	}

	if data.ShowUnreadSection != nil && !isValidTrueOrFalseString(*data.ShowUnreadSection) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.advanced_props_show_unread_section.error", nil, "", http.StatusBadRequest)
	}

	if data.EmailInterval != nil && !isValidEmailBatchingInterval(*data.EmailInterval) {
		return model.NewAppError("BulkImport", "app.import.validate_user_import_data.advanced_props_email_interval.error", nil, "", http.StatusBadRequest)
	}

	if data.Teams != nil {
		return ValidateUserTeamsImportData(data.Teams)
	}

	return nil
}

var validAuthServices = []string{
	"",
	model.UserAuthServiceEmail,
	model.UserAuthServiceGitlab,
	model.UserAuthServiceSaml,
	model.UserAuthServiceLdap,
	model.ServiceGoogle,
	model.ServiceOffice365,
}

func validateAuthService(authService *string) *model.AppError {
	if authService == nil {
		return nil
	}
	for _, valid := range validAuthServices {
		if *authService == valid {
			return nil
		}
	}

	return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.invalid_auth_service.error", map[string]any{"AuthService": *authService}, "", http.StatusBadRequest)
}

func ValidateUserTeamsImportData(data *[]UserTeamImportData) *model.AppError {
	if data == nil {
		return nil
	}

	for _, tdata := range *data {
		if tdata.Name == nil {
			return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.team_name_missing.error", nil, "", http.StatusBadRequest)
		}

		if tdata.Roles != nil && !model.IsValidUserRoles(*tdata.Roles) {
			return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.invalid_roles.error", nil, "", http.StatusBadRequest)
		}

		if tdata.Channels != nil {
			if err := ValidateUserChannelsImportData(tdata.Channels); err != nil {
				return err
			}
		}

		if tdata.Theme != nil && strings.Trim(*tdata.Theme, " \t\r") != "" {
			var unused map[string]string
			if err := json.NewDecoder(strings.NewReader(*tdata.Theme)).Decode(&unused); err != nil {
				return model.NewAppError("BulkImport", "app.import.validate_user_teams_import_data.invalid_team_theme.error", nil, "", http.StatusBadRequest).Wrap(err)
			}
		}
	}

	return nil
}

func ValidateUserChannelsImportData(data *[]UserChannelImportData) *model.AppError {
	if data == nil {
		return nil
	}

	for _, cdata := range *data {
		if cdata.Name == nil {
			return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.channel_name_missing.error", nil, "", http.StatusBadRequest)
		}

		if cdata.Roles != nil && !model.IsValidUserRoles(*cdata.Roles) {
			return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_roles.error", nil, "", http.StatusBadRequest)
		}

		if cdata.NotifyProps != nil {
			if cdata.NotifyProps.Desktop != nil && !model.IsChannelNotifyLevelValid(*cdata.NotifyProps.Desktop) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_desktop.error", nil, "", http.StatusBadRequest)
			}

			if cdata.NotifyProps.Mobile != nil && !model.IsChannelNotifyLevelValid(*cdata.NotifyProps.Mobile) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_mobile.error", nil, "", http.StatusBadRequest)
			}

			if cdata.NotifyProps.MarkUnread != nil && !model.IsChannelMarkUnreadLevelValid(*cdata.NotifyProps.MarkUnread) {
				return model.NewAppError("BulkImport", "app.import.validate_user_channels_import_data.invalid_notify_props_mark_unread.error", nil, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func ValidateReactionImportData(data *ReactionImportData, parentCreateAt int64) *model.AppError {
	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.EmojiName == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.emoji_name_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.EmojiName) > model.EmojiNameMaxLength {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.emoji_name_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt < parentCreateAt {
		return model.NewAppError("BulkImport", "app.import.validate_reaction_import_data.create_at_before_parent.error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func ValidateReplyImportData(data *ReplyImportData, parentCreateAt int64, maxPostSize int) *model.AppError {
	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reply_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Message == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reply_import_data.message_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.Message) > maxPostSize {
		return model.NewAppError("BulkImport", "app.import.validate_reply_import_data.message_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_reply_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_reply_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt < parentCreateAt {
		mlog.Warn("Reply CreateAt is before parent post CreateAt", mlog.Int64("reply_create_at", *data.CreateAt), mlog.Int64("parent_create_at", parentCreateAt))
	}

	return nil
}

func ValidatePostImportData(data *PostImportData, maxPostSize int) *model.AppError {
	if data.Team == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.team_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Channel == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.channel_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Message == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.message_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.Message) > maxPostSize {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.message_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			reaction := reaction
			ValidateReactionImportData(&reaction, *data.CreateAt)
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			reply := reply
			ValidateReplyImportData(&reply, *data.CreateAt, maxPostSize)
		}
	}

	if data.Props != nil && utf8.RuneCountInString(model.StringInterfaceToJSON(*data.Props)) > model.PostPropsMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_post_import_data.props_too_large.error", nil, "", http.StatusBadRequest)
	}

	return nil
}

func ValidateDirectChannelImportData(data *DirectChannelImportData) *model.AppError {
	if data.Members == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_required.error", nil, "", http.StatusBadRequest)
	}

	if len(*data.Members) != 2 {
		if len(*data.Members) < model.ChannelGroupMinUsers {
			return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_too_few.error", nil, "", http.StatusBadRequest)
		} else if len(*data.Members) > model.ChannelGroupMaxUsers {
			return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.members_too_many.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.Header != nil && utf8.RuneCountInString(*data.Header) > model.ChannelHeaderMaxRunes {
		return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.header_length.error", nil, "", http.StatusBadRequest)
	}

	if data.FavoritedBy != nil {
		for _, favoriter := range *data.FavoritedBy {
			found := false
			for _, member := range *data.Members {
				if favoriter == member {
					found = true
					break
				}
			}
			if !found {
				return model.NewAppError("BulkImport", "app.import.validate_direct_channel_import_data.unknown_favoriter.error", map[string]any{"Username": favoriter}, "", http.StatusBadRequest)
			}
		}
	}

	return nil
}

func ValidateDirectPostImportData(data *DirectPostImportData, maxPostSize int) *model.AppError {
	if data.ChannelMembers == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_required.error", nil, "", http.StatusBadRequest)
	}

	if len(*data.ChannelMembers) != 2 {
		if len(*data.ChannelMembers) < model.ChannelGroupMinUsers {
			return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_too_few.error", nil, "", http.StatusBadRequest)
		} else if len(*data.ChannelMembers) > model.ChannelGroupMaxUsers {
			return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.channel_members_too_many.error", nil, "", http.StatusBadRequest)
		}
	}

	if data.User == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.user_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Message == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.message_missing.error", nil, "", http.StatusBadRequest)
	} else if utf8.RuneCountInString(*data.Message) > maxPostSize {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.message_length.error", nil, "", http.StatusBadRequest)
	}

	if data.CreateAt == nil {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.create_at_missing.error", nil, "", http.StatusBadRequest)
	} else if *data.CreateAt == 0 {
		return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.create_at_zero.error", nil, "", http.StatusBadRequest)
	}

	if data.FlaggedBy != nil {
		for _, flagger := range *data.FlaggedBy {
			found := false
			for _, member := range *data.ChannelMembers {
				if flagger == member {
					found = true
					break
				}
			}
			if !found {
				return model.NewAppError("BulkImport", "app.import.validate_direct_post_import_data.unknown_flagger.error", map[string]any{"Username": flagger}, "", http.StatusBadRequest)
			}
		}
	}

	if data.Reactions != nil {
		for _, reaction := range *data.Reactions {
			reaction := reaction
			ValidateReactionImportData(&reaction, *data.CreateAt)
		}
	}

	if data.Replies != nil {
		for _, reply := range *data.Replies {
			reply := reply
			ValidateReplyImportData(&reply, *data.CreateAt, maxPostSize)
		}
	}

	return nil
}

// ValidateEmojiImportData validates emoji data and returns if the import name
// conflicts with a system emoji.
func ValidateEmojiImportData(data *EmojiImportData) *model.AppError {
	if data == nil {
		return model.NewAppError("BulkImport", "app.import.validate_emoji_import_data.empty.error", nil, "", http.StatusBadRequest)
	}

	if data.Name == nil || *data.Name == "" {
		return model.NewAppError("BulkImport", "app.import.validate_emoji_import_data.name_missing.error", nil, "", http.StatusBadRequest)
	}

	if data.Image == nil || *data.Image == "" {
		return model.NewAppError("BulkImport", "app.import.validate_emoji_import_data.image_missing.error", nil, "", http.StatusBadRequest)
	}

	if err := model.IsValidEmojiName(*data.Name); err != nil {
		return err
	}

	return nil
}

func isValidTrueOrFalseString(value string) bool {
	return value == "true" || value == "false"
}

func isValidUserNotifyLevel(notifyLevel string) bool {
	return notifyLevel == model.ChannelNotifyAll ||
		notifyLevel == model.ChannelNotifyMention ||
		notifyLevel == model.ChannelNotifyNone
}

func isValidPushStatusNotifyLevel(notifyLevel string) bool {
	return notifyLevel == model.StatusOnline ||
		notifyLevel == model.StatusAway ||
		notifyLevel == model.StatusOffline
}

func isValidCommentsNotifyLevel(notifyLevel string) bool {
	return notifyLevel == model.CommentsNotifyAny ||
		notifyLevel == model.CommentsNotifyRoot ||
		notifyLevel == model.CommentsNotifyNever
}

func isValidEmailBatchingInterval(emailInterval string) bool {
	return emailInterval == model.PreferenceEmailIntervalImmediately ||
		emailInterval == model.PreferenceEmailIntervalFifteen ||
		emailInterval == model.PreferenceEmailIntervalHour
}
