// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"
)

type ReadCloseSeeker interface {
	io.ReadCloser
	io.Seeker
}

type FileBackend interface {
	TestConnection() *model.AppError

	Reader(path string) (ReadCloseSeeker, *model.AppError)
	ReadFile(path string) ([]byte, *model.AppError)
	FileExists(path string) (bool, *model.AppError)
	FileSize(path string) (int64, *model.AppError)
	CopyFile(oldPath, newPath string) *model.AppError
	MoveFile(oldPath, newPath string) *model.AppError
	WriteFile(fr io.Reader, path string) (int64, *model.AppError)
	AppendFile(fr io.Reader, path string) (int64, *model.AppError)
	RemoveFile(path string) *model.AppError

	ListDirectory(path string) (*[]string, *model.AppError)
	RemoveDirectory(path string) *model.AppError
}

func NewFileBackend(settings *model.FileSettings, enableComplianceFeatures bool) (FileBackend, *model.AppError) {
	switch *settings.DriverName {
	case model.IMAGE_DRIVER_S3:
		backend, err := NewS3FileBackend(settings, enableComplianceFeatures)
		if err != nil {
			return nil, model.NewAppError("NewFileBackend", "api.file.new_backend.s3.app_error", nil, err.Error(), http.StatusInternalServerError)
		}
		return backend, nil
	case model.IMAGE_DRIVER_LOCAL:
		return &LocalFileBackend{
			directory: *settings.Directory,
		}, nil
	}
	return nil, model.NewAppError("NewFileBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError)
}
