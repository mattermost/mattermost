package debug

import (
	"io"
	"net/http"
	"net/http/httputil"
)

// Transport implements http.RoundTripper and can be used to wrap other HTTP
// transports to dump request and responses for debugging.
type Transport struct {
	http.RoundTripper
	Output io.Writer
}

func (t *Transport) RoundTrip(req *http.Request) (*http.Response, error) {
	b, err := httputil.DumpRequestOut(req, true)
	if err != nil {
		return nil, err
	}
	_, err = t.Output.Write(ensureTrailingNewline(b))
	if err != nil {
		return nil, err
	}
	resp, err := t.RoundTripper.RoundTrip(req)
	if err != nil {
		return nil, err
	}
	b, err = httputil.DumpResponse(resp, true)
	if err != nil {
		return nil, err
	}
	_, err = t.Output.Write(ensureTrailingNewline(b))
	if err != nil {
		return nil, err
	}
	return resp, nil
}

func ensureTrailingNewline(b []byte) []byte {
	if len(b) > 0 && b[len(b)-1] != '\n' {
		b = append(b, '\n')
	}
	return b
}
