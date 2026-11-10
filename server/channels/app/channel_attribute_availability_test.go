// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package app

import (
	"strconv"
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestChannelAttributeFieldAvailable(t *testing.T) {
	linkedID := model.NewId()
	emptyLinkedID := ""

	classification := &model.PropertyField{Name: "classification", LinkedFieldID: &linkedID}
	generic := &model.PropertyField{Name: "region"}
	unlinkedClassification := &model.PropertyField{Name: "classification"}
	emptyLinkedClassification := &model.PropertyField{Name: "classification", LinkedFieldID: &emptyLinkedID}

	tests := []struct {
		name                    string
		field                   *model.PropertyField
		channelAttributes       bool
		classificationAvailable bool
		expected                bool
	}{
		{"classification, both on", classification, true, true, true},
		{"classification, only classification on", classification, false, true, true},
		{"classification, only channel attributes on", classification, true, false, false},
		{"classification, both off", classification, false, false, false},
		{"generic, both on", generic, true, true, true},
		{"generic, only channel attributes on", generic, true, false, true},
		{"generic, only classification on", generic, false, true, false},
		{"generic, both off", generic, false, false, false},
		{"unlinked classification name is generic", unlinkedClassification, true, false, true},
		{"empty linked id is generic", emptyLinkedClassification, false, true, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			assert.Equal(t, tc.expected, ChannelAttributeFieldAvailable(tc.field, tc.channelAttributes, tc.classificationAvailable))
		})
	}
}

func TestChannelAttributeAvailability(t *testing.T) {
	tests := []struct {
		name                  string
		sku                   string
		channelAttributesFlag bool
		classificationFlag    bool
		channelAttributes     bool
		classification        bool
	}{
		{"flags on, advanced license", model.LicenseShortSkuEnterpriseAdvanced, true, true, true, true},
		{"flags on, enterprise license", model.LicenseShortSkuEnterprise, true, true, false, true},
		{"flags on, no license", "", true, true, false, false},
		{"flags off, advanced license", model.LicenseShortSkuEnterpriseAdvanced, false, false, false, false},
		{"only channel attributes flag", model.LicenseShortSkuEnterpriseAdvanced, true, false, true, false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			// Feature flags cannot change on a running server, and an
			// MM_FEATUREFLAGS_* variable would override the config, so each case
			// starts its own server with the variables pinned.
			t.Setenv("MM_FEATUREFLAGS_CHANNELATTRIBUTES", strconv.FormatBool(tc.channelAttributesFlag))
			t.Setenv("MM_FEATUREFLAGS_CLASSIFICATIONMARKINGS", strconv.FormatBool(tc.classificationFlag))
			th := SetupConfig(t, func(cfg *model.Config) {
				cfg.FeatureFlags.ChannelAttributes = tc.channelAttributesFlag
				cfg.FeatureFlags.ClassificationMarkings = tc.classificationFlag
			})
			setListingLicense(t, th, licenseForSKU(tc.sku))

			channelAttributes, classification := th.App.channelAttributeAvailability()
			assert.Equal(t, tc.channelAttributes, channelAttributes)
			assert.Equal(t, tc.classification, classification)
		})
	}
}

func licenseForSKU(sku string) *model.License {
	if sku == "" {
		return nil
	}
	return model.NewTestLicenseSKU(sku)
}
