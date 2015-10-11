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
	"strconv"
	"strings"
	"time"
)

func InitPost(r *mux.Router) {
	l4g.Debug("Initializing post api routes")

	r.Handle("/posts/search", ApiUserRequired(searchPosts)).Methods("GET")

	sr := r.PathPrefix("/channels/{id:[A-Za-z0-9]+}").Subrouter()
	sr.Handle("/create", ApiUserRequired(createPost)).Methods("POST")
	sr.Handle("/update", ApiUserRequired(updatePost)).Methods("POST")
	sr.Handle("/posts/{offset:[0-9]+}/{limit:[0-9]+}", ApiUserRequiredActivity(getPosts, false)).Methods("GET")
	sr.Handle("/posts/{time:[0-9]+}", ApiUserRequiredActivity(getPostsSince, false)).Methods("GET")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}", ApiUserRequired(getPost)).Methods("GET")
	sr.Handle("/post/{post_id:[A-Za-z0-9]+}/delete", ApiUserRequired(deletePost)).Methods("POST")
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
		w.Write([]byte(rp.ToJson()))
	}
}

func CreatePost(c *Context, post *model.Post, doUpdateLastViewed bool) (*model.Post, *model.AppError) {
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
	} else if doUpdateLastViewed && (<-Srv.Store.Channel().UpdateLastViewedAt(post.ChannelId, c.Session.UserId)).Err != nil {
		return nil, result.Err
	} else {
		rpost = result.Data.(*model.Post)

		fireAndForgetNotifications(rpost, c.Session.TeamId, c.GetSiteURL())

	}

	return rpost, nil
}

func fireAndForgetNotifications(post *model.Post, teamId, siteURL string) {

	go func() {
		// Get a list of user names (to be used as keywords) and ids for the given team
		uchan := Srv.Store.User().GetProfiles(teamId)
		echan := Srv.Store.Channel().GetMembers(post.ChannelId)
		cchan := Srv.Store.Channel().Get(post.ChannelId)
		tchan := Srv.Store.Team().Get(teamId)

		var channel *model.Channel
		var channelName string
		var bodyText string
		var subjectText string
		if result := <-cchan; result.Err != nil {
			l4g.Error("Failed to retrieve channel channel_id=%v, err=%v", post.ChannelId, result.Err)
			return
		} else {
			channel = result.Data.(*model.Channel)
			if channel.Type == model.CHANNEL_DIRECT {
				bodyText = "You have one new message."
				subjectText = "New Direct Message"
			} else {
				bodyText = "You have one new mention."
				subjectText = "New Mention"
				channelName = channel.DisplayName
			}
		}

		var mentionedUsers []string

		if result := <-uchan; result.Err != nil {
			l4g.Error("Failed to retrieve user profiles team_id=%v, err=%v", teamId, result.Err)
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
					fireAndForgetMentionUpdate(post.ChannelId, id)
				}
			}

			if len(toEmailMap) != 0 {
				mentionedUsers = make([]string, 0, len(toEmailMap))
				for k := range toEmailMap {
					mentionedUsers = append(mentionedUsers, k)
				}

				var teamDisplayName string
				var teamURL string
				if result := <-tchan; result.Err != nil {
					l4g.Error("Failed to retrieve team team_id=%v, err=%v", teamId, result.Err)
					return
				} else {
					teamDisplayName = result.Data.(*model.Team).DisplayName
					teamURL = siteURL + "/" + result.Data.(*model.Team).Name
				}

				// Build and send the emails
				location, _ := time.LoadLocation("UTC")
				tm := time.Unix(post.CreateAt/1000, 0).In(location)

				subjectPage := NewServerTemplatePage("post_subject")
				subjectPage.Props["SiteURL"] = siteURL
				subjectPage.Props["TeamDisplayName"] = teamDisplayName
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
					bodyPage.Props["SiteURL"] = siteURL
					bodyPage.Props["Nickname"] = profileMap[id].FirstName
					bodyPage.Props["TeamDisplayName"] = teamDisplayName
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
								if len(session.DeviceId) > 0 && alreadySeen[session.DeviceId] == "" {

									alreadySeen[session.DeviceId] = session.DeviceId

									utils.FireAndForgetSendAppleNotify(session.DeviceId, subjectPage.Render(), 1)
								}
							}
						}
					}
				}
			}
		}

		message := model.NewMessage(teamId, post.ChannelId, post.UserId, model.ACTION_POSTED)
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

func fireAndForgetMentionUpdate(channelId, userId string) {
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

func searchPosts(c *Context, w http.ResponseWriter, r *http.Request) {
	terms := r.FormValue("terms")

	if len(terms) == 0 {
		c.SetInvalidParam("search", "terms")
		return
	}

	hashtagTerms, plainTerms := model.ParseHashtags(terms)

	var hchan store.StoreChannel
	if len(hashtagTerms) != 0 {
		hchan = Srv.Store.Post().Search(c.Session.TeamId, c.Session.UserId, hashtagTerms, true)
	}

	var pchan store.StoreChannel
	if len(plainTerms) != 0 {
		pchan = Srv.Store.Post().Search(c.Session.TeamId, c.Session.UserId, terms, false)
	}

	mainList := &model.PostList{}
	if hchan != nil {
		if result := <-hchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			mainList = result.Data.(*model.PostList)
		}
	}

	plainList := &model.PostList{}
	if pchan != nil {
		if result := <-pchan; result.Err != nil {
			c.Err = result.Err
			return
		} else {
			plainList = result.Data.(*model.PostList)
		}
	}

	for _, postId := range plainList.Order {
		if _, ok := mainList.Posts[postId]; !ok {
			mainList.AddPost(plainList.Posts[postId])
			mainList.AddOrder(postId)
		}

	}

	w.Write([]byte(mainList.ToJson()))
}
