// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"fmt"

	"github.com/mattermost/mattermost-server/v5/mlog"
)

type splitMlogAdapter struct {
	wrappedLog *mlog.Logger
}

func (s *splitMlogAdapter) Error(msg ...interface{}) {
	s.wrappedLog.Error(fmt.Sprint(msg...))
}

func (s *splitMlogAdapter) Warning(msg ...interface{}) {
	s.wrappedLog.Warn(fmt.Sprint(msg...))
}

// Ignoring more verbose messages from split
func (s *splitMlogAdapter) Info(msg ...interface{}) {
	//s.wrappedLog.Info(fmt.Sprint(msg...))
}

func (s *splitMlogAdapter) Debug(msg ...interface{}) {
	//s.wrappedLog.Debug(fmt.Sprint(msg...))
}

func (s *splitMlogAdapter) Verbose(msg ...interface{}) {
	//s.wrappedLog.Info(fmt.Sprint(msg...))
}
