package throttled

import (
	"bytes"
	"net/http"
	"strings"
)

// VaryBy defines the criteria to use to group requests.
type VaryBy struct {
	// Vary by the RemoteAddr as specified by the net/http.Request field.
	RemoteAddr bool

	// Vary by the HTTP Method as specified by the net/http.Request field.
	Method bool

	// Vary by the URL's Path as specified by the Path field of the net/http.Request
	// URL field.
	Path bool

	// Vary by this list of header names, read from the net/http.Request Header field.
	Headers []string

	// Vary by this list of parameters, read from the net/http.Request FormValue method.
	Params []string

	// Vary by this list of cookie names, read from the net/http.Request Cookie method.
	Cookies []string

	// Use this separator string to concatenate the various criteria of the VaryBy struct.
	// Defaults to a newline character if empty (\n).
	Separator string

	// DEPRECATED. Custom specifies the custom-generated key to use for this request.
	// If not nil, the value returned by this function is used instead of any
	// VaryBy criteria.
	Custom func(r *http.Request) string
}

// Key returns the key for this request based on the criteria defined by the VaryBy struct.
func (vb *VaryBy) Key(r *http.Request) string {
	var buf bytes.Buffer

	if vb == nil {
		return "" // Special case for no vary-by option
	}
	if vb.Custom != nil {
		// A custom key generator is specified
		return vb.Custom(r)
	}
	sep := vb.Separator
	if sep == "" {
		sep = "\n" // Separator defaults to newline
	}
	if vb.RemoteAddr && len(r.RemoteAddr) > 0 {
		// RemoteAddr usually looks something like `IP:port`. For example,
		// `[::]:1234`. However, it seems to occasionally degenerately appear
		// as just IP (or other), so be conservative with how we extract it.
		index := strings.LastIndex(r.RemoteAddr, ":")

		var ip string
		if index == -1 {
			ip = r.RemoteAddr
		} else {
			ip = r.RemoteAddr[:index]
		}

		buf.WriteString(strings.ToLower(ip) + sep)
	}
	if vb.Method {
		buf.WriteString(strings.ToLower(r.Method) + sep)
	}
	for _, h := range vb.Headers {
		buf.WriteString(strings.ToLower(r.Header.Get(h)) + sep)
	}
	if vb.Path {
		buf.WriteString(r.URL.Path + sep)
	}
	for _, p := range vb.Params {
		buf.WriteString(r.FormValue(p) + sep)
	}
	for _, c := range vb.Cookies {
		ck, err := r.Cookie(c)
		if err == nil {
			buf.WriteString(ck.Value)
		}
		buf.WriteString(sep) // Write the separator anyway, whether or not the cookie exists
	}
	return buf.String()
}
