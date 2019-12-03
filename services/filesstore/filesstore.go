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
	CopyFile(oldPath, newPath string) *model.AppError
	MoveFile(oldPath, newPath string) *model.AppError
	WriteFile(fr io.Reader, path string) (int64, *model.AppError)
	RemoveFile(path string) *model.AppError

	ListDirectory(path string) (*[]string, *model.AppError)
	RemoveDirectory(path string) *model.AppError
}

func NewFileBackend(settings *model.FileSettings, enableComplianceFeatures bool) (FileBackend, *model.AppError) {
	switch *settings.DriverName {
	case model.IMAGE_DRIVER_S3:
		return &S3FileBackend{
			endpoint:  *settings.AmazonS3Endpoint,
			accessKey: *settings.AmazonS3AccessKeyId,
			secretKey: *settings.AmazonS3SecretAccessKey,
			secure:    settings.AmazonS3SSL == nil || *settings.AmazonS3SSL,
			signV2:    settings.AmazonS3SignV2 != nil && *settings.AmazonS3SignV2,
			region:    *settings.AmazonS3Region,
			bucket:    *settings.AmazonS3Bucket,
			encrypt:   settings.AmazonS3SSE != nil && *settings.AmazonS3SSE && enableComplianceFeatures,
			trace:     settings.AmazonS3Trace != nil && *settings.AmazonS3Trace,
		}, nil
	case model.IMAGE_DRIVER_LOCAL:
		return &LocalFileBackend{
			directory: *settings.Directory,
		}, nil
	}
	return nil, model.NewAppError("NewFileBackend", "api.file.no_driver.app_error", nil, "", http.StatusInternalServerError)
}
