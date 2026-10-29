// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

//go:build unit

package commands

import (
	"errors"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
)

func TestExtractErrorFromResponse(t *testing.T) {
	baseErr := errors.New("boom")

	t.Run("nil response returns the original error", func(t *testing.T) {
		require.Equal(t, baseErr, ExtractErrorFromResponse(nil, baseErr))
	})

	t.Run("not found", func(t *testing.T) {
		err := ExtractErrorFromResponse(&model.Response{StatusCode: http.StatusNotFound}, baseErr)
		var nfErr *NotFoundError
		require.ErrorAs(t, err, &nfErr)
	})

	t.Run("bad request", func(t *testing.T) {
		err := ExtractErrorFromResponse(&model.Response{StatusCode: http.StatusBadRequest}, baseErr)
		var brErr *BadRequestError
		require.ErrorAs(t, err, &brErr)
	})

	t.Run("other status returns the original error", func(t *testing.T) {
		require.Equal(t, baseErr, ExtractErrorFromResponse(&model.Response{StatusCode: http.StatusForbidden}, baseErr))
	})
}
