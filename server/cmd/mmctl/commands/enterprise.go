// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build enterprise
// +build enterprise

package commands

import (
	// Enterprise Deps
	_ "github.com/gorilla/handlers"
	_ "github.com/hako/durafmt"
	_ "github.com/hashicorp/memberlist"
	_ "github.com/mattermost/gosaml2"
	_ "github.com/mattermost/ldap"
	_ "github.com/mattermost/mattermost-server/server/v8/channels/imports"
	_ "github.com/mattermost/mattermost-server/server/v8/channels/utils/testutils"
	_ "github.com/mattermost/rsc/qr"
	_ "github.com/prometheus/client_golang/prometheus"
	_ "github.com/prometheus/client_golang/prometheus/collectors"
	_ "github.com/prometheus/client_golang/prometheus/promhttp"
	_ "github.com/tylerb/graceful"
	_ "gopkg.in/olivere/elastic.v6"
)
