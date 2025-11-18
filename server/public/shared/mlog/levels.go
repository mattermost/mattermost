// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package mlog

import "github.com/mattermost/logr/v2"

// Standard levels.
var (
	LvlPanic = logr.Panic // ID = 0
	LvlFatal = logr.Fatal // ID = 1
	LvlError = logr.Error // ID = 2
	LvlWarn  = logr.Warn  // ID = 3
	LvlInfo  = logr.Info  // ID = 4
	LvlDebug = logr.Debug // ID = 5
	LvlTrace = logr.Trace // ID = 6
	StdAll   = []Level{LvlPanic, LvlFatal, LvlError, LvlWarn, LvlInfo, LvlDebug, LvlTrace, LvlStdLog}
	// non-standard "critical" level
	LvlCritical = Level{ID: 7, Name: "critical"}
	// used by redirected standard logger
	LvlStdLog = Level{ID: 10, Name: "stdlog"}
	// used only by the logger
	LvlLogError = Level{ID: 11, Name: "logerror", Stacktrace: true}
)

// Register custom (discrete) levels here.
// !!!!! Custom ID's must be between 20 and 32,768 !!!!!!
var (
	// Audit system levels.
	//
	// LvlAuditAPI is used for auditing REST API endpoint access. This is the most commonly used
	// audit level and should be applied whenever a REST API endpoint is accessed. It provides
	// a record of API usage patterns and access.
	//
	// Example usage: Logging when a user accesses the /api/v4/posts endpoint.
	LvlAuditAPI = Level{ID: 100, Name: "audit-api"}

	// LvlAuditContent is used for auditing content-generating operations such as creating posts,
	// adding reactions, or other actions that create new content in the system. Note that this
	// level can generate a large volume of logs and is typically disabled by default in production
	// environments.
	//
	// Example usage: Logging when a user creates a new post or adds a reaction.
	LvlAuditContent = Level{ID: 101, Name: "audit-content"}

	// LvlAuditPerms is used for auditing permissions checks. This level is automatically applied
	// when permission-related errors occur, helping to track authorization failures and access
	// control issues.
	//
	// Example usage: Logging when a user attempts to access a resource they don't have permission for.
	LvlAuditPerms = Level{ID: 102, Name: "audit-permissions"}

	// LvlAuditCLI is intended for auditing command-line interface operations. This level was
	// originally designed for the legacy CLI. It's mostly unused now.
	LvlAuditCLI = Level{ID: 103, Name: "audit-cli"}

	// used by Remote Cluster Service
	LvlRemoteClusterServiceDebug = Level{ID: 130, Name: "RemoteClusterServiceDebug"}
	LvlRemoteClusterServiceError = Level{ID: 131, Name: "RemoteClusterServiceError"}
	LvlRemoteClusterServiceWarn  = Level{ID: 132, Name: "RemoteClusterServiceWarn"}

	// used by LDAP sync job
	LvlLDAPError = Level{ID: 140, Name: "LDAPError"}
	LvlLDAPWarn  = Level{ID: 141, Name: "LDAPWarn"}
	LvlLDAPInfo  = Level{ID: 142, Name: "LDAPInfo"}
	LvlLDAPDebug = Level{ID: 143, Name: "LDAPDebug"}
	LvlLDAPTrace = Level{ID: 144, Name: "LDAPTrace"}

	// used by Shared Channel Sync Service
	LvlSharedChannelServiceDebug            = Level{ID: 200, Name: "SharedChannelServiceDebug"}
	LvlSharedChannelServiceError            = Level{ID: 201, Name: "SharedChannelServiceError"}
	LvlSharedChannelServiceWarn             = Level{ID: 202, Name: "SharedChannelServiceWarn"}
	LvlSharedChannelServiceMessagesInbound  = Level{ID: 203, Name: "SharedChannelServiceMsgInbound"}
	LvlSharedChannelServiceMessagesOutbound = Level{ID: 204, Name: "SharedChannelServiceMsgOutbound"}

	// used by Notification Service
	LvlNotificationError = Level{ID: 300, Name: "NotificationError"}
	LvlNotificationWarn  = Level{ID: 301, Name: "NotificationWarn"}
	LvlNotificationInfo  = Level{ID: 302, Name: "NotificationInfo"}
	LvlNotificationDebug = Level{ID: 303, Name: "NotificationDebug"}
	LvlNotificationTrace = Level{ID: 304, Name: "NotificationTrace"}
)

// Combinations for LogM (log multi).
var (
	MLvlAuditAll = []Level{LvlAuditAPI, LvlAuditContent, LvlAuditPerms, LvlAuditCLI}

	MlvlLDAPError = []Level{LvlError, LvlLDAPError}
	MlvlLDAPWarn  = []Level{LvlWarn, LvlLDAPWarn}
	MlvlLDAPInfo  = []Level{LvlInfo, LvlLDAPInfo}
	MlvlLDAPDebug = []Level{LvlDebug, LvlLDAPDebug}

	MlvlNotificationError = []Level{LvlError, LvlNotificationError}
	MlvlNotificationWarn  = []Level{LvlWarn, LvlNotificationWarn}
	MlvlNotificationInfo  = []Level{LvlInfo, LvlNotificationInfo}
	MlvlNotificationDebug = []Level{LvlDebug, LvlNotificationDebug}
	MlvlNotificationTrace = []Level{LvlTrace, LvlNotificationTrace}
)
