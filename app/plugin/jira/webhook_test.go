package jira

import (
	"encoding/json"
	"os"
	"reflect"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func walkFields(prefix string, thing interface{}, f func(path string, value interface{})) {
	rv := reflect.ValueOf(thing)
	for i := 0; i < rv.NumField(); i++ {
		path := prefix + "." + rv.Type().Field(i).Name
		value := rv.Field(i).Interface()
		f(path, value)
		if rv.Field(i).Kind() == reflect.Struct {
			walkFields(path, value, f)
		}
	}
}

func TestWebhookJSONUnmarshal(t *testing.T) {
	f, err := os.Open("testdata/webhook_sample.json")
	require.NoError(t, err)
	defer f.Close()
	var w Webhook
	require.NoError(t, json.NewDecoder(f).Decode(&w))
	walkFields("", w, func(path string, value interface{}) {
		assert.NotEmpty(t, value, path)
	})
}
