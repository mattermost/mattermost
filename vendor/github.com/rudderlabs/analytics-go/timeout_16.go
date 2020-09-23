// +build go1.6

package analytics

import "net/http"

// http clients on versions of go after 1.6 always support timeout.
func supportsTimeout(transport http.RoundTripper) bool {
	return true
}
