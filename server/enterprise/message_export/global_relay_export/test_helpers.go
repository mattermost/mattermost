// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package global_relay_export

import (
	"net/mail"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func AssertHeaderContains(t *testing.T, msg string, expected map[string]string) {
	t.Helper()
	m, err := mail.ReadMessage(strings.NewReader(msg))
	require.NoError(t, err)

	for k, v := range expected {
		assert.Equal(t, v, m.Header.Get(k))
	}
}

func CleanTestOutput(msg string) string {
	msg = strings.Replace(msg, "=\r\n", "", -1)
	msg = strings.Replace(msg, "\r\n", "\n", -1)
	return msg
}
