// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package filesstore

import (
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/model"
)

type ReadCloseSeeker interface {
	io.ReadCloser
	io.Seeker
}

type FileBackend interface {
	TestConnection() error

	Reader(path string) (ReadCloseSeeker, error)
	ReadFile(path string) ([]byte, error)
	FileExists(path string) (bool, error)
	CopyFile(oldPath, newPath string) error
	MoveFile(oldPath, newPath string) error
	WriteFile(fr io.Reader, path string) (int64, error)
	RemoveFile(path string) error

	ListDirectory(path string) (*[]string, error)
	RemoveDirectory(path string) error
}

func NewFileBackend(settings *model.FileSettings, enableComplianceFeatures bool) (FileBackend, error) {
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
