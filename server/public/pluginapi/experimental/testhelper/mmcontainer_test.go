// Copyright (c) 2019-present Mattermost, Inc. All Rights Reserved.
// See License for license information.

//go:build integration

package testhelper

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestGetMMImage(t *testing.T) {
	t.Run("default when env not set", func(t *testing.T) {
		t.Setenv("MM_TEST_IMAGE", "")

		img := getMMImage()
		assert.Equal(t, defaultMMImage, img)
	})

	t.Run("custom image from env", func(t *testing.T) {
		t.Setenv("MM_TEST_IMAGE", "mattermost/mattermost-enterprise-edition:10.5")

		img := getMMImage()
		assert.Equal(t, "mattermost/mattermost-enterprise-edition:10.5", img)
	})

	t.Run("development image from env", func(t *testing.T) {
		t.Setenv("MM_TEST_IMAGE", "mattermostdevelopment/mattermost-enterprise-edition:master")

		img := getMMImage()
		assert.Equal(t, "mattermostdevelopment/mattermost-enterprise-edition:master", img)
	})
}
