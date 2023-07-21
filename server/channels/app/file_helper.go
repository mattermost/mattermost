// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"net/http"

	"github.com/mattermost/mattermost/server/public/model"
)

// removeInaccessibleContentFromFilesSlice removes content from the files beyond the cloud plan's limit
// and also returns the firstInaccessibleFileTime
func (a *App) removeInaccessibleContentFromFilesSlice(files []*model.FileInfo) (int64, *model.AppError) {
	if len(files) == 0 {
		return 0, nil
	}

	lastAccessibleFileTime, appErr := a.GetLastAccessibleFileTime()
	if appErr != nil {
		return 0, model.NewAppError("removeInaccessibleFileListContent", "app.last_accessible_file.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}
	if lastAccessibleFileTime == 0 {
		// No need to remove content, all files are accessible
		return 0, nil
	}

	var firstInaccessibleFileTime int64
	for _, file := range files {
		if createAt := file.CreateAt; createAt < lastAccessibleFileTime {
			file.MakeContentInaccessible()
			if createAt > firstInaccessibleFileTime {
				firstInaccessibleFileTime = createAt
			}
		}
	}

	return firstInaccessibleFileTime, nil
}

// filterInaccessibleFiles filters out the files, past the cloud limit
func (a *App) filterInaccessibleFiles(fileList *model.FileInfoList, options filterFileOptions) *model.AppError {
	if fileList == nil || fileList.FileInfos == nil || len(fileList.FileInfos) == 0 {
		return nil
	}

	lastAccessibleFileTime, appErr := a.GetLastAccessibleFileTime()
	if appErr != nil {
		return model.NewAppError("filterInaccessibleFiles", "app.last_accessible_file.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	}
	if lastAccessibleFileTime == 0 {
		// No need to filter, all files are accessible
		return nil
	}

	if len(fileList.FileInfos) == len(fileList.Order) && options.assumeSortedCreatedAt {
		lenFiles := len(fileList.FileInfos)
		getCreateAt := func(i int) int64 { return fileList.FileInfos[fileList.Order[i]].CreateAt }

		bounds := getTimeSortedPostAccessibleBounds(lastAccessibleFileTime, lenFiles, getCreateAt)

		if bounds.allAccessible(lenFiles) {
			return nil
		}
		if bounds.noAccessible() {
			if lenFiles > 0 {
				firstFileCreatedAt := fileList.FileInfos[fileList.Order[0]].CreateAt
				lastFileCreatedAt := fileList.FileInfos[fileList.Order[lenFiles-1]].CreateAt
				fileList.FirstInaccessibleFileTime = max(firstFileCreatedAt, lastFileCreatedAt)
			}
			fileList.FileInfos = map[string]*model.FileInfo{}
			fileList.Order = []string{}
			return nil
		}
		startInaccessibleIndex, endInaccessibleIndex := bounds.getInaccessibleRange(len(fileList.Order))
		startInaccessibleCreatedAt := fileList.FileInfos[fileList.Order[startInaccessibleIndex]].CreateAt
		endInaccessibleCreatedAt := fileList.FileInfos[fileList.Order[endInaccessibleIndex]].CreateAt
		fileList.FirstInaccessibleFileTime = max(startInaccessibleCreatedAt, endInaccessibleCreatedAt)

		files := fileList.FileInfos
		order := fileList.Order
		accessibleCount := bounds.end - bounds.start + 1
		inaccessibleCount := lenFiles - accessibleCount
		// Linearly cover shorter route to traverse files map
		if inaccessibleCount < accessibleCount {
			for i := 0; i < bounds.start; i++ {
				delete(files, order[i])
			}
			for i := bounds.end + 1; i < lenFiles; i++ {
				delete(files, order[i])
			}
		} else {
			accessibleFiles := make(map[string]*model.FileInfo, accessibleCount)
			for i := bounds.start; i <= bounds.end; i++ {
				accessibleFiles[order[i]] = files[order[i]]
			}
			fileList.FileInfos = accessibleFiles
		}

		fileList.Order = fileList.Order[bounds.start : bounds.end+1]
	} else {
		linearFilterFileList(fileList, lastAccessibleFileTime)
	}

	return nil
}

// isInaccessibleFile indicates if the file is past the cloud plan's limit.
func (a *App) isInaccessibleFile(file *model.FileInfo) (int64, *model.AppError) {
	if file == nil {
		return 0, nil
	}

	fl := &model.FileInfoList{
		Order:     []string{file.Id},
		FileInfos: map[string]*model.FileInfo{file.Id: file},
	}

	appErr := a.filterInaccessibleFiles(fl, filterFileOptions{assumeSortedCreatedAt: true})
	return fl.FirstInaccessibleFileTime, appErr
}

// getFilteredAccessibleFiles returns accessible files filtered as per the cloud plan's limit and also indicates if there were any inaccessible files
func (a *App) getFilteredAccessibleFiles(files []*model.FileInfo, options filterFileOptions) ([]*model.FileInfo, int64, *model.AppError) {
	if len(files) == 0 {
		return files, 0, nil
	}

	filteredFiles := []*model.FileInfo{}
	lastAccessibleFileTime, appErr := a.GetLastAccessibleFileTime()
	if appErr != nil {
		return filteredFiles, 0, model.NewAppError("getFilteredAccessibleFiles", "app.last_accessible_file.app_error", nil, appErr.Error(), http.StatusInternalServerError)
	} else if lastAccessibleFileTime == 0 {
		// No need to filter, all files are accessible
		return files, 0, nil
	}

	if options.assumeSortedCreatedAt {
		lenFiles := len(files)
		getCreateAt := func(i int) int64 { return files[i].CreateAt }
		bounds := getTimeSortedPostAccessibleBounds(lastAccessibleFileTime, lenFiles, getCreateAt)
		if bounds.allAccessible(lenFiles) {
			return files, 0, nil
		}
		if bounds.noAccessible() {
			var firstInaccessibleFileTime int64
			if lenFiles > 0 {
				firstFileCreatedAt := files[0].CreateAt
				lastFileCreatedAt := files[len(files)-1].CreateAt
				firstInaccessibleFileTime = max(firstFileCreatedAt, lastFileCreatedAt)
			}
			return filteredFiles, firstInaccessibleFileTime, nil
		}

		startInaccessibleIndex, endInaccessibleIndex := bounds.getInaccessibleRange(len(files))
		firstFileCreatedAt := files[startInaccessibleIndex].CreateAt
		lastFileCreatedAt := files[endInaccessibleIndex].CreateAt
		firstInaccessibleFileTime := max(firstFileCreatedAt, lastFileCreatedAt)
		filteredFiles = files[bounds.start : bounds.end+1]
		return filteredFiles, firstInaccessibleFileTime, nil
	}

	filteredFiles, firstInaccessibleFileTime := linearFilterFilesSlice(files, lastAccessibleFileTime)
	return filteredFiles, firstInaccessibleFileTime, nil
}

type filterFileOptions struct {
	assumeSortedCreatedAt bool
}

// linearFilterFileList make no assumptions about ordering, go through files one by one
// this is the slower fallback that is still safe
// if we can not assume files are ordered by CreatedAt
func linearFilterFileList(fileList *model.FileInfoList, earliestAccessibleTime int64) {
	files := fileList.FileInfos
	order := fileList.Order

	n := 0
	for i, fileID := range order {
		if createAt := files[fileID].CreateAt; createAt >= earliestAccessibleTime {
			order[n] = order[i]
			n++
		} else {
			if createAt > fileList.FirstInaccessibleFileTime {
				fileList.FirstInaccessibleFileTime = createAt
			}
			delete(files, fileID)
		}
	}
	fileList.Order = order[:n]
}

// linearFilterFilesSlice make no assumptions about ordering, go through files one by one
// this is the slower fallback that is still safe
// if we can not assume files are ordered by CreatedAt
func linearFilterFilesSlice(files []*model.FileInfo, earliestAccessibleTime int64) ([]*model.FileInfo, int64) {
	var firstInaccessibleFileTime int64
	n := 0
	for i := range files {
		if createAt := files[i].CreateAt; createAt >= earliestAccessibleTime {
			files[n] = files[i]
			n++
		} else {
			if createAt > firstInaccessibleFileTime {
				firstInaccessibleFileTime = createAt
			}
		}
	}
	return files[:n], firstInaccessibleFileTime
}
