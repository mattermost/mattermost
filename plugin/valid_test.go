package plugin_test

import (
	"testing"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost-server/plugin"
)

func TestIsValid(t *testing.T) {
	t.Parallel()

	testCases := map[string]bool{
		"":    false,
		"a":   false,
		"ab":  false,
		"abc": true,
		"abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij":  true,
		"abcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghijabcdefghij1": false,
		"../path":                                 false,
		"/etc/passwd":                             false,
		"com.mattermost.plugin_with_features-0.9": true,
		"PLUGINS-THAT-YELL-ARE-OK-2":              true,
	}

	for id, valid := range testCases {
		t.Run(id, func(t *testing.T) {
			assert.Equal(t, valid, plugin.IsValidId(id))
		})
	}
}
