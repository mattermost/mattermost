// Copyright 2013 Google Inc. All rights reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// Package imageproxy provides an image proxy server.  For typical use of
// creating and using a Proxy, see cmd/imageproxy/main.go.
package imageproxy // import "willnorris.com/go/imageproxy"

import (
	"bufio"
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"mime"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"

	"github.com/gregjones/httpcache"
	tphttp "willnorris.com/go/imageproxy/third_party/http"
)

// Proxy serves image requests.
type Proxy struct {
	Client *http.Client // client used to fetch remote URLs
	Cache  Cache        // cache used to cache responses

	// AllowHosts specifies a list of remote hosts that images can be
	// proxied from.  An empty list means all hosts are allowed.
	AllowHosts []string

	// DenyHosts specifies a list of remote hosts that images cannot be
	// proxied from.
	DenyHosts []string

	// Referrers, when given, requires that requests to the image
	// proxy come from a referring host. An empty list means all
	// hosts are allowed.
	Referrers []string

	// DefaultBaseURL is the URL that relative remote URLs are resolved in
	// reference to.  If nil, all remote URLs specified in requests must be
	// absolute.
	DefaultBaseURL *url.URL

	// The Logger used by the image proxy
	Logger *log.Logger

	// SignatureKey is the HMAC key used to verify signed requests.
	SignatureKey []byte

	// Allow images to scale beyond their original dimensions.
	ScaleUp bool

	// Timeout specifies a time limit for requests served by this Proxy.
	// If a call runs for longer than its time limit, a 504 Gateway Timeout
	// response is returned.  A Timeout of zero means no timeout.
	Timeout time.Duration

	// If true, log additional debug messages
	Verbose bool

	// ContentTypes specifies a list of content types to allow. An empty
	// list means all content types are allowed.
	ContentTypes []string

	// The User-Agent used by imageproxy when requesting origin image
	UserAgent string
}

// NewProxy constructs a new proxy.  The provided http RoundTripper will be
// used to fetch remote URLs.  If nil is provided, http.DefaultTransport will
// be used.
func NewProxy(transport http.RoundTripper, cache Cache) *Proxy {
	if transport == nil {
		transport = http.DefaultTransport
	}
	if cache == nil {
		cache = NopCache
	}

	proxy := &Proxy{
		Cache: cache,
	}

	client := new(http.Client)
	client.Transport = &httpcache.Transport{
		Transport: &TransformingTransport{
			Transport:     transport,
			CachingClient: client,
			log: func(format string, v ...interface{}) {
				if proxy.Verbose {
					proxy.logf(format, v...)
				}
			},
		},
		Cache:               cache,
		MarkCachedResponses: true,
	}

	proxy.Client = client

	return proxy
}

// ServeHTTP handles incoming requests.
func (p *Proxy) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/favicon.ico" {
		return // ignore favicon requests
	}

	if r.URL.Path == "/" || r.URL.Path == "/health-check" {
		fmt.Fprint(w, "OK")
		return
	}

	var h http.Handler = http.HandlerFunc(p.serveImage)
	if p.Timeout > 0 {
		h = tphttp.TimeoutHandler(h, p.Timeout, "Gateway timeout waiting for remote resource.")
	}
	h.ServeHTTP(w, r)
}

// serveImage handles incoming requests for proxied images.
func (p *Proxy) serveImage(w http.ResponseWriter, r *http.Request) {
	req, err := NewRequest(r, p.DefaultBaseURL)
	if err != nil {
		msg := fmt.Sprintf("invalid request URL: %v", err)
		p.log(msg)
		http.Error(w, msg, http.StatusBadRequest)
		return
	}

	if err := p.allowed(req); err != nil {
		p.logf("%s: %v", err, req)
		http.Error(w, msgNotAllowed, http.StatusForbidden)
		return
	}

	// assign static settings from proxy to req.Options
	req.Options.ScaleUp = p.ScaleUp

	actualReq, _ := http.NewRequest("GET", req.String(), nil)
	if p.UserAgent != "" {
		actualReq.Header.Set("User-Agent", p.UserAgent)
	}
	if len(p.ContentTypes) != 0 {
		actualReq.Header.Set("Accept", strings.Join(p.ContentTypes, ", "))
	}
	resp, err := p.Client.Do(actualReq)

	if err != nil {
		msg := fmt.Sprintf("error fetching remote image: %v", err)
		p.log(msg)
		http.Error(w, msg, http.StatusInternalServerError)
		return
	}
	// close the original resp.Body, even if we wrap it in a NopCloser below
	defer resp.Body.Close()

	cached := resp.Header.Get(httpcache.XFromCache)
	if p.Verbose {
		p.logf("request: %+v (served from cache: %t)", *actualReq, cached == "1")
	}

	copyHeader(w.Header(), resp.Header, "Cache-Control", "Last-Modified", "Expires", "Etag", "Link")

	if should304(r, resp) {
		w.WriteHeader(http.StatusNotModified)
		return
	}

	contentType, _, _ := mime.ParseMediaType(resp.Header.Get("Content-Type"))
	if contentType == "" {
		// try to detect content type
		b := bufio.NewReader(resp.Body)
		resp.Body = ioutil.NopCloser(b)
		contentType = peekContentType(b)
	}
	if resp.ContentLength != 0 && !contentTypeMatches(p.ContentTypes, contentType) {
		p.logf("content-type not allowed: %q", contentType)
		http.Error(w, msgNotAllowed, http.StatusForbidden)
		return
	}
	w.Header().Set("Content-Type", contentType)

	copyHeader(w.Header(), resp.Header, "Content-Length")

	//Enable CORS for 3rd party applications
	w.Header().Set("Access-Control-Allow-Origin", "*")

	w.WriteHeader(resp.StatusCode)
	io.Copy(w, resp.Body)
}

// peekContentType peeks at the first 512 bytes of p, and attempts to detect
// the content type.  Returns empty string if error occurs.
func peekContentType(p *bufio.Reader) string {
	byt, err := p.Peek(512)
	if err != nil && err != bufio.ErrBufferFull {
		return ""
	}
	return http.DetectContentType(byt)
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

var (
	errReferrer   = errors.New("request does not contain an allowed referrer")
	errDeniedHost = errors.New("request contains a denied host")
	errNotAllowed = errors.New("request does not contain an allowed host or valid signature")

	msgNotAllowed = "requested URL is not allowed"
)

// allowed determines whether the specified request contains an allowed
// referrer, host, and signature.  It returns an error if the request is not
// allowed.
func (p *Proxy) allowed(r *Request) error {
	if len(p.Referrers) > 0 && !referrerMatches(p.Referrers, r.Original) {
		return errReferrer
	}

	if hostMatches(p.DenyHosts, r.URL) {
		return errDeniedHost
	}

	if len(p.AllowHosts) == 0 && len(p.SignatureKey) == 0 {
		return nil // no allowed hosts or signature key, all requests accepted
	}

	if len(p.AllowHosts) > 0 && hostMatches(p.AllowHosts, r.URL) {
		return nil
	}

	if len(p.SignatureKey) > 0 && validSignature(p.SignatureKey, r) {
		return nil
	}

	return errNotAllowed
}

// contentTypeMatches returns whether contentType matches one of the allowed patterns.
func contentTypeMatches(patterns []string, contentType string) bool {
	if len(patterns) == 0 {
		return true
	}

	for _, pattern := range patterns {
		if ok, err := filepath.Match(pattern, contentType); ok && err == nil {
			return true
		}
	}

	return false
}

// hostMatches returns whether the host in u matches one of hosts.
func hostMatches(hosts []string, u *url.URL) bool {
	for _, host := range hosts {
		if u.Host == host {
			return true
		}
		if strings.HasPrefix(host, "*.") && strings.HasSuffix(u.Host, host[2:]) {
			return true
		}
	}

	return false
}

// returns whether the referrer from the request is in the host list.
func referrerMatches(hosts []string, r *http.Request) bool {
	u, err := url.Parse(r.Header.Get("Referer"))
	if err != nil { // malformed or blank header, just deny
		return false
	}

	return hostMatches(hosts, u)
}

// validSignature returns whether the request signature is valid.
func validSignature(key []byte, r *Request) bool {
	sig := r.Options.Signature
	if m := len(sig) % 4; m != 0 { // add padding if missing
		sig += strings.Repeat("=", 4-m)
	}

	got, err := base64.URLEncoding.DecodeString(sig)
	if err != nil {
		log.Printf("error base64 decoding signature %q", r.Options.Signature)
		return false
	}

	// check signature with URL only
	mac := hmac.New(sha256.New, key)
	mac.Write([]byte(r.URL.String()))
	want := mac.Sum(nil)
	if hmac.Equal(got, want) {
		return true
	}

	// check signature with URL and options
	u, opt := *r.URL, r.Options // make copies
	opt.Signature = ""
	u.Fragment = opt.String()

	mac = hmac.New(sha256.New, key)
	mac.Write([]byte(u.String()))
	want = mac.Sum(nil)
	return hmac.Equal(got, want)
}

// should304 returns whether we should send a 304 Not Modified in response to
// req, based on the response resp.  This is determined using the last modified
// time and the entity tag of resp.
func should304(req *http.Request, resp *http.Response) bool {
	// TODO(willnorris): if-none-match header can be a comma separated list
	// of multiple tags to be matched, or the special value "*" which
	// matches all etags
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

func (p *Proxy) log(v ...interface{}) {
	if p.Logger != nil {
		p.Logger.Print(v...)
	} else {
		log.Print(v...)
	}
}

func (p *Proxy) logf(format string, v ...interface{}) {
	if p.Logger != nil {
		p.Logger.Printf(format, v...)
	} else {
		log.Printf(format, v...)
	}
}

// TransformingTransport is an implementation of http.RoundTripper that
// optionally transforms images using the options specified in the request URL
// fragment.
type TransformingTransport struct {
	// Transport is the underlying http.RoundTripper used to satisfy
	// non-transform requests (those that do not include a URL fragment).
	Transport http.RoundTripper

	// CachingClient is used to fetch images to be resized.  This client is
	// used rather than Transport directly in order to ensure that
	// responses are properly cached.
	CachingClient *http.Client

	log func(format string, v ...interface{})
}

// RoundTrip implements the http.RoundTripper interface.
func (t *TransformingTransport) RoundTrip(req *http.Request) (*http.Response, error) {
	if req.URL.Fragment == "" {
		// normal requests pass through
		if t.log != nil {
			t.log("fetching remote URL: %v", req.URL)
		}
		return t.Transport.RoundTrip(req)
	}

	f := req.URL.Fragment
	req.URL.Fragment = ""
	resp, err := t.CachingClient.Do(req)
	req.URL.Fragment = f
	if err != nil {
		return nil, err
	}

	defer resp.Body.Close()

	if should304(req, resp) {
		// bare 304 response, full response will be used from cache
		return &http.Response{StatusCode: http.StatusNotModified}, nil
	}

	b, err := ioutil.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}

	opt := ParseOptions(req.URL.Fragment)

	img, err := Transform(b, opt)
	if err != nil {
		log.Printf("error transforming image %s: %v", req.URL.String(), err)
		img = b
	}

	// replay response with transformed image and updated content length
	buf := new(bytes.Buffer)
	fmt.Fprintf(buf, "%s %s\n", resp.Proto, resp.Status)
	resp.Header.WriteSubset(buf, map[string]bool{
		"Content-Length": true,
		// exclude Content-Type header if the format may have changed during transformation
		"Content-Type": opt.Format != "" || resp.Header.Get("Content-Type") == "image/webp" || resp.Header.Get("Content-Type") == "image/tiff",
	})
	fmt.Fprintf(buf, "Content-Length: %d\n\n", len(img))
	buf.Write(img)

	return http.ReadResponse(bufio.NewReader(buf), req)
}
