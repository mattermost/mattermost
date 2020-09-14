// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"errors"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/services/searchengine"
	"github.com/mattermost/mattermost-server/v5/store"
)

type SearchPostStore struct {
	store.PostStore
	rootStore *SearchStore
}

func (s SearchPostStore) indexPost(post *model.Post) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				channel, chanErr := s.rootStore.Channel().Get(post.ChannelId, true)
				if chanErr != nil {
					mlog.Error("Couldn't get channel for post for SearchEngine indexing.", mlog.String("channel_id", post.ChannelId), mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", post.Id), mlog.Err(chanErr))
					return
				}
				if err := engineCopy.IndexPost(post, channel.TeamId); err != nil {
					mlog.Error("Encountered error indexing post", mlog.String("post_id", post.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
				}
				mlog.Debug("Indexed post in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", post.Id))
			})
		}
	}
}

func (s SearchPostStore) deletePostIndex(post *model.Post) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeletePost(post); err != nil {
					mlog.Error("Encountered error deleting post", mlog.String("post_id", post.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
				}
				mlog.Debug("Removed post from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", post.Id))
			})
		}
	}
}

func (s SearchPostStore) deleteChannelPostsIndex(channelID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteChannelPosts(channelID); err != nil {
					mlog.Error("Encountered error deleting channel posts", mlog.String("channel_id", channelID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
				}
				mlog.Debug("Removed all channel posts from the index in search engine", mlog.String("channel_id", channelID), mlog.String("search_engine", engineCopy.GetName()))
			})
		}
	}
}

func (s SearchPostStore) deleteUserPostsIndex(userID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUserPosts(userID); err != nil {
					mlog.Error("Encountered error deleting user posts", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
				}
				mlog.Debug("Removed all user posts from the index in search engine", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()))
			})
		}
	}
}

func (s SearchPostStore) Update(newPost, oldPost *model.Post) (*model.Post, error) {
	post, err := s.PostStore.Update(newPost, oldPost)

	if err == nil {
		s.indexPost(post)
	}
	return post, err
}

func (s *SearchPostStore) Overwrite(post *model.Post) (*model.Post, *model.AppError) {
	post, err := s.PostStore.Overwrite(post)
	if err == nil {
		s.indexPost(post)
	}
	return post, err
}

func (s SearchPostStore) Save(post *model.Post) (*model.Post, error) {
	npost, err := s.PostStore.Save(post)

	if err == nil {
		s.indexPost(npost)
	}
	return npost, err
}

func (s SearchPostStore) Delete(postId string, date int64, deletedByID string) error {
	err := s.PostStore.Delete(postId, date, deletedByID)

	if err == nil {
		postList, err2 := s.PostStore.Get(postId, true)
		if postList != nil && len(postList.Order) > 0 {
			if err2 != nil {
				s.deletePostIndex(postList.Posts[postList.Order[0]])
			}
		}
	}
	return err
}

func (s SearchPostStore) PermanentDeleteByUser(userID string) error {
	err := s.PostStore.PermanentDeleteByUser(userID)
	if err == nil {
		s.deleteUserPostsIndex(userID)
	}
	return err
}

func (s SearchPostStore) PermanentDeleteByChannel(channelID string) error {
	err := s.PostStore.PermanentDeleteByChannel(channelID)
	if err == nil {
		s.deleteChannelPostsIndex(channelID)
	}
	return err
}

func (s SearchPostStore) searchPostsInTeamForUserByEngine(engine searchengine.SearchEngineInterface, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, *model.AppError) {
	if err := model.IsSearchParamsListValid(paramsList); err != nil {
		return nil, err
	}

	// We only allow the user to search in channels they are a member of.
	userChannels, nErr := s.rootStore.Channel().GetChannels(teamId, userId, paramsList[0].IncludeDeletedChannels, 0)
	if nErr != nil {
		mlog.Error("error getting channel for user", mlog.Err(nErr))
		var nfErr *store.ErrNotFound
		switch {
		// TODO: This error key would go away once this store method is migrated to return plain errors
		case errors.As(nErr, &nfErr):
			return nil, model.NewAppError("searchPostsInTeamForUserByEngine", "app.channel.get_channels.not_found.app_error", nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("searchPostsInTeamForUserByEngine", "app.channel.get_channels.get.app_error", nil, nErr.Error(), http.StatusInternalServerError)
		}
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

func (s SearchPostStore) SearchPostsInTeamForUser(paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.PostSearchResults, *model.AppError) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			results, err := s.searchPostsInTeamForUserByEngine(engine, paramsList, userId, teamId, page, perPage)
			if err != nil {
				mlog.Error("Encountered error on SearchPostsInTeamForUser.", mlog.String("search_engine", engine.GetName()), mlog.Err(err))
				continue
			}
			mlog.Debug("Using the first available search engine", mlog.String("search_engine", engine.GetName()))
			return results, err
		}
	}

	if *s.rootStore.config.SqlSettings.DisableDatabaseSearch {
		mlog.Debug("Returning empty results for post SearchPostsInTeam as the database search is disabled")
		return &model.PostSearchResults{PostList: model.NewPostList(), Matches: model.PostSearchMatches{}}, nil
	}

	mlog.Debug("Using database search because no other search engine is available")
	return s.PostStore.SearchPostsInTeamForUser(paramsList, userId, teamId, page, perPage)
}
