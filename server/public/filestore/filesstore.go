// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

import (
	"context"
	"io"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

// NewFileBackend creates a new file backend
func NewFileBackend(settings model.FileBackendSettings) (model.FileBackend, error) {
	return newFileBackend(settings, true)
}

// NewExportFileBackend creates a new file backend for exports, that will not attempt to use bifrost.
func NewExportFileBackend(settings model.FileBackendSettings) (model.FileBackend, error) {
	return newFileBackend(settings, false)
}

func newFileBackend(settings model.FileBackendSettings, canBeCloud bool) (model.FileBackend, error) {
	switch settings.DriverName {
	case model.FileStoreDriverS3:
		newBackendFn := NewS3FileBackend
		if !canBeCloud {
			newBackendFn = NewS3FileBackendWithoutBifrost
		}
		backend, err := newBackendFn(settings)
		if err != nil {
			return nil, errors.Wrap(err, "unable to connect to the s3 backend")
		}
		return backend, nil
	case model.FileStoreDriverLocal:
		return &LocalFileBackend{
			directory: settings.Directory,
		}, nil
	}
	return nil, errors.New("no valid filestorage driver found")
}

// TryWriteFileContext checks if the file backend supports context writes and passes the context in that case.
// Should the file backend not support contexts, it just calls WriteFile instead. This can be used to disable
// the timeouts for long writes (like exports).
func TryWriteFileContext(ctx context.Context, fb model.FileBackend, fr io.Reader, path string) (int64, error) {
	type ContextWriter interface {
		WriteFileContext(context.Context, io.Reader, string) (int64, error)
	}

	if cw, ok := fb.(ContextWriter); ok {
		return cw.WriteFileContext(ctx, fr, path)
	}

	return fb.WriteFile(fr, path)
}
