// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/tls"
	"fmt"
	"html"
	"html/template"
	"io"
	"io/ioutil"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"github.com/nicksnyder/go-i18n/i18n"
)

const (
	TRIGGERWORDS_FULL       = 0
	TRIGGERWORDS_STARTSWITH = 1
)

func InitPost() {
	l4g.Debug(utils.T("api.post.init.debug"))

	BaseRoutes.NeedTeam.Handle("/posts/search", ApiUserRequiredActivity(searchPosts, true)).Methods("POST")
	BaseRoutes.NeedTeam.Handle("/posts/flagged/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getFlaggedPosts)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/posts/{post_id}", ApiUserRequired(getPostById)).Methods("GET")
	BaseRoutes.NeedTeam.Handle("/pltmp/{post_id}", ApiUserRequired(getPermalinkTmp)).Methods("GET")

	BaseRoutes.Posts.Handle("/create", ApiUserRequiredActivity(createPost, true)).Methods("POST")
	BaseRoutes.Posts.Handle("/update", ApiUserRequiredActivity(updatePost, true)).Methods("POST")
	BaseRoutes.Posts.Handle("/page/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequired(getPosts)).Methods("GET")
	BaseRoutes.Posts.Handle("/since/{time:[0-9]+}", ApiUserRequired(getPostsSince)).Methods("GET")

	BaseRoutes.NeedPost.Handle("/get", ApiUserRequired(getPost)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/delete", ApiUserRequiredActivity(deletePost, true)).Methods("POST")
	BaseRoutes.NeedPost.Handle("/before/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsBefore)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/after/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsAfter)).Methods("GET")
	BaseRoutes.NeedPost.Handle("/get_file_infos", ApiUserRequired(getFileInfosForPost)).Methods("GET")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("createPost", "post")
		return
	}
	post.UserId = c.Session.UserId

	cchan := Srv.Store.Channel().Get(post.ChannelId)

	if !HasPermissionToChannelContext(c, post.ChannelId, model.PERMISSION_CREATE_POST) {
		return
	}

	// Check that channel has not been deleted
	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		c.SetInvalidParam("createPost", "post.channelId")
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	if channel.DeleteAt != 0 {
		c.Err = model.NewLocAppError("createPost", "api.post.create_post.can_not_post_to_deleted.error", nil, "")
		c.Err.StatusCode = http.StatusBadRequest
		return
	}

	if rp, err := CreatePost(c, post, true); err != nil {
		c.Err = err

		if c.Err.Id == "api.post.create_post.root_id.app_error" ||
			c.Err.Id == "api.post.create_post.channel_root_id.app_error" ||
			c.Err.Id == "api.post.create_post.parent_id.app_error" {
			c.Err.StatusCode = http.StatusBadRequest
		}

		return
	} else {
		// Update the LastViewAt only if the post does not have from_webhook prop set (eg. Zapier app)
		if _, ok := post.Props["from_webhook"]; !ok {
			if result := <-Srv.Store.Channel().UpdateLastViewedAt(post.ChannelId, c.Session.UserId); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.last_viewed.error"), post.ChannelId, c.Session.UserId, result.Err)
			}
		}

		w.Write([]byte(rp.ToJson()))
	}
}

func CreatePost(c *Context, post *model.Post, triggerWebhooks bool) (*model.Post, *model.AppError) {
	var pchan store.StoreChannel
	if len(post.RootId) > 0 {
		pchan = Srv.Store.Post().Get(post.RootId)
	}

	// Verify the parent/child relationships are correct
	if pchan != nil {
		if presult := <-pchan; presult.Err != nil {
			return nil, model.NewLocAppError("createPost", "api.post.create_post.root_id.app_error", nil, "")
		} else {
			list := presult.Data.(*model.PostList)
			if len(list.Posts) == 0 || !list.IsChannelId(post.ChannelId) {
				return nil, model.NewLocAppError("createPost", "api.post.create_post.channel_root_id.app_error", nil, "")
			}

			if post.ParentId == "" {
				post.ParentId = post.RootId
			}

			if post.RootId != post.ParentId {
				parent := list.Posts[post.ParentId]
				if parent == nil {
					return nil, model.NewLocAppError("createPost", "api.post.create_post.parent_id.app_error", nil, "")
				}
			}
		}
	}

	post.CreateAt = 0

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	var rpost *model.Post
	if result := <-Srv.Store.Post().Save(post); result.Err != nil {
		return nil, result.Err
	} else {
		rpost = result.Data.(*model.Post)
	}

	if len(post.FileIds) > 0 {
		// There's a rare bug where the client sends up duplicate FileIds so protect against that
		post.FileIds = utils.RemoveDuplicatesFromStringArray(post.FileIds)

		for _, fileId := range post.FileIds {
			if result := <-Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.attach_files.error"), post.Id, post.FileIds, c.Session.UserId, result.Err)
			}
		}
	}

	handlePostEvents(c, rpost, triggerWebhooks)

	return rpost, nil
}

func CreateWebhookPost(c *Context, channelId, text, overrideUsername, overrideIconUrl string, props model.StringInterface, postType string) (*model.Post, *model.AppError) {
	// parse links into Markdown format
	linkWithTextRegex := regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)
	text = linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")

	post := &model.Post{UserId: c.Session.UserId, ChannelId: channelId, Message: text, Type: postType}
	post.AddProp("from_webhook", "true")

	if utils.Cfg.ServiceSettings.EnablePostUsernameOverride {
		if len(overrideUsername) != 0 {
			post.AddProp("override_username", overrideUsername)
		} else {
			post.AddProp("override_username", model.DEFAULT_WEBHOOK_USERNAME)
		}
	}

	if utils.Cfg.ServiceSettings.EnablePostIconOverride {
		if len(overrideIconUrl) != 0 {
			post.AddProp("override_icon_url", overrideIconUrl)
		}
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if list, success := val.([]interface{}); success {
					// parse attachment links into Markdown format
					for i, aInt := range list {
						attachment := aInt.(map[string]interface{})
						if aText, ok := attachment["text"].(string); ok {
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["text"] = aText
							list[i] = attachment
						}
						if aText, ok := attachment["pretext"].(string); ok {
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["pretext"] = aText
							list[i] = attachment
						}
						if fVal, ok := attachment["fields"]; ok {
							if fields, ok := fVal.([]interface{}); ok {
								// parse attachment field links into Markdown format
								for j, fInt := range fields {
									field := fInt.(map[string]interface{})
									if fValue, ok := field["value"].(string); ok {
										fValue = linkWithTextRegex.ReplaceAllString(fValue, "[${2}](${1})")
										field["value"] = fValue
										fields[j] = field
									}
								}
								attachment["fields"] = fields
								list[i] = attachment
							}
						}
					}
					post.AddProp(key, list)
				}
			} else if key != "override_icon_url" && key != "override_username" && key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	if _, err := CreatePost(c, post, false); err != nil {
		return nil, model.NewLocAppError("CreateWebhookPost", "api.post.create_webhook_post.creating.app_error", nil, "err="+err.Message)
	}

	return post, nil
}

func handlePostEvents(c *Context, post *model.Post, triggerWebhooks bool) {
	tchan := Srv.Store.Team().Get(c.TeamId)
	cchan := Srv.Store.Channel().Get(post.ChannelId)
	uchan := Srv.Store.User().Get(post.UserId)

	var team *model.Team
	if result := <-tchan; result.Err != nil {
		l4g.Error(utils.T("api.post.handle_post_events_and_forget.team.error"), c.TeamId, result.Err)
		return
	} else {
		team = result.Data.(*model.Team)
	}

	var channel *model.Channel
	if result := <-cchan; result.Err != nil {
		l4g.Error(utils.T("api.post.handle_post_events_and_forget.channel.error"), post.ChannelId, result.Err)
		return
	} else {
		channel = result.Data.(*model.Channel)
	}

	sendNotifications(c, post, team, channel)

	var user *model.User
	if result := <-uchan; result.Err != nil {
		l4g.Error(utils.T("api.post.handle_post_events_and_forget.user.error"), post.UserId, result.Err)
		return
	} else {
		user = result.Data.(*model.User)
	}

	if triggerWebhooks {
		go handleWebhookEvents(c, post, team, channel, user)
	}

	if channel.Type == model.CHANNEL_DIRECT {
		go makeDirectChannelVisible(post.ChannelId)
	}
}

func makeDirectChannelVisible(channelId string) {
	var members []model.ChannelMember
	if result := <-Srv.Store.Channel().GetMembers(channelId); result.Err != nil {
		l4g.Error(utils.T("api.post.make_direct_channel_visible.get_members.error"), channelId, result.Err.Message)
		return
	} else {
		members = result.Data.([]model.ChannelMember)
	}

	if len(members) != 2 {
		l4g.Error(utils.T("api.post.make_direct_channel_visible.get_2_members.error"), channelId)
		return
	}

	// make sure the channel is visible to both members
	for i, member := range members {
		otherUserId := members[1-i].UserId

		if result := <-Srv.Store.Preference().Get(member.UserId, model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW, otherUserId); result.Err != nil {
			// create a new preference since one doesn't exist yet
			preference := &model.Preference{
				UserId:   member.UserId,
				Category: model.PREFERENCE_CATEGORY_DIRECT_CHANNEL_SHOW,
				Name:     otherUserId,
				Value:    "true",
			}

			if saveResult := <-Srv.Store.Preference().Save(&model.Preferences{*preference}); saveResult.Err != nil {
				l4g.Error(utils.T("api.post.make_direct_channel_visible.save_pref.error"), member.UserId, otherUserId, saveResult.Err.Message)
			} else {
				message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", member.UserId, nil)
				message.Add("preference", preference.ToJson())

				go Publish(message)
			}
		} else {
			preference := result.Data.(model.Preference)

			if preference.Value != "true" {
				// update the existing preference to make the channel visible
				preference.Value = "true"

				if updateResult := <-Srv.Store.Preference().Save(&model.Preferences{preference}); updateResult.Err != nil {
					l4g.Error(utils.T("api.post.make_direct_channel_visible.update_pref.error"), member.UserId, otherUserId, updateResult.Err.Message)
				} else {
					message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_PREFERENCE_CHANGED, "", "", member.UserId, nil)
					message.Add("preference", preference.ToJson())

					go Publish(message)
				}
			}
		}
	}
}

func handleWebhookEvents(c *Context, post *model.Post, team *model.Team, channel *model.Channel, user *model.User) {
	if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
		return
	}

	if channel.Type != model.CHANNEL_OPEN {
		return
	}

	hchan := Srv.Store.Webhook().GetOutgoingByTeam(c.TeamId)
	result := <-hchan
	if result.Err != nil {
		l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.getting.error"), result.Err)
		return
	}

	hooks := result.Data.([]*model.OutgoingWebhook)
	if len(hooks) == 0 {
		return
	}

	splitWords := strings.Fields(post.Message)
	if len(splitWords) == 0 {
		return
	}
	firstWord := splitWords[0]

	relevantHooks := []*model.OutgoingWebhook{}
	for _, hook := range hooks {
		if hook.ChannelId == post.ChannelId || len(hook.ChannelId) == 0 {
			if hook.ChannelId == post.ChannelId && len(hook.TriggerWords) == 0 {
				relevantHooks = append(relevantHooks, hook)
			} else if hook.TriggerWhen == TRIGGERWORDS_FULL && hook.HasTriggerWord(firstWord) {
				relevantHooks = append(relevantHooks, hook)
			} else if hook.TriggerWhen == TRIGGERWORDS_STARTSWITH && hook.TriggerWordStartsWith(firstWord) {
				relevantHooks = append(relevantHooks, hook)
			}
		}
	}

	for _, hook := range relevantHooks {
		go func(hook *model.OutgoingWebhook) {
			payload := &model.OutgoingWebhookPayload{
				Token:       hook.Token,
				TeamId:      hook.TeamId,
				TeamDomain:  team.Name,
				ChannelId:   post.ChannelId,
				ChannelName: channel.Name,
				Timestamp:   post.CreateAt,
				UserId:      post.UserId,
				UserName:    user.Username,
				PostId:      post.Id,
				Text:        post.Message,
				TriggerWord: firstWord,
			}
			var body io.Reader
			var contentType string
			if hook.ContentType == "application/json" {
				body = strings.NewReader(payload.ToJSON())
				contentType = "application/json"
			} else {
				body = strings.NewReader(payload.ToFormValues())
				contentType = "application/x-www-form-urlencoded"
			}
			tr := &http.Transport{
				TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
			}
			client := &http.Client{Transport: tr}

			for _, url := range hook.CallbackURLs {
				go func(url string) {
					req, _ := http.NewRequest("POST", url, body)
					req.Header.Set("Content-Type", contentType)
					req.Header.Set("Accept", "application/json")
					if resp, err := client.Do(req); err != nil {
						l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.event_post.error"), err.Error())
					} else {
						defer func() {
							ioutil.ReadAll(resp.Body)
							resp.Body.Close()
						}()
						respProps := model.MapFromJson(resp.Body)

						// copy the context and create a mock session for posting the message
						mockSession := model.Session{
							UserId:      hook.CreatorId,
							TeamMembers: []*model.TeamMember{{TeamId: hook.TeamId, UserId: hook.CreatorId}},
							IsOAuth:     false,
						}

						newContext := &Context{
							Session:      mockSession,
							RequestId:    model.NewId(),
							IpAddress:    "",
							Path:         c.Path,
							Err:          nil,
							teamURLValid: c.teamURLValid,
							teamURL:      c.teamURL,
							siteURL:      c.siteURL,
							T:            c.T,
							Locale:       c.Locale,
							TeamId:       hook.TeamId,
						}

						if text, ok := respProps["text"]; ok {
							if _, err := CreateWebhookPost(newContext, post.ChannelId, text, respProps["username"], respProps["icon_url"], post.Props, post.Type); err != nil {
								l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.create_post.error"), err)
							}
						}
					}
				}(url)
			}

		}(hook)
	}
}

// Given a map of user IDs to profiles, returns a list of mention
// keywords for all users in the channel.
func getMentionKeywordsInChannel(profiles map[string]*model.User) map[string][]string {
	keywords := make(map[string][]string)

	for id, profile := range profiles {
		if len(profile.NotifyProps["mention_keys"]) > 0 {
			// Add all the user's mention keys
			splitKeys := strings.Split(profile.NotifyProps["mention_keys"], ",")
			for _, k := range splitKeys {
				// note that these are made lower case so that we can do a case insensitive check for them
				key := strings.ToLower(k)
				keywords[key] = append(keywords[key], id)
			}
		}

		// If turned on, add the user's case sensitive first name
		if profile.NotifyProps["first_name"] == "true" {
			keywords[profile.FirstName] = append(keywords[profile.FirstName], profile.Id)
		}

		// Add @channel and @all to keywords if user has them turned on
		if profile.NotifyProps["channel"] == "true" {
			keywords["@channel"] = append(keywords["@channel"], profile.Id)
			keywords["@all"] = append(keywords["@all"], profile.Id)
		}
	}

	return keywords
}

// Given a message and a map mapping mention keywords to the users who use them, returns a map of mentioned
// users and a slice of potencial mention users not in the channel and whether or not @here was mentioned.
func getExplicitMentions(message string, keywords map[string][]string) (map[string]bool, []string, bool) {
	mentioned := make(map[string]bool)
	potentialOthersMentioned := make([]string, 0)
	systemMentions := map[string]bool{"@here": true, "@channel": true, "@all": true}
	hereMentioned := false

	addMentionedUsers := func(ids []string) {
		for _, id := range ids {
			mentioned[id] = true
		}
	}

	for _, word := range strings.Fields(message) {
		isMention := false

		if word == "@here" {
			hereMentioned = true
		}

		// Non-case-sensitive check for regular keys
		if ids, match := keywords[strings.ToLower(word)]; match {
			addMentionedUsers(ids)
			isMention = true
		}

		// Case-sensitive check for first name
		if ids, match := keywords[word]; match {
			addMentionedUsers(ids)
			isMention = true
		} else if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
			potentialOthersMentioned = append(potentialOthersMentioned, word[1:])
			continue
		}

		if !isMention {
			// No matches were found with the string split just on whitespace so try further splitting
			// the message on punctuation
			splitWords := strings.FieldsFunc(word, func(c rune) bool {
				return model.SplitRunes[c]
			})

			for _, splitWord := range splitWords {
				if splitWord == "@here" {
					hereMentioned = true
				}

				// Non-case-sensitive check for regular keys
				if ids, match := keywords[strings.ToLower(splitWord)]; match {
					addMentionedUsers(ids)
				}

				// Case-sensitive check for first name
				if ids, match := keywords[splitWord]; match {
					addMentionedUsers(ids)
				} else if _, ok := systemMentions[word]; !ok && strings.HasPrefix(word, "@") {
					username := word[1:len(splitWord)]
					potentialOthersMentioned = append(potentialOthersMentioned, username)
				}
			}
		}
	}

	return mentioned, potentialOthersMentioned, hereMentioned
}

func sendNotifications(c *Context, post *model.Post, team *model.Team, channel *model.Channel) []string {
	pchan := Srv.Store.User().GetProfilesInChannel(channel.Id, -1, -1, true)
	fchan := Srv.Store.FileInfo().GetForPost(post.Id)

	var profileMap map[string]*model.User
	if result := <-pchan; result.Err != nil {
		l4g.Error(utils.T("api.post.handle_post_events_and_forget.profiles.error"), c.TeamId, result.Err)
		return nil
	} else {
		profileMap = result.Data.(map[string]*model.User)
	}

	// If the user who made the post is mention don't send a notification
	if _, ok := profileMap[post.UserId]; !ok {
		l4g.Error(utils.T("api.post.send_notifications_and_forget.user_id.error"), post.UserId)
		return nil
	}

	mentionedUserIds := make(map[string]bool)
	allActivityPushUserIds := []string{}
	hereNotification := false
	updateMentionChans := []store.StoreChannel{}

	if channel.Type == model.CHANNEL_DIRECT {
		var otherUserId string
		if userIds := strings.Split(channel.Name, "__"); userIds[0] == post.UserId {
			otherUserId = userIds[1]
		} else {
			otherUserId = userIds[0]
		}

		mentionedUserIds[otherUserId] = true
	} else {
		keywords := getMentionKeywordsInChannel(profileMap)

		var potentialOtherMentions []string
		mentionedUserIds, potentialOtherMentions, hereNotification = getExplicitMentions(post.Message, keywords)

		// get users that have comment thread mentions enabled
		if len(post.RootId) > 0 {
			if result := <-Srv.Store.Post().Get(post.RootId); result.Err != nil {
				l4g.Error(utils.T("api.post.send_notifications_and_forget.comment_thread.error"), post.RootId, result.Err)
				return nil
			} else {
				list := result.Data.(*model.PostList)

				for _, threadPost := range list.Posts {
					profile := profileMap[threadPost.UserId]
					if profile.NotifyProps["comments"] == "any" || (profile.NotifyProps["comments"] == "root" && threadPost.Id == list.Order[0]) {
						mentionedUserIds[threadPost.UserId] = true
					}
				}
			}
		}

		// prevent the user from mentioning themselves
		if post.Props["from_webhook"] != "true" {
			delete(mentionedUserIds, post.UserId)
		}

		if len(potentialOtherMentions) > 0 {
			if result := <-Srv.Store.User().GetProfilesByUsernames(potentialOtherMentions, team.Id); result.Err == nil {
				outOfChannelMentions := result.Data.(map[string]*model.User)
				go sendOutOfChannelMentions(c, post, outOfChannelMentions)
			}
		}

		// find which users in the channel are set up to always receive mobile notifications
		for _, profile := range profileMap {
			if profile.NotifyProps["push"] == model.USER_NOTIFY_ALL &&
				(post.UserId != profile.Id || post.Props["from_webhook"] == "true") &&
				!post.IsSystemMessage() {
				allActivityPushUserIds = append(allActivityPushUserIds, profile.Id)
			}
		}
	}

	mentionedUsersList := make([]string, 0, len(mentionedUserIds))
	for id := range mentionedUserIds {
		mentionedUsersList = append(mentionedUsersList, id)
		updateMentionChans = append(updateMentionChans, Srv.Store.Channel().IncrementMentionCount(post.ChannelId, id))
	}

	senderName := ""

	var sender *model.User
	if post.IsSystemMessage() {
		senderName = c.T("system.message.name")
	} else if profile, ok := profileMap[post.UserId]; ok {
		if value, ok := post.Props["override_username"]; ok && post.Props["from_webhook"] == "true" {
			senderName = value.(string)
		} else {
			senderName = profile.Username
		}
		sender = profile
	}

	if utils.Cfg.EmailSettings.SendEmailNotifications {
		for _, id := range mentionedUsersList {
			userAllowsEmails := profileMap[id].NotifyProps["email"] != "false"

			var status *model.Status
			var err *model.AppError
			if status, err = GetStatus(id); err != nil {
				status = &model.Status{id, model.STATUS_OFFLINE, false, 0, ""}
			}

			if userAllowsEmails && status.Status != model.STATUS_ONLINE {
				sendNotificationEmail(c, post, profileMap[id], channel, team, senderName, sender)
			}
		}
	}

	if hereNotification {
		if result := <-Srv.Store.Status().GetOnline(); result.Err != nil {
			l4g.Warn(utils.T("api.post.notification.here.warn"), result.Err)
			return nil
		} else {
			statuses := result.Data.([]*model.Status)
			for _, status := range statuses {
				if status.UserId == post.UserId {
					continue
				}

				_, profileFound := profileMap[status.UserId]
				_, alreadyMentioned := mentionedUserIds[status.UserId]

				if status.Status == model.STATUS_ONLINE && profileFound && !alreadyMentioned {
					mentionedUsersList = append(mentionedUsersList, status.UserId)
					updateMentionChans = append(updateMentionChans, Srv.Store.Channel().IncrementMentionCount(post.ChannelId, status.UserId))
				}
			}
		}
	}

	// Make sure all mention updates are complete to prevent race
	// Probably better to batch these DB updates in the future
	// MUST be completed before push notifications send
	for _, uchan := range updateMentionChans {
		if result := <-uchan; result.Err != nil {
			l4g.Warn(utils.T("api.post.update_mention_count_and_forget.update_error"), post.Id, post.ChannelId, result.Err)
		}
	}

	sendPushNotifications := false
	if *utils.Cfg.EmailSettings.SendPushNotifications {
		pushServer := *utils.Cfg.EmailSettings.PushNotificationServer
		if pushServer == model.MHPNS && (!utils.IsLicensed || !*utils.License.Features.MHPNS) {
			l4g.Warn(utils.T("api.post.send_notifications_and_forget.push_notification.mhpnsWarn"))
			sendPushNotifications = false
		} else {
			sendPushNotifications = true
		}
	}

	if sendPushNotifications {
		for _, id := range mentionedUsersList {
			var status *model.Status
			var err *model.AppError
			if status, err = GetStatus(id); err != nil {
				status = &model.Status{id, model.STATUS_OFFLINE, false, 0, ""}
			}

			if DoesStatusAllowPushNotification(profileMap[id], status, post.ChannelId) {
				sendPushNotification(post, profileMap[id], channel, senderName, true)
			}
		}

		for _, id := range allActivityPushUserIds {
			if _, ok := mentionedUserIds[id]; !ok {
				var status *model.Status
				var err *model.AppError
				if status, err = GetStatus(id); err != nil {
					status = &model.Status{id, model.STATUS_OFFLINE, false, 0, ""}
				}

				if DoesStatusAllowPushNotification(profileMap[id], status, post.ChannelId) {
					sendPushNotification(post, profileMap[id], channel, senderName, false)
				}
			}
		}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POSTED, "", post.ChannelId, "", nil)
	message.Add("post", post.ToJson())
	message.Add("channel_type", channel.Type)
	message.Add("channel_display_name", channel.DisplayName)
	message.Add("sender_name", senderName)
	message.Add("team_id", team.Id)

	if len(post.FileIds) != 0 {
		message.Add("otherFile", "true")

		var infos []*model.FileInfo
		if result := <-fchan; result.Err != nil {
			l4g.Warn(utils.T("api.post.send_notifications.files.error"), post.Id, result.Err)
		} else {
			infos = result.Data.([]*model.FileInfo)
		}

		for _, info := range infos {
			if info.IsImage() {
				message.Add("image", "true")
				break
			}
		}
	}

	if len(mentionedUsersList) != 0 {
		message.Add("mentions", model.ArrayToJson(mentionedUsersList))
	}

	Publish(message)
	return mentionedUsersList
}

func sendNotificationEmail(c *Context, post *model.Post, user *model.User, channel *model.Channel, team *model.Team, senderName string, sender *model.User) {
	// skip if inactive
	if user.DeleteAt > 0 {
		return
	}

	if channel.Type == model.CHANNEL_DIRECT && channel.TeamId != team.Id {
		// this message is a cross-team DM so it we need to find a team that the recipient is on to use in the link
		if result := <-Srv.Store.Team().GetTeamsByUserId(user.Id); result.Err != nil {
			l4g.Error(utils.T("api.post.send_notifications_and_forget.get_teams.error"), user.Id, result.Err)
			return
		} else {
			// if the recipient isn't in the current user's team, just pick one
			teams := result.Data.([]*model.Team)
			found := false

			for i := range teams {
				if teams[i].Id == team.Id {
					found = true
					break
				}
			}

			if !found {
				team = teams[0]
			}
		}
	}

	if *utils.Cfg.EmailSettings.EnableEmailBatching {
		var sendBatched bool

		if result := <-Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_NOTIFICATIONS, model.PREFERENCE_NAME_EMAIL_INTERVAL); result.Err != nil {
			// if the call fails, assume it hasn't been set and use the default
			sendBatched = false
		} else {
			// default to not using batching if the setting is set to immediate
			sendBatched = result.Data.(model.Preference).Value != model.PREFERENCE_DEFAULT_EMAIL_INTERVAL
		}

		if sendBatched {
			if err := AddNotificationEmailToBatch(user, post, team); err == nil {
				return
			}
		}

		// fall back to sending a single email if we can't batch it for some reason
	}

	var channelName string
	var bodyText string
	var subjectText string
	var mailTemplate string
	var mailParameters map[string]interface{}

	teamURL := c.GetSiteURL() + "/" + team.Name
	tm := time.Unix(post.CreateAt/1000, 0)

	userLocale := utils.GetUserTranslations(user.Locale)
	month := userLocale(tm.Month().String())
	day := fmt.Sprintf("%d", tm.Day())
	year := fmt.Sprintf("%d", tm.Year())
	zone, _ := tm.Zone()

	if channel.Type == model.CHANNEL_DIRECT {
		bodyText = userLocale("api.post.send_notifications_and_forget.message_body")
		subjectText = userLocale("api.post.send_notifications_and_forget.message_subject")

		senderDisplayName := senderName
		if sender != nil {
			if result := <-Srv.Store.Preference().Get(user.Id, model.PREFERENCE_CATEGORY_DISPLAY_SETTINGS, "name_format"); result.Err != nil {
				// Show default sender's name if user doesn't set display settings.
				senderDisplayName = senderName
			} else {
				senderDisplayName = sender.GetDisplayNameForPreference(result.Data.(model.Preference).Value)
			}
		}

		mailTemplate = "api.templates.post_subject_in_direct_message"
		mailParameters = map[string]interface{}{"SubjectText": subjectText, "TeamDisplayName": team.DisplayName,
			"SenderDisplayName": senderDisplayName, "Month": month, "Day": day, "Year": year}
	} else {
		bodyText = userLocale("api.post.send_notifications_and_forget.mention_body")
		subjectText = userLocale("api.post.send_notifications_and_forget.mention_subject")
		channelName = channel.DisplayName
		mailTemplate = "api.templates.post_subject_in_channel"
		mailParameters = map[string]interface{}{"SubjectText": subjectText, "TeamDisplayName": team.DisplayName,
			"ChannelName": channelName, "Month": month, "Day": day, "Year": year}
	}

	subjectPage := utils.NewHTMLTemplate("post_subject", user.Locale)
	subjectPage.Props["Subject"] = userLocale(mailTemplate, mailParameters)
	subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

	bodyPage := utils.NewHTMLTemplate("post_body", user.Locale)
	bodyPage.Props["SiteURL"] = c.GetSiteURL()
	bodyPage.Props["PostMessage"] = getMessageForNotification(post, userLocale)
	bodyPage.Props["TeamLink"] = teamURL + "/pl/" + post.Id
	bodyPage.Props["BodyText"] = bodyText
	bodyPage.Props["Button"] = userLocale("api.templates.post_body.button")
	bodyPage.Html["Info"] = template.HTML(userLocale("api.templates.post_body.info",
		map[string]interface{}{"ChannelName": channelName, "SenderName": senderName,
			"Hour": fmt.Sprintf("%02d", tm.Hour()), "Minute": fmt.Sprintf("%02d", tm.Minute()),
			"TimeZone": zone, "Month": month, "Day": day}))

	if err := utils.SendMail(user.Email, html.UnescapeString(subjectPage.Render()), bodyPage.Render()); err != nil {
		l4g.Error(utils.T("api.post.send_notifications_and_forget.send.error"), user.Email, err)
	}
}

func getMessageForNotification(post *model.Post, translateFunc i18n.TranslateFunc) string {
	if len(strings.TrimSpace(post.Message)) != 0 || len(post.FileIds) == 0 {
		return post.Message
	}

	// extract the filenames from their paths and determine what type of files are attached
	var infos []*model.FileInfo
	if result := <-Srv.Store.FileInfo().GetForPost(post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.get_message_for_notification.get_files.error"), post.Id, result.Err)
	} else {
		infos = result.Data.([]*model.FileInfo)
	}

	filenames := make([]string, len(infos))
	onlyImages := true
	for i, info := range infos {
		if escaped, err := url.QueryUnescape(filepath.Base(info.Name)); err != nil {
			// this should never error since filepath was escaped using url.QueryEscape
			filenames[i] = escaped
		} else {
			filenames[i] = info.Name
		}

		onlyImages = onlyImages && info.IsImage()
	}

	props := map[string]interface{}{"Filenames": strings.Join(filenames, ", ")}

	if onlyImages {
		return translateFunc("api.post.get_message_for_notification.images_sent", len(filenames), props)
	} else {
		return translateFunc("api.post.get_message_for_notification.files_sent", len(filenames), props)
	}
}

func sendPushNotification(post *model.Post, user *model.User, channel *model.Channel, senderName string, wasMentioned bool) {
	sessions := getMobileAppSessions(user.Id)

	if sessions == nil {
		return
	}

	var channelName string

	if channel.Type == model.CHANNEL_DIRECT {
		channelName = senderName
	} else {
		channelName = channel.DisplayName
	}

	userLocale := utils.GetUserTranslations(user.Locale)

	msg := model.PushNotification{}
	if badge := <-Srv.Store.User().GetUnreadCount(user.Id); badge.Err != nil {
		msg.Badge = 1
		l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), user.Id, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}
	msg.Type = model.PUSH_TYPE_MESSAGE
	msg.ChannelId = channel.Id
	msg.ChannelName = channel.Name

	if *utils.Cfg.EmailSettings.PushNotificationContents == model.FULL_NOTIFICATION {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_DM
			msg.Message = "@" + senderName + ": " + model.ClearMentionTags(post.Message)
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_in") + channelName + ": " + model.ClearMentionTags(post.Message)
		}
	} else {
		if channel.Type == model.CHANNEL_DIRECT {
			msg.Category = model.CATEGORY_DM
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
		} else if wasMentioned {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention") + channelName
		} else {
			msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_non_mention") + channelName
		}
	}

	l4g.Debug(utils.T("api.post.send_notifications_and_forget.push_notification.debug"), msg.DeviceId, msg.Message)

	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		sendToPushProxy(tmpMessage)
	}
}

func clearPushNotification(userId string, channelId string) {
	sessions := getMobileAppSessions(userId)
	if sessions == nil {
		return
	}

	msg := model.PushNotification{}
	msg.Type = model.PUSH_TYPE_CLEAR
	msg.ChannelId = channelId
	msg.ContentAvailable = 0
	if badge := <-Srv.Store.User().GetUnreadCount(userId); badge.Err != nil {
		msg.Badge = 0
		l4g.Error(utils.T("store.sql_user.get_unread_count.app_error"), userId, badge.Err)
	} else {
		msg.Badge = int(badge.Data.(int64))
	}

	l4g.Debug(utils.T("api.post.send_notifications_and_forget.clear_push_notification.debug"), msg.DeviceId, msg.ChannelId)
	for _, session := range sessions {
		tmpMessage := *model.PushNotificationFromJson(strings.NewReader(msg.ToJson()))
		tmpMessage.SetDeviceIdAndPlatform(session.DeviceId)
		sendToPushProxy(tmpMessage)
	}
}

func sendToPushProxy(msg model.PushNotification) {
	msg.ServerId = utils.CfgDiagnosticId

	tr := &http.Transport{
		TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
	}
	httpClient := &http.Client{Transport: tr}
	request, _ := http.NewRequest("POST", *utils.Cfg.EmailSettings.PushNotificationServer+model.API_URL_SUFFIX_V1+"/send_push", strings.NewReader(msg.ToJson()))

	if resp, err := httpClient.Do(request); err != nil {
		l4g.Error(utils.T("api.post.send_notifications_and_forget.push_notification.error"), msg.DeviceId, err)
	} else {
		ioutil.ReadAll(resp.Body)
		resp.Body.Close()
	}
}

func getMobileAppSessions(userId string) []*model.Session {
	if result := <-Srv.Store.Session().GetSessionsWithActiveDeviceIds(userId); result.Err != nil {
		l4g.Error(utils.T("api.post.send_notifications_and_forget.sessions.error"), userId, result.Err)
		return nil
	} else {
		return result.Data.([]*model.Session)
	}
}

func sendOutOfChannelMentions(c *Context, post *model.Post, profiles map[string]*model.User) {
	if len(profiles) == 0 {
		return
	}

	var usernames []string
	for _, user := range profiles {
		usernames = append(usernames, user.Username)
	}
	sort.Strings(usernames)

	var message string
	if len(usernames) == 1 {
		message = c.T("api.post.check_for_out_of_channel_mentions.message.one", map[string]interface{}{
			"Username": usernames[0],
		})
	} else {
		message = c.T("api.post.check_for_out_of_channel_mentions.message.multiple", map[string]interface{}{
			"Usernames":    strings.Join(usernames[:len(usernames)-1], ", "),
			"LastUsername": usernames[len(usernames)-1],
		})
	}

	SendEphemeralPost(
		c.TeamId,
		post.UserId,
		&model.Post{
			ChannelId: post.ChannelId,
			Message:   message,
			CreateAt:  post.CreateAt + 1,
		},
	)
}

func SendEphemeralPost(teamId, userId string, post *model.Post) {
	post.Type = model.POST_EPHEMERAL

	// fill in fields which haven't been specified which have sensible defaults
	if post.Id == "" {
		post.Id = model.NewId()
	}
	if post.CreateAt == 0 {
		post.CreateAt = model.GetMillis()
	}
	if post.Props == nil {
		post.Props = model.StringInterface{}
	}

	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_EPHEMERAL_MESSAGE, "", post.ChannelId, userId, nil)
	message.Add("post", post.ToJson())

	go Publish(message)
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("updatePost", "post")
		return
	}

	pchan := Srv.Store.Post().Get(post.Id)

	if !HasPermissionToChannelContext(c, post.ChannelId, model.PERMISSION_EDIT_POST) {
		return
	}

	var oldPost *model.Post
	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		oldPost = result.Data.(*model.PostList).Posts[post.Id]

		if oldPost == nil {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.find.app_error", nil, "id="+post.Id)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oldPost.UserId != c.Session.UserId {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil, "oldUserId="+oldPost.UserId)
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldPost.DeleteAt != 0 {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.permissions.app_error", nil,
				c.T("api.post.update_post.permissions_details.app_error", map[string]interface{}{"PostId": post.Id}))
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldPost.IsSystemMessage() {
			c.Err = model.NewLocAppError("updatePost", "api.post.update_post.system_message.app_error", nil, "id="+post.Id)
			c.Err.StatusCode = http.StatusForbidden
			return
		}
	}

	newPost := &model.Post{}
	*newPost = *oldPost

	newPost.Message = post.Message
	newPost.Hashtags, _ = model.ParseHashtags(post.Message)

	if result := <-Srv.Store.Post().Update(newPost, oldPost); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rpost := result.Data.(*model.Post)

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", rpost.ChannelId, "", nil)
		message.Add("post", rpost.ToJson())

		go Publish(message)

		w.Write([]byte(rpost.ToJson()))
	}
}

func getFlaggedPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getFlaggedPosts", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getFlaggedPosts", "limit")
		return
	}

	posts := &model.PostList{}

	if result := <-Srv.Store.Post().GetFlaggedPosts(c.Session.UserId, offset, limit); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		posts = result.Data.(*model.PostList)
	}

	w.Write([]byte(posts.ToJson()))
}

func getPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPosts", "channelId")
		return
	}

	offset, err := strconv.Atoi(params["offset"])
	if err != nil {
		c.SetInvalidParam("getPosts", "offset")
		return
	}

	limit, err := strconv.Atoi(params["limit"])
	if err != nil {
		c.SetInvalidParam("getPosts", "limit")
		return
	}

	etagChan := Srv.Store.Post().GetEtag(id)

	if !HasPermissionToChannelContext(c, id, model.PERMISSION_CREATE_POST) {
		return
	}

	etag := (<-etagChan).Data.(string)

	if HandleEtag(etag, w, r) {
		return
	}

	pchan := Srv.Store.Post().GetPosts(id, offset, limit)

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(list.ToJson()))
	}

}

func getPostsSince(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPostsSince", "channelId")
		return
	}

	time, err := strconv.ParseInt(params["time"], 10, 64)
	if err != nil {
		c.SetInvalidParam("getPostsSince", "time")
		return
	}

	pchan := Srv.Store.Post().GetPostsSince(id, time)

	if !HasPermissionToChannelContext(c, id, model.PERMISSION_READ_CHANNEL) {
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		w.Write([]byte(list.ToJson()))
	}

}

func getPost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPost", "postId")
		return
	}

	pchan := Srv.Store.Post().Get(postId)

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_READ_CHANNEL) {
		return
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else if HandleEtag(result.Data.(*model.PostList).Etag(), w, r) {
		return
	} else {
		list := result.Data.(*model.PostList)

		if !list.IsChannelId(channelId) {
			c.Err = model.NewLocAppError("getPost", "api.post.get_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func getPostById(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPostById", "postId")
		return
	}

	if result := <-Srv.Store.Post().Get(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		if len(list.Order) != 1 {
			c.Err = model.NewLocAppError("getPostById", "api.post_get_post_by_id.get.app_error", nil, "")
			return
		}
		post := list.Posts[list.Order[0]]

		if !HasPermissionToChannelContext(c, post.ChannelId, model.PERMISSION_READ_CHANNEL) {
			return
		}

		if HandleEtag(list.Etag(), w, r) {
			return
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func getPermalinkTmp(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPermalinkTmp", "postId")
		return
	}

	if result := <-Srv.Store.Post().Get(postId); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		if len(list.Order) != 1 {
			c.Err = model.NewLocAppError("getPermalinkTmp", "api.post_get_post_by_id.get.app_error", nil, "")
			return
		}
		post := list.Posts[list.Order[0]]

		// Because we confuse permissions and membership in Mattermost's model, we have to just
		// try to join the channel without checking if we already have permission to it. This is
		// because system admins have permissions to every channel but are not nessisary a member
		// of every channel. If we checked here then system admins would skip joining the channel and
		// error when they tried to view it.
		if err, _ := JoinChannelById(c, c.Session.UserId, post.ChannelId); err != nil {
			// On error just return with permissions error
			c.Err = err
			return
		}

		if HandleEtag(list.Etag(), w, r) {
			return
		}

		w.Header().Set(model.HEADER_ETAG_SERVER, list.Etag())
		w.Write([]byte(list.ToJson()))
	}
}

func deletePost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deletePost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("deletePost", "postId")
		return
	}

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_EDIT_POST) {
		return
	}

	pchan := Srv.Store.Post().Get(postId)

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {

		post := result.Data.(*model.PostList).Posts[postId]

		if post == nil {
			c.SetInvalidParam("deletePost", "postId")
			return
		}

		if post.ChannelId != channelId {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if post.UserId != c.Session.UserId && !HasPermissionToChannelContext(c, post.ChannelId, model.PERMISSION_EDIT_OTHERS_POSTS) {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if dresult := <-Srv.Store.Post().Delete(postId, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", post.ChannelId, "", nil)
		message.Add("post", post.ToJson())

		go Publish(message)
		go DeletePostFiles(post)
		go DeleteFlaggedPost(c.Session.UserId, post)

		result := make(map[string]string)
		result["id"] = postId
		w.Write([]byte(model.MapToJson(result)))
	}
}

func DeleteFlaggedPost(userId string, post *model.Post) {
	if result := <-Srv.Store.Preference().Delete(userId, model.PREFERENCE_CATEGORY_FLAGGED_POST, post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_flagged_post.app_error.warn"), result.Err)
		return
	}
}

func DeletePostFiles(post *model.Post) {
	if len(post.FileIds) != 0 {
		return
	}

	if result := <-Srv.Store.FileInfo().DeleteForPost(post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_post_files.app_error.warn"), post.Id, result.Err)
	}
}

func getPostsBefore(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, true)
}

func getPostsAfter(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, false)
}

func getPostsBeforeOrAfter(c *Context, w http.ResponseWriter, r *http.Request, before bool) {
	params := mux.Vars(r)

	id := params["channel_id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "postId")
		return
	}

	numPosts, err := strconv.Atoi(params["num_posts"])
	if err != nil || numPosts <= 0 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "numPosts")
		return
	}

	offset, err := strconv.Atoi(params["offset"])
	if err != nil || offset < 0 {
		c.SetInvalidParam("getPostsBeforeOrAfter", "offset")
		return
	}

	// We can do better than this etag in this situation
	etagChan := Srv.Store.Post().GetEtag(id)

	if !HasPermissionToChannelContext(c, id, model.PERMISSION_READ_CHANNEL) {
		return
	}

	etag := (<-etagChan).Data.(string)
	if HandleEtag(etag, w, r) {
		return
	}

	var pchan store.StoreChannel
	if before {
		pchan = Srv.Store.Post().GetPostsBefore(id, postId, numPosts, offset)
	} else {
		pchan = Srv.Store.Post().GetPostsAfter(id, postId, numPosts, offset)
	}

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		list := result.Data.(*model.PostList)

		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(list.ToJson()))
	}
}

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	props := model.StringInterfaceFromJson(r.Body)

	terms := props["terms"].(string)
	if len(terms) == 0 {
		c.SetInvalidParam("search", "terms")
		return
	}

	isOrSearch := false
	if val, ok := props["is_or_search"]; ok && val != nil {
		isOrSearch = val.(bool)
	}

	paramsList := model.ParseSearchParams(terms)
	channels := []store.StoreChannel{}

	for _, params := range paramsList {
		params.OrTerms = isOrSearch
		// don't allow users to search for everything
		if params.Terms != "*" {
			channels = append(channels, Srv.Store.Post().Search(c.TeamId, c.Session.UserId, params))
		}
	}

	posts := &model.PostList{}
	for _, channel := range channels {
		if result := <-channel; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			data := result.Data.(*model.PostList)
			posts.Extend(data)
		}
	}

	w.Header().Set("Cache-Control", "no-cache, no-store, must-revalidate")
	w.Write([]byte(posts.ToJson()))
}

func getFileInfosForPost(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	channelId := params["channel_id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getFileInfosForPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getFileInfosForPost", "postId")
		return
	}

	pchan := Srv.Store.Post().Get(postId)
	fchan := Srv.Store.FileInfo().GetForPost(postId)

	if !HasPermissionToChannelContext(c, channelId, model.PERMISSION_READ_CHANNEL) {
		return
	}

	var infos []*model.FileInfo
	if result := <-fchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {
		infos = result.Data.([]*model.FileInfo)
	}

	if len(infos) == 0 {
		// No FileInfos were returned so check if they need to be created for this post
		var post *model.Post
		if result := <-pchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			post = result.Data.(*model.PostList).Posts[postId]
		}

		if len(post.Filenames) > 0 {
			// The post has Filenames that need to be replaced with FileInfos
			infos = migrateFilenamesToFileInfos(post)
		}
	}

	etag := model.GetEtagForFileInfos(infos)

	if HandleEtag(etag, w, r) {
		return
	} else {
		w.Header().Set(model.HEADER_ETAG_SERVER, etag)
		w.Write([]byte(model.FileInfosToJson(infos)))
	}
}
