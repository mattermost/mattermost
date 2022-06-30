// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package featureflag

import (
	"math"
	"reflect"
	"strconv"
	"strings"

	"github.com/pkg/errors"
	"github.com/splitio/go-client/v6/splitio/client"
	"github.com/splitio/go-client/v6/splitio/conf"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
)

type SyncParams struct {
	ServerID            string
	SplitKey            string
	SyncIntervalSeconds int
	Log                 *mlog.Logger
	Attributes          map[string]any
}

type Synchronizer struct {
	SyncParams

	client  *client.SplitClient
	stop    chan struct{}
	stopped chan struct{}
}

var featureNames = getStructFields(model.FeatureFlags{})

func NewSynchronizer(params SyncParams) (*Synchronizer, error) {
	cfg := conf.Default()
	if params.Log != nil {
		cfg.Logger = &splitLogger{wrappedLog: params.Log.With(mlog.String("service", "split"))}
	} else {
		cfg.LoggerConfig.LogLevel = math.MinInt32
	}
	factory, err := client.NewSplitFactory(params.SplitKey, cfg)
	if err != nil {
		return nil, errors.Wrap(err, "unable to create split factory")
	}

	return &Synchronizer{
		SyncParams: params,
		client:     factory.Client(),
		stop:       make(chan struct{}),
		stopped:    make(chan struct{}),
	}, nil
}

// EnsureReady blocks until the synchronizer is ready to update feature flag values
func (f *Synchronizer) EnsureReady() error {
	if err := f.client.BlockUntilReady(10); err != nil {
		return errors.Wrap(err, "split.io client could not initialize")
	}

	return nil
}

func (f *Synchronizer) UpdateFeatureFlagValues(base model.FeatureFlags) model.FeatureFlags {
	featuresMap := f.client.Treatments(f.ServerID, featureNames, f.Attributes)
	ffm := featureFlagsFromMap(featuresMap, base)
	return ffm
}

func (f *Synchronizer) Close() {
	f.client.Destroy()
}

// featureFlagsFromMap sets the feature flags from a map[string]string.
// It starts with baseFeatureFlags and only sets values that are
// given by the upstream management system.
// Makes the assumption that all feature flags are strings or booleans.
// Strings are converted to booleans by considering case insensitive "on" or any value considered by strconv.ParseBool as true and any other value as false.
func featureFlagsFromMap(featuresMap map[string]string, baseFeatureFlags model.FeatureFlags) model.FeatureFlags {
	refStruct := reflect.ValueOf(&baseFeatureFlags).Elem()
	for fieldName, fieldValue := range featuresMap {
		refField := refStruct.FieldByName(fieldName)
		// "control" is returned by split.io if the treatment is not found, in this case we should use the default value.
		if !refField.IsValid() || !refField.CanSet() || fieldValue == "control" {
			continue
		}

		switch refField.Type().Kind() {
		case reflect.Bool:
			parsedBoolValue, _ := strconv.ParseBool(fieldValue)
			refField.Set(reflect.ValueOf(strings.ToLower(fieldValue) == "on" || parsedBoolValue))
		default:
			refField.Set(reflect.ValueOf(fieldValue))
		}

	}
	return baseFeatureFlags
}

func getStructFields(s any) []string {
	structType := reflect.TypeOf(s)
	fieldNames := make([]string, 0, structType.NumField())
	for i := 0; i < structType.NumField(); i++ {
		fieldNames = append(fieldNames, structType.Field(i).Name)
	}

	return fieldNames
}
