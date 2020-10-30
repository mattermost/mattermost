// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package config

import (
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
)

func TestGetStructFields(t *testing.T) {
	type testStruct struct {
		FieldOne       string
		SecondField    bool
		SomeOtherField int
	}

	fields := getStructFields(testStruct{})
	require.Equal(t,
		[]string{
			"FieldOne",
			"SecondField",
			"SomeOtherField",
		},
		fields,
	)

	featureFlagsFields := getStructFields(model.FeatureFlags{})
	require.Contains(t, featureFlagsFields, "TestFeature")
}

func TestFeatureFlagsFromMap(t *testing.T) {
	for name, tc := range map[string]struct {
		FeatureMap        map[string]string
		Base              model.FeatureFlags
		ExpectedTestValue string
	}{
		"empty": {
			FeatureMap:        map[string]string{},
			Base:              model.FeatureFlags{},
			ExpectedTestValue: "",
		},
		"no base value": {
			FeatureMap:        map[string]string{"TestFeature": "expectedvalue"},
			Base:              model.FeatureFlags{},
			ExpectedTestValue: "expectedvalue",
		},
		"only base value": {
			FeatureMap:        map[string]string{},
			Base:              model.FeatureFlags{TestFeature: "somebasevalue"},
			ExpectedTestValue: "somebasevalue",
		},
		"override base value": {
			FeatureMap:        map[string]string{"TestFeature": "overridevalue"},
			Base:              model.FeatureFlags{TestFeature: "somebasevalue"},
			ExpectedTestValue: "overridevalue",
		},
		"override base value with extras": {
			FeatureMap:        map[string]string{"TestFeature": "overridevalue", "SomeOldFlag": "oldvalue"},
			Base:              model.FeatureFlags{TestFeature: "somebasevalue"},
			ExpectedTestValue: "overridevalue",
		},
		"all values do not exist": {
			FeatureMap:        map[string]string{"SomeOldFlag": "oldvalue"},
			Base:              model.FeatureFlags{},
			ExpectedTestValue: "",
		},
	} {
		t.Run(name, func(t *testing.T) {
			require.Equal(t, tc.ExpectedTestValue, featureFlagsFromMap(tc.FeatureMap, tc.Base).TestFeature)
		})
	}
}
