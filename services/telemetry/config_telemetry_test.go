package telemetry

import (
	"fmt"
	"reflect"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/stretchr/testify/assert"
)

// This is the main test that illustrates the point of this change - if a config setting doesn't have it's telemetry
// mapping specified this unit test will pass, forcing anyone who adds a new config setting to explicitly set what
// telemetry is sent for it in order to pass CI.
func TestMapConfig(t *testing.T) {
	config := model.Config{}
	config.SetDefaults()

	// Build the list of all config fields.
	configFields := recursiveBuildConfigList(reflect.ValueOf(config), "")
	_ = configFields

	// Get the list of config fields that are covered by telemetry.
	telemetryFields := buildTelemetryList()
	_ = telemetryFields

	// Check that all config fields are handled in the telemetry Fields.
	for _, configField := range configFields {
		assert.Contains(
			t,
			telemetryFields,
			configField,
			fmt.Sprintf("Telemetry for Config Field %v must be specified in services/telemetry/config_telemetry.go", configField),
		)
	}
}

// FIXME: WIP.
func TestConfigToMap(t *testing.T) {
	config := model.Config{}
	config.SetDefaults()
	config.TeamSettings.ExperimentalDefaultChannels = []string{"Foo", "Bar"}

	data := configToMap(config, "")
	for k, v := range data {
		t.Log(fmt.Sprintf("%v: %v", k, v))
	}
}

// FIXME: WIP.
func recursiveBuildConfigList(val reflect.Value, prefix string) []string {
	var fields []string
	for i := 0; i < val.Type().NumField(); i++ {
		name := val.Type().Field(i).Name
		newVal := val.Field(i)
		if newVal.Kind() == reflect.Struct {
			fields = append(fields, recursiveBuildConfigList(newVal, prefix+name+".")...)
		} else {
			fields = append(fields, prefix+name)
		}
	}
	return fields
}

// FIXME: WIP.
func buildTelemetryList() []string {
	cm := makeConfigTelemetryMap()
	var fieldNames []string
	for _, fields := range cm {
		for _, field := range fields {
			fieldNames = append(fieldNames, field.configField)
		}
	}
	return fieldNames
}
