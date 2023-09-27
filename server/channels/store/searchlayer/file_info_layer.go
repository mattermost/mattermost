// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
	"github.com/mattermost/mattermost/server/v8/platform/services/searchengine"
)

type SearchFileInfoStore struct {
	store.FileInfoStore
	rootStore *SearchStore
}

func (s SearchFileInfoStore) indexFile(c *request.Context, file *model.FileInfo) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(c, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if file.PostId == "" {
					return
				}
				post, postErr := s.rootStore.Post().GetSingle(file.PostId, false)
				if postErr != nil {
					c.Logger().Error("Couldn't get post for file for SearchEngine indexing.", mlog.String("post_id", file.PostId), mlog.String("search_engine", engineCopy.GetName()), mlog.String("file_info_id", file.Id), mlog.Err(postErr))
					return
				}

				if err := engineCopy.IndexFile(file, post.ChannelId); err != nil {
					c.Logger().Error("Encountered error indexing file", mlog.String("file_info_id", file.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndex(c *request.Context, fileID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(c, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFile(fileID); err != nil {
					c.Logger().Error("Encountered error deleting file", mlog.String("file_info_id", fileID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexForUser(c *request.Context, userID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(c, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUserFiles(userID); err != nil {
					c.Logger().Error("Encountered error deleting files for user", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				c.Logger().Debug("Removed user's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", userID))
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexForPost(c *request.Context, postID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(c, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeletePostFiles(postID); err != nil {
					c.Logger().Error("Encountered error deleting files for post", mlog.String("post_id", postID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				c.Logger().Debug("Removed post's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", postID))
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexBatch(c *request.Context, endTime, limit int64) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(c, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFilesBatch(endTime, limit); err != nil {
					c.Logger().Error("Encountered error deleting a batch of files", mlog.Int64("limit", limit), mlog.Int64("end_time", endTime), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				c.Logger().Debug("Removed batch of files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.Int64("end_time", endTime), mlog.Int64("limit", limit))
			})
		}
	}
}

func (s SearchFileInfoStore) Save(c *request.Context, info *model.FileInfo) (*model.FileInfo, error) {
	nfile, err := s.FileInfoStore.Save(info)
	if err == nil {
		s.indexFile(c, nfile)
	}
	return nfile, err
}

func (s SearchFileInfoStore) SetContent(c *request.Context, fileID, content string) error {
	err := s.FileInfoStore.SetContent(fileID, content)
	if err == nil {
		nfile, err2 := s.FileInfoStore.GetFromMaster(fileID)
		if err2 == nil {
			nfile.Content = content
			s.indexFile(c, nfile)
		}
	}
	return err
}

func (s SearchFileInfoStore) AttachToPost(c *request.Context, fileId, postId, channelId, creatorId string) error {
	err := s.FileInfoStore.AttachToPost(fileId, postId, channelId, creatorId)
	if err == nil {
		nFileInfo, err2 := s.FileInfoStore.GetFromMaster(fileId)
		if err2 == nil {
			s.indexFile(c, nFileInfo)
		}
	}
	return err
}

func (s SearchFileInfoStore) DeleteForPost(c *request.Context, postId string) (string, error) {
	result, err := s.FileInfoStore.DeleteForPost(postId)
	if err == nil {
		s.deleteFileIndexForPost(c, postId)
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDelete(c *request.Context, fileId string) error {
	err := s.FileInfoStore.PermanentDelete(fileId)
	if err == nil {
		s.deleteFileIndex(c, fileId)
	}
	return err
}

func (s SearchFileInfoStore) PermanentDeleteBatch(c *request.Context, endTime int64, limit int64) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteBatch(endTime, limit)
	if err == nil {
		s.deleteFileIndexBatch(c, endTime, limit)
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDeleteByUser(c *request.Context, userId string) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteByUser(userId)
	if err == nil {
		s.deleteFileIndexForUser(c, userId)
	}
	return result, err
}

func (s SearchFileInfoStore) Search(paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.FileInfoList, error) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsSearchEnabled() {
			userChannels, nErr := s.rootStore.Channel().GetChannels(teamId, userId, &model.ChannelSearchOpts{
				IncludeDeleted: paramsList[0].IncludeDeletedChannels,
				LastDeleteAt:   0,
			})
			if nErr != nil {
				return nil, nErr
			}
			fileIds, appErr := engine.SearchFiles(userChannels, paramsList, page, perPage)
			if appErr != nil {
				mlog.Error("Encountered error on Search.", mlog.String("search_engine", engine.GetName()), mlog.Err(appErr))
				continue
			}

			// Get the files
			filesList := model.NewFileInfoList()
			if len(fileIds) > 0 {
				files, nErr := s.FileInfoStore.GetByIds(fileIds)
				if nErr != nil {
					return nil, nErr
				}
				for _, f := range files {
					filesList.AddFileInfo(f)
					filesList.AddOrder(f.Id)
				}
			}
			return filesList, nil
		}
	}

	if *s.rootStore.getConfig().SqlSettings.DisableDatabaseSearch {
		return model.NewFileInfoList(), nil
	}

	return s.FileInfoStore.Search(paramsList, userId, teamId, page, perPage)
}
