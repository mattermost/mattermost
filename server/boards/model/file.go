// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.
package model

import (
	"mime"
	"path/filepath"
	"strings"

	"github.com/mattermost/mattermost-server/server/v8/boards/utils"
	mm_model "github.com/mattermost/mattermost-server/server/v8/model"
)

func NewFileInfo(name string) *mm_model.FileInfo {

	extension := strings.ToLower(filepath.Ext(name))
	now := utils.GetMillis()
	return &mm_model.FileInfo{
		CreatorId: "boards",
		CreateAt:  now,
		UpdateAt:  now,
		Name:      name,
		Extension: extension,
		MimeType:  mime.TypeByExtension(extension),
	}

}
