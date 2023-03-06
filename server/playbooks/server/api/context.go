package api

import (
	"net/http"

	"github.com/sirupsen/logrus"
)

// requestIDContextKeyType ensures requestIDContextKey can never collide with another context key
// having the same value.
type requestIDContextKeyType string

// requestIDContextKey is the key for the incoming requestID.
var requestIDContextKey = requestIDContextKeyType("requestID")

// getLogger builds a logger with the requestID attached to the given request.
func getLogger(r *http.Request) logrus.FieldLogger {
	var logger logrus.FieldLogger = logrus.StandardLogger()

	requestID, ok := r.Context().Value(requestIDContextKey).(string)
	if ok {
		logger = logger.WithField("request_id", requestID)
	}

	return logger
}

type Context struct {
	logger logrus.FieldLogger
}

// withContext passes a logger to http handler functions.
func withContext(handler func(c *Context, w http.ResponseWriter, r *http.Request)) func(http.ResponseWriter, *http.Request) {
	return func(w http.ResponseWriter, r *http.Request) {
		logger := getLogger(r)
		handler(&Context{logger}, w, r)
	}
}
