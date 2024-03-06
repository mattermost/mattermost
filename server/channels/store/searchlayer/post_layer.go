// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"context"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type SearchPostStore struct {
	store.PostStore
	rootStore *SearchStore
}

func (s SearchPostStore) indexPost(rctx request.CTX, post *model.Post) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				channel, chanErr := s.rootStore.Channel().Get(post.ChannelId, true)
				if chanErr != nil {
					rctx.Logger().Error("Couldn't get channel for post for SearchEngine indexing.", mlog.String("channel_id", post.ChannelId), mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", post.Id), mlog.Err(chanErr))
					return
				}
				if err := engineCopy.IndexPost(post, channel.TeamId); err != nil {
					rctx.Logger().Warn("Encountered error indexing post", mlog.String("post_id", post.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchPostStore) deletePostIndex(rctx request.CTX, post *model.Post) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeletePost(post); err != nil {
					rctx.Logger().Warn("Encountered error deleting post", mlog.String("post_id", post.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchPostStore) deleteChannelPostsIndex(rctx request.CTX, channelID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteChannelPosts(rctx, channelID); err != nil {
					rctx.Logger().Warn("Encountered error deleting channel posts", mlog.String("channel_id", channelID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed all channel posts from the index in search engine", mlog.String("channel_id", channelID), mlog.String("search_engine", engineCopy.GetName()))
			})
		}
	}
}

func (s SearchPostStore) deleteUserPostsIndex(rctx request.CTX, userID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUserPosts(rctx, userID); err != nil {
					rctx.Logger().Warn("Encountered error deleting user posts", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed all user posts from the index in search engine", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()))
			})
		}
	}
}

func (s SearchPostStore) Update(rctx request.CTX, newPost, oldPost *model.Post) (*model.Post, error) {
	post, err := s.PostStore.Update(rctx, newPost, oldPost)

	if err == nil {
		s.indexPost(rctx, post)
	}
	return post, err
}

func (s *SearchPostStore) Overwrite(rctx request.CTX, post *model.Post) (*model.Post, error) {
	post, err := s.PostStore.Overwrite(rctx, post)
	if err == nil {
		s.indexPost(rctx, post)
	}
	return post, err
}

func (s SearchPostStore) Save(rctx request.CTX, post *model.Post) (*model.Post, error) {
	npost, err := s.PostStore.Save(rctx, post)

	if err == nil {
		s.indexPost(rctx, npost)
	}
	return npost, err
}

func (s SearchPostStore) Delete(rctx request.CTX, postId string, date int64, deletedByID string) error {
	err := s.PostStore.Delete(rctx, postId, date, deletedByID)

	if err == nil {
		opts := model.GetPostsOptions{
			SkipFetchThreads: true,
		}
		postList, err2 := s.PostStore.Get(context.Background(), postId, opts, "", map[string]bool{})
		if postList != nil && len(postList.Order) > 0 {
			if err2 != nil {
				s.deletePostIndex(rctx, postList.Posts[postList.Order[0]])
			}
		}
	}
	return err
}

func (s SearchPostStore) PermanentDeleteByUser(rctx request.CTX, userID string) error {
	err := s.PostStore.PermanentDeleteByUser(rctx, userID)
	if err == nil {
		s.deleteUserPostsIndex(rctx, userID)
	}
	return err
}

func (s SearchPostStore) PermanentDeleteByChannel(rctx request.CTX, channelID string) error {
	err := s.PostStore.PermanentDeleteByChannel(rctx, channelID)
	if err == nil {
		s.deleteChannelPostsIndex(rctx, channelID)
	}
	return err
}

func (s SearchPostStore) searchPostsForUserByEngine(engine searchengine.SearchEngineInterface, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, error) {
	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}

	// We only allow the user to search in channels they are a member of.
	userChannels, err2 := s.rootStore.Channel().GetChannels(teamId, userId,
		&model.ChannelSearchOpts{
			IncludeDeleted: paramsList[0].IncludeDeletedChannels,
			LastDeleteAt:   0,
		})
	if err2 != nil {
		return nil, errors.Wrap(err2, "error getting channel for user")
	}

	postIds, matches, err := engine.SearchPosts(userChannels, paramsList, page, perPage)
	if err != nil {
		return nil, err
	}

	// Get the posts
	postList := model.NewPostList()
	if len(postIds) > 0 {
		posts, err := s.PostStore.GetPostsByIds(postIds)
		if err != nil {
			return nil, err
		}
		for _, p := range posts {
			if p.DeleteAt == 0 {
				postList.AddPost(p)
				postList.AddOrder(p.Id)
			}
		}
	}

	return model.MakePostSearchResults(postList, matches), nil
}

func (s SearchPostStore) SearchPostsForUser(rctx request.CTX, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, error) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			results, err := s.searchPostsForUserByEngine(engine, paramsList, userId, teamId, page, perPage)
			if err != nil {
				rctx.Logger().Warn("Encountered error on SearchPostsInTeamForUser.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			return results, err
		}
	}

	if *s.rootStore.getConfig().SqlSettings.DisableDatabaseSearch {
		return &model.PostSearchResults{PostList: model.NewPostList(), Matches: model.PostSearchMatches{}}, nil
	}

	return s.PostStore.SearchPostsForUser(rctx, paramsList, userId, teamId, page, perPage)
}
