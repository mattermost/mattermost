// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package file

import (
	"os"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// DeleteTemp removes a file and logs the error
// Intended to be called in a defer after the creation of a temp file to ensure cleanup
func DeleteTemp(logger mlog.LoggerIFace, file *os.File) {
	err := file.Close()
	if err != nil {
		logger.Warn("Failed to close temporary file", mlog.String("filename", file.Name()), mlog.Err(err))
	}
	err = os.Remove(file.Name())
	if err != nil {
		logger.Warn("Failed to delete temporary file", mlog.String("filename", file.Name()), mlog.Err(err))
	}
}
