// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"github.com/mattermost/mattermost-server/v6/channels/store"
	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/platform/services/searchengine"
	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

type SearchFileInfoStore struct {
	store.FileInfoStore
	rootStore *SearchStore
}

func (s SearchFileInfoStore) indexFile(file *model.FileInfo) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if file.PostId == "" {
					return
				}
				post, postErr := s.rootStore.Post().GetSingle(file.PostId, false)
				if postErr != nil {
					mlog.Error("Couldn't get post for file for SearchEngine indexing.", mlog.String("post_id", file.PostId), mlog.String("search_engine", engineCopy.GetName()), mlog.String("file_info_id", file.Id), mlog.Err(postErr))
					return
				}

				if err := engineCopy.IndexFile(file, post.ChannelId); err != nil {
					mlog.Error("Encountered error indexing file", mlog.String("file_info_id", file.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndex(fileID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFile(fileID); err != nil {
					mlog.Error("Encountered error deleting file", mlog.String("file_info_id", fileID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexForUser(userID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUserFiles(userID); err != nil {
					mlog.Error("Encountered error deleting files for user", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Removed user's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", userID))
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexForPost(postID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeletePostFiles(postID); err != nil {
					mlog.Error("Encountered error deleting files for post", mlog.String("post_id", postID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Removed post's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", postID))
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexBatch(endTime, limit int64) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFilesBatch(endTime, limit); err != nil {
					mlog.Error("Encountered error deleting a batch of files", mlog.Int64("limit", limit), mlog.Int64("end_time", endTime), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				mlog.Debug("Removed batch of files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.Int64("end_time", endTime), mlog.Int64("limit", limit))
			})
		}
	}
}

func (s SearchFileInfoStore) Save(info *model.FileInfo) (*model.FileInfo, error) {
	nfile, err := s.FileInfoStore.Save(info)
	if err == nil {
		s.indexFile(nfile)
	}
	return nfile, err
}

func (s SearchFileInfoStore) SetContent(fileID, content string) error {
	err := s.FileInfoStore.SetContent(fileID, content)
	if err == nil {
		nfile, err2 := s.FileInfoStore.GetFromMaster(fileID)
		if err2 == nil {
			nfile.Content = content
			s.indexFile(nfile)
		}
	}
	return err
}

func (s SearchFileInfoStore) AttachToPost(fileId, postId, creatorId string) error {
	err := s.FileInfoStore.AttachToPost(fileId, postId, creatorId)
	if err == nil {
		nFileInfo, err2 := s.FileInfoStore.GetFromMaster(fileId)
		if err2 == nil {
			s.indexFile(nFileInfo)
		}
	}
	return err
}

func (s SearchFileInfoStore) DeleteForPost(postId string) (string, error) {
	result, err := s.FileInfoStore.DeleteForPost(postId)
	if err == nil {
		s.deleteFileIndexForPost(postId)
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDelete(fileId string) error {
	err := s.FileInfoStore.PermanentDelete(fileId)
	if err == nil {
		s.deleteFileIndex(fileId)
	}
	return err
}

func (s SearchFileInfoStore) PermanentDeleteBatch(endTime int64, limit int64) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteBatch(endTime, limit)
	if err == nil {
		s.deleteFileIndexBatch(endTime, limit)
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDeleteByUser(userId string) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteByUser(userId)
	if err == nil {
		s.deleteFileIndexForUser(userId)
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
