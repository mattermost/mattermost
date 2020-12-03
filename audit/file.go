// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"os"

	"github.com/mattermost/logr"
	"github.com/mattermost/logr/target"
)

type FileOptions target.FileOptions

// NewFileTarget creates a target capable of outputting log records to a rotated file.
func NewFileTarget(filter logr.Filter, formatter logr.Formatter, opts FileOptions, maxQSize int) (*target.File, error) {
	fopts := target.FileOptions(opts)
	err := checkFileWritable(fopts.Filename)
	if err != nil {
		return nil, err
	}
	target := target.NewFileTarget(filter, formatter, fopts, maxQSize)
	return target, nil
}

func checkFileWritable(filename string) error {
	// try opening/creating the file for writing
	file, err := os.OpenFile(filename, os.O_RDWR|os.O_APPEND|os.O_CREATE, 0600)
	if err != nil {
		return err
	}
	file.Close()
	return nil
}
