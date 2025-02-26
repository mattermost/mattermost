// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"io"
	"net/http"
	"net/url"

	"github.com/mattermost/mattermost/server/public/model"
)

type AtmosCamoBackend struct {
	siteURL       *url.URL
	remoteOptions string
	remoteURL     *url.URL
	client        *http.Client
}

func makeAtmosCamoBackend(proxy *ImageProxy, proxySettings model.ImageProxySettings) *AtmosCamoBackend {
	// We deliberately ignore the error because it's from config.json.
	// The function returns a nil pointer in case of error, and we handle it when it's used.
	remoteURL, _ := url.Parse(*proxySettings.RemoteImageProxyURL)

	return &AtmosCamoBackend{
		siteURL:       proxy.siteURL,
		remoteURL:     remoteURL,
		remoteOptions: *proxySettings.RemoteImageProxyOptions,
		client:        proxy.HTTPService.MakeClient(false),
	}
}

func (backend *AtmosCamoBackend) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	http.Redirect(w, r, backend.getAtmosCamoImageURL(imageURL), http.StatusFound)
}

func (backend *AtmosCamoBackend) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	req, err := http.NewRequest("GET", backend.getAtmosCamoImageURL(imageURL), nil)
	if err != nil {
		return nil, "", Error{err}
	}

	resp, err := backend.client.Do(req)
	if err != nil {
		return nil, "", Error{err}
	}

	// Note that we don't do any additional validation of the received data since we expect the image proxy to do that
	return resp.Body, resp.Header.Get("Content-Type"), nil
}

func (backend *AtmosCamoBackend) getAtmosCamoImageURL(imageURL string) string {
	if imageURL == "" || backend.siteURL == nil {
		return imageURL
	}

	// Parse url, return siteURL in case of failure.
	// Also if the URL is opaque.
	parsedURL, err := url.Parse(imageURL)
	if err != nil || parsedURL.Opaque != "" {
		return backend.siteURL.String()
	}

	// If host is same as siteURL host/ remoteURL host, return.
	if parsedURL.Host == backend.siteURL.Host || parsedURL.Host == backend.remoteURL.Host {
		return parsedURL.String()
	}

	// Handle protocol-relative URLs.
	if parsedURL.Scheme == "" {
		parsedURL.Scheme = backend.siteURL.Scheme
	}

	// If it's a relative URL, fill up the hostname and scheme and return.
	if parsedURL.Host == "" {
		parsedURL.Host = backend.siteURL.Host
		return parsedURL.String()
	}

	urlBytes := []byte(parsedURL.String())
	mac := hmac.New(sha1.New, []byte(backend.remoteOptions))
	mac.Write(urlBytes)
	digest := hex.EncodeToString(mac.Sum(nil))

	return backend.remoteURL.String() + "/" + digest + "/" + hex.EncodeToString(urlBytes)
}
