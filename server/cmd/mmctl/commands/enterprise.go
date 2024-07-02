// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build enterprise
// +build enterprise

// This file is needed to ensure the enterprise code get complied
// when running tests. See https://mattermost.atlassian.net/browse/MM-54929
// for more details.

package commands

import (
	// Enterprise Deps
	_ "github.com/elastic/go-elasticsearch/v8"
	_ "github.com/gorilla/handlers"
	_ "github.com/hako/durafmt"
	_ "github.com/hashicorp/memberlist"
	_ "github.com/mattermost/gosaml2"
	_ "github.com/mattermost/ldap"
	_ "github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
	_ "github.com/mattermost/mattermost/server/v8/enterprise"
	_ "github.com/mattermost/rsc/qr"
	_ "github.com/prometheus/client_golang/prometheus"
	_ "github.com/prometheus/client_golang/prometheus/collectors"
	_ "github.com/prometheus/client_golang/prometheus/promhttp"
	_ "github.com/tylerb/graceful"
)
