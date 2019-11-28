// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"errors"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"net/url"

	"github.com/mattermost/mattermost-server/v5/mlog"
	"github.com/mattermost/mattermost-server/v5/services/httpservice"
	"willnorris.com/go/imageproxy"
)

var imageContentTypes = []string{
	"image/bmp", "image/cgm", "image/g3fax", "image/gif", "image/ief", "image/jp2",
	"image/jpeg", "image/jpg", "image/pict", "image/png", "image/prs.btif", "image/svg+xml",
	"image/tiff", "image/vnd.adobe.photoshop", "image/vnd.djvu", "image/vnd.dwg",
	"image/vnd.dxf", "image/vnd.fastbidsheet", "image/vnd.fpx", "image/vnd.fst",
	"image/vnd.fujixerox.edmics-mmr", "image/vnd.fujixerox.edmics-rlc",
	"image/vnd.microsoft.icon", "image/vnd.ms-modi", "image/vnd.net-fpx", "image/vnd.wap.wbmp",
	"image/vnd.xiff", "image/webp", "image/x-cmu-raster", "image/x-cmx", "image/x-icon",
	"image/x-macpaint", "image/x-pcx", "image/x-pict", "image/x-portable-anymap",
	"image/x-portable-bitmap", "image/x-portable-graymap", "image/x-portable-pixmap",
	"image/x-quicktime", "image/x-rgb", "image/x-xbitmap", "image/x-xpixmap", "image/x-xwindowdump",
}

var ErrLocalRequestFailed = Error{errors.New("imageproxy.LocalBackend: failed to request proxied image")}

type LocalBackend struct {
	proxy *ImageProxy

	// The underlying image proxy implementation provided by the third party library
	impl *imageproxy.Proxy
}

func makeLocalBackend(proxy *ImageProxy) *LocalBackend {
	impl := imageproxy.NewProxy(proxy.HTTPService.MakeTransport(false), nil)

	if proxy.Logger != nil {
		logger, err := proxy.Logger.StdLogAt(mlog.LevelDebug, mlog.String("image_proxy", "local"))
		if err != nil {
			mlog.Error("Failed to initialize logger for image proxy", mlog.Err(err))
		}

		impl.Logger = logger
	}

	baseURL, err := url.Parse(*proxy.ConfigService.Config().ServiceSettings.SiteURL)
	if err != nil {
		mlog.Error("Failed to set base URL for image proxy. Relative image links may not work.", mlog.Err(err))
	} else {
		impl.DefaultBaseURL = baseURL
	}

	impl.Timeout = httpservice.RequestTimeout
	impl.ContentTypes = imageContentTypes

	return &LocalBackend{
		proxy: proxy,
		impl:  impl,
	}
}

func (backend *LocalBackend) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	// The interface to the proxy only exposes a ServeHTTP method, so fake a request to it
	req, err := http.NewRequest(http.MethodGet, "/"+imageURL, nil)
	if err != nil {
		// http.NewRequest should only return an error on an invalid URL
		mlog.Error("Failed to create request for proxied image", mlog.String("url", imageURL), mlog.Err(err))

		w.WriteHeader(http.StatusBadRequest)
		w.Write([]byte{})
		return
	}

	w.Header().Set("X-Frame-Options", "deny")
	w.Header().Set("X-XSS-Protection", "1; mode=block")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.Header().Set("Content-Security-Policy", "default-src 'none'; img-src data:; style-src 'unsafe-inline'")

	backend.impl.ServeHTTP(w, req)
}

func (backend *LocalBackend) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	// The interface to the proxy only exposes a ServeHTTP method, so fake a request to it
	req, err := http.NewRequest(http.MethodGet, "/"+imageURL, nil)
	if err != nil {
		return nil, "", Error{err}
	}

	recorder := httptest.NewRecorder()

	backend.impl.ServeHTTP(recorder, req)

	if recorder.Code != http.StatusOK {
		return nil, "", ErrLocalRequestFailed
	}

	return ioutil.NopCloser(recorder.Body), recorder.Header().Get("Content-Type"), nil
}
