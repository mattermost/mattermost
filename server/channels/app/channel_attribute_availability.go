// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"github.com/mattermost/mattermost/server/public/model"
)

// IsClassificationChannelField reports whether field is the channel-scoped
// classification linked field rather than a generic channel attribute.
// Classification predates channel attributes and ships behind its own
// flag/license pair.
func IsClassificationChannelField(field *model.PropertyField) bool {
	return field.Name == classificationFieldName && field.LinkedFieldID != nil && *field.LinkedFieldID != ""
}

// ChannelAttributeFieldAvailable reports whether field's own feature is on,
// given the pre-computed availability of channel attributes and classification.
func ChannelAttributeFieldAvailable(field *model.PropertyField, channelAttributesAvailable, classificationAvailable bool) bool {
	if IsClassificationChannelField(field) {
		return classificationAvailable
	}
	return channelAttributesAvailable
}

// channelAttributeAvailability reports whether channel attributes (feature
// flag plus Enterprise Advanced) and classification (feature flag plus
// Enterprise) are available on this server.
func (a *App) channelAttributeAvailability() (channelAttributes, classification bool) {
	flags := a.Config().FeatureFlags
	license := a.License()
	return flags.ChannelAttributes && model.MinimumEnterpriseAdvancedLicense(license),
		flags.ClassificationMarkings && model.MinimumEnterpriseLicense(license)
}
