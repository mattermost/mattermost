// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package audit

import (
	"github.com/sirupsen/logrus"
	"github.com/wiggin77/logr"
	"github.com/wiggin77/logrus4logr"
)

// AddLogrusHook adds the Logrus hook to the list of targets each audit record
// will be output to. The hook will output using the default JSON formatter.
func AddLogrusHook(hook logrus.Hook) {
	AddLogrusHookWithFormatter(hook, nil)
}

// AddLogrusHookWithFormatter adds the Logrus hook to the list of targets each audit record
// will be output to. The hook will output using the Logrus formatter.
func AddLogrusHookWithFormatter(hook logrus.Hook, formatter logrus.Formatter) {
	var f logr.Formatter
	if formatter != nil {
		f = &logrus4logr.FAdapter{Fmtr: formatter}
	} else {
		f = DefaultFormatter
	}
	target := logrus4logr.NewAdapterTarget(AuditFilter, f, hook, MaxQueueSize)
	AddTarget(target)
}
