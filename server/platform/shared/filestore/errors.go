// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package filestore

// FileBackendAuthError is returned when testing a connection and authentication
// against the file storage backend fails. Backends should wrap the underlying
// auth failure in this type so the admin Test Connection flow can surface a
// useful message regardless of which driver is configured.
type FileBackendAuthError struct {
	// Err is the underlying driver error, if any.
	Err error
	// DetailedError is a human-readable message describing the failure.
	// Kept for compatibility with the previous S3-specific type.
	DetailedError string
}

func (e *FileBackendAuthError) Error() string {
	if e.DetailedError != "" {
		return e.DetailedError
	}
	if e.Err != nil {
		return e.Err.Error()
	}
	return "authentication failed"
}

func (e *FileBackendAuthError) Unwrap() error { return e.Err }

// FileBackendNoBucketError is returned when testing a connection and the
// configured bucket / container does not exist.
type FileBackendNoBucketError struct {
	// Err is the underlying driver error, if any.
	Err error
}

func (e *FileBackendNoBucketError) Error() string {
	if e.Err != nil {
		return e.Err.Error()
	}
	return "no such bucket or container"
}

func (e *FileBackendNoBucketError) Unwrap() error { return e.Err }
