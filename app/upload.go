// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
	"github.com/mattermost/mattermost-server/v5/store"
)

const minFirstPartSize = 5 * 1024 * 1024 // 5MB
const IncompleteUploadSuffix = ".tmp"

func (a *App) runPluginsHook(info *model.FileInfo, file io.Reader) *model.AppError {
	pluginsEnvironment := a.GetPluginsEnvironment()
	if pluginsEnvironment == nil {
		return nil
	}

	filePath := info.Path
	// using a pipe to avoid loading the whole file content in memory.
	r, w := io.Pipe()
	errChan := make(chan *model.AppError, 1)
	hookHasRunCh := make(chan struct{})

	go func() {
		defer w.Close()
		defer close(hookHasRunCh)
		defer close(errChan)
		var rejErr *model.AppError
		var once sync.Once
		pluginContext := a.PluginContext()
		pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
			once.Do(func() {
				hookHasRunCh <- struct{}{}
			})
			newInfo, rejStr := hooks.FileWillBeUploaded(pluginContext, info, file, w)
			if rejStr != "" {
				rejErr = model.NewAppError("runPluginsHook", "app.upload.run_plugins_hook.rejected",
					map[string]interface{}{"Filename": info.Name, "Reason": rejStr}, "", http.StatusBadRequest)
				return false
			}
			if newInfo != nil {
				info = newInfo
			}
			return true
		}, plugin.FileWillBeUploadedID)
		if rejErr != nil {
			errChan <- rejErr
		}
	}()

	// If the plugin hook has not run we can return early.
	if _, ok := <-hookHasRunCh; !ok {
		return nil
	}

	tmpPath := filePath + ".tmp"
	written, err := a.WriteFile(r, tmpPath)
	if err != nil {
		if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
			mlog.Warn("Failed to remove file", mlog.Err(fileErr))
		}
		return err
	}

	if err = <-errChan; err != nil {
		if fileErr := a.RemoveFile(info.Path); fileErr != nil {
			mlog.Warn("Failed to remove file", mlog.Err(fileErr))
		}
		if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
			mlog.Warn("Failed to remove file", mlog.Err(fileErr))
		}
		return err
	}

	if written > 0 {
		info.Size = written
		if fileErr := a.MoveFile(tmpPath, info.Path); fileErr != nil {
			return model.NewAppError("runPluginsHook", "app.upload.run_plugins_hook.move_fail",
				nil, fileErr.Error(), http.StatusInternalServerError)
		}
	} else {
		if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
			mlog.Warn("Failed to remove file", mlog.Err(fileErr))
		}
	}

	return nil
}

func (a *App) CreateUploadSession(us *model.UploadSession) (*model.UploadSession, *model.AppError) {
	if us.FileSize > *a.Config().FileSettings.MaxFileSize {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.upload_too_large.app_error",
			map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusRequestEntityTooLarge)
	}

	us.FileOffset = 0
	now := time.Now()
	us.CreateAt = model.GetMillisForTime(now)
	if us.Type == model.UploadTypeAttachment {
		us.Path = now.Format("20060102") + "/teams/noteam/channels/" + us.ChannelId + "/users/" + us.UserId + "/" + us.Id + "/" + filepath.Base(us.Filename)
	} else if us.Type == model.UploadTypeImport {
		us.Path = filepath.Clean(*a.Config().ImportSettings.Directory) + "/" + us.Id + "_" + filepath.Base(us.Filename)
	}
	if err := us.IsValid(); err != nil {
		return nil, err
	}

	if us.Type == model.UploadTypeAttachment {
		channel, err := a.GetChannel(us.ChannelId)
		if err != nil {
			return nil, model.NewAppError("CreateUploadSession", "app.upload.create.incorrect_channel_id.app_error",
				map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusBadRequest)
		}
		if channel.DeleteAt != 0 {
			return nil, model.NewAppError("CreateUploadSession", "app.upload.create.cannot_upload_to_deleted_channel.app_error",
				map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusBadRequest)
		}
	}

	us, storeErr := a.Srv().Store.UploadSession().Save(us)
	if storeErr != nil {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.save.app_error", nil, storeErr.Error(), http.StatusInternalServerError)
	}

	return us, nil
}

func (a *App) GetUploadSession(uploadId string) (*model.UploadSession, *model.AppError) {
	us, err := a.Srv().Store.UploadSession().Get(uploadId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUpload", "app.upload.get.app_error",
				nil, nfErr.Error(), http.StatusNotFound)
		default:
			return nil, model.NewAppError("GetUpload", "app.upload.get.app_error",
				nil, err.Error(), http.StatusInternalServerError)
		}
	}
	return us, nil
}

func (a *App) GetUploadSessionsForUser(userID string) ([]*model.UploadSession, *model.AppError) {
	uss, err := a.Srv().Store.UploadSession().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetUploadsForUser", "app.upload.get_for_user.app_error",
			nil, err.Error(), http.StatusInternalServerError)
	}
	return uss, nil
}

func (a *App) UploadData(us *model.UploadSession, rd io.Reader) (*model.FileInfo, *model.AppError) {
	// prevent more than one caller to upload data at the same time for a given upload session.
	// This is to avoid possible inconsistencies.
	a.Srv().uploadLockMapMut.Lock()
	locked := a.Srv().uploadLockMap[us.Id]
	if locked {
		// session lock is already taken, return error.
		a.Srv().uploadLockMapMut.Unlock()
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.concurrent.app_error",
			nil, "", http.StatusBadRequest)
	}
	// grab the session lock.
	a.Srv().uploadLockMap[us.Id] = true
	a.Srv().uploadLockMapMut.Unlock()

	// reset the session lock on exit.
	defer func() {
		a.Srv().uploadLockMapMut.Lock()
		delete(a.Srv().uploadLockMap, us.Id)
		a.Srv().uploadLockMapMut.Unlock()
	}()

	// fetch the session from store to check for inconsistencies.
	if storedSession, err := a.GetUploadSession(us.Id); err != nil {
		return nil, err
	} else if us.FileOffset != storedSession.FileOffset {
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.concurrent.app_error",
			nil, "FileOffset mismatch", http.StatusBadRequest)
	}

	uploadPath := us.Path
	if us.Type == model.UploadTypeImport {
		uploadPath += IncompleteUploadSuffix
	}

	// make sure it's not possible to upload more data than what is expected.
	lr := &io.LimitedReader{
		R: rd,
		N: us.FileSize - us.FileOffset,
	}
	var err *model.AppError
	var written int64
	if us.FileOffset == 0 {
		// new upload
		written, err = a.WriteFile(lr, uploadPath)
		if err != nil && written == 0 {
			return nil, err
		}
		if written < minFirstPartSize && written != us.FileSize {
			a.RemoveFile(uploadPath)
			var errStr string
			if err != nil {
				errStr = err.Error()
			}
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.first_part_too_small.app_error",
				map[string]interface{}{"Size": minFirstPartSize}, errStr, http.StatusBadRequest)
		}
	} else if us.FileOffset < us.FileSize {
		// resume upload
		written, err = a.AppendFile(lr, uploadPath)
	}
	if written > 0 {
		us.FileOffset += written
		if storeErr := a.Srv().Store.UploadSession().Update(us); storeErr != nil {
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.update.app_error", nil, storeErr.Error(), http.StatusInternalServerError)
		}
	}
	if err != nil {
		return nil, err
	}

	// upload is incomplete
	if us.FileOffset != us.FileSize {
		return nil, nil
	}

	// upload is done, create FileInfo
	file, err := a.FileReader(uploadPath)
	if err != nil {
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.read_file.app_error", nil, err.Error(), http.StatusInternalServerError)
	}

	info, err := model.GetInfoForBytes(us.Filename, file, int(us.FileSize))
	file.Close()
	if err != nil {
		return nil, err
	}

	info.CreatorId = us.UserId
	info.Path = us.Path
	info.RemoteId = model.NewString(us.RemoteId)
	if us.ReqFileId != "" {
		info.Id = us.ReqFileId
	}

	// run plugins upload hook
	if err := a.runPluginsHook(info, file); err != nil {
		return nil, err
	}

	// image post-processing
	if info.IsImage() {
		// Check dimensions before loading the whole thing into memory later on
		// This casting is done to prevent overflow on 32 bit systems (not needed
		// in 64 bits systems because images can't have more than 32 bits height or
		// width)
		if int64(info.Width)*int64(info.Height) > MaxImageSize {
			return nil, model.NewAppError("uploadData", "app.upload.upload_data.large_image.app_error",
				map[string]interface{}{"Filename": us.Filename, "Width": info.Width, "Height": info.Height}, "", http.StatusBadRequest)
		}
		nameWithoutExtension := info.Name[:strings.LastIndex(info.Name, ".")]
		info.PreviewPath = filepath.Dir(info.Path) + "/" + nameWithoutExtension + "_preview.jpg"
		info.ThumbnailPath = filepath.Dir(info.Path) + "/" + nameWithoutExtension + "_thumb.jpg"
		imgData, fileErr := a.ReadFile(uploadPath)
		if fileErr != nil {
			return nil, fileErr
		}
		a.HandleImages([]string{info.PreviewPath}, []string{info.ThumbnailPath}, [][]byte{imgData})
	}

	if us.Type == model.UploadTypeImport {
		if err := a.MoveFile(uploadPath, us.Path); err != nil {
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.move_file.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
	}

	var storeErr error
	if info, storeErr = a.Srv().Store.FileInfo().Save(info); storeErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(storeErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("uploadData", "app.upload.upload_data.save.app_error", nil, storeErr.Error(), http.StatusInternalServerError)
		}
	}

	if *a.Config().FileSettings.ExtractContent && a.Config().FeatureFlags.FilesSearch {
		infoCopy := *info
		a.Srv().Go(func() {
			err := a.ExtractContentFromFileInfo(&infoCopy)
			if err != nil {
				mlog.Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
			}
		})
	}

	// delete upload session
	if storeErr := a.Srv().Store.UploadSession().Delete(us.Id); storeErr != nil {
		mlog.Warn("Failed to delete UploadSession", mlog.Err(storeErr))
	}

	return info, nil
}
