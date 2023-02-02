package web

import (
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

var UnsafeContentTypes = [...]string{
	"application/javascript",
	"application/ecmascript",
	"text/javascript",
	"text/ecmascript",
	"application/x-javascript",
	"text/html",
}

var MediaContentTypes = [...]string{
	"image/jpeg",
	"image/png",
	"image/bmp",
	"image/gif",
	"image/tiff",
	"video/avi",
	"video/mpeg",
	"video/mp4",
	"audio/mpeg",
	"audio/wav",
}

func WriteFileResponse(filename string, contentType string, contentSize int64, lastModification time.Time, webserverMode string, fileReader io.ReadSeeker, forceDownload bool, w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Cache-Control", "private, no-cache")
	w.Header().Set("X-Content-Type-Options", "nosniff")

	if contentSize > 0 {
		contentSizeStr := strconv.Itoa(int(contentSize))
		if webserverMode == "gzip" {
			w.Header().Set("X-Uncompressed-Content-Length", contentSizeStr)
		} else {
			w.Header().Set("Content-Length", contentSizeStr)
		}
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	} else {
		for _, unsafeContentType := range UnsafeContentTypes {
			if strings.HasPrefix(contentType, unsafeContentType) {
				contentType = "text/plain"
				break
			}
		}
	}

	w.Header().Set("Content-Type", contentType)

	var toDownload bool
	if forceDownload {
		toDownload = true
	} else {
		isMediaType := false

		for _, mediaContentType := range MediaContentTypes {
			if strings.HasPrefix(contentType, mediaContentType) {
				isMediaType = true
				break
			}
		}

		toDownload = !isMediaType
	}

	filename = url.PathEscape(filename)

	if toDownload {
		w.Header().Set("Content-Disposition", "attachment;filename=\""+filename+"\"; filename*=UTF-8''"+filename)
	} else {
		w.Header().Set("Content-Disposition", "inline;filename=\""+filename+"\"; filename*=UTF-8''"+filename)
	}

	// prevent file links from being embedded in iframes
	w.Header().Set("X-Frame-Options", "DENY")
	w.Header().Set("Content-Security-Policy", "Frame-ancestors 'none'")

	http.ServeContent(w, r, filename, lastModification, fileReader)
}
