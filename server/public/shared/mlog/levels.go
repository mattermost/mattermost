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
	// used by the audit system
	LvlAuditAPI     = Level{ID: 100, Name: "audit-api"}
	LvlAuditContent = Level{ID: 101, Name: "audit-content"}
	LvlAuditPerms   = Level{ID: 102, Name: "audit-permissions"}
	LvlAuditCLI     = Level{ID: 103, Name: "audit-cli"}

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
