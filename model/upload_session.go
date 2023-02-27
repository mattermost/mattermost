// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"fmt"
	"net/http"
)

// UploadType defines the type of an upload.
type UploadType string

const (
	UploadTypeAttachment   UploadType = "attachment"
	UploadTypeImport       UploadType = "import"
	IncompleteUploadSuffix            = ".tmp"
)

// UploadNoUserID is a "fake" user id used by the API layer when in local mode.
const UploadNoUserID = "nouser"

// UploadSession contains information used to keep track of a file upload.
type UploadSession struct {
	// The unique identifier for the session.
	Id string `json:"id"`
	// The type of the upload.
	Type UploadType `json:"type"`
	// The timestamp of creation.
	CreateAt int64 `json:"create_at"`
	// The id of the user performing the upload.
	UserId string `json:"user_id"`
	// The id of the channel to upload to.
	ChannelId string `json:"channel_id,omitempty"`
	// The name of the file to upload.
	Filename string `json:"filename"`
	// The path where the file is stored.
	Path string `json:"-"`
	// The size of the file to upload.
	FileSize int64 `json:"file_size"`
	// The amount of received data in bytes. If equal to FileSize it means the
	// upload has finished.
	FileOffset int64 `json:"file_offset"`
	// Id of remote cluster if uploading for shared channel
	RemoteId string `json:"remote_id"`
	// Requested file id if uploading for shared channel
	ReqFileId string `json:"req_file_id"`
}

// PreSave is a utility function used to fill required information.
func (us *UploadSession) PreSave() {
	if us.Id == "" {
		us.Id = NewId()
	}

	if us.CreateAt == 0 {
		us.CreateAt = GetMillis()
	}
}

// IsValid validates an UploadType. It returns an error in case of
// failure.
func (t UploadType) IsValid() error {
	switch t {
	case UploadTypeAttachment:
		return nil
	case UploadTypeImport:
		return nil
	default:
	}
	return fmt.Errorf("invalid UploadType %s", t)
}

// IsValid validates an UploadSession. It returns an error in case of
// failure.
func (us *UploadSession) IsValid() *AppError {
	if !IsValidId(us.Id) {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.id.app_error", nil, "", http.StatusBadRequest)
	}

	if err := us.Type.IsValid(); err != nil {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.type.app_error", nil, "", http.StatusBadRequest).Wrap(err)
	}

	if !IsValidId(us.UserId) && us.UserId != UploadNoUserID {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.user_id.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.Type == UploadTypeAttachment && !IsValidId(us.ChannelId) {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.channel_id.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.CreateAt == 0 {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.create_at.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.Filename == "" {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.filename.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.FileSize <= 0 {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.file_size.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.FileOffset < 0 || us.FileOffset > us.FileSize {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.file_offset.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if us.Path == "" {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.path.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	return nil
}
