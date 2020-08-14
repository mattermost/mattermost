// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"errors"
	"io"
	"net/http"
	"path/filepath"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/plugin"
	"github.com/mattermost/mattermost-server/v5/store"
)

const minFirstPartSize = 5 * 1024 * 1024 // 5MB

func (a *App) CreateUploadSession(us *model.UploadSession) (*model.UploadSession, *model.AppError) {
	if us.FileSize > *a.Config().FileSettings.MaxFileSize {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.upload_too_large.app_error",
			map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusRequestEntityTooLarge)
	}

	us.FileOffset = 0
	now := time.Now()
	us.CreateAt = model.GetMillisForTime(now)
	us.Path = now.Format("20060102") + "/teams/noteam/channels/" + us.ChannelId + "/users/" + us.UserId + "/" + us.Id + "/" + us.Filename
	if err := us.IsValid(); err != nil {
		return nil, err
	}

	channel, err := a.GetChannel(us.ChannelId)
	if err != nil {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.incorrect_channel_id.app_error",
			map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusBadRequest)
	}
	if channel.DeleteAt != 0 {
		return nil, model.NewAppError("CreateUploadSession", "app.upload.create.cannot_upload_to_deleted_channel.app_error",
			map[string]interface{}{"channelId": us.ChannelId}, "", http.StatusBadRequest)
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

func (a *App) GetUploadSessionsForUser(userId string) ([]*model.UploadSession, *model.AppError) {
	uss, err := a.Srv().Store.UploadSession().GetForUser(userId)
	if err != nil {
		return nil, model.NewAppError("GetUploadsForUser", "app.upload.get_for_user.app_error",
			nil, err.Error(), http.StatusInternalServerError)
	}
	return uss, nil
}

func (a *App) UploadData(us *model.UploadSession, rd io.Reader) (*model.FileInfo, *model.AppError) {
	// make sure it's not possible to upload more data than what is expected.
	lr := &io.LimitedReader{
		R: rd,
		N: us.FileSize - us.FileOffset,
	}
	var err *model.AppError
	var written int64
	if us.FileOffset == 0 {
		// new upload
		written, err = a.WriteFile(lr, us.Path)
		if written < minFirstPartSize && written != us.FileSize {
			a.RemoveFile(us.Path)
			return nil, model.NewAppError("UploadData", "app.upload.upload_data.first_part_too_small.app_error",
				map[string]interface{}{"Size": minFirstPartSize}, "", http.StatusBadRequest)
		}
	} else if us.FileOffset < us.FileSize {
		// resume upload
		written, err = a.AppendFile(lr, us.Path)
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
	file, err := a.FileReader(us.Path)
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

	// call plugins upload hook
	if pluginsEnvironment := a.GetPluginsEnvironment(); pluginsEnvironment != nil {
		// using a pipe to avoid loading the whole file content in memory.
		r, w := io.Pipe()
		errChan := make(chan *model.AppError, 1)
		go func() {
			defer w.Close()
			defer close(errChan)
			pluginContext := a.PluginContext()
			pluginsEnvironment.RunMultiPluginHook(func(hooks plugin.Hooks) bool {
				newInfo, rejStr := hooks.FileWillBeUploaded(pluginContext, info, file, w)
				if rejStr != "" {
					errChan <- model.NewAppError("UploadData", "File rejected by plugin. "+rejStr, nil, "", http.StatusBadRequest)
					return false
				}
				if newInfo != nil {
					info = newInfo
				}
				return true
			}, plugin.FileWillBeUploadedId)
		}()

		var written int64
		tmpPath := us.Path + ".tmp"
		written, err = a.WriteFile(r, tmpPath)
		if err != nil {
			if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
				mlog.Error("Failed to remove file", mlog.Err(fileErr))
			}
			return nil, err
		}

		if err = <-errChan; err != nil {
			if fileErr := a.RemoveFile(us.Path); fileErr != nil {
				mlog.Error("Failed to remove file", mlog.Err(fileErr))
			}
			if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
				mlog.Error("Failed to remove file", mlog.Err(fileErr))
			}
			return nil, err
		}

		if written > 0 {
			info.Size = written
			if fileErr := a.MoveFile(tmpPath, us.Path); fileErr != nil {
				mlog.Error("Failed to move file", mlog.Err(fileErr))
			}
		} else {
			if fileErr := a.RemoveFile(tmpPath); fileErr != nil {
				mlog.Error("Failed to remove file", mlog.Err(fileErr))
			}
		}
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
		imgData, fileErr := a.ReadFile(us.Path)
		if fileErr != nil {
			return nil, fileErr
		}
		a.HandleImages([]string{info.PreviewPath}, []string{info.ThumbnailPath}, [][]byte{imgData})
	}

	info, err = a.Srv().Store.FileInfo().Save(info)
	if err != nil {
		return nil, err
	}

	// delete upload session
	if storeErr := a.Srv().Store.UploadSession().Delete(us.Id); storeErr != nil {
		mlog.Error("Failed to delete UploadSession", mlog.Err(storeErr))
	}

	return info, nil
}
