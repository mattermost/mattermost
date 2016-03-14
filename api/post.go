// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	"crypto/tls"
	"fmt"
	l4g "github.com/alecthomas/log4go"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"html/template"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

func InitPost(r *mux.Router) {
	l4g.Debug(utils.T("api.post.init.debug"))

	r.Handle("/posts/search", ApiUserRequired(searchPosts)).Methods("GET")
	r.Handle("/posts/{post_id}", ApiUserRequired(getPostById)).Methods("GET")

	sr := r.PathPrefix("/channels/{id:[A-Za-z0-9]+}").Subrouter()
	sr.Handle("/create", ApiUserRequired(createPost)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updatePost)).Methods("POST")
	sr.Handle("/posts/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequiredActivity(getPosts, false)).Methods("GET")
	sr.Handle("/posts/{time:[0-9]+}", ApiUserRequiredActivity(getPostsSince, false)).Methods("GET")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}", ApiUserRequired(getPost)).Methods("GET")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}/delete", ApiUserRequired(deletePost)).Methods("POST")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}/before/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsBefore)).Methods("GET")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}/after/{offset:[0-9]+}/{num_posts:[0-9]+}", ApiUserRequired(getPostsAfter)).Methods("GET")
}

func createPost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)
	if post == nil {
		c.SetInvalidParam("createPost", "post")
		return
	}

	// Create and save post object to channel
	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, post.ChannelId, c.Session.UserId)

	if !c.HasPermissionsToChannel(cchan, "createPost") {
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
		if result := <-Srv.Store.Channel().UpdateLastViewedAt(post.ChannelId, c.Session.UserId); result.Err != nil {
			l4g.Error(utils.T("api.post.create_post.last_viewed.error"), post.ChannelId, c.Session.UserId, result.Err)
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

	post.UserId = c.Session.UserId

	if len(post.Filenames) > 0 {
		doRemove := false
		for i := len(post.Filenames) - 1; i >= 0; i-- {
			path := post.Filenames[i]

			doRemove = false
			if model.UrlRegex.MatchString(path) {
				continue
			} else if model.PartialUrlRegex.MatchString(path) {
				matches := model.PartialUrlRegex.FindAllStringSubmatch(path, -1)
				if len(matches) == 0 || len(matches[0]) < 4 {
					doRemove = true
				}

				channelId := matches[0][1]
				if channelId != post.ChannelId {
					doRemove = true
				}

				userId := matches[0][2]
				if userId != post.UserId {
					doRemove = true
				}
			} else {
				doRemove = true
			}
			if doRemove {
				l4g.Error(utils.T("api.post.create_post.bad_filename.error"), path)
				post.Filenames = append(post.Filenames[:i], post.Filenames[i+1:]...)
			}
		}
	}

	var rpost *model.Post
	if result := <-Srv.Store.Post().Save(post); result.Err != nil {
		return nil, result.Err
	} else {
		rpost = result.Data.(*model.Post)

		handlePostEventsAndForget(c, rpost, triggerWebhooks)

	}

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
		} else {
			post.AddProp("override_icon_url", model.DEFAULT_WEBHOOK_ICON)
		}
	}

	if len(props) > 0 {
		for key, val := range props {
			if key == "attachments" {
				if list, success := val.([]interface{}); success {
					// parse attachment links into Markdown format
					for i, aInt := range list {
						attachment := aInt.(map[string]interface{})
						if _, ok := attachment["text"]; ok {
							aText := attachment["text"].(string)
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["text"] = aText
							list[i] = attachment
						}
						if _, ok := attachment["pretext"]; ok {
							aText := attachment["pretext"].(string)
							aText = linkWithTextRegex.ReplaceAllString(aText, "[${2}](${1})")
							attachment["pretext"] = aText
							list[i] = attachment
						}
						if fVal, ok := attachment["fields"]; ok {
							if fields, ok := fVal.([]interface{}); ok {
								// parse attachment field links into Markdown format
								for j, fInt := range fields {
									field := fInt.(map[string]interface{})
									if _, ok := field["text"]; ok {
										fText := field["text"].(string)
										fText = linkWithTextRegex.ReplaceAllString(fText, "[${2}](${1})")
										field["text"] = fText
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

func handlePostEventsAndForget(c *Context, post *model.Post, triggerWebhooks bool) {
	go func() {
		tchan := Srv.Store.Team().Get(c.Session.TeamId)
		cchan := Srv.Store.Channel().Get(post.ChannelId)
		uchan := Srv.Store.User().Get(post.UserId)
		pchan := Srv.Store.User().GetProfiles(c.Session.TeamId)
		mchan := Srv.Store.Channel().GetMembers(post.ChannelId)

		var team *model.Team
		if result := <-tchan; result.Err != nil {
			l4g.Error(utils.T("api.post.handle_post_events_and_forget.team.error"), c.Session.TeamId, result.Err)
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

		var profiles map[string]*model.User
		if result := <-pchan; result.Err != nil {
			l4g.Error(utils.T("api.post.handle_post_events_and_forget.profiles.error"), c.Session.TeamId, result.Err)
			return
		} else {
			profiles = result.Data.(map[string]*model.User)
		}

		var members []model.ChannelMember
		if result := <-mchan; result.Err != nil {
			l4g.Error(utils.T("api.post.handle_post_events_and_forget.members.error"), post.ChannelId, result.Err)
			return
		} else {
			members = result.Data.([]model.ChannelMember)
		}

		go sendNotifications(c, post, team, channel, profiles, members)
		go checkForOutOfChannelMentions(c, post, channel, profiles, members)

		var user *model.User
		if result := <-uchan; result.Err != nil {
			l4g.Error(utils.T("api.post.handle_post_events_and_forget.user.error"), post.UserId, result.Err)
			return
		} else {
			user = result.Data.(*model.User)
		}

		if triggerWebhooks {
			handleWebhookEventsAndForget(c, post, team, channel, user)
		}

		if channel.Type == model.CHANNEL_DIRECT {
			go makeDirectChannelVisible(c.Session.TeamId, post.ChannelId)
		}
	}()
}

func makeDirectChannelVisible(teamId string, channelId string) {
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
				message := model.NewMessage(teamId, channelId, member.UserId, model.ACTION_PREFERENCE_CHANGED)
				message.Add("preference", preference.ToJson())

				PublishAndForget(message)
			}
		} else {
			preference := result.Data.(model.Preference)

			if preference.Value != "true" {
				// update the existing preference to make the channel visible
				preference.Value = "true"

				if updateResult := <-Srv.Store.Preference().Save(&model.Preferences{preference}); updateResult.Err != nil {
					l4g.Error(utils.T("api.post.make_direct_channel_visible.update_pref.error"), member.UserId, otherUserId, updateResult.Err.Message)
				} else {
					message := model.NewMessage(teamId, channelId, member.UserId, model.ACTION_PREFERENCE_CHANGED)
					message.Add("preference", preference.ToJson())

					PublishAndForget(message)
				}
			}
		}
	}
}

func handleWebhookEventsAndForget(c *Context, post *model.Post, team *model.Team, channel *model.Channel, user *model.User) {
	go func() {
		if !utils.Cfg.ServiceSettings.EnableOutgoingWebhooks {
			return
		}

		if channel.Type != model.CHANNEL_OPEN {
			return
		}

		hchan := Srv.Store.Webhook().GetOutgoingByTeam(c.Session.TeamId)

		hooks := []*model.OutgoingWebhook{}

		if result := <-hchan; result.Err != nil {
			l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.getting.error"), result.Err)
			return
		} else {
			hooks = result.Data.([]*model.OutgoingWebhook)
		}

		if len(hooks) == 0 {
			return
		}

		firstWord := strings.Split(post.Message, " ")[0]

		relevantHooks := []*model.OutgoingWebhook{}

		for _, hook := range hooks {
			if hook.ChannelId == post.ChannelId {
				if len(hook.TriggerWords) == 0 || hook.HasTriggerWord(firstWord) {
					relevantHooks = append(relevantHooks, hook)
				}
			} else if len(hook.ChannelId) == 0 && hook.HasTriggerWord(firstWord) {
				relevantHooks = append(relevantHooks, hook)
			}
		}

		for _, hook := range relevantHooks {
			go func(hook *model.OutgoingWebhook) {
				p := url.Values{}
				p.Set("token", hook.Token)

				p.Set("team_id", hook.TeamId)
				p.Set("team_domain", team.Name)

				p.Set("channel_id", post.ChannelId)
				p.Set("channel_name", channel.Name)

				p.Set("timestamp", strconv.FormatInt(post.CreateAt/1000, 10))

				p.Set("user_id", post.UserId)
				p.Set("user_name", user.Username)

				p.Set("text", post.Message)
				p.Set("trigger_word", firstWord)

				tr := &http.Transport{
					TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
				}
				client := &http.Client{Transport: tr}

				for _, url := range hook.CallbackURLs {
					go func(url string) {
						req, _ := http.NewRequest("POST", url, strings.NewReader(p.Encode()))
						req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
						req.Header.Set("Accept", "application/json")
						if resp, err := client.Do(req); err != nil {
							l4g.Error(utils.T("api.post.handle_webhook_events_and_forget.event_post.error"), err.Error())
						} else {
							respProps := model.MapFromJson(resp.Body)

							// copy the context and create a mock session for posting the message
							mockSession := model.Session{UserId: hook.CreatorId, TeamId: hook.TeamId, IsOAuth: false}
							newContext := &Context{mockSession, model.NewId(), "", c.Path, nil, c.teamURLValid, c.teamURL, c.siteURL, c.T, c.Locale}

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

	}()

}

func sendNotifications(c *Context, post *model.Post, team *model.Team, channel *model.Channel, profileMap map[string]*model.User, members []model.ChannelMember) {
	var channelName string
	var bodyText string
	var subjectText string

	var mentionedUsers []string

	if _, ok := profileMap[post.UserId]; !ok {
		l4g.Error(utils.T("api.post.send_notifications_and_forget.user_id.error"), post.UserId)
		return
	}
	senderName := profileMap[post.UserId].Username

	toEmailMap := make(map[string]bool)

	if channel.Type == model.CHANNEL_DIRECT {

		var otherUserId string
		if userIds := strings.Split(channel.Name, "__"); userIds[0] == post.UserId {
			otherUserId = userIds[1]
			channelName = profileMap[userIds[1]].Username
		} else {
			otherUserId = userIds[0]
			channelName = profileMap[userIds[0]].Username
		}

		otherUser := profileMap[otherUserId]
		sendEmail := true
		if _, ok := otherUser.NotifyProps["email"]; ok && otherUser.NotifyProps["email"] == "false" {
			sendEmail = false
		}
		if sendEmail && (otherUser.IsOffline() || otherUser.IsAway()) {
			toEmailMap[otherUserId] = true
		}

	} else {
		// Find out who is a member of the channel, only keep those profiles
		tempProfileMap := make(map[string]*model.User)
		for _, member := range members {
			tempProfileMap[member.UserId] = profileMap[member.UserId]
		}

		profileMap = tempProfileMap

		// Build map for keywords
		keywordMap := make(map[string][]string)
		for _, profile := range profileMap {
			if len(profile.NotifyProps["mention_keys"]) > 0 {

				// Add all the user's mention keys
				splitKeys := strings.Split(profile.NotifyProps["mention_keys"], ",")
				for _, k := range splitKeys {
					keywordMap[k] = append(keywordMap[strings.ToLower(k)], profile.Id)
				}
			}

			// If turned on, add the user's case sensitive first name
			if profile.NotifyProps["first_name"] == "true" {
				keywordMap[profile.FirstName] = append(keywordMap[profile.FirstName], profile.Id)
			}

			// Add @all to keywords if user has them turned on
			// if profile.NotifyProps["all"] == "true" {
			// 	keywordMap["@all"] = append(keywordMap["@all"], profile.Id)
			// }

			// Add @channel to keywords if user has them turned on
			if profile.NotifyProps["channel"] == "true" {
				keywordMap["@channel"] = append(keywordMap["@channel"], profile.Id)
			}
		}

		// Build a map as a list of unique user_ids that are mentioned in this post
		splitF := func(c rune) bool {
			return model.SplitRunes[c]
		}
		splitMessage := strings.Fields(post.Message)
		for _, word := range splitMessage {
			var userIds []string

			// Non-case-sensitive check for regular keys
			if ids, match := keywordMap[strings.ToLower(word)]; match {
				userIds = append(userIds, ids...)
			}

			// Case-sensitive check for first name
			if ids, match := keywordMap[word]; match {
				userIds = append(userIds, ids...)
			}

			if len(userIds) == 0 {
				// No matches were found with the string split just on whitespace so try further splitting
				// the message on punctuation
				splitWords := strings.FieldsFunc(word, splitF)

				for _, splitWord := range splitWords {
					// Non-case-sensitive check for regular keys
					if ids, match := keywordMap[strings.ToLower(splitWord)]; match {
						userIds = append(userIds, ids...)
					}

					// Case-sensitive check for first name
					if ids, match := keywordMap[splitWord]; match {
						userIds = append(userIds, ids...)
					}
				}
			}

			for _, userId := range userIds {
				if post.UserId == userId {
					continue
				}
				sendEmail := true
				if _, ok := profileMap[userId].NotifyProps["email"]; ok && profileMap[userId].NotifyProps["email"] == "false" {
					sendEmail = false
				}
				if sendEmail && (profileMap[userId].IsAway() || profileMap[userId].IsOffline()) {
					toEmailMap[userId] = true
				} else {
					toEmailMap[userId] = false
				}
			}
		}

		for id := range toEmailMap {
			updateMentionCountAndForget(post.ChannelId, id)
		}
	}

	if len(toEmailMap) != 0 {
		mentionedUsers = make([]string, 0, len(toEmailMap))
		for k := range toEmailMap {
			mentionedUsers = append(mentionedUsers, k)
		}

		teamURL := c.GetSiteURL() + "/" + team.Name

		// Build and send the emails
		tm := time.Unix(post.CreateAt/1000, 0)

		for id, doSend := range toEmailMap {

			if !doSend {
				continue
			}

			// skip if inactive
			if profileMap[id].DeleteAt > 0 {
				continue
			}

			userLocale := utils.GetUserTranslations(profileMap[id].Locale)

			if channel.Type == model.CHANNEL_DIRECT {
				bodyText = userLocale("api.post.send_notifications_and_forget.message_body")
				subjectText = userLocale("api.post.send_notifications_and_forget.message_subject")
			} else {
				bodyText = userLocale("api.post.send_notifications_and_forget.mention_body")
				subjectText = userLocale("api.post.send_notifications_and_forget.mention_subject")
				channelName = channel.DisplayName
			}

			month := userLocale(tm.Month().String())
			day := fmt.Sprintf("%d", tm.Day())
			year := fmt.Sprintf("%d", tm.Year())
			zone, _ := tm.Zone()

			subjectPage := utils.NewHTMLTemplate("post_subject", profileMap[id].Locale)
			subjectPage.Props["Subject"] = userLocale("api.templates.post_subject",
				map[string]interface{}{"SubjectText": subjectText, "TeamDisplayName": team.DisplayName,
					"Month": month[:3], "Day": day, "Year": year})
			subjectPage.Props["SiteName"] = utils.Cfg.TeamSettings.SiteName

			bodyPage := utils.NewHTMLTemplate("post_body", profileMap[id].Locale)
			bodyPage.Props["SiteURL"] = c.GetSiteURL()
			bodyPage.Props["PostMessage"] = model.ClearMentionTags(post.Message)
			bodyPage.Props["TeamLink"] = teamURL + "/channels/" + channel.Name
			bodyPage.Props["BodyText"] = bodyText
			bodyPage.Props["Button"] = userLocale("api.templates.post_body.button")
			bodyPage.Html["Info"] = template.HTML(userLocale("api.templates.post_body.info",
				map[string]interface{}{"ChannelName": channelName, "SenderName": senderName,
					"Hour": fmt.Sprintf("%02d", tm.Hour()), "Minute": fmt.Sprintf("%02d", tm.Minute()),
					"TimeZone": zone, "Month": month, "Day": day}))

			// attempt to fill in a message body if the post doesn't have any text
			if len(strings.TrimSpace(bodyPage.Props["PostMessage"])) == 0 && len(post.Filenames) > 0 {
				// extract the filenames from their paths and determine what type of files are attached
				filenames := make([]string, len(post.Filenames))
				onlyImages := true
				for i, filename := range post.Filenames {
					var err error
					if filenames[i], err = url.QueryUnescape(filepath.Base(filename)); err != nil {
						// this should never error since filepath was escaped using url.QueryEscape
						filenames[i] = filepath.Base(filename)
					}

					ext := filepath.Ext(filename)
					onlyImages = onlyImages && model.IsFileExtImage(ext)
				}
				filenamesString := strings.Join(filenames, ", ")

				var attachmentPrefix string
				if onlyImages {
					attachmentPrefix = "Image"
				} else {
					attachmentPrefix = "File"
				}
				if len(post.Filenames) > 1 {
					attachmentPrefix += "s"
				}

				bodyPage.Props["PostMessage"] = userLocale("api.post.send_notifications_and_forget.sent",
					map[string]interface{}{"Prefix": attachmentPrefix, "Filenames": filenamesString})
			}

			if err := utils.SendMail(profileMap[id].Email, subjectPage.Render(), bodyPage.Render()); err != nil {
				l4g.Error(utils.T("api.post.send_notifications_and_forget.send.error"), profileMap[id].Email, err)
			}

			if *utils.Cfg.EmailSettings.SendPushNotifications {
				sessionChan := Srv.Store.Session().GetSessions(id)
				if result := <-sessionChan; result.Err != nil {
					l4g.Error(utils.T("api.post.send_notifications_and_forget.sessions.error"), id, result.Err)
				} else {
					sessions := result.Data.([]*model.Session)
					alreadySeen := make(map[string]string)

					for _, session := range sessions {
						if len(session.DeviceId) > 0 && alreadySeen[session.DeviceId] == "" &&
							(strings.HasPrefix(session.DeviceId, model.PUSH_NOTIFY_APPLE+":") || strings.HasPrefix(session.DeviceId, model.PUSH_NOTIFY_ANDROID+":")) {
							alreadySeen[session.DeviceId] = session.DeviceId

							msg := model.PushNotification{}
							msg.Badge = 1
							msg.ServerId = utils.CfgDiagnosticId

							if strings.HasPrefix(session.DeviceId, model.PUSH_NOTIFY_APPLE+":") {
								msg.Platform = model.PUSH_NOTIFY_APPLE
								msg.DeviceId = strings.TrimPrefix(session.DeviceId, model.PUSH_NOTIFY_APPLE+":")
							} else if strings.HasPrefix(session.DeviceId, model.PUSH_NOTIFY_ANDROID+":") {
								msg.Platform = model.PUSH_NOTIFY_ANDROID
								msg.DeviceId = strings.TrimPrefix(session.DeviceId, model.PUSH_NOTIFY_ANDROID+":")
							}

							if channel.Type == model.CHANNEL_DIRECT {
								msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_message")
							} else {
								msg.Message = senderName + userLocale("api.post.send_notifications_and_forget.push_mention") + channelName
							}

							tr := &http.Transport{
								TLSClientConfig: &tls.Config{InsecureSkipVerify: *utils.Cfg.ServiceSettings.EnableInsecureOutgoingConnections},
							}
							httpClient := &http.Client{Transport: tr}
							request, _ := http.NewRequest("POST", *utils.Cfg.EmailSettings.PushNotificationServer+"/api/v1/send_push", strings.NewReader(msg.ToJson()))

							l4g.Debug(utils.T("api.post.send_notifications_and_forget.push_notification.debug"), msg.DeviceId, msg.Message)
							if _, err := httpClient.Do(request); err != nil {
								l4g.Error(utils.T("api.post.send_notifications_and_forget.push_notification.error"), id, err)
							}
						}
					}
				}
			}
		}
	}

	message := model.NewMessage(c.Session.TeamId, post.ChannelId, post.UserId, model.ACTION_POSTED)
	message.Add("post", post.ToJson())
	message.Add("channel_type", channel.Type)

	if len(post.Filenames) != 0 {
		message.Add("otherFile", "true")

		for _, filename := range post.Filenames {
			ext := filepath.Ext(filename)
			if model.IsFileExtImage(ext) {
				message.Add("image", "true")
				break
			}
		}
	}

	if len(mentionedUsers) != 0 {
		message.Add("mentions", model.ArrayToJson(mentionedUsers))
	}

	PublishAndForget(message)
}

func updateMentionCountAndForget(channelId, userId string) {
	go func() {
		if result := <-Srv.Store.Channel().IncrementMentionCount(channelId, userId); result.Err != nil {
			l4g.Error(utils.T("api.post.update_mention_count_and_forget.update_error"), userId, channelId, result.Err)
		}
	}()
}

func checkForOutOfChannelMentions(c *Context, post *model.Post, channel *model.Channel, allProfiles map[string]*model.User, members []model.ChannelMember) {
	// don't check for out of channel mentions in direct channels
	if channel.Type == model.CHANNEL_DIRECT {
		return
	}

	mentioned := getOutOfChannelMentions(post, allProfiles, members)
	if len(mentioned) == 0 {
		return
	}

	usernames := make([]string, len(mentioned))
	for i, user := range mentioned {
		usernames[i] = user.Username
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
		c.Session.TeamId,
		post.UserId,
		&model.Post{
			ChannelId: post.ChannelId,
			Message:   message,
			CreateAt:  post.CreateAt + 1,
		},
	)
}

// Gets a list of users that were mentioned in a given post that aren't in the channel that the post was made in
func getOutOfChannelMentions(post *model.Post, allProfiles map[string]*model.User, members []model.ChannelMember) []*model.User {
	// copy the profiles map since we'll be removing items from it
	profiles := make(map[string]*model.User)
	for id, profile := range allProfiles {
		profiles[id] = profile
	}

	// only keep profiles which aren't in the current channel
	for _, member := range members {
		delete(profiles, member.UserId)
	}

	var mentioned []*model.User

	for _, profile := range profiles {
		if pattern, err := regexp.Compile(`(\W|^)@` + regexp.QuoteMeta(profile.Username) + `(\W|$)`); err != nil {
			l4g.Error(utils.T("api.post.get_out_of_channel_mentions.regex.error"), profile.Id, err)
		} else if pattern.MatchString(post.Message) {
			mentioned = append(mentioned, profile)
		}
	}

	return mentioned
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
	if post.Filenames == nil {
		post.Filenames = []string{}
	}

	message := model.NewMessage(teamId, post.ChannelId, userId, model.ACTION_EPHEMERAL_MESSAGE)
	message.Add("post", post.ToJson())

	PublishAndForget(message)
}

func updatePost(c *Context, w http.ResponseWriter, r *http.Request) {
	post := model.PostFromJson(r.Body)

	if post == nil {
		c.SetInvalidParam("updatePost", "post")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, post.ChannelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(post.Id)

	if !c.HasPermissionsToChannel(cchan, "updatePost") {
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
	}

	hashtags, _ := model.ParseHashtags(post.Message)

	if result := <-Srv.Store.Post().Update(oldPost, post.Message, hashtags); result.Err != nil {
		c.Err = result.Err
		return
	} else {
		rpost := result.Data.(*model.Post)

		message := model.NewMessage(c.Session.TeamId, rpost.ChannelId, c.Session.UserId, model.ACTION_POST_EDITED)
		message.Add("post", rpost.ToJson())

		PublishAndForget(message)

		w.Write([]byte(rpost.ToJson()))
	}
}

func getPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	params := mux.Vars(r)

	id := params["id"]
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

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	etagChan := Srv.Store.Post().GetEtag(id)

	if !c.HasPermissionsToChannel(cchan, "getPosts") {
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

	id := params["id"]
	if len(id) != 26 {
		c.SetInvalidParam("getPostsSince", "channelId")
		return
	}

	time, err := strconv.ParseInt(params["time"], 10, 64)
	if err != nil {
		c.SetInvalidParam("getPostsSince", "time")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	pchan := Srv.Store.Post().GetPostsSince(id, time)

	if !c.HasPermissionsToChannel(cchan, "getPostsSince") {
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

	channelId := params["id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("getPost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("getPost", "postId")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(postId)

	if !c.HasPermissionsToChannel(cchan, "getPost") {
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

		cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, post.ChannelId, c.Session.UserId)
		if !c.HasPermissionsToChannel(cchan, "getPostById") {
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

	channelId := params["id"]
	if len(channelId) != 26 {
		c.SetInvalidParam("deletePost", "channelId")
		return
	}

	postId := params["post_id"]
	if len(postId) != 26 {
		c.SetInvalidParam("deletePost", "postId")
		return
	}

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, channelId, c.Session.UserId)
	pchan := Srv.Store.Post().Get(postId)

	if result := <-pchan; result.Err != nil {
		c.Err = result.Err
		return
	} else {

		post := result.Data.(*model.PostList).Posts[postId]

		if !c.HasPermissionsToChannel(cchan, "deletePost") && !c.IsTeamAdmin() {
			return
		}

		if post == nil {
			c.SetInvalidParam("deletePost", "postId")
			return
		}

		if post.ChannelId != channelId {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if post.UserId != c.Session.UserId && !c.IsTeamAdmin() {
			c.Err = model.NewLocAppError("deletePost", "api.post.delete_post.permissions.app_error", nil, "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if dresult := <-Srv.Store.Post().Delete(postId, model.GetMillis()); dresult.Err != nil {
			c.Err = dresult.Err
			return
		}

		message := model.NewMessage(c.Session.TeamId, post.ChannelId, c.Session.UserId, model.ACTION_POST_DELETED)
		message.Add("post", post.ToJson())

		PublishAndForget(message)
		DeletePostFilesAndForget(c.Session.TeamId, post)

		result := make(map[string]string)
		result["id"] = postId
		w.Write([]byte(model.MapToJson(result)))
	}
}

func DeletePostFilesAndForget(teamId string, post *model.Post) {
	go func() {
		if len(post.Filenames) == 0 {
			return
		}

		prefix := "teams/" + teamId + "/channels/" + post.ChannelId + "/users/" + post.UserId + "/"
		for _, filename := range post.Filenames {
			splitUrl := strings.Split(filename, "/")
			oldPath := prefix + splitUrl[len(splitUrl)-2] + "/" + splitUrl[len(splitUrl)-1]
			newPath := prefix + splitUrl[len(splitUrl)-2] + "/deleted_" + splitUrl[len(splitUrl)-1]
			moveFile(oldPath, newPath)
		}

	}()
}

func getPostsBefore(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, true)
}

func getPostsAfter(c *Context, w http.ResponseWriter, r *http.Request) {
	getPostsBeforeOrAfter(c, w, r, false)
}

func getPostsBeforeOrAfter(c *Context, w http.ResponseWriter, r *http.Request, before bool) {
	params := mux.Vars(r)

	id := params["id"]
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

	cchan := Srv.Store.Channel().CheckPermissionsTo(c.Session.TeamId, id, c.Session.UserId)
	// We can do better than this etag in this situation
	etagChan := Srv.Store.Post().GetEtag(id)

	if !c.HasPermissionsToChannel(cchan, "getPostsBeforeOrAfter") {
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
	terms := r.FormValue("terms")

	if len(terms) == 0 {
		c.SetInvalidParam("search", "terms")
		return
	}

	paramsList := model.ParseSearchParams(terms)
	channels := []store.StoreChannel{}

	for _, params := range paramsList {
		// don't allow users to search for everything
		if params.Terms != "*" {
			channels = append(channels, Srv.Store.Post().Search(c.Session.TeamId, c.Session.UserId, params))
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
