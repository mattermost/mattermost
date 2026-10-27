// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package api4

import (
	"net/http"

	"github.com/klauspost/compress/gzhttp"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/mlog"
)

// apiCompressionHandler wraps h with compressionHandler using the server's current
// config, negotiating Brotli only for handlers that opt in via allowBrotli — large
// file downloads stay on gzip regardless of the feature flag, since Brotli's memory
// footprint scales with response size and buys little over gzip for already-large bodies.
func apiCompressionHandler(cfg *model.Config, h http.Handler, allowBrotli bool) http.Handler {
	useBrotli := allowBrotli && cfg.ServiceSettings.CompressResponsesWithBrotli(cfg.FeatureFlags.EnableBrotliCompression)
	return compressionHandler(h, cfg.ServiceSettings.CompressResponses(), useBrotli)
}

// compressionHandler wraps h to prefer Brotli when the client supports it,
// falling back to gzip, and passing through uncompressed otherwise.
func compressionHandler(h http.Handler, useCompression, useBrotli bool) http.Handler {
	gzipWrapped := h
	if useCompression {
		gzipWrapped = gzhttp.GzipHandler(h)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if useBrotli && acceptsBrotli(r) {
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
