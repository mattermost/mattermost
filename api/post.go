// Copyright (c) 2015 Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api

import (
	l4g "code.google.com/p/log4go"
	"fmt"
	"github.com/gorilla/mux"
	"github.com/mattermost/platform/model"
	"github.com/mattermost/platform/store"
	"github.com/mattermost/platform/utils"
	"net/http"
	"net/url"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

func InitPost(r *mux.Router) {
	l4g.Debug("Initializing post api routes")

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

		if strings.Contains(c.Err.Message, "parameter") {
			c.Err.StatusCode = http.StatusBadRequest
		}

		return
	} else {
		if result := <-Srv.Store.Channel().UpdateLastViewedAt(post.ChannelId, c.Session.UserId); result.Err != nil {
			l4g.Error("Encountered error updating last viewed, channel_id=%s, user_id=%s, err=%v", post.ChannelId, c.Session.UserId, result.Err)
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
			return nil, model.NewAppError("createPost", "Invalid RootId parameter", "")
		} else {
			list := presult.Data.(*model.PostList)
			if len(list.Posts) == 0 || !list.IsChannelId(post.ChannelId) {
				return nil, model.NewAppError("createPost", "Invalid ChannelId for RootId parameter", "")
			}

			if post.ParentId == "" {
				post.ParentId = post.RootId
			}

			if post.RootId != post.ParentId {
				parent := list.Posts[post.ParentId]
				if parent == nil {
					return nil, model.NewAppError("createPost", "Invalid ParentId parameter", "")
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
				l4g.Error("Bad filename discarded, filename=%v", path)
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

	linkRegex := regexp.MustCompile(`<\s*(\S*)\s*>`)
	text = linkRegex.ReplaceAllString(text, "${1}")

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
			if key != "override_icon_url" && key != "override_username" && key != "from_webhook" {
				post.AddProp(key, val)
			}
		}
	}

	if _, err := CreatePost(c, post, false); err != nil {
		return nil, model.NewAppError("CreateWebhookPost", "Error creating post", "err="+err.Message)
	}

	return post, nil
}

func handlePostEventsAndForget(c *Context, post *model.Post, triggerWebhooks bool) {
	go func() {
		tchan := Srv.Store.Team().Get(c.Session.TeamId)
		cchan := Srv.Store.Channel().Get(post.ChannelId)
		uchan := Srv.Store.User().Get(post.UserId)

		var team *model.Team
		if result := <-tchan; result.Err != nil {
			l4g.Error("Encountered error getting team, team_id=%s, err=%v", c.Session.TeamId, result.Err)
			return
		} else {
			team = result.Data.(*model.Team)
		}

		var channel *model.Channel
		if result := <-cchan; result.Err != nil {
			l4g.Error("Encountered error getting channel, channel_id=%s, err=%v", post.ChannelId, result.Err)
			return
		} else {
			channel = result.Data.(*model.Channel)
		}

		sendNotificationsAndForget(c, post, team, channel)

		var user *model.User
		if result := <-uchan; result.Err != nil {
			l4g.Error("Encountered error getting user, user_id=%s, err=%v", post.UserId, result.Err)
			return
		} else {
			user = result.Data.(*model.User)
		}

		if triggerWebhooks {
			handleWebhookEventsAndForget(c, post, team, channel, user)
		}
	}()
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
			l4g.Error("Encountered error getting webhooks by team, err=%v", result.Err)
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

				client := &http.Client{}

				for _, url := range hook.CallbackURLs {
					go func(url string) {
						req, _ := http.NewRequest("POST", url, strings.NewReader(p.Encode()))
						req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
						req.Header.Set("Accept", "application/json")
						if resp, err := client.Do(req); err != nil {
							l4g.Error("Event POST failed, err=%s", err.Error())
						} else {
							respProps := model.MapFromJson(resp.Body)

							// copy the context and create a mock session for posting the message
							mockSession := model.Session{UserId: hook.CreatorId, TeamId: hook.TeamId, IsOAuth: false}
							newContext := &Context{mockSession, model.NewId(), "", c.Path, nil, c.teamURLValid, c.teamURL, c.siteURL, 0}

							if text, ok := respProps["text"]; ok {
								if _, err := CreateWebhookPost(newContext, post.ChannelId, text, respProps["username"], respProps["icon_url"], post.Props, post.Type); err != nil {
									l4g.Error("Failed to create response post, err=%v", err)
								}
							}
						}
					}(url)
				}

			}(hook)
		}

	}()

}

func sendNotificationsAndForget(c *Context, post *model.Post, team *model.Team, channel *model.Channel) {

	go func() {
		// Get a list of user names (to be used as keywords) and ids for the given team
		uchan := Srv.Store.User().GetProfiles(c.Session.TeamId)
		echan := Srv.Store.Channel().GetMembers(post.ChannelId)

		var channelName string
		var bodyText string
		var subjectText string
		if channel.Type == model.CHANNEL_DIRECT {
			bodyText = "You have one new message."
			subjectText = "New Direct Message"
		} else {
			bodyText = "You have one new mention."
			subjectText = "New Mention"
			channelName = channel.DisplayName
		}

		var mentionedUsers []string

		if result := <-uchan; result.Err != nil {
			l4g.Error("Failed to retrieve user profiles team_id=%v, err=%v", c.Session.TeamId, result.Err)
			return
		} else {
			profileMap := result.Data.(map[string]*model.User)

			if _, ok := profileMap[post.UserId]; !ok {
				l4g.Error("Post user_id not returned by GetProfiles user_id=%v", post.UserId)
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
				if eResult := <-echan; eResult.Err != nil {
					l4g.Error("Failed to get channel members channel_id=%v err=%v", post.ChannelId, eResult.Err.Message)
					return
				} else {
					tempProfileMap := make(map[string]*model.User)
					members := eResult.Data.([]model.ChannelMember)
					for _, member := range members {
						tempProfileMap[member.UserId] = profileMap[member.UserId]
					}

					profileMap = tempProfileMap
				}

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
					if profile.NotifyProps["all"] == "true" {
						keywordMap["@all"] = append(keywordMap["@all"], profile.Id)
					}

					// Add @channel to keywords if user has them turned on
					if profile.NotifyProps["channel"] == "true" {
						keywordMap["@channel"] = append(keywordMap["@channel"], profile.Id)
					}
				}

				// Build a map as a list of unique user_ids that are mentioned in this post
				splitF := func(c rune) bool {
					return model.SplitRunes[c]
				}
				splitMessage := strings.FieldsFunc(post.Message, splitF)
				for _, word := range splitMessage {

					// Non-case-sensitive check for regular keys
					userIds1, keyMatch := keywordMap[strings.ToLower(word)]

					// Case-sensitive check for first name
					userIds2, firstNameMatch := keywordMap[word]

					userIds := append(userIds1, userIds2...)

					// If one of the non-case-senstive keys or the first name matches the word
					//  then we add en entry to the sendEmail map
					if keyMatch || firstNameMatch {
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
				location, _ := time.LoadLocation("UTC")
				tm := time.Unix(post.CreateAt/1000, 0).In(location)

				subjectPage := NewServerTemplatePage("post_subject")
				subjectPage.Props["SiteURL"] = c.GetSiteURL()
				subjectPage.Props["TeamDisplayName"] = team.DisplayName
				subjectPage.Props["SubjectText"] = subjectText
				subjectPage.Props["Month"] = tm.Month().String()[:3]
				subjectPage.Props["Day"] = fmt.Sprintf("%d", tm.Day())
				subjectPage.Props["Year"] = fmt.Sprintf("%d", tm.Year())

				for id, doSend := range toEmailMap {

					if !doSend {
						continue
					}

					// skip if inactive
					if profileMap[id].DeleteAt > 0 {
						continue
					}

					bodyPage := NewServerTemplatePage("post_body")
					bodyPage.Props["SiteURL"] = c.GetSiteURL()
					bodyPage.Props["Nickname"] = profileMap[id].FirstName
					bodyPage.Props["TeamDisplayName"] = team.DisplayName
					bodyPage.Props["ChannelName"] = channelName
					bodyPage.Props["BodyText"] = bodyText
					bodyPage.Props["SenderName"] = senderName
					bodyPage.Props["Hour"] = fmt.Sprintf("%02d", tm.Hour())
					bodyPage.Props["Minute"] = fmt.Sprintf("%02d", tm.Minute())
					bodyPage.Props["Month"] = tm.Month().String()[:3]
					bodyPage.Props["Day"] = fmt.Sprintf("%d", tm.Day())
					bodyPage.Props["PostMessage"] = model.ClearMentionTags(post.Message)
					bodyPage.Props["TeamLink"] = teamURL + "/channels/" + channel.Name

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

						bodyPage.Props["PostMessage"] = fmt.Sprintf("%s: %s sent", attachmentPrefix, filenamesString)
					}

					if err := utils.SendMail(profileMap[id].Email, subjectPage.Render(), bodyPage.Render()); err != nil {
						l4g.Error("Failed to send mention email successfully email=%v err=%v", profileMap[id].Email, err)
					}

					if len(utils.Cfg.EmailSettings.ApplePushServer) > 0 {
						sessionChan := Srv.Store.Session().GetSessions(id)
						if result := <-sessionChan; result.Err != nil {
							l4g.Error("Failed to retrieve sessions in notifications id=%v, err=%v", id, result.Err)
						} else {
							sessions := result.Data.([]*model.Session)
							alreadySeen := make(map[string]string)

							for _, session := range sessions {
								if len(session.DeviceId) > 0 && alreadySeen[session.DeviceId] == "" && strings.HasPrefix(session.DeviceId, "apple:") {
									alreadySeen[session.DeviceId] = session.DeviceId

									utils.SendAppleNotifyAndForget(strings.TrimPrefix(session.DeviceId, "apple:"), subjectPage.Render(), 1)
								}
							}
						}
					}
				}
			}
		}

		message := model.NewMessage(c.Session.TeamId, post.ChannelId, post.UserId, model.ACTION_POSTED)
		message.Add("post", post.ToJson())

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
	}()
}

func updateMentionCountAndForget(channelId, userId string) {
	go func() {
		if result := <-Srv.Store.Channel().IncrementMentionCount(channelId, userId); result.Err != nil {
			l4g.Error("Failed to update mention count for user_id=%v on channel_id=%v err=%v", userId, channelId, result.Err)
		}
	}()
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
			c.Err = model.NewAppError("updatePost", "We couldn't find the existing post or comment to update.", "id="+post.Id)
			c.Err.StatusCode = http.StatusBadRequest
			return
		}

		if oldPost.UserId != c.Session.UserId {
			c.Err = model.NewAppError("updatePost", "You do not have the appropriate permissions", "oldUserId="+oldPost.UserId)
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if oldPost.DeleteAt != 0 {
			c.Err = model.NewAppError("updatePost", "You do not have the appropriate permissions", "Already delted id="+post.Id)
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
			c.Err = model.NewAppError("getPost", "You do not have the appropriate permissions", "")
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
			c.Err = model.NewAppError("getPostById", "Unable to get post", "")
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
			c.Err = model.NewAppError("deletePost", "You do not have the appropriate permissions", "")
			c.Err.StatusCode = http.StatusForbidden
			return
		}

		if post.UserId != c.Session.UserId && !c.IsTeamAdmin() {
			c.Err = model.NewAppError("deletePost", "You do not have the appropriate permissions", "")
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

		result := make(map[string]string)
		result["id"] = postId
		w.Write([]byte(model.MapToJson(result)))
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

	w.Write([]byte(posts.ToJson()))
}
