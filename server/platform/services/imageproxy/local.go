// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"mime"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"path"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"golang.org/x/text/encoding/unicode"
	"golang.org/x/text/transform"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

var imageContentTypes = []string{
	"image/bmp", "image/cgm", "image/g3fax", "image/gif", "image/ief", "image/jp2",
	"image/jpeg", "image/jpg", "image/pict", "image/png", "image/prs.btif",
	"image/tiff", "image/vnd.adobe.photoshop", "image/vnd.djvu", "image/vnd.dwg",
	"image/vnd.dxf", "image/vnd.fastbidsheet", "image/vnd.fpx", "image/vnd.fst",
	"image/vnd.fujixerox.edmics-mmr", "image/vnd.fujixerox.edmics-rlc",
	"image/vnd.microsoft.icon", "image/vnd.ms-modi", "image/vnd.net-fpx", "image/vnd.wap.wbmp",
	"image/vnd.xiff", "image/webp", "image/x-cmu-raster", "image/x-cmx", "image/x-icon",
	"image/x-macpaint", "image/x-pcx", "image/x-pict", "image/x-portable-anymap",
	"image/x-portable-bitmap", "image/x-portable-graymap", "image/x-portable-pixmap",
	"image/x-quicktime", "image/x-rgb", "image/x-xbitmap", "image/x-xpixmap", "image/x-xwindowdump",
}

var msgNotAllowed = "requested URL is not allowed"

var ErrLocalRequestFailed = Error{errors.New("imageproxy.LocalBackend: failed to request proxied image")}

type LocalBackend struct {
	client  *http.Client
	baseURL *url.URL
}

// URLError reports a malformed URL error.
type URLError struct {
	Message string
	URL     *url.URL
}

func (e URLError) Error() string {
	return fmt.Sprintf("malformed URL %q: %s", e.URL, e.Message)
}

func makeLocalBackend(proxy *ImageProxy) *LocalBackend {
	baseURL := proxy.siteURL
	if baseURL == nil {
		mlog.Warn("Failed to set base URL for image proxy. Relative image links may not work.")
	}

	client := proxy.HTTPService.MakeClient(false)

	return &LocalBackend{
		client:  client,
		baseURL: baseURL,
	}
}

type contentTypeRecorder struct {
	http.ResponseWriter
	filename string
}

func (rec *contentTypeRecorder) WriteHeader(code int) {
	hdr := rec.ResponseWriter.Header()
	contentType := hdr.Get("Content-Type")
	mediaType, _, err := mime.ParseMediaType(contentType)
	// The error is caused by a malformed input and there's not much use logging it.
	// Therefore, even in the error case we set it to attachment mode to be safe.
	if err != nil || mediaType == "image/svg+xml" {
		hdr.Set("Content-Disposition", fmt.Sprintf("attachment;filename=%q", rec.filename))
	}

	rec.ResponseWriter.WriteHeader(code)
}

func (backend *LocalBackend) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	// The interface to the proxy only exposes a ServeHTTP method, so fake a request to it
	req, err := http.NewRequest(http.MethodGet, "/"+imageURL, nil)
	if err != nil {
		// http.NewRequest should only return an error on an invalid URL
		mlog.Debug("Failed to create request for proxied image", mlog.String("url", imageURL), mlog.Err(err))

		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte{})
		return
	}

	u, err := url.Parse(imageURL)
	if err != nil {
		mlog.Debug("Failed to parse URL for proxied image", mlog.String("url", imageURL), mlog.Err(err))
		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte{})
		return
	}

	w.Header().Set("X-Frame-Options", "deny")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'")

	rec := contentTypeRecorder{w, filepath.Base(u.Path)}
	backend.ServeImage(&rec, req)
}

func (backend *LocalBackend) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	// The interface to the proxy only exposes a ServeHTTP method, so fake a request to it
	req, err := http.NewRequest(http.MethodGet, "/"+imageURL, nil)
	if err != nil {
		return nil, "", Error{err}
	}

	recorder := httptest.NewRecorder()

	backend.ServeImage(recorder, req)

	if recorder.Code != http.StatusOK {
		return nil, "", ErrLocalRequestFailed
	}

	return io.NopCloser(recorder.Body), recorder.Header().Get("Content-Type"), nil
}

func (backend *LocalBackend) ServeImage(w http.ResponseWriter, req *http.Request) {
	proxyReq, err := newProxyRequest(req, backend.baseURL)
	if err != nil {
		http.Error(w, fmt.Sprintf("invalid request URL: %v", err), http.StatusBadRequest)
		return
	}

	actualReq, err := http.NewRequest("GET", proxyReq.String(), nil)
	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	actualReq.Header.Set("Accept", strings.Join(imageContentTypes, ", "))

	resp, err := backend.client.Do(actualReq)
	if err != nil {
		mlog.Warn("error fetching remote image", mlog.Err(err))
		statusCode := http.StatusInternalServerError
		if e, ok := err.(net.Error); ok && e.Timeout() {
			statusCode = http.StatusGatewayTimeout
		}
		http.Error(w, fmt.Sprintf("error fetching remote image: %v", err), statusCode)
		return
	}
	// close the original resp.Body, even if we wrap it in a NopCloser below
	defer resp.Body.Close()

	copyHeader(w.Header(), resp.Header, "Cache-Control", "Last-Modified", "Expires", "Etag", "Link")

	// Wrap the body in a bufio.Reader so we can peek at bytes for
	// content-type detection without consuming the stream.
	b := bufio.NewReaderSize(resp.Body, contentPeekSize)
	resp.Body = io.NopCloser(b)

	if isSVGContent(b) {
		http.Error(w, msgNotAllowed, http.StatusForbidden)
		return
	}

	contentType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if contentType == "" || contentType == "application/octet-stream" || contentType == "binary/octet-stream" {
		contentType = peekContentType(b)
	}
	if resp.ContentLength != 0 && !contentTypeMatches(imageContentTypes, contentType) {
		http.Error(w, msgNotAllowed, http.StatusForbidden)
		return
	}

	if should304(req, resp) {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	w.Header().Set("Content-Type", contentType)

	copyHeader(w.Header(), resp.Header, "Content-Length")

	// Enable CORS for 3rd party applications
	w.Header().Set("Access-Control-Allow-Origin", "*")

	// Add a Content-Security-Policy to prevent stored-XSS attacks via SVG files
	w.Header().Set("Content-Security-Policy", "script-src 'none'")

	// Disable Content-Type sniffing
	w.Header().Set("X-Content-Type-Options", "nosniff")

	// Block potential XSS attacks especially in legacy browsers which do not support CSP
	w.Header().Set("X-XSS-Protection", "1; mode=block")

	w.WriteHeader(resp.StatusCode)
	if _, err := io.Copy(w, resp.Body); err != nil {
		mlog.Warn("error copying response", mlog.Err(err))
	}
}

// copyHeader copies header values from src to dst, adding to any existing
// values with the same header name.  If keys is not empty, only those header
// keys will be copied.
func copyHeader(dst, src http.Header, keys ...string) {
	if len(keys) == 0 {
		for k := range src {
			keys = append(keys, k)
		}
	}
	for _, key := range keys {
		k := http.CanonicalHeaderKey(key)
		for _, v := range src[k] {
			dst.Add(k, v)
		}
	}
}

func should304(req *http.Request, resp *http.Response) bool {
	etag := resp.Header.Get("Etag")
	if etag != "" && etag == req.Header.Get("If-None-Match") {
		return true
	}

	lastModified, err := time.Parse(time.RFC1123, resp.Header.Get("Last-Modified"))
	if err != nil {
		return false
	}
	ifModSince, err := time.Parse(time.RFC1123, req.Header.Get("If-Modified-Since"))
	if err != nil {
		return false
	}
	if lastModified.Before(ifModSince) || lastModified.Equal(ifModSince) {
		return true
	}

	return false
}

// peekContentType peeks at the first 512 bytes of p, and attempts to detect
// the content type.  Returns empty string if error occurs.
func peekContentType(p *bufio.Reader) string {
	byt, err := p.Peek(512)
	if err != nil && err != bufio.ErrBufferFull && err != io.EOF {
		return ""
	}
	return http.DetectContentType(byt)
}

// contentPeekSize is the number of bytes read ahead for content inspection.
// It must match the bufio.Reader buffer size created in ServeImage.
const contentPeekSize = 8192

// isSVGContent peeks at the first contentPeekSize bytes of p and reports whether
// they contain SVG markers. UTF-16 encoded content (identified by a BOM) is
// decoded to ASCII before scanning.
func isSVGContent(p *bufio.Reader) bool {
	byt, err := p.Peek(contentPeekSize)
	if err != nil && err != bufio.ErrBufferFull && err != io.EOF {
		return false
	}
	if len(byt) == 0 {
		return false
	}

	// UseBOM selects endianness from a BOM when present (0xFF 0xFE → LE,
	// 0xFE 0xFF → BE), defaulting to LE otherwise.
	enc := unicode.UTF16(unicode.LittleEndian, unicode.UseBOM)
	if decoded, _, decodeErr := transform.Bytes(enc.NewDecoder(), byt); decodeErr == nil {
		lower := strings.ToLower(string(decoded))
		if strings.Contains(lower, "<svg") ||
			(strings.Contains(lower, "<?xml") && strings.Contains(lower, "<svg")) {
			return true
		}
	}

	// Raw-byte scan for UTF-8 / ASCII content; interleaved-NUL patterns cover BOM-less UTF-16 BE.
	rawLower := strings.ToLower(string(byt))
	return strings.Contains(rawLower, "<svg") ||
		(strings.Contains(rawLower, "<?xml") && strings.Contains(rawLower, "<svg")) ||
		strings.Contains(rawLower, "<\x00s\x00v\x00g\x00") || // BOM-less UTF-16 LE
		strings.Contains(rawLower, "\x00<\x00s\x00v\x00g") // BOM-less UTF-16 BE
}

// contentTypeMatches returns whether contentType matches one of the allowed patterns.
func contentTypeMatches(patterns []string, contentType string) bool {
	if len(patterns) == 0 {
		return true
	}

	for _, pattern := range patterns {
		if ok, err := path.Match(pattern, contentType); ok && err == nil {
			return true
		}
	}

	return false
}

// proxyRequest is an imageproxy request which includes a remote URL of an image to
// proxy.
type proxyRequest struct {
	URL      *url.URL      // URL of the image to proxy
	Original *http.Request // The original HTTP request
}

// String returns the request URL as a string, with r.Options encoded in the
// URL fragment.
func (r proxyRequest) String() string {
	return r.URL.String()
}

func newProxyRequest(r *http.Request, baseURL *url.URL) (*proxyRequest, error) {
	var err error
	req := &proxyRequest{Original: r}

	path := r.URL.EscapedPath()[1:] // strip leading slash
	req.URL, err = parseURL(path)
	if err != nil || !req.URL.IsAbs() {
		// first segment should be options
		parts := strings.SplitN(path, "/", 2)
		if len(parts) != 2 {
			return nil, URLError{"too few path segments", r.URL}
		}

		var err error
		req.URL, err = parseURL(parts[1])
		if err != nil {
			return nil, URLError{fmt.Sprintf("unable to parse remote URL: %v", err), r.URL}
		}
	}

	if baseURL != nil {
		req.URL = baseURL.ResolveReference(req.URL)
	}

	if !req.URL.IsAbs() {
		return nil, URLError{"must provide absolute remote URL", r.URL}
	}

	if req.URL.Scheme != "http" && req.URL.Scheme != "https" {
		return nil, URLError{"remote URL must have http or https scheme", r.URL}
	}

	// query string is always part of the remote URL
	req.URL.RawQuery = r.URL.RawQuery
	return req, nil
}

var reCleanedURL = regexp.MustCompile(`^(https?):/+([^/])`)

// parseURL parses s as a URL, handling URLs that have been munged by
// path.Clean or a webserver that collapses multiple slashes.
func parseURL(s string) (*url.URL, error) {
	s = reCleanedURL.ReplaceAllString(s, "$1://$2")
	return url.Parse(s)
}
