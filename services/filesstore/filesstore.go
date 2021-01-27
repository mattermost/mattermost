// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filesstore

import (
	"io"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v5/model"
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
	FileSize(path string) (int64, error)
	CopyFile(oldPath, newPath string) error
	MoveFile(oldPath, newPath string) error
	WriteFile(fr io.Reader, path string) (int64, error)
	AppendFile(fr io.Reader, path string) (int64, error)
	RemoveFile(path string) error
	FileModTime(path string) (time.Time, error)

	ListDirectory(path string) ([]string, error)
	RemoveDirectory(path string) error
}

func NewFileBackend(settings *model.FileSettings, enableComplianceFeatures bool) (FileBackend, error) {
	switch *settings.DriverName {
	case model.IMAGE_DRIVER_S3:
		backend, err := NewS3FileBackend(settings, enableComplianceFeatures)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the s3 backend")
		}
		return backend, nil
	case model.IMAGE_DRIVER_LOCAL:
		return &LocalFileBackend{
			directory: *settings.Directory,
		}, nil
	}
	return nil, errors.New("no valid filestorage driver found")
}
