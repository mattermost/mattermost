// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"bytes"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/mattermost/mattermost/server/public/shared/httpservice"
	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func makeTestLocalProxy() *ImageProxy {
	configService := &testutils.StaticConfigService{
		Cfg: &model.Config{
			ServiceSettings: model.ServiceSettings{
				SiteURL:                             model.NewPointer("https://mattermost.example.com"),
				AllowedUntrustedInternalConnections: model.NewPointer("127.0.0.1"),
			},
			ImageProxySettings: model.ImageProxySettings{
				Enable:         model.NewPointer(true),
				ImageProxyType: model.NewPointer(model.ImageProxyTypeLocal),
			},
		},
	}

	return MakeImageProxy(configService, httpservice.MakeHTTPService(configService), nil)
}

func TestLocalBackend_GetImage(t *testing.T) {
	t.Run("image", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "max-age=2592000, private")
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Content-Length", "10")

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("1111111111"))
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "max-age=2592000, private", resp.Header.Get("Cache-Control"))
		assert.Equal(t, "10", resp.Header.Get("Content-Length"))

		respBody, _ := io.ReadAll(resp.Body)
		assert.Equal(t, []byte("1111111111"), respBody)
	})

	t.Run("not an image", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotAcceptable)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/file.pdf")
		resp := recorder.Result()

		require.Equal(t, http.StatusNotAcceptable, resp.StatusCode)
	})

	t.Run("not an image, but remote server ignores accept header", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "max-age=2592000, private")
			w.Header().Set("Content-Type", "application/pdf")
			w.Header().Set("Content-Length", "10")

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("1111111111"))
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/file.pdf")
		resp := recorder.Result()

		require.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("not found", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		require.Equal(t, http.StatusNotFound, resp.StatusCode)
	})

	t.Run("other server error", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		require.Equal(t, http.StatusInternalServerError, resp.StatusCode)
	})

	t.Run("timeout", func(t *testing.T) {
		wait := make(chan bool, 1)

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-wait
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		// Modify the timeout to be much shorter than the default 30 seconds
		proxy.backend.(*LocalBackend).client.Timeout = time.Millisecond

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		require.Equal(t, http.StatusGatewayTimeout, resp.StatusCode)

		wait <- true
	})

	t.Run("unsupported SVG content type", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "max-age=2592000, private")
			w.Header().Set("Content-Type", "image/svg+xml")
			w.Header().Set("Content-Length", "10")

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("1111111111"))
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/test.svg")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("SVG body with image/png content type", func(t *testing.T) {
		body := []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect width="100" height="100"/></svg>`)
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")

			w.WriteHeader(http.StatusOK)
			w.Write(body)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("XML-based SVG with image/png content type", func(t *testing.T) {
		body := []byte(`<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`)
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")

			w.WriteHeader(http.StatusOK)
			w.Write(body)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("UTF-16 LE BOM SVG with image/png content type", func(t *testing.T) {
		// Build a UTF-16 LE payload with BOM: 0xFF 0xFE followed by each ASCII
		// character of the SVG tag as a two-byte little-endian code unit.
		svgASCII := `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`
		body := []byte{0xFF, 0xFE} // UTF-16 LE BOM
		for _, c := range svgASCII {
			body = append(body, byte(c), 0x00)
		}
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")
			w.WriteHeader(http.StatusOK)
			w.Write(body)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("UTF-16 BE BOM SVG with image/png content type", func(t *testing.T) {
		// Build a UTF-16 BE payload with BOM: 0xFE 0xFF followed by each ASCII
		// character as a two-byte big-endian code unit.
		svgASCII := `<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`
		body := []byte{0xFE, 0xFF} // UTF-16 BE BOM
		for _, c := range svgASCII {
			body = append(body, 0x00, byte(c))
		}
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")
			w.WriteHeader(http.StatusOK)
			w.Write(body)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("SVG body with leading whitespace prefix", func(t *testing.T) {
		prefix := bytes.Repeat([]byte(" "), 600)
		body := append(prefix, []byte(`<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>`)...)
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Content-Type", "image/png")

			w.WriteHeader(http.StatusOK)
			w.Write(body)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, err := http.NewRequest(http.MethodGet, "", nil)
		require.NoError(t, err)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		assert.Equal(t, http.StatusForbidden, resp.StatusCode)
	})

	t.Run("Redirect", func(t *testing.T) {
		var mock *httptest.Server
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			switch r.URL.Path {
			case "/image.png":
				w.Header().Set("Location", mock.URL+"/image2.png")
				w.WriteHeader(http.StatusMovedPermanently)
			case "/image2.png":
				w.Header().Set("Cache-Control", "max-age=2592000, private")
				w.Header().Set("Content-Type", "image/png")
				w.Header().Set("Content-Length", "10")

				w.WriteHeader(http.StatusOK)
				w.Write([]byte("1111111111"))
			}
		})

		mock = httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		recorder := httptest.NewRecorder()
		request, _ := http.NewRequest(http.MethodGet, "", nil)
		proxy.GetImage(recorder, request, mock.URL+"/image.png")
		resp := recorder.Result()

		require.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "10", resp.Header.Get("Content-Length"))
	})
}

func TestLocalBackend_GetImageDirect(t *testing.T) {
	t.Run("image", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "max-age=2592000, private")
			w.Header().Set("Content-Type", "image/png")
			w.Header().Set("Content-Length", "10")

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("1111111111"))
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/image.png")

		assert.NoError(t, err)
		assert.Equal(t, "image/png", contentType)

		respBody, _ := io.ReadAll(body)
		assert.Equal(t, []byte("1111111111"), respBody)
	})

	t.Run("not an image", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotAcceptable)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/file.pdf")

		assert.Error(t, err)
		assert.Equal(t, "", contentType)
		assert.Equal(t, ErrLocalRequestFailed, err)
		assert.Nil(t, body)
	})

	t.Run("not an image, but remote server ignores accept header", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.Header().Set("Cache-Control", "max-age=2592000, private")
			w.Header().Set("Content-Type", "application/pdf")
			w.Header().Set("Content-Length", "10")

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("1111111111"))
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/file.pdf")

		assert.Error(t, err)
		assert.Equal(t, "", contentType)
		assert.Equal(t, ErrLocalRequestFailed, err)
		assert.Nil(t, body)
	})

	t.Run("not found", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusNotFound)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/image.png")

		assert.Error(t, err)
		assert.Equal(t, "", contentType)
		assert.Equal(t, ErrLocalRequestFailed, err)
		assert.Nil(t, body)
	})

	t.Run("other server error", func(t *testing.T) {
		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			w.WriteHeader(http.StatusInternalServerError)
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/image.png")

		assert.Error(t, err)
		assert.Equal(t, "", contentType)
		assert.Equal(t, ErrLocalRequestFailed, err)
		assert.Nil(t, body)
	})

	t.Run("timeout", func(t *testing.T) {
		wait := make(chan bool, 1)

		handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			<-wait
		})

		mock := httptest.NewServer(handler)
		defer mock.Close()

		proxy := makeTestLocalProxy()

		// Modify the timeout to be much shorter than the default 30 seconds
		proxy.backend.(*LocalBackend).client.Timeout = time.Millisecond

		body, contentType, err := proxy.GetImageDirect(mock.URL + "/image.png")

		assert.Error(t, err)
		assert.Equal(t, "", contentType)
		assert.Equal(t, ErrLocalRequestFailed, err)
		assert.Nil(t, body)

		wait <- true
	})
}
