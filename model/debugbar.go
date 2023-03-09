// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import "runtime"

type DebugBarInfo struct {
	ServerOS             string
	ServerArchitecture   string
	ServerVersion        string
	BuildHash            string
	DatabaseType         string
	DatabaseVersion      string
	LdapVendorName       string
	LdapVendorVersion    string
	ElasticServerVersion string
	ElasticServerPlugins []string
	WebSocketConnections int
	MasterDBConnections  int
	ReadDBConnections    int
	SessionsCount        int64
	Goroutines           int
	Cpus                 int
	CgoCalls             int64
	GoVersion            string
	GoMemStats           runtime.MemStats
}
