// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api

import (
	"context"
	"net/http"
	"time"

	"github.com/mattermost/mattermost-server/server/public/model"
	"github.com/sirupsen/logrus"
)

// statusRecorder intercepts and saves the status code written to an http.ResponseWriter.
type statusRecorder struct {
	http.ResponseWriter
	statusCode int
}

func (r *statusRecorder) WriteHeader(code int) {
	// Forward the write
	r.ResponseWriter.WriteHeader(code)

	// Save the status code
	r.statusCode = code
}

// LogRequest logs each request, attaching a unique request_id to the request context to trace
// logs throughout the request lifecycle.
func LogRequest(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		recorder := statusRecorder{w, 200}
		requestID := model.NewId()

		startMilis := time.Now().UnixNano() / int64(time.Millisecond)

		logger := logrus.WithFields(logrus.Fields{
			"method":     r.Method,
			"url":        r.URL.String(),
			"user_id":    r.Header.Get("Mattermost-User-Id"),
			"request_id": requestID,
			"user_agent": r.Header.Get("User-Agent"),
		})
		r = r.WithContext(context.WithValue(r.Context(), requestIDContextKey, requestID))

		logger.Debug("Received HTTP request")

		next.ServeHTTP(&recorder, r)

		gqlOp := r.Header.Get("X-GQL-Operation")
		if gqlOp != "" {
			logger = logger.WithField("gql_operation", gqlOp)
		}

		endMilis := time.Now().UnixNano() / int64(time.Millisecond)
		logger.WithFields(logrus.Fields{
			"time":   endMilis - startMilis,
			"status": recorder.statusCode,
		}).Debug("Handled HTTP request")
	})
}
