// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

// Standard levels
var (
	LvlPanic = LogLevel{ID: 0, Name: "panic"}
	LvlFatal = LogLevel{ID: 1, Name: "fatal"}
	LvlError = LogLevel{ID: 2, Name: "error"}
	LvlWarn  = LogLevel{ID: 3, Name: "warn"}
	LvlInfo  = LogLevel{ID: 4, Name: "info"}
	LvlDebug = LogLevel{ID: 5, Name: "debug"}
	LvlTrace = LogLevel{ID: 6, Name: "trace"}
	// used only by the logger
	LvlLogError = LogLevel{ID: 11, Name: "logerror"}
)

// Register custom (discrete) levels here...
// ! ID's must not exceed 32,768 !
var (
	// used by the audit system
	LvlAuditDebug = LogLevel{ID: 100, Name: "AuditDebug"}
	LvlAuditError = LogLevel{ID: 101, Name: "AuditError"}
	// used by the TCP log target
	LvlTcpLogTarget = LogLevel{ID: 105, Name: "TcpLogTarget"}
)

// Combinations for LogM (log multi)
var (
	MLvlExample = []LogLevel{LvlAuditDebug, LvlDebug}
)
