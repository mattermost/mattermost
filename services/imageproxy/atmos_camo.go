// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package imageproxy

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
	"io"
	"net/http"
	"strings"
)

type AtmosCamoBackend struct {
	proxy *ImageProxy
}

func makeAtmosCamoBackend(proxy *ImageProxy) *AtmosCamoBackend {
	return &AtmosCamoBackend{
		proxy: proxy,
	}
}

func (backend *AtmosCamoBackend) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	http.Redirect(w, r, backend.GetProxiedImageURL(imageURL), http.StatusFound)
}

func (backend *AtmosCamoBackend) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	req, err := http.NewRequest("GET", backend.GetProxiedImageURL(imageURL), nil)
	if err != nil {
		return nil, "", Error{err}
	}

	client := backend.proxy.HTTPService.MakeClient(false)

	resp, err := client.Do(req)
	if err != nil {
		return nil, "", Error{err}
	}

	// Note that we don't do any additional validation of the received data since we expect the image proxy to do that
	return resp.Body, resp.Header.Get("Content-Type"), nil
}

func (backend *AtmosCamoBackend) GetProxiedImageURL(imageURL string) string {
	cfg := *backend.proxy.ConfigService.Config()
	siteURL := *cfg.ServiceSettings.SiteURL
	proxyURL := *cfg.ImageProxySettings.RemoteImageProxyURL
	options := *cfg.ImageProxySettings.RemoteImageProxyOptions

	return getAtmosCamoImageURL(imageURL, siteURL, proxyURL, options)
}

func getAtmosCamoImageURL(imageURL, siteURL, proxyURL, options string) string {
	// Don't proxy blank images, relative URLs, absolute URLs on this server, or URLs that are already going through the proxy
	if imageURL == "" || imageURL[0] == '/' || (siteURL != "" && strings.HasPrefix(imageURL, siteURL)) || strings.HasPrefix(imageURL, proxyURL) {
		return imageURL
	}

	mac := hmac.New(sha1.New, []byte(options))
	mac.Write([]byte(imageURL))
	digest := hex.EncodeToString(mac.Sum(nil))

	return proxyURL + "/" + digest + "/" + hex.EncodeToString([]byte(imageURL))
}

func (backend *AtmosCamoBackend) GetUnproxiedImageURL(proxiedURL string) string {
	proxyURL := *backend.proxy.ConfigService.Config().ImageProxySettings.RemoteImageProxyURL + "/"

	if !strings.HasPrefix(proxiedURL, proxyURL) {
		return proxiedURL
	}

	path := proxiedURL[len(proxyURL):]

	slash := strings.IndexByte(path, '/')
	if slash == -1 {
		return proxiedURL
	}

	decoded, err := hex.DecodeString(path[slash+1:])
	if err != nil {
		return proxiedURL
	}

	return string(decoded)
}
