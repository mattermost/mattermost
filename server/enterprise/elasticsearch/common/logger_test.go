// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.enterprise for license information.

package common

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

func TestLoggerLogRoundTrip(t *testing.T) {
	logger := NewLogger("Opensearch", mlog.CreateConsoleTestLogger(t), false)

	t.Run("request and response", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "http://localhost:9200/_bulk", nil)
		res := &http.Response{StatusCode: http.StatusOK}
		assert.NoError(t, logger.LogRoundTrip(req, res, nil, time.Now(), time.Millisecond))
	})

	t.Run("error without request or response", func(t *testing.T) {
		assert.NotPanics(t, func() {
			assert.NoError(t, logger.LogRoundTrip(nil, nil, errors.New("discovery failed"), time.Now(), time.Millisecond))
		})
	})

	t.Run("request without response", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "http://localhost:9200/_bulk", nil)
		assert.NotPanics(t, func() {
			assert.NoError(t, logger.LogRoundTrip(req, nil, errors.New("connection refused"), time.Now(), time.Millisecond))
		})
	})
}
