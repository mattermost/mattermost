// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package targets

import (
	"bytes"

	"github.com/mattermost/logr/v2"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// DeliveryNoopFormat is the advanced-logging "format" name that selects
// NoopFormatter. Use it for the audit delivery targets, which read structured
// fields straight off the LogRec and ignore the formatted bytes.
const DeliveryNoopFormat = "noop"

// NoopFormatter is a zero-cost logr formatter. logr formats every record on the
// target's single host goroutine before calling Write; for targets like
// DeliveryDBTarget / ShardedDeliveryDBTarget that read fields directly off the
// LogRec and discard the formatted bytes, the default "json" formatter is pure
// wasted CPU on that bottleneck goroutine. NoopFormatter skips serialization
// entirely so the host goroutine only routes records.
type NoopFormatter struct{}

var _ logr.Formatter = NoopFormatter{}

func (NoopFormatter) IsStacktraceNeeded() bool { return false }

func (NoopFormatter) Format(_ *mlog.LogRec, _ mlog.Level, buf *bytes.Buffer) (*bytes.Buffer, error) {
	if buf == nil {
		buf = &bytes.Buffer{}
	}
	return buf, nil
}
