// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"io"
	"mime"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/plugin"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/mattermost/mattermost/server/public/shared/request"
	"github.com/mattermost/mattermost/server/v8/channels/store"
)

const minFirstPartSize = 5 * 1024 * 1024 // 5MB

func (a *App) genFileInfoFromReader(name string, file io.ReadSeeker, size int64) (*model.FileInfo, error) {
	ext := strings.ToLower(filepath.Ext(name))

	info := &model.FileInfo{
		Name:      name,
		MimeType:  mime.TypeByExtension(ext),
		Size:      size,
		Extension: ext,
	}

	if ext != "" {
		// The client expects a file extension without the leading period
		info.Extension = ext[1:]
	}

	if info.IsImage() {
		config, _, err := a.ch.imgDecoder.DecodeConfig(file)
		if err != nil {
			return nil, err
		}
		info.Width = config.Width
		info.Height = config.Height
	}
	return info, nil
}

func (a *App) runPluginsHook(c request.CTX, info *model.FileInfo, file io.Reader) *model.AppError {
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
		pluginContext := pluginContext(c)
		a.ch.RunMultiHook(func(hooks plugin.Hooks) bool {
			once.Do(func() {
				hookHasRunCh <- struct{}{}
			})
			newInfo, rejStr := hooks.FileWillBeUploaded(pluginContext, info, file, w)
			if rejStr != "" {
				rejErr = model.NewAppError("runPluginsHook", "app.upload.run_plugins_hook.rejected",
					map[string]any{"Filename": info.Name, "Reason": rejStr}, "", http.StatusBadRequest)
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
			c.Logger().Warn("Failed to remove file", mlog.Err(fileErr))
		}
		r.CloseWithError(err) // always returns nil
		return err
	}

	if err = <-errChan; err != nil {
		if fileErr := a.RemoveFile(info.Path); fileErr != nil {
			c.Logger().Warn("Failed to remove file", mlog.Err(fileErr))
		}
		if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
			c.Logger().Warn("Failed to remove file", mlog.Err(fileErr))
		}
		return err
	}

	if written > 0 {
		info.Size = written
		if fileErr := a.MoveFile(tmpPath, info.Path); fileErr != nil {
			return model.NewAppError("runPluginsHook", "app.upload.run_plugins_hook.move_fail",
				nil, "", http.StatusInternalServerError).Wrap(fileErr)
		}
	} else {
		if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
			c.Logger().Warn("Failed to remove file", mlog.Err(fileErr))
		}
	}

	return nil
}

func (a *App) CreateUploadSession(c request.CTX, us *model.UploadSession) (*model.UploadSession, *model.AppError) {
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
		channel, err := a.GetChannel(c, us.ChannelId)
		if err != nil {
			return nil, model.NewAppError("CreateUploadSession", "app.upload.create.incorrect_channel_id.app_error",
				map[string]any{"channelId": us.ChannelId}, "", http.StatusBadRequest)
		}
		if channel.DeleteAt != 0 {
			return nil, model.NewAppError("CreateUploadSession", "app.upload.create.cannot_upload_to_deleted_channel.app_error",
				map[string]any{"channelId": us.ChannelId}, "", http.StatusBadRequest)
		}
	}

	us, storeErr := a.Srv().Store().UploadSession().Save(us)
	if storeErr != nil {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.save.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
	}

	return us, nil
}

func (a *App) GetUploadSession(c request.CTX, uploadId string) (*model.UploadSession, *model.AppError) {
	us, err := a.Srv().Store().UploadSession().Get(c, uploadId)
	if err != nil {
		var nfErr *store.ErrNotFound
		switch {
		case errors.As(err, &nfErr):
			return nil, model.NewAppError("GetUpload", "app.upload.get.app_error",
				nil, "", http.StatusNotFound).Wrap(err)
		default:
			return nil, model.NewAppError("GetUpload", "app.upload.get.app_error",
				nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}
	return us, nil
}

func (a *App) GetUploadSessionsForUser(userID string) ([]*model.UploadSession, *model.AppError) {
	uss, err := a.Srv().Store().UploadSession().GetForUser(userID)
	if err != nil {
		return nil, model.NewAppError("GetUploadsForUser", "app.upload.get_for_user.app_error",
			nil, "", http.StatusInternalServerError).Wrap(err)
	}
	return uss, nil
}

func (a *App) UploadData(c request.CTX, us *model.UploadSession, rd io.Reader) (*model.FileInfo, *model.AppError) {
	// prevent more than one caller to upload data at the same time for a given upload session.
	// This is to avoid possible inconsistencies.
	a.ch.uploadLockMapMut.Lock()
	locked := a.ch.uploadLockMap[us.Id]
	if locked {
		// session lock is already taken, return error.
		a.ch.uploadLockMapMut.Unlock()
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.concurrent.app_error",
			nil, "", http.StatusBadRequest)
	}
	// grab the session lock.
	a.ch.uploadLockMap[us.Id] = true
	a.ch.uploadLockMapMut.Unlock()

	// reset the session lock on exit.
	defer func() {
		a.ch.uploadLockMapMut.Lock()
		delete(a.ch.uploadLockMap, us.Id)
		a.ch.uploadLockMapMut.Unlock()
	}()

	// fetch the session from store to check for inconsistencies.
	c = c.With(RequestContextWithMaster)
	if storedSession, err := a.GetUploadSession(c, us.Id); err != nil {
		return nil, err
	} else if us.FileOffset != storedSession.FileOffset {
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.concurrent.app_error",
			nil, "FileOffset mismatch", http.StatusBadRequest)
	}

	uploadPath := us.Path
	if us.Type == model.UploadTypeImport {
		uploadPath += model.IncompleteUploadSuffix
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
				map[string]any{"Size": minFirstPartSize}, errStr, http.StatusBadRequest)
		}
	} else if us.FileOffset < us.FileSize {
		// resume upload
		written, err = a.AppendFile(lr, uploadPath)
	}
	if written > 0 {
		us.FileOffset += written
		if storeErr := a.Srv().Store().UploadSession().Update(us); storeErr != nil {
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.update.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
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
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.read_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
	}

	// generate file info
	info, genErr := a.genFileInfoFromReader(us.Filename, file, us.FileSize)
	file.Close()
	if genErr != nil {
		return nil, model.NewAppError("UploadData", "app.upload.upload_data.gen_info.app_error", nil, "", http.StatusInternalServerError).Wrap(genErr)
	}

	info.CreatorId = us.UserId
	info.Path = us.Path
	info.RemoteId = model.NewString(us.RemoteId)
	if us.ReqFileId != "" {
		info.Id = us.ReqFileId
	}

	// run plugins upload hook
	if err := a.runPluginsHook(c, info, file); err != nil {
		return nil, err
	}

	// image post-processing
	if info.IsImage() && !info.IsSvg() {
		if limitErr := checkImageResolutionLimit(info.Width, info.Height, *a.Config().FileSettings.MaxImageResolution); limitErr != nil {
			return nil, model.NewAppError("uploadData", "app.upload.upload_data.large_image.app_error",
				map[string]any{"Filename": us.Filename, "Width": info.Width, "Height": info.Height}, "", http.StatusBadRequest)
		}

		nameWithoutExtension := info.Name[:strings.LastIndex(info.Name, ".")]
		info.PreviewPath = filepath.Dir(info.Path) + "/" + nameWithoutExtension + "_preview." + getFileExtFromMimeType(info.MimeType)
		info.ThumbnailPath = filepath.Dir(info.Path) + "/" + nameWithoutExtension + "_thumb." + getFileExtFromMimeType(info.MimeType)
		imgData, fileErr := a.ReadFile(uploadPath)
		if fileErr != nil {
			return nil, fileErr
		}
		a.HandleImages(c, []string{info.PreviewPath}, []string{info.ThumbnailPath}, [][]byte{imgData})
	}

	if us.Type == model.UploadTypeImport {
		if err := a.MoveFile(uploadPath, us.Path); err != nil {
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.move_file.app_error", nil, "", http.StatusInternalServerError).Wrap(err)
		}
	}

	var storeErr error
	if info, storeErr = a.Srv().Store().FileInfo().Save(c, info); storeErr != nil {
		var appErr *model.AppError
		switch {
		case errors.As(storeErr, &appErr):
			return nil, appErr
		default:
			return nil, model.NewAppError("uploadData", "app.upload.upload_data.save.app_error", nil, "", http.StatusInternalServerError).Wrap(storeErr)
		}
	}

	if *a.Config().FileSettings.ExtractContent {
		infoCopy := *info
		a.Srv().Go(func() {
			err := a.ExtractContentFromFileInfo(c, &infoCopy)
			if err != nil {
				c.Logger().Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", infoCopy.Id))
			}
		})
	}

	// delete upload session
	if storeErr := a.Srv().Store().UploadSession().Delete(us.Id); storeErr != nil {
		c.Logger().Warn("Failed to delete UploadSession", mlog.Err(storeErr))
	}

	return info, nil
}
