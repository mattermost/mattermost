// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package plugin

type metricsInterface interface {
	ObservePluginHookDuration(pluginID, hookName string, success bool, elapsed float64)
	ObservePluginMultiHookIterationDuration(pluginID string, elapsed float64)
	ObservePluginMultiHookDuration(elapsed float64)
	ObservePluginAPIDuration(pluginID, apiName string, success bool, elapsed float64)
}
