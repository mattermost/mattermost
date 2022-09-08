// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package platform

import (
	"github.com/mattermost/mattermost-server/v6/einterfaces"
	"github.com/mattermost/mattermost-server/v6/services/searchengine"
)

var clusterInterface func(*PlatformService) einterfaces.ClusterInterface

func RegisterClusterInterface(f func(*PlatformService) einterfaces.ClusterInterface) {
	clusterInterface = f
}

var elasticsearchInterface func(*PlatformService) searchengine.SearchEngineInterface

func RegisterElasticsearchInterface(f func(*PlatformService) searchengine.SearchEngineInterface) {
	elasticsearchInterface = f
}

var licenseInterface func(*PlatformService) einterfaces.LicenseInterface

func RegisterLicenseInterface(f func(*PlatformService) einterfaces.LicenseInterface) {
	licenseInterface = f
}

var metricsInterface func(*PlatformService, string, string) einterfaces.MetricsInterface

func RegisterMetricsInterface(f func(*PlatformService, string, string) einterfaces.MetricsInterface) {
	metricsInterface = f
}
