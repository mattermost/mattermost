// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"bufio"
	"fmt"
	"net"
	"net/http"
	"strconv"
	"strings"

	"github.com/klauspost/compress/gzhttp"
	brrr "github.com/molecule-man/go-brrr"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// brotliCompressionLevel is chosen for its cost/benefit ratio: benchmarked across
// response sizes from a few hundred bytes to tens of megabytes, it consistently beats
// gzip's default level on ratio and speed while keeping memory use close to (small/medium
// responses) or a bounded multiple of (large responses) gzip's own footprint. Higher
// levels buy only marginal ratio gains for a steep rise in memory and CPU cost.
const brotliCompressionLevel = 2

// brotliMinSize reuses gzhttp's own minimum-size threshold so both compression
// paths in compressionHandler apply the same "is this worth compressing" policy.
const brotliMinSize = gzhttp.DefaultMinSize

// bodyAllowedForStatus reports whether a given response status code permits a
// body, mirroring gzhttp's own helper of the same name (RFC 7230, section 3.3).
func bodyAllowedForStatus(status int) bool {
	switch {
	case status >= 100 && status <= 199:
		return false
	case status == http.StatusNoContent:
		return false
	case status == http.StatusNotModified:
		return false
	}
	return true
}

// brotliContentTypeAllowed mirrors gzhttp.DefaultContentTypeFilter: content
// that's already compressed (video, audio, most images) gains nothing from
// brotli and isn't worth buffering entirely into memory, e.g. for the file,
// thumbnail, and preview download handlers.
func brotliContentTypeAllowed(contentType string) bool {
	return gzhttp.DefaultContentTypeFilter(contentType)
}

// brotliResponseWriter mirrors gzhttp.GzipResponseWriter's own Write/Close
// algorithm (buffer up to minSize, decide once whether to compress, then
// stream everything else directly into the compressor) so brotli responses
// get the same behavior gzip responses already have in this codebase: small
// or incompressible bodies pass through untouched, and large bodies are
// streamed rather than fully buffered in memory. go-brrr (unlike gzhttp for
// gzip/zstd) is a bare compressor with no such policy layer, so this type
// provides it.
type brotliResponseWriter struct {
	http.ResponseWriter
	bw       *brrr.Writer // set once compression starts; nil until then
	code     int          // pending status code; 0 means WriteHeader wasn't called yet
	buf      []byte       // holds the response until minSize is reached or Close
	ignore   bool         // true once we've decided not to compress
	hijacked bool         // true once the connection has been hijacked
}

func newBrotliResponseWriter(w http.ResponseWriter) *brotliResponseWriter {
	return &brotliResponseWriter{ResponseWriter: w}
}

// WriteHeader just saves the response code, mirroring gzhttp.GzipResponseWriter:
// the real header commit happens once Write/Close decides compress vs. passthrough.
func (b *brotliResponseWriter) WriteHeader(code int) {
	if code >= 100 && code <= 199 {
		b.ResponseWriter.WriteHeader(code)
		return
	}
	if b.code == 0 {
		b.code = code
	}
}

// statusCode returns the pending status code, defaulting to 200 if the
// handler never called WriteHeader, matching net/http's own default.
func (b *brotliResponseWriter) statusCode() int {
	if b.code == 0 {
		return http.StatusOK
	}
	return b.code
}

func (b *brotliResponseWriter) Write(p []byte) (int, error) {
	if b.bw != nil {
		return b.bw.Write(p)
	}
	if b.ignore {
		return b.ResponseWriter.Write(p)
	}

	// Matches net/http: the first Write without a prior WriteHeader locks in
	// 200, and any WriteHeader call after that is a no-op on the real
	// ResponseWriter — so it must be a no-op here too.
	if b.code == 0 {
		b.code = http.StatusOK
	}

	toAdd := len(p)
	if len(b.buf)+toAdd > brotliMinSize {
		toAdd = brotliMinSize - len(b.buf)
	}
	b.buf = append(b.buf, p[:toAdd]...)
	remain := p[toAdd:]

	if len(b.buf) < brotliMinSize {
		// Not enough data yet to decide; wait for more Writes or Close.
		return len(p), nil
	}

	if err := b.startCompression(remain); err != nil {
		return 0, err
	}
	return len(p), nil
}

// startCompression commits headers, decides compress vs. passthrough based on
// content-type, and (if compressing) writes the buffered bytes plus remain
// through the brotli writer. Mirrors gzhttp's startCompression.
func (b *brotliResponseWriter) startCompression(remain []byte) error {
	h := b.ResponseWriter.Header()
	h.Add("Vary", "Accept-Encoding")

	code := b.statusCode()

	// A handler that already declared its own Content-Encoding has either
	// pre-compressed the body itself or opted out of transparent compression;
	// compressing it again would corrupt the response, so pass it through as-is.
	alreadyEncoded := h.Get("Content-Encoding") != ""

	// A ranged response (e.g. from http.ServeContent) has Content-Range set;
	// compressing it would corrupt the byte range the client asked for, since
	// the range refers to the uncompressed body. Matches gzhttp's own check.
	isRanged := h.Get("Content-Range") != ""

	_, hasContentType := h["Content-Type"]
	ct := h.Get("Content-Type")
	if !hasContentType && bodyAllowedForStatus(code) && len(b.buf) > 0 {
		// Detect Content-Type from the buffered plain bytes before compressing —
		// once Content-Encoding is set, net/http's own sniffing (which normally
		// runs on Write when Content-Type is unset) would otherwise sniff the
		// compressed bytes instead, matching gzhttp's own behavior. Checking the
		// header key's presence (not just whether its value is "") distinguishes
		// "never set" from a handler explicitly setting an empty Content-Type to
		// opt out of sniffing — the same distinction gzhttp itself makes.
		ct = http.DetectContentType(b.buf)
		h.Set("Content-Type", ct)
	}

	if alreadyEncoded || isRanged || !bodyAllowedForStatus(code) || !brotliContentTypeAllowed(ct) {
		return b.startPlain(remain)
	}

	bw, err := brrr.NewWriter(b.ResponseWriter, brotliCompressionLevel)
	if err != nil {
		mlog.Warn("Failed to create brotli writer, sending uncompressed response", mlog.Err(err))
		return b.startPlain(remain)
	}
	b.bw = bw

	h.Set("Content-Encoding", "br")
	// If the handler already set an explicit Content-Length (e.g. compliance.go),
	// it describes the uncompressed size and must not survive into a compressed
	// response, or the client will misread the body boundary.
	h.Del("Content-Length")
	b.ResponseWriter.WriteHeader(code)

	if len(b.buf) > 0 {
		if _, err := b.bw.Write(b.buf); err != nil {
			return err
		}
		b.buf = nil
	}
	if len(remain) > 0 {
		if _, err := b.bw.Write(remain); err != nil {
			return err
		}
	}
	return nil
}

// startPlain commits headers and writes any buffered bytes through unmodified,
// mirroring gzhttp's startPlain. Only reachable before headers are committed
// (Content-Encoding is never set on this path), so header mutation is still safe.
func (b *brotliResponseWriter) startPlain(remain []byte) error {
	b.ResponseWriter.WriteHeader(b.statusCode())
	b.ignore = true
	if len(b.buf) > 0 {
		if _, err := b.ResponseWriter.Write(b.buf); err != nil {
			return err
		}
		b.buf = nil
	}
	if len(remain) > 0 {
		if _, err := b.ResponseWriter.Write(remain); err != nil {
			return err
		}
	}
	return nil
}

// Close finalizes the response. If compression never started because the whole
// body stayed under minSize, decide now: too small to bother, so send it plain.
// Otherwise close the brotli stream. Mirrors gzhttp.GzipResponseWriter.Close.
func (b *brotliResponseWriter) Close() error {
	if b.hijacked || b.ignore {
		return nil
	}
	if b.bw == nil {
		if len(b.buf) < brotliMinSize {
			return b.startPlain(nil)
		}
		return b.startCompression(nil)
	}
	return b.bw.Close()
}

// Flush flushes the underlying brotli writer (if compression has started) and
// then the underlying ResponseWriter, matching gzhttp.GzipResponseWriter.Flush.
// If not enough data has been written to decide compress-vs-passthrough, this
// starts compression now so buffered data is actually sent, exactly like gzhttp.
func (b *brotliResponseWriter) Flush() {
	if b.hijacked {
		return
	}
	if b.bw == nil && !b.ignore {
		if len(b.buf) == 0 {
			// Nothing written yet.
			return
		}
		if err := b.startCompression(nil); err != nil {
			mlog.Warn("Failed to start brotli compression on flush", mlog.Err(err))
			return
		}
	}
	if b.bw != nil {
		if err := b.bw.Flush(); err != nil {
			mlog.Warn("Failed to flush brotli writer", mlog.Err(err))
		}
	}
	if f, ok := b.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}

// Hijack implements http.Hijacker by delegating to the underlying ResponseWriter,
// the same pattern gzhttp.GzipResponseWriter uses — without it, WebSocket upgrades
// routed through this writer would fail to take over the connection.
func (b *brotliResponseWriter) Hijack() (net.Conn, *bufio.ReadWriter, error) {
	if hj, ok := b.ResponseWriter.(http.Hijacker); ok {
		conn, rw, err := hj.Hijack()
		if err == nil {
			b.hijacked = true
		}
		return conn, rw, err
	}
	return nil, nil, fmt.Errorf("http.Hijacker interface is not supported")
}

// acceptsBrotli reports whether the client's Accept-Encoding header accepts
// the "br" coding, honoring q-values (e.g. "br;q=0" means "not accepted")
// rather than doing a naive substring match.
func acceptsBrotli(r *http.Request) bool {
	header := r.Header.Get("Accept-Encoding")
	for token := range strings.SplitSeq(header, ",") {
		token = strings.TrimSpace(token)
		if token == "" {
			continue
		}
		coding, params, _ := strings.Cut(token, ";")
		coding = strings.TrimSpace(coding)
		if !strings.EqualFold(coding, "br") {
			continue
		}
		if params == "" {
			return true
		}
		return acceptEncodingQAllowsCompression(params)
	}
	return false
}

// acceptEncodingQAllowsCompression parses the ";q=..." parameter portion of an
// Accept-Encoding token and reports whether it permits use of that coding
// (i.e. is absent, unparsable, or a non-zero quality value).
func acceptEncodingQAllowsCompression(params string) bool {
	for param := range strings.SplitSeq(params, ";") {
		name, value, found := strings.Cut(param, "=")
		if !found || !strings.EqualFold(strings.TrimSpace(name), "q") {
			continue
		}
		q, err := strconv.ParseFloat(strings.TrimSpace(value), 64)
		if err != nil {
			return true
		}
		return q > 0
	}
	return true
}

// compressionHandler wraps h to prefer Brotli when the client supports it,
// falling back to gzip, and passing through uncompressed otherwise.
func compressionHandler(h http.Handler, useCompression bool) http.Handler {
	gzipWrapped := h
	if useCompression {
		gzipWrapped = gzhttp.GzipHandler(h)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if useCompression && acceptsBrotli(r) {
			bbw := newBrotliResponseWriter(w)
			defer func() {
				if err := bbw.Close(); err != nil {
					mlog.Warn("Failed to close brotli response writer", mlog.Err(err))
				}
			}()
			h.ServeHTTP(bbw, r)
			return
		}
		gzipWrapped.ServeHTTP(w, r)
	})
}
