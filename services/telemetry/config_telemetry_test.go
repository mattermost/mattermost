package telemetry

import (
	"fmt"
	"go/ast"
	"go/parser"
	"go/token"
	"reflect"
	"testing"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/stretchr/testify/assert"
)

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

/*
func buildTelemetryList() []string {
	cm := makeConfigMap()
	var fieldNames []string
	for _, fields := range cm {
		for _, field := range fields {
			fieldNames = append(fieldNames, field.configField)
		}
	}
	return fieldNames
}
*/

func buildTelemetryList() []string {
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "config_telemetry.go", nil, parser.ParseComments)
	if err != nil {
		panic(err)
	}

	ast.Inspect(file, func(n ast.Node) bool {
		tp, ok := n.(*ast.DeclStmt)
		if ok {
			fmt.Println(tp.Decl)
		}
		return true
	})
	return []string{}
}
