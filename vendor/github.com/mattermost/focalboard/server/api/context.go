package api

import (
	"context"
	"net"
	"net/http"
)

type contextKey int

const (
	httpConnContextKey contextKey = iota
	sessionContextKey
)

// SetContextConn stores the connection in the request context.
func SetContextConn(ctx context.Context, c net.Conn) context.Context {
	return context.WithValue(ctx, httpConnContextKey, c)
}

// GetContextConn gets the stored connection from the request context.
func GetContextConn(r *http.Request) net.Conn {
	value := r.Context().Value(httpConnContextKey)
	if value == nil {
		return nil
	}

	return value.(net.Conn)
}
