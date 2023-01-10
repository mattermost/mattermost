// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"context"
	"io"
	"time"

	"github.com/pkg/errors"
)

const (
	driverS3    = "amazons3"
	driverLocal = "local"
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
	ListDirectoryRecursively(path string) ([]string, error)
	RemoveDirectory(path string) error
}

type FileBackendSettings struct {
	DriverName                         string
	Directory                          string
	AmazonS3AccessKeyId                string
	AmazonS3SecretAccessKey            string
	AmazonS3Bucket                     string
	AmazonS3PathPrefix                 string
	AmazonS3Region                     string
	AmazonS3Endpoint                   string
	AmazonS3SSL                        bool
	AmazonS3SignV2                     bool
	AmazonS3SSE                        bool
	AmazonS3Trace                      bool
	SkipVerify                         bool
	AmazonS3RequestTimeoutMilliseconds int64
}

func (settings *FileBackendSettings) CheckMandatoryS3Fields() error {
	if settings.AmazonS3Bucket == "" {
		return errors.New("missing s3 bucket settings")
	}

	// if S3 endpoint is not set call the set defaults to set that
	if settings.AmazonS3Endpoint == "" {
		settings.AmazonS3Endpoint = "s3.amazonaws.com"
	}

	return nil
}

func NewFileBackend(settings FileBackendSettings) (FileBackend, error) {
	switch settings.DriverName {
	case driverS3:
		backend, err := NewS3FileBackend(settings)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the s3 backend")
		}
		return backend, nil
	case driverLocal:
		return &LocalFileBackend{
			directory: settings.Directory,
		}, nil
	}
	return nil, errors.New("no valid filestorage driver found")
}

// TryWriteFileContext checks if the file backend supports context writes and passes the context in that case.
// Should the file backend not support contexts, it just calls WriteFile instead. This can be used to disable
// the timeouts for long writes (like exports).
func TryWriteFileContext(fb FileBackend, ctx context.Context, fr io.Reader, path string) (int64, error) {
	type ContextWriter interface {
		WriteFileContext(context.Context, io.Reader, string) (int64, error)
	}

	if cw, ok := fb.(ContextWriter); ok {
		return cw.WriteFileContext(ctx, fr, path)
	} else {
		return fb.WriteFile(fr, path)
	}
}
