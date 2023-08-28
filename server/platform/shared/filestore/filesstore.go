// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"context"
	"io"
	"time"

	"github.com/mattermost/mattermost/server/public/model"
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

type FileBackendWithLinkGenerator interface {
	GeneratePublicLink(path string) (string, time.Duration, error)
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
	AmazonS3PresignExpiresSeconds      int64
}

func NewFileBackendSettingsFromConfig(fileSettings *model.FileSettings, enableComplianceFeature bool, skipVerify bool) FileBackendSettings {
	if *fileSettings.DriverName == model.ImageDriverLocal {
		return FileBackendSettings{
			DriverName: *fileSettings.DriverName,
			Directory:  *fileSettings.Directory,
		}
	}
	return FileBackendSettings{
		DriverName:                         *fileSettings.DriverName,
		AmazonS3AccessKeyId:                *fileSettings.AmazonS3AccessKeyId,
		AmazonS3SecretAccessKey:            *fileSettings.AmazonS3SecretAccessKey,
		AmazonS3Bucket:                     *fileSettings.AmazonS3Bucket,
		AmazonS3PathPrefix:                 *fileSettings.AmazonS3PathPrefix,
		AmazonS3Region:                     *fileSettings.AmazonS3Region,
		AmazonS3Endpoint:                   *fileSettings.AmazonS3Endpoint,
		AmazonS3SSL:                        fileSettings.AmazonS3SSL == nil || *fileSettings.AmazonS3SSL,
		AmazonS3SignV2:                     fileSettings.AmazonS3SignV2 != nil && *fileSettings.AmazonS3SignV2,
		AmazonS3SSE:                        fileSettings.AmazonS3SSE != nil && *fileSettings.AmazonS3SSE && enableComplianceFeature,
		AmazonS3Trace:                      fileSettings.AmazonS3Trace != nil && *fileSettings.AmazonS3Trace,
		AmazonS3RequestTimeoutMilliseconds: *fileSettings.AmazonS3RequestTimeoutMilliseconds,
		SkipVerify:                         skipVerify,
	}
}

func NewExportFileBackendSettingsFromConfig(fileSettings *model.FileSettings, enableComplianceFeature bool, skipVerify bool) FileBackendSettings {
	if *fileSettings.ExportDriverName == model.ImageDriverLocal {
		return FileBackendSettings{
			DriverName: *fileSettings.ExportDriverName,
			Directory:  *fileSettings.ExportDirectory,
		}
	}
	return FileBackendSettings{
		DriverName:                         *fileSettings.ExportDriverName,
		AmazonS3AccessKeyId:                *fileSettings.ExportAmazonS3AccessKeyId,
		AmazonS3SecretAccessKey:            *fileSettings.ExportAmazonS3SecretAccessKey,
		AmazonS3Bucket:                     *fileSettings.ExportAmazonS3Bucket,
		AmazonS3PathPrefix:                 *fileSettings.ExportAmazonS3PathPrefix,
		AmazonS3Region:                     *fileSettings.ExportAmazonS3Region,
		AmazonS3Endpoint:                   *fileSettings.ExportAmazonS3Endpoint,
		AmazonS3SSL:                        fileSettings.ExportAmazonS3SSL == nil || *fileSettings.ExportAmazonS3SSL,
		AmazonS3SignV2:                     fileSettings.ExportAmazonS3SignV2 != nil && *fileSettings.ExportAmazonS3SignV2,
		AmazonS3SSE:                        fileSettings.ExportAmazonS3SSE != nil && *fileSettings.ExportAmazonS3SSE && enableComplianceFeature,
		AmazonS3Trace:                      fileSettings.ExportAmazonS3Trace != nil && *fileSettings.ExportAmazonS3Trace,
		AmazonS3RequestTimeoutMilliseconds: *fileSettings.ExportAmazonS3RequestTimeoutMilliseconds,
		AmazonS3PresignExpiresSeconds:      *fileSettings.ExportAmazonS3PresignExpiresSeconds,
		SkipVerify:                         skipVerify,
	}
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

// NewFileBackend creates a new file backend
func NewFileBackend(settings FileBackendSettings) (FileBackend, error) {
	return newFileBackend(settings, true)
}

// NewExportFileBackend creates a new file backend for exports, that will not attempt to use bifrost.
func NewExportFileBackend(settings FileBackendSettings) (FileBackend, error) {
	return newFileBackend(settings, false)
}

func newFileBackend(settings FileBackendSettings, canBeCloud bool) (FileBackend, error) {
	switch settings.DriverName {
	case driverS3:
		newBackendFn := NewS3FileBackend
		if !canBeCloud {
			newBackendFn = NewS3FileBackendWithoutBifrost
		}
		backend, err := newBackendFn(settings)
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
	}

	return fb.WriteFile(fr, path)
}
