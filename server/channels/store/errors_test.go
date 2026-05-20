// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package store

import (
	"errors"
	"testing"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/stretchr/testify/assert"
)

func TestErrNotFound(t *testing.T) {
	id := model.NewId()

	t.Run("plain", func(t *testing.T) {
		err := NewErrNotFound("channel", id)

		assert.EqualError(t, err, "resource \"channel\" not found, id: "+id)
	})
	t.Run("with wrapped error", func(t *testing.T) {
		err := NewErrNotFound("channel", id)
		err = err.Wrap(errors.New("some error"))

		assert.EqualError(t, err, "resource \"channel\" not found, id: "+id+", error: some error")
	})
}
