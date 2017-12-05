// Copyright (c) 2016-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package app

import (
	"encoding/json"
	"fmt"
	"net/http"
	"regexp"
	"strings"

	l4g "github.com/alecthomas/log4go"
	"github.com/dyatlov/go-opengraph/opengraph"
	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/store"
	"github.com/mattermost/mattermost-server/utils"
)

var linkWithTextRegex = regexp.MustCompile(`<([^<\|]+)\|([^>]+)>`)

func (a *App) CreatePostAsUser(post *model.Post) (*model.Post, *model.AppError) {
	// Check that channel has not been deleted
	var channel *model.Channel
	if result := <-a.Srv.Store.Channel().Get(post.ChannelId, true); result.Err != nil {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.channel_id"}, result.Err.Error(), http.StatusBadRequest)
		return nil, err
	} else {
		channel = result.Data.(*model.Channel)
	}

	if strings.HasPrefix(post.Type, model.POST_SYSTEM_MESSAGE_PREFIX) {
		err := model.NewAppError("CreatePostAsUser", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.type"}, "", http.StatusBadRequest)
		return nil, err
	}

	if channel.DeleteAt != 0 {
		err := model.NewAppError("createPost", "api.post.create_post.can_not_post_to_deleted.error", nil, "", http.StatusBadRequest)
		return nil, err
	}

	if rp, err := a.CreatePost(post, channel, true); err != nil {
		if err.Id == "api.post.create_post.root_id.app_error" ||
			err.Id == "api.post.create_post.channel_root_id.app_error" ||
			err.Id == "api.post.create_post.parent_id.app_error" {
			err.StatusCode = http.StatusBadRequest
		}

		if err.Id == "api.post.create_post.town_square_read_only" {
			uchan := a.Srv.Store.User().Get(post.UserId)
			var user *model.User
			if result := <-uchan; result.Err != nil {
				return nil, result.Err
			} else {
				user = result.Data.(*model.User)
			}

			T := utils.GetUserTranslations(user.Locale)
			a.SendEphemeralPost(
				post.UserId,
				&model.Post{
					ChannelId: channel.Id,
					ParentId:  post.ParentId,
					RootId:    post.RootId,
					UserId:    post.UserId,
					Message:   T("api.post.create_post.town_square_read_only"),
					CreateAt:  model.GetMillis() + 1,
				},
			)
		}

		return nil, err
	} else {
		// Update the LastViewAt only if the post does not have from_webhook prop set (eg. Zapier app)
		if _, ok := post.Props["from_webhook"]; !ok {
			if result := <-a.Srv.Store.Channel().UpdateLastViewedAt([]string{post.ChannelId}, post.UserId); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.last_viewed.error"), post.ChannelId, post.UserId, result.Err)
			}

			if *a.Config().ServiceSettings.EnableChannelViewedMessages {
				message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_CHANNEL_VIEWED, "", "", post.UserId, nil)
				message.Add("channel_id", post.ChannelId)
				a.Go(func() {
					a.Publish(message)
				})
			}
		}

		return rp, nil
	}

}

func (a *App) CreatePostMissingChannel(post *model.Post, triggerWebhooks bool) (*model.Post, *model.AppError) {
	var channel *model.Channel
	cchan := a.Srv.Store.Channel().Get(post.ChannelId, true)
	if result := <-cchan; result.Err != nil {
		return nil, result.Err
	} else {
		channel = result.Data.(*model.Channel)
	}

	return a.CreatePost(post, channel, triggerWebhooks)
}

func (a *App) CreatePost(post *model.Post, channel *model.Channel, triggerWebhooks bool) (*model.Post, *model.AppError) {
	post.SanitizeProps()

	var pchan store.StoreChannel
	if len(post.RootId) > 0 {
		pchan = a.Srv.Store.Post().Get(post.RootId)
	}

	uchan := a.Srv.Store.User().Get(post.UserId)
	var user *model.User
	if result := <-uchan; result.Err != nil {
		return nil, result.Err
	} else {
		user = result.Data.(*model.User)
	}

	if utils.IsLicensed() && *a.Config().TeamSettings.ExperimentalTownSquareIsReadOnly &&
		!post.IsSystemMessage() &&
		channel.Name == model.DEFAULT_CHANNEL &&
		!a.CheckIfRolesGrantPermission(user.GetRoles(), model.PERMISSION_MANAGE_SYSTEM.Id) {
		return nil, model.NewAppError("createPost", "api.post.create_post.town_square_read_only", nil, "", http.StatusForbidden)
	}

	// Verify the parent/child relationships are correct
	var parentPostList *model.PostList
	if pchan != nil {
		if presult := <-pchan; presult.Err != nil {
			return nil, model.NewAppError("createPost", "api.post.create_post.root_id.app_error", nil, "", http.StatusBadRequest)
		} else {
			parentPostList = presult.Data.(*model.PostList)
			if len(parentPostList.Posts) == 0 || !parentPostList.IsChannelId(post.ChannelId) {
				return nil, model.NewAppError("createPost", "api.post.create_post.channel_root_id.app_error", nil, "", http.StatusInternalServerError)
			}

			if post.ParentId == "" {
				post.ParentId = post.RootId
			}

			if post.RootId != post.ParentId {
				parent := parentPostList.Posts[post.ParentId]
				if parent == nil {
					return nil, model.NewAppError("createPost", "api.post.create_post.parent_id.app_error", nil, "", http.StatusInternalServerError)
				}
			}
		}
	}

	post.Hashtags, _ = model.ParseHashtags(post.Message)

	if err := a.FillInPostProps(post, channel); err != nil {
		return nil, err
	}

	var rpost *model.Post
	if result := <-a.Srv.Store.Post().Save(post); result.Err != nil {
		return nil, result.Err
	} else {
		rpost = result.Data.(*model.Post)
	}

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
		a.Go(func() {
			esInterface.IndexPost(rpost, channel.TeamId)
		})
	}

	if a.Metrics != nil {
		a.Metrics.IncrementPostCreate()
	}

	if len(post.FileIds) > 0 {
		// There's a rare bug where the client sends up duplicate FileIds so protect against that
		post.FileIds = utils.RemoveDuplicatesFromStringArray(post.FileIds)

		for _, fileId := range post.FileIds {
			if result := <-a.Srv.Store.FileInfo().AttachToPost(fileId, post.Id); result.Err != nil {
				l4g.Error(utils.T("api.post.create_post.attach_files.error"), post.Id, post.FileIds, post.UserId, result.Err)
			}
		}

		if a.Metrics != nil {
			a.Metrics.IncrementPostFileAttachment(len(post.FileIds))
		}
	}

	if err := a.handlePostEvents(rpost, user, channel, triggerWebhooks, parentPostList); err != nil {
		return nil, err
	}

	return rpost, nil
}

// FillInPostProps should be invoked before saving posts to fill in properties such as
// channel_mentions.
//
// If channel is nil, FillInPostProps will look up the channel corresponding to the post.
func (a *App) FillInPostProps(post *model.Post, channel *model.Channel) *model.AppError {
	channelMentions := post.ChannelMentions()
	channelMentionsProp := make(map[string]interface{})

	if len(channelMentions) > 0 {
		if channel == nil {
			result := <-a.Srv.Store.Channel().GetForPost(post.Id)
			if result.Err != nil {
				return model.NewAppError("FillInPostProps", "api.context.invalid_param.app_error", map[string]interface{}{"Name": "post.channel_id"}, result.Err.Error(), http.StatusBadRequest)
			}
			channel = result.Data.(*model.Channel)
		}

		mentionedChannels, err := a.GetChannelsByNames(channelMentions, channel.TeamId)
		if err != nil {
			return err
		}

		for _, mentioned := range mentionedChannels {
			if mentioned.Type == model.CHANNEL_OPEN {
				channelMentionsProp[mentioned.Name] = map[string]interface{}{
					"display_name": mentioned.DisplayName,
				}
			}
		}
	}

	if len(channelMentionsProp) > 0 {
		post.AddProp("channel_mentions", channelMentionsProp)
	} else if post.Props != nil {
		delete(post.Props, "channel_mentions")
	}

	return nil
}

func (a *App) handlePostEvents(post *model.Post, user *model.User, channel *model.Channel, triggerWebhooks bool, parentPostList *model.PostList) *model.AppError {
	var tchan store.StoreChannel
	if len(channel.TeamId) > 0 {
		tchan = a.Srv.Store.Team().Get(channel.TeamId)
	}

	var team *model.Team
	if tchan != nil {
		if result := <-tchan; result.Err != nil {
			return result.Err
		} else {
			team = result.Data.(*model.Team)
		}
	} else {
		// Blank team for DMs
		team = &model.Team{}
	}

	a.InvalidateCacheForChannel(channel)
	a.InvalidateCacheForChannelPosts(channel.Id)

	if _, err := a.SendNotifications(post, team, channel, user, parentPostList); err != nil {
		return err
	}

	if triggerWebhooks {
		a.Go(func() {
			if err := a.handleWebhookEvents(post, team, channel, user); err != nil {
				l4g.Error(err.Error())
			}
		})
	}

	return nil
}

// This method only parses and processes the attachments,
// all else should be set in the post which is passed
func parseSlackAttachment(post *model.Post, attachments []*model.SlackAttachment) {
	post.Type = model.POST_SLACK_ATTACHMENT

	for _, attachment := range attachments {
		attachment.Text = parseSlackLinksToMarkdown(attachment.Text)
		attachment.Pretext = parseSlackLinksToMarkdown(attachment.Pretext)

		for _, field := range attachment.Fields {
			if value, ok := field.Value.(string); ok {
				field.Value = parseSlackLinksToMarkdown(value)
			}
		}
	}
	post.AddProp("attachments", attachments)
}

func parseSlackLinksToMarkdown(text string) string {
	return linkWithTextRegex.ReplaceAllString(text, "[${2}](${1})")
}

func (a *App) SendEphemeralPost(userId string, post *model.Post) *model.Post {
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

	a.Go(func() {
		a.Publish(message)
	})

	return post
}

func (a *App) UpdatePost(post *model.Post, safeUpdate bool) (*model.Post, *model.AppError) {
	post.SanitizeProps()

	var oldPost *model.Post
	if result := <-a.Srv.Store.Post().Get(post.Id); result.Err != nil {
		return nil, result.Err
	} else {
		oldPost = result.Data.(*model.PostList).Posts[post.Id]

		if utils.IsLicensed() {
			if *a.Config().ServiceSettings.AllowEditPost == model.ALLOW_EDIT_POST_NEVER && post.Message != oldPost.Message {
				err := model.NewAppError("UpdatePost", "api.post.update_post.permissions_denied.app_error", nil, "", http.StatusForbidden)
				return nil, err
			}
		}

		if oldPost == nil {
			err := model.NewAppError("UpdatePost", "api.post.update_post.find.app_error", nil, "id="+post.Id, http.StatusBadRequest)
			return nil, err
		}

		if oldPost.DeleteAt != 0 {
			err := model.NewAppError("UpdatePost", "api.post.update_post.permissions_details.app_error", map[string]interface{}{"PostId": post.Id}, "", http.StatusBadRequest)
			return nil, err
		}

		if oldPost.IsSystemMessage() {
			err := model.NewAppError("UpdatePost", "api.post.update_post.system_message.app_error", nil, "id="+post.Id, http.StatusBadRequest)
			return nil, err
		}

		if utils.IsLicensed() {
			if *a.Config().ServiceSettings.AllowEditPost == model.ALLOW_EDIT_POST_TIME_LIMIT && model.GetMillis() > oldPost.CreateAt+int64(*a.Config().ServiceSettings.PostEditTimeLimit*1000) && post.Message != oldPost.Message {
				err := model.NewAppError("UpdatePost", "api.post.update_post.permissions_time_limit.app_error", map[string]interface{}{"timeLimit": *a.Config().ServiceSettings.PostEditTimeLimit}, "", http.StatusBadRequest)
				return nil, err
			}
		}
	}

	newPost := &model.Post{}
	*newPost = *oldPost

	if newPost.Message != post.Message {
		newPost.Message = post.Message
		newPost.EditAt = model.GetMillis()
		newPost.Hashtags, _ = model.ParseHashtags(post.Message)
	}

	if !safeUpdate {
		newPost.IsPinned = post.IsPinned
		newPost.HasReactions = post.HasReactions
		newPost.FileIds = post.FileIds
		newPost.Props = post.Props
	}

	if err := a.FillInPostProps(post, nil); err != nil {
		return nil, err
	}

	if result := <-a.Srv.Store.Post().Update(newPost, oldPost); result.Err != nil {
		return nil, result.Err
	} else {
		rpost := result.Data.(*model.Post)

		esInterface := a.Elasticsearch
		if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
			a.Go(func() {
				if rchannel := <-a.Srv.Store.Channel().GetForPost(rpost.Id); rchannel.Err != nil {
					l4g.Error("Couldn't get channel %v for post %v for Elasticsearch indexing.", rpost.ChannelId, rpost.Id)
				} else {
					esInterface.IndexPost(rpost, rchannel.Data.(*model.Channel).TeamId)
				}
			})
		}

		a.sendUpdatedPostEvent(rpost)

		a.InvalidateCacheForChannelPosts(rpost.ChannelId)

		return rpost, nil
	}
}

func (a *App) PatchPost(postId string, patch *model.PostPatch) (*model.Post, *model.AppError) {
	post, err := a.GetSinglePost(postId)
	if err != nil {
		return nil, err
	}

	post.Patch(patch)

	updatedPost, err := a.UpdatePost(post, false)
	if err != nil {
		return nil, err
	}

	return updatedPost, nil
}

func (a *App) sendUpdatedPostEvent(post *model.Post) {
	message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_EDITED, "", post.ChannelId, "", nil)
	message.Add("post", post.ToJson())

	a.Go(func() {
		a.Publish(message)
	})
}

func (a *App) GetPostsPage(channelId string, page int, perPage int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetPosts(channelId, page*perPage, perPage, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetPosts(channelId string, offset int, limit int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetPosts(channelId, offset, limit, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetPostsEtag(channelId string) string {
	return (<-a.Srv.Store.Post().GetEtag(channelId, true)).Data.(string)
}

func (a *App) GetPostsSince(channelId string, time int64) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetPostsSince(channelId, time, true); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetSinglePost(postId string) (*model.Post, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetSingle(postId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.Post), nil
	}
}

func (a *App) GetPostThread(postId string) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().Get(postId); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetFlaggedPosts(userId string, offset int, limit int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetFlaggedPosts(userId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetFlaggedPostsForTeam(userId, teamId string, offset int, limit int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetFlaggedPostsForTeam(userId, teamId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetFlaggedPostsForChannel(userId, channelId string, offset int, limit int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetFlaggedPostsForChannel(userId, channelId, offset, limit); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetPermalinkPost(postId string, userId string) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().Get(postId); result.Err != nil {
		return nil, result.Err
	} else {
		list := result.Data.(*model.PostList)

		if len(list.Order) != 1 {
			return nil, model.NewAppError("getPermalinkTmp", "api.post_get_post_by_id.get.app_error", nil, "", http.StatusNotFound)
		}
		post := list.Posts[list.Order[0]]

		var channel *model.Channel
		var err *model.AppError
		if channel, err = a.GetChannel(post.ChannelId); err != nil {
			return nil, err
		}

		if err = a.JoinChannel(channel, userId); err != nil {
			return nil, err
		}

		return list, nil
	}
}

func (a *App) GetPostsBeforePost(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetPostsBefore(channelId, postId, perPage, page*perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetPostsAfterPost(channelId, postId string, page, perPage int) (*model.PostList, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetPostsAfter(channelId, postId, perPage, page*perPage); result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) GetPostsAroundPost(postId, channelId string, offset, limit int, before bool) (*model.PostList, *model.AppError) {
	var pchan store.StoreChannel
	if before {
		pchan = a.Srv.Store.Post().GetPostsBefore(channelId, postId, limit, offset)
	} else {
		pchan = a.Srv.Store.Post().GetPostsAfter(channelId, postId, limit, offset)
	}

	if result := <-pchan; result.Err != nil {
		return nil, result.Err
	} else {
		return result.Data.(*model.PostList), nil
	}
}

func (a *App) DeletePost(postId string) (*model.Post, *model.AppError) {
	if result := <-a.Srv.Store.Post().GetSingle(postId); result.Err != nil {
		result.Err.StatusCode = http.StatusBadRequest
		return nil, result.Err
	} else {
		post := result.Data.(*model.Post)

		if result := <-a.Srv.Store.Post().Delete(postId, model.GetMillis()); result.Err != nil {
			return nil, result.Err
		}

		message := model.NewWebSocketEvent(model.WEBSOCKET_EVENT_POST_DELETED, "", post.ChannelId, "", nil)
		message.Add("post", post.ToJson())

		a.Go(func() {
			a.Publish(message)
		})
		a.Go(func() {
			a.DeletePostFiles(post)
		})
		a.Go(func() {
			a.DeleteFlaggedPosts(post.Id)
		})

		esInterface := a.Elasticsearch
		if esInterface != nil && *a.Config().ElasticsearchSettings.EnableIndexing {
			a.Go(func() {
				esInterface.DeletePost(post)
			})
		}

		a.InvalidateCacheForChannelPosts(post.ChannelId)

		return post, nil
	}
}

func (a *App) DeleteFlaggedPosts(postId string) {
	if result := <-a.Srv.Store.Preference().DeleteCategoryAndName(model.PREFERENCE_CATEGORY_FLAGGED_POST, postId); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_flagged_post.app_error.warn"), result.Err)
		return
	}
}

func (a *App) DeletePostFiles(post *model.Post) {
	if len(post.FileIds) != 0 {
		return
	}

	if result := <-a.Srv.Store.FileInfo().DeleteForPost(post.Id); result.Err != nil {
		l4g.Warn(utils.T("api.post.delete_post_files.app_error.warn"), post.Id, result.Err)
	}
}

func (a *App) SearchPostsInTeam(terms string, userId string, teamId string, isOrSearch bool) (*model.PostList, *model.AppError) {
	paramsList := model.ParseSearchParams(terms)

	esInterface := a.Elasticsearch
	if esInterface != nil && *a.Config().ElasticsearchSettings.EnableSearching && utils.IsLicensed() && *utils.License().Features.Elasticsearch {
		finalParamsList := []*model.SearchParams{}

		for _, params := range paramsList {
			params.OrTerms = isOrSearch
			// Don't allow users to search for "*"
			if params.Terms != "*" {
				// Convert channel names to channel IDs
				for idx, channelName := range params.InChannels {
					if channel, err := a.GetChannelByName(channelName, teamId); err != nil {
						l4g.Error(err)
					} else {
						params.InChannels[idx] = channel.Id
					}
				}

				// Convert usernames to user IDs
				for idx, username := range params.FromUsers {
					if user, err := a.GetUserByUsername(username); err != nil {
						l4g.Error(err)
					} else {
						params.FromUsers[idx] = user.Id
					}
				}

				finalParamsList = append(finalParamsList, params)
			}
		}

		// If the processed search params are empty, return empty search results.
		if len(finalParamsList) == 0 {
			return model.NewPostList(), nil
		}

		// We only allow the user to search in channels they are a member of.
		userChannels, err := a.GetChannelsForUser(teamId, userId)
		if err != nil {
			l4g.Error(err)
			return nil, err
		}

		postIds, err := a.Elasticsearch.SearchPosts(userChannels, finalParamsList)
		if err != nil {
			return nil, err
		}

		// Get the posts
		postList := model.NewPostList()
		if len(postIds) > 0 {
			if presult := <-a.Srv.Store.Post().GetPostsByIds(postIds); presult.Err != nil {
				return nil, presult.Err
			} else {
				for _, p := range presult.Data.([]*model.Post) {
					postList.AddPost(p)
					postList.AddOrder(p.Id)
				}
			}
		}

		return postList, nil
	} else {
		if !*a.Config().ServiceSettings.EnablePostSearch {
			return nil, model.NewAppError("SearchPostsInTeam", "store.sql_post.search.disabled", nil, fmt.Sprintf("teamId=%v userId=%v", teamId, userId), http.StatusNotImplemented)
		}

		channels := []store.StoreChannel{}

		for _, params := range paramsList {
			params.OrTerms = isOrSearch
			// don't allow users to search for everything
			if params.Terms != "*" {
				channels = append(channels, a.Srv.Store.Post().Search(teamId, userId, params))
			}
		}

		posts := model.NewPostList()
		for _, channel := range channels {
			if result := <-channel; result.Err != nil {
				return nil, result.Err
			} else {
				data := result.Data.(*model.PostList)
				posts.Extend(data)
			}
		}

		posts.SortByCreateAt()

		return posts, nil
	}
}

func (a *App) GetFileInfosForPost(postId string, readFromMaster bool) ([]*model.FileInfo, *model.AppError) {
	pchan := a.Srv.Store.Post().GetSingle(postId)
	fchan := a.Srv.Store.FileInfo().GetForPost(postId, readFromMaster, true)

	var infos []*model.FileInfo
	if result := <-fchan; result.Err != nil {
		return nil, result.Err
	} else {
		infos = result.Data.([]*model.FileInfo)
	}

	if len(infos) == 0 {
		// No FileInfos were returned so check if they need to be created for this post
		var post *model.Post
		if result := <-pchan; result.Err != nil {
			return nil, result.Err
		} else {
			post = result.Data.(*model.Post)
		}

		if len(post.Filenames) > 0 {
			a.Srv.Store.FileInfo().InvalidateFileInfosForPostCache(postId)
			// The post has Filenames that need to be replaced with FileInfos
			infos = a.MigrateFilenamesToFileInfos(post)
		}
	}

	return infos, nil
}

func (a *App) GetOpenGraphMetadata(url string) *opengraph.OpenGraph {
	og := opengraph.NewOpenGraph()

	res, err := a.HTTPClient(false).Get(url)
	if err != nil {
		l4g.Error("GetOpenGraphMetadata request failed for url=%v with err=%v", url, err.Error())
		return og
	}
	defer consumeAndClose(res)

	if err := og.ProcessHTML(res.Body); err != nil {
		l4g.Error("GetOpenGraphMetadata processing failed for url=%v with err=%v", url, err.Error())
	}

	return og
}

func (a *App) DoPostAction(postId string, actionId string, userId string) *model.AppError {
	pchan := a.Srv.Store.Post().GetSingle(postId)

	var post *model.Post
	if result := <-pchan; result.Err != nil {
		return result.Err
	} else {
		post = result.Data.(*model.Post)
	}

	action := post.GetAction(actionId)
	if action == nil || action.Integration == nil {
		return model.NewAppError("DoPostAction", "api.post.do_action.action_id.app_error", nil, fmt.Sprintf("action=%v", action), http.StatusNotFound)
	}

	request := &model.PostActionIntegrationRequest{
		UserId:  userId,
		Context: action.Integration.Context,
	}

	req, _ := http.NewRequest("POST", action.Integration.URL, strings.NewReader(request.ToJson()))
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")
	resp, err := a.HTTPClient(false).Do(req)
	if err != nil {
		return model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "err="+err.Error(), http.StatusBadRequest)
	}
	defer consumeAndClose(resp)

	if resp.StatusCode != http.StatusOK {
		return model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, fmt.Sprintf("status=%v", resp.StatusCode), http.StatusBadRequest)
	}

	var response model.PostActionIntegrationResponse
	if err := json.NewDecoder(resp.Body).Decode(&response); err != nil {
		return model.NewAppError("DoPostAction", "api.post.do_action.action_integration.app_error", nil, "err="+err.Error(), http.StatusBadRequest)
	}

	retainedProps := []string{"override_username", "override_icon_url"}

	if response.Update != nil {
		response.Update.Id = postId
		response.Update.AddProp("from_webhook", "true")
		for _, prop := range retainedProps {
			if value, ok := post.Props[prop]; ok {
				response.Update.Props[prop] = value
			} else {
				delete(response.Update.Props, prop)
			}
		}
		if _, err := a.UpdatePost(response.Update, false); err != nil {
			return err
		}
	}

	if response.EphemeralText != "" {
		ephemeralPost := &model.Post{}
		ephemeralPost.Message = parseSlackLinksToMarkdown(response.EphemeralText)
		ephemeralPost.ChannelId = post.ChannelId
		ephemeralPost.RootId = post.RootId
		if ephemeralPost.RootId == "" {
			ephemeralPost.RootId = post.Id
		}
		ephemeralPost.UserId = post.UserId
		ephemeralPost.AddProp("from_webhook", "true")
		for _, prop := range retainedProps {
			if value, ok := post.Props[prop]; ok {
				ephemeralPost.Props[prop] = value
			} else {
				delete(ephemeralPost.Props, prop)
			}
		}
		a.SendEphemeralPost(userId, ephemeralPost)
	}

	return nil
}
