// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

// Standard levels
var (
	LvlPanic = LogLevel{ID: 0, Name: "panic", Stacktrace: true}
	LvlFatal = LogLevel{ID: 1, Name: "fatal", Stacktrace: true}
	LvlError = LogLevel{ID: 2, Name: "error"}
	LvlWarn  = LogLevel{ID: 3, Name: "warn"}
	LvlInfo  = LogLevel{ID: 4, Name: "info"}
	LvlDebug = LogLevel{ID: 5, Name: "debug"}
	LvlTrace = LogLevel{ID: 6, Name: "trace"}
	// used by redirected standard logger
	LvlStdLog = LogLevel{ID: 10, Name: "stdlog"}
	// used only by the logger
	LvlLogError = LogLevel{ID: 11, Name: "logerror", Stacktrace: true}
)

// Register custom (discrete) levels here.
// !!!!! ID's must not exceed 32,768 !!!!!!
var (
	// used by the audit system
	LvlAuditAPI     = LogLevel{ID: 100, Name: "audit-api"}
	LvlAuditContent = LogLevel{ID: 101, Name: "audit-content"}
	LvlAuditPerms   = LogLevel{ID: 102, Name: "audit-permissions"}
	LvlAuditCLI     = LogLevel{ID: 103, Name: "audit-cli"}

	// used by the TCP log target
	LvlTcpLogTarget = LogLevel{ID: 120, Name: "TcpLogTarget"}

	// add more here ...
)

// Combinations for LogM (log multi)
var (
	MLvlAuditAll = []LogLevel{LvlAuditAPI, LvlAuditContent, LvlAuditPerms, LvlAuditCLI}
)
