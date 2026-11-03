// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package healthcheck

import "github.com/mattermost/mattermost/server/public/model"

// Feature getters for Licensed, LicenseAllows and LicenseFeature.
func FeatureAdvancedLogging(f *model.Features) *bool { return f.AdvancedLogging }
func FeatureCluster(f *model.Features) *bool         { return f.Cluster }
func FeatureCompliance(f *model.Features) *bool      { return f.Compliance }
func FeatureDataRetention(f *model.Features) *bool   { return f.DataRetention }
func FeatureElasticsearch(f *model.Features) *bool   { return f.Elasticsearch }
func FeatureIDLoaded(f *model.Features) *bool        { return f.IDLoadedPushNotifications }
func FeatureLDAP(f *model.Features) *bool            { return f.LDAP }
func FeatureMessageExport(f *model.Features) *bool   { return f.MessageExport }
func FeatureMetrics(f *model.Features) *bool         { return f.Metrics }
func FeatureMHPNS(f *model.Features) *bool           { return f.MHPNS }
func FeatureOpenID(f *model.Features) *bool          { return f.OpenId }
func FeatureSAML(f *model.Features) *bool            { return f.SAML }

// AnyLicense allows every licensed server, for settings the server honors under any license.
func AnyLicense(*model.Features) *bool {
	allowed := true
	return &allowed
}

// AnyFeature allows the server when the license allows at least one of features.
func AnyFeature(features ...func(*model.Features) *bool) func(*model.Features) *bool {
	return func(f *model.Features) *bool {
		for _, feature := range features {
			if value := feature(f); value == nil || *value {
				return value
			}
		}

		allowed := false
		return &allowed
	}
}
