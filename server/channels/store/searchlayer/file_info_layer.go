// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package searchlayer

import (
	"fmt"

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

func (s SearchFileInfoStore) indexFile(rctx request.CTX, file *model.FileInfo) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if file.PostId == "" && file.CreatorId != model.BookmarkFileOwner {
					return
				}
				channelId := file.ChannelId
				if file.PostId != "" {
					post, postErr := s.rootStore.Post().GetSingle(rctx, file.PostId, false)
					if postErr != nil {
						rctx.Logger().Error("Couldn't get post for file for SearchEngine indexing.", mlog.String("post_id", file.PostId), mlog.String("search_engine", engineCopy.GetName()), mlog.String("file_info_id", file.Id), mlog.Err(postErr))
						return
					}
					channelId = post.ChannelId
				}

				if channelId == "" {
					rctx.Logger().Error("Couldn't associate file with a channel for file for SearchEngine indexing.", mlog.String("search_engine", engineCopy.GetName()), mlog.String("file_info_id", file.Id))
					return
				}

				if err := engineCopy.IndexFile(file, channelId); err != nil {
					rctx.Logger().Error("Encountered error indexing file", mlog.String("file_info_id", file.Id), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndex(rctx request.CTX, fileID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFile(fileID); err != nil {
					rctx.Logger().Error("Encountered error deleting file", mlog.String("file_info_id", fileID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexForUser(rctx request.CTX, userID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteUserFiles(rctx, userID); err != nil {
					rctx.Logger().Error("Encountered error deleting files for user", mlog.String("user_id", userID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed user's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("user_id", userID))
			})
		}
	}
}

//nolint:unused // Temporarily unused until the post_id is indexed with the file
func (s SearchFileInfoStore) deleteFileIndexForPost(rctx request.CTX, postID string) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeletePostFiles(rctx, postID); err != nil {
					rctx.Logger().Error("Encountered error deleting files for post", mlog.String("post_id", postID), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed post's files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.String("post_id", postID))
			})
		}
	}
}

func (s SearchFileInfoStore) deleteFileIndexBatch(rctx request.CTX, endTime, limit int64) {
	for _, engine := range s.rootStore.searchEngine.GetActiveEngines() {
		if engine.IsIndexingEnabled() {
			runIndexFn(rctx, engine, func(engineCopy searchengine.SearchEngineInterface) {
				if err := engineCopy.DeleteFilesBatch(rctx, endTime, limit); err != nil {
					rctx.Logger().Error("Encountered error deleting a batch of files", mlog.Int("limit", limit), mlog.Int("end_time", endTime), mlog.String("search_engine", engineCopy.GetName()), mlog.Err(err))
					return
				}
				rctx.Logger().Debug("Removed batch of files from the index in search engine", mlog.String("search_engine", engineCopy.GetName()), mlog.Int("end_time", endTime), mlog.Int("limit", limit))
			})
		}
	}
}

func (s SearchFileInfoStore) Save(rctx request.CTX, info *model.FileInfo) (*model.FileInfo, error) {
	nfile, err := s.FileInfoStore.Save(rctx, info)
	if err == nil {
		s.indexFile(rctx, nfile)
	}
	return nfile, err
}

func (s SearchFileInfoStore) SetContent(rctx request.CTX, fileID, content string) error {
	err := s.FileInfoStore.SetContent(rctx, fileID, content)
	if err == nil {
		nfile, err2 := s.FileInfoStore.GetFromMaster(fileID)
		if err2 == nil {
			nfile.Content = content
			s.indexFile(rctx, nfile)
		}
	}
	return err
}

func (s SearchFileInfoStore) AttachToPost(rctx request.CTX, fileId, postId, channelId, creatorId string) error {
	err := s.FileInfoStore.AttachToPost(rctx, fileId, postId, channelId, creatorId)
	if err == nil {
		nFileInfo, err2 := s.FileInfoStore.GetFromMaster(fileId)
		if err2 == nil {
			s.indexFile(rctx, nFileInfo)
		}
	}
	return err
}

func (s SearchFileInfoStore) DeleteForPost(rctx request.CTX, postID string) (string, error) {
	// temporary workaround because deleteFileIndexForPost is not working due to the post_id not being indexed with the file
	files, err := s.FileInfoStore.GetForPost(postID, false, true, true)
	if err != nil {
		return "", fmt.Errorf("failed to get files for post %s: %w", postID, err)
	}
	result, err := s.FileInfoStore.DeleteForPost(rctx, postID)
	if err == nil {
		for _, file := range files {
			s.deleteFileIndex(rctx, file.Id)
		}
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDeleteForPost(rctx request.CTX, postID string) error {
	// temporary workaround because deleteFileIndexForPost is not working due to the post_id not being indexed with the file
	files, err := s.FileInfoStore.GetForPost(postID, false, true, true)
	if err != nil {
		return err
	}
	err = s.FileInfoStore.PermanentDeleteForPost(rctx, postID)
	if err == nil {
		for _, file := range files {
			s.deleteFileIndex(rctx, file.Id)
		}
	}
	return err
}

func (s SearchFileInfoStore) PermanentDelete(rctx request.CTX, fileId string) error {
	err := s.FileInfoStore.PermanentDelete(rctx, fileId)
	if err == nil {
		s.deleteFileIndex(rctx, fileId)
	}
	return err
}

func (s SearchFileInfoStore) PermanentDeleteBatch(rctx request.CTX, endTime int64, limit int64) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteBatch(rctx, endTime, limit)
	if err == nil {
		s.deleteFileIndexBatch(rctx, endTime, limit)
	}
	return result, err
}

func (s SearchFileInfoStore) PermanentDeleteByUser(rctx request.CTX, userId string) (int64, error) {
	result, err := s.FileInfoStore.PermanentDeleteByUser(rctx, userId)
	if err == nil {
		s.deleteFileIndexForUser(rctx, userId)
	}
	return result, err
}

func (s SearchFileInfoStore) Search(rctx request.CTX, paramsList []*model.SearchParams, userId, teamId string, page, perPage int) (*model.FileInfoList, error) {
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
				rctx.Logger().Error("Encountered error on Search.", mlog.String("search_engine", engine.GetName()), mlog.Err(appErr))
				continue
			}

			// Get the files
			filesList := model.NewFileInfoList()
			if len(fileIds) > 0 {
				files, nErr := s.FileInfoStore.GetByIds(fileIds, false, true)
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

	return s.FileInfoStore.Search(rctx, paramsList, userId, teamId, page, perPage)
}
