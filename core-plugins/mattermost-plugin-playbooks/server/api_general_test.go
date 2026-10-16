// Copyright (c) 2020-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestAPI(t *testing.T) {
	e := Setup(t)
	e.CreateClients()

	t.Run("404", func(t *testing.T) {
		resp, err := e.ServerClient.DoAPIRequestWithHeaders(context.Background(), "POST", e.ServerClient.URL+"/plugins/"+manifest.Id+"/api/v0/nothing", "", nil)
		assert.Error(t, err)
		assert.Equal(t, http.StatusNotFound, resp.StatusCode)
	})
}
