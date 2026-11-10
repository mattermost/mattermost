// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"
	"strings"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/i18n"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

// requiredChannelAttributesEnabled reports whether the server tracks channels
// that miss a required attribute value: the feature flag plus Enterprise
// Advanced, the same pair that guards marking a field Required.
func (a *App) requiredChannelAttributesEnabled() bool {
	return a.Config().FeatureFlags.IsChannelAttributesRequiredEnabled() && model.MinimumEnterpriseAdvancedLicense(a.License())
}

// channelCanMissRequiredAttributes reports whether channel is one that
// required attributes apply to: an active public or private channel. Direct and
// group messages, boards and spaces never carry attribute values.
func channelCanMissRequiredAttributes(channel *model.Channel) bool {
	if channel == nil || channel.DeleteAt != 0 {
		return false
	}
	return channel.Type == model.ChannelTypeOpen || channel.Type == model.ChannelTypePrivate
}

// requiredChannelAttributeFields loads the access_control group's channel
// fields once and keeps the required ones that are available on this server.
func (a *App) requiredChannelAttributeFields(rctx request.CTX) (string, []*model.PropertyField, *model.AppError) {
	group, appErr := a.GetPropertyGroup(rctx, model.AccessControlPropertyGroupName)
	if appErr != nil {
		return "", nil, appErr
	}

	// The group's field budget is capped, so one oversized page holds all of it.
	fields, appErr := a.SearchPropertyFields(rctx, group.ID, model.PropertyFieldSearchOpts{
		GroupID:    group.ID,
		ObjectType: model.PropertyFieldObjectTypeChannel,
		TargetType: model.PropertyValueTargetTypeSystem,
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if appErr != nil {
		return "", nil, appErr
	}

	channelAttributesAvailable, classificationAvailable := a.channelAttributeAvailability()
	required := make([]*model.PropertyField, 0, len(fields))
	for _, field := range fields {
		if model.IsPropertyFieldRequired(field) && ChannelAttributeFieldAvailable(field, channelAttributesAvailable, classificationAvailable) {
			required = append(required, field)
		}
	}
	return group.ID, required, nil
}

// missingRequiredFieldsOf returns the fields of required that channel has no
// value for. It reads the channel's values in one call, from the master and
// straight from the store: the answer is about the channel, not about what any
// one viewer may read, and a value written a moment ago must count.
func (a *App) missingRequiredFieldsOf(rctx request.CTX, groupID string, required []*model.PropertyField, channel *model.Channel) ([]*model.PropertyField, *model.AppError) {
	if len(required) == 0 {
		return nil, nil
	}

	values, err := a.Srv().Store().PropertyValue().SearchPropertyValues(store.RequestContextWithMaster(rctx), model.PropertyValueSearchOpts{
		GroupID:    groupID,
		TargetType: model.PropertyValueTargetTypeChannel,
		TargetIDs:  []string{channel.Id},
		PerPage:    model.AccessControlGroupFieldLimit + 5,
	})
	if err != nil {
		return nil, model.NewAppError("missingRequiredChannelAttributes", "app.property_value.search.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	set := make(map[string]bool, len(values))
	for _, value := range values {
		// Sanitized first, so "  " counts as unset exactly as it does when written.
		if !model.IsEmptyPropertyValue(model.SanitizePropertyValue(value.Value)) {
			set[value.FieldID] = true
		}
	}

	var missing []*model.PropertyField
	for _, field := range required {
		if !set[field.ID] {
			missing = append(missing, field)
		}
	}
	return missing, nil
}

// missingRequiredChannelAttributes returns the required, available channel
// attributes that channel has no value for. It returns nil without a query when
// required attributes are off or the channel is not an active public or private
// channel.
func (a *App) missingRequiredChannelAttributes(rctx request.CTX, channel *model.Channel) ([]*model.PropertyField, *model.AppError) {
	if !a.requiredChannelAttributesEnabled() || !channelCanMissRequiredAttributes(channel) {
		return nil, nil
	}

	groupID, required, appErr := a.requiredChannelAttributeFields(rctx)
	if appErr != nil {
		return nil, appErr
	}
	return a.missingRequiredFieldsOf(rctx, groupID, required, channel)
}

// queueNewChannelAdminMissingAttributesNotice sends the missing-values message
// in the background. The flag, license and channel-type checks run first, so a
// server with the feature off starts no goroutine and runs no query.
func (a *App) queueNewChannelAdminMissingAttributesNotice(rctx request.CTX, userID string, channels ...*model.Channel) {
	if !a.requiredChannelAttributesEnabled() {
		return
	}

	applicable := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if channelCanMissRequiredAttributes(channel) {
			applicable = append(applicable, channel)
		}
	}
	if len(applicable) == 0 {
		return
	}

	a.Srv().Go(func() {
		a.NotifyNewChannelAdminOfMissingRequiredAttributes(rctx, userID, applicable)
	})
}

// queueNewChannelAdminMissingAttributesNoticeByID is the same for a trigger
// that only knows the channel's ID.
func (a *App) queueNewChannelAdminMissingAttributesNoticeByID(rctx request.CTX, userID, channelID string) {
	if !a.requiredChannelAttributesEnabled() {
		return
	}

	channel, appErr := a.GetChannel(rctx, channelID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load the channel to check it for missing required channel attributes",
			mlog.String("user_id", userID), mlog.String("channel_id", channelID), mlog.Err(appErr))
		return
	}
	a.queueNewChannelAdminMissingAttributesNotice(rctx, userID, channel)
}

// missingChannelAttributesForAdmin is one channel the recipient was just made
// admin of, with the missing attributes they may both see and set.
type missingChannelAttributesForAdmin struct {
	channel *model.Channel
	fields  []*model.PropertyField
}

// NotifyNewChannelAdminOfMissingRequiredAttributes tells a user who just became
// channel admin of channels, in one System bot direct message, which required
// attributes those channels still lack and the user can set. It sends nothing,
// and creates no direct channel, when there is nothing for the user to set.
// Failures are logged and never returned: this runs beside the action that made
// the user an admin and must not affect it.
func (a *App) NotifyNewChannelAdminOfMissingRequiredAttributes(rctx request.CTX, userID string, channels []*model.Channel) {
	if !a.requiredChannelAttributesEnabled() {
		return
	}

	applicable := make([]*model.Channel, 0, len(channels))
	for _, channel := range channels {
		if channelCanMissRequiredAttributes(channel) {
			applicable = append(applicable, channel)
		}
	}
	if len(applicable) == 0 {
		return
	}

	user, appErr := a.GetUser(rctx, userID)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load the new channel admin to notify of missing required channel attributes",
			mlog.String("user_id", userID), mlog.Err(appErr))
		return
	}
	if user.IsBot || user.DeleteAt != 0 {
		return
	}

	// Property reads are on behalf of the recipient, so a request context with
	// no caller (a background run) is tagged with one.
	propertyCtx := RequestContextWithCallerID(rctx, userID)
	groupID, required, appErr := a.requiredChannelAttributeFields(propertyCtx)
	if appErr != nil {
		rctx.Logger().Warn("Failed to load the required channel attributes to notify a new channel admin",
			mlog.String("user_id", userID), mlog.Err(appErr))
		return
	}
	if len(required) == 0 {
		return
	}

	var entries []missingChannelAttributesForAdmin
	for _, channel := range applicable {
		missing, appErr := a.missingRequiredFieldsOf(rctx, groupID, required, channel)
		if appErr != nil {
			rctx.Logger().Warn("Failed to check a channel for missing required channel attributes",
				mlog.String("user_id", userID), mlog.String("channel_id", channel.Id), mlog.Err(appErr))
			continue
		}

		var fixable []*model.PropertyField
		for _, field := range missing {
			canRead := a.decidePropertyFieldPermission(rctx, userID, field, model.PropertyActionValueRead, channel.Id).Allowed
			canWrite := a.decidePropertyFieldPermission(rctx, userID, field, model.PropertyActionValueWrite, channel.Id).Allowed
			if canRead && canWrite {
				fixable = append(fixable, field)
			}
		}
		if len(fixable) > 0 {
			entries = append(entries, missingChannelAttributesForAdmin{channel: channel, fields: fixable})
		}
	}
	if len(entries) == 0 {
		return
	}

	a.sendMissingRequiredAttributesDM(rctx, user, groupID, entries)
}

func (a *App) sendMissingRequiredAttributesDM(rctx request.CTX, user *model.User, groupID string, entries []missingChannelAttributesForAdmin) {
	channelIDs := make([]string, 0, len(entries))
	var fieldIDs []string
	seenFields := make(map[string]bool)
	for _, entry := range entries {
		channelIDs = append(channelIDs, entry.channel.Id)
		for _, field := range entry.fields {
			if !seenFields[field.ID] {
				seenFields[field.ID] = true
				fieldIDs = append(fieldIDs, field.ID)
			}
		}
	}
	logFields := []mlog.Field{
		mlog.String("user_id", user.Id),
		mlog.Array("channel_ids", channelIDs),
		mlog.Array("property_field_ids", fieldIDs),
	}

	// The list is built first so a DM channel is only created when there is
	// something to post.
	T := i18n.GetUserTranslations(user.Locale)
	channelList := a.missingRequiredAttributesChannelList(rctx, user.Id, groupID, entries, T)
	if channelList == "" {
		return
	}

	systemBot, appErr := a.GetSystemBot(rctx)
	if appErr != nil {
		rctx.Logger().Warn("Failed to get the system bot to notify a new channel admin of missing required channel attributes", append(logFields, mlog.Err(appErr))...)
		return
	}

	dmChannel, appErr := a.GetOrCreateDirectChannel(rctx, user.Id, systemBot.UserId)
	if appErr != nil {
		rctx.Logger().Warn("Failed to get the direct channel to notify a new channel admin of missing required channel attributes", append(logFields, mlog.Err(appErr))...)
		return
	}

	post := &model.Post{
		ChannelId: dmChannel.Id,
		UserId:    systemBot.UserId,
		Type:      model.PostTypeDefault,
		Message: T("app.channel_attributes.new_admin_missing_value.dm", model.StringInterface{
			"ChannelList": channelList,
		}),
		Props: model.StringInterface{
			"channel_ids":        channelIDs,
			"property_field_ids": fieldIDs,
		},
	}
	if a.IsPostPriorityEnabled() {
		post.Metadata = &model.PostMetadata{
			Priority: &model.PostPriority{Priority: model.NewPointer(model.PostPriorityUrgent)},
		}
	}

	if _, _, appErr := a.CreatePost(rctx, post, dmChannel, model.CreatePostFlags{SetOnline: true}); appErr != nil {
		rctx.Logger().Warn("Failed to send the missing required channel attributes message to a new channel admin", append(logFields, mlog.Err(appErr))...)
	}
}

// missingRequiredAttributesChannelList renders one bullet per channel: a
// permalink, its team in parentheses, and the attributes it needs in bold.
// Channels whose team can't be loaded are left out, as there is no permalink to
// give. Beyond channelAttributeNotifyChannelsPerDM the rest collapse into one
// "and N more" line.
func (a *App) missingRequiredAttributesChannelList(rctx request.CTX, userID, groupID string, entries []missingChannelAttributesForAdmin, T i18n.TranslateFunc) string {
	shown := entries
	var more int
	if len(shown) > channelAttributeNotifyChannelsPerDM {
		more = len(shown) - channelAttributeNotifyChannelsPerDM
		shown = shown[:channelAttributeNotifyChannelsPerDM]
	}

	// Attribute names are read on behalf of the recipient.
	propertyCtx := RequestContextWithCallerID(rctx, userID)
	teams := make(map[string]*model.Team)
	var b strings.Builder
	for _, entry := range shown {
		team, ok := teams[entry.channel.TeamId]
		if !ok {
			var appErr *model.AppError
			team, appErr = a.GetTeam(entry.channel.TeamId)
			if appErr != nil {
				rctx.Logger().Warn("Failed to load the team of a channel missing required channel attributes",
					mlog.String("channel_id", entry.channel.Id), mlog.String("team_id", entry.channel.TeamId), mlog.Err(appErr))
				team = nil
			}
			teams[entry.channel.TeamId] = team
		}
		if team == nil {
			continue
		}

		names := make([]string, 0, len(entry.fields))
		for _, field := range entry.fields {
			names = append(names, "**"+a.channelAttributeDisplayName(propertyCtx, groupID, field)+"**")
		}

		b.WriteString(T("app.channel_attributes.new_admin_missing_value.dm_channel_line", model.StringInterface{
			"ChannelDisplayName": escapeChannelAttributeMarkdownLinkText(entry.channel.DisplayName),
			"ChannelLink":        "/" + team.Name + "/channels/" + entry.channel.Name,
			"TeamDisplayName":    escapeChannelAttributeMarkdownPlainText(team.DisplayName),
			"AttributeNames":     strings.Join(names, ", "),
		}))
	}
	if more > 0 {
		b.WriteString(T("app.channel_attributes.notify_missing_value.dm_more", model.StringInterface{"Count": more}))
	}
	return b.String()
}

// escapeChannelAttributeMarkdownPlainText backslash-escapes the characters that
// start Markdown formatting, links, images, code or HTML, so a display name
// placed in running text stays plain text.
func escapeChannelAttributeMarkdownPlainText(text string) string {
	return strings.NewReplacer(
		`\`, `\\`, "`", "\\`", `*`, `\*`, `_`, `\_`, `~`, `\~`,
		`[`, `\[`, `]`, `\]`, `(`, `\(`, `)`, `\)`, `<`, `\<`, `>`, `\>`, `!`, `\!`,
	).Replace(text)
}
