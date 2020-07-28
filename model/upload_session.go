// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"encoding/json"
	"io"
	"net/http"
)

// UploadSession contains information used to keep track of a file upload.
type UploadSession struct {
	Id       string
	CreateAt int64  `json:"create_at"`
	UserId   string `json:"user_id"`
	Filename string `json:"filename"`
	Path     string `json:"-"`
	// The size of the file to upload.
	FileSize int64 `json:"file_size"`
	// The amount of received data in bytes. If equal to FileSize it means the
	// upload has finished.
	FileOffset int64 `json:"file_offset"`
}

func (us *UploadSession) ToJson() string {
	b, _ := json.Marshal(us)
	return string(b)
}

func UploadSessionFromJson(data io.Reader) *UploadSession {
	decoder := json.NewDecoder(data)
	var us UploadSession
	if err := decoder.Decode(&us); err != nil {
		return nil
	}
	return &us
}

func (us *UploadSession) PreSave() {
	if us.Id == "" {
		us.Id = NewId()
	}

	if us.CreateAt == 0 {
		us.CreateAt = GetMillis()
	}
}

func (us *UploadSession) IsValid() *AppError {
	if !IsValidId(us.Id) {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.id.app_error", nil, "id="+us.Id, http.StatusBadRequest)
	}

	if !IsValidId(us.UserId) {
		return NewAppError("UploadSession.IsValid", "model.upload_session.is_valid.user_id.app_error", nil, "id="+us.Id, http.StatusBadRequest)
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
