// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"github.com/mattermost/mattermost/server/public/mattermost-govet/apiAuditLogs"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/configtelemetry"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/emptyInterface"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/emptyStrCmp"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/equalLenAsserts"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/errorAssertions"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/errorVars"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/errorVarsName"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/immut"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/inconsistentReceiverName"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/license"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/mutexLock"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/noSelectStar"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/openApiSync"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/pointerToSlice"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/rawSql"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/structuredLogging"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/tFatal"
	"github.com/mattermost/mattermost/server/public/mattermost-govet/wraperrors"
	"golang.org/x/tools/go/analysis/unitchecker"
)

func main() {
	unitchecker.Main(
		license.Analyzer,
		license.EEAnalyzer,
		structuredLogging.Analyzer,
		// appErrorWhere.Analyzer,
		tFatal.Analyzer,
		equalLenAsserts.Analyzer,
		openApiSync.Analyzer,
		rawSql.Analyzer,
		inconsistentReceiverName.Analyzer,
		apiAuditLogs.Analyzer,
		immut.Analyzer,
		emptyInterface.Analyzer,
		emptyStrCmp.Analyzer,
		configtelemetry.Analyzer,
		errorAssertions.Analyzer,
		errorVarsName.Analyzer,
		errorVars.Analyzer,
		pointerToSlice.Analyzer,
		mutexLock.Analyzer,
		wraperrors.Analyzer,
		noSelectStar.Analyzer,
	)
}
