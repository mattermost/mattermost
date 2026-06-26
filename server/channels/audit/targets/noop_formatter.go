// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"bytes"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

const DeliveryNoopFormat = "noop"

type NoopFormatter struct{}

var _ logr.Formatter = NoopFormatter{}

func (NoopFormatter) IsStacktraceNeeded() bool { return false }

func (NoopFormatter) Format(_ *mlog.LogRec, _ mlog.Level, buf *bytes.Buffer) (*bytes.Buffer, error) {
	if buf == nil {
		buf = &bytes.Buffer{}
	}
	return buf, nil
}
