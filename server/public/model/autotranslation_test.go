// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package model

import (
	"context"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestWithAutoTranslationPath(t *testing.T) {
	tests := []struct {
		name     string
		path     AutoTranslationPath
		expected AutoTranslationPath
	}{
		{
			name:     "create path",
			path:     AutoTranslationPathCreate,
			expected: AutoTranslationPathCreate,
		},
		{
			name:     "edit path",
			path:     AutoTranslationPathEdit,
			expected: AutoTranslationPathEdit,
		},
		{
			name:     "fetch path",
			path:     AutoTranslationPathFetch,
			expected: AutoTranslationPathFetch,
		},
		{
			name:     "websocket path",
			path:     AutoTranslationPathWebSocket,
			expected: AutoTranslationPathWebSocket,
		},
		{
			name:     "push notification path",
			path:     AutoTranslationPathPushNotification,
			expected: AutoTranslationPathPushNotification,
		},
		{
			name:     "email notification path",
			path:     AutoTranslationPathEmailNotification,
			expected: AutoTranslationPathEmailNotification,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			ctx := context.Background()
			ctx = WithAutoTranslationPath(ctx, tt.path)

			got := GetAutoTranslationPath(ctx)
			assert.Equal(t, tt.expected, got)
		})
	}
}

func TestGetAutoTranslationPathUnknown(t *testing.T) {
	t.Run("no path set returns unknown", func(t *testing.T) {
		ctx := context.Background()
		got := GetAutoTranslationPath(ctx)
		assert.Equal(t, AutoTranslationPathUnknown, got)
	})

	t.Run("wrong type in context returns unknown", func(t *testing.T) {
		ctx := context.WithValue(context.Background(), ContextKeyAutoTranslationPath, "string_not_type")
		got := GetAutoTranslationPath(ctx)
		assert.Equal(t, AutoTranslationPathUnknown, got)
	})
}

func TestAutoTranslationPathConstants(t *testing.T) {
	t.Run("all constants are defined", func(t *testing.T) {
		assert.Equal(t, AutoTranslationPath("create"), AutoTranslationPathCreate)
		assert.Equal(t, AutoTranslationPath("edit"), AutoTranslationPathEdit)
		assert.Equal(t, AutoTranslationPath("fetch"), AutoTranslationPathFetch)
		assert.Equal(t, AutoTranslationPath("websocket"), AutoTranslationPathWebSocket)
		assert.Equal(t, AutoTranslationPath("push_notification"), AutoTranslationPathPushNotification)
		assert.Equal(t, AutoTranslationPath("email_notification"), AutoTranslationPathEmailNotification)
		assert.Equal(t, AutoTranslationPath("unknown"), AutoTranslationPathUnknown)
	})
}
