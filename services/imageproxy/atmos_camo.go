// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package imageproxy

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/hex"
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

func (backend *AtmosCamoBackend) GetProxiedImageURL(imageURL string) string {
	cfg := *backend.proxy.ConfigService.Config()
	siteURL := *cfg.ServiceSettings.SiteURL
	proxyURL := *cfg.ImageProxySettings.RemoteImageProxyURL
	options := *cfg.ImageProxySettings.RemoteImageProxyOptions

	if imageURL == "" || imageURL[0] == '/' || strings.HasPrefix(imageURL, siteURL) || strings.HasPrefix(imageURL, proxyURL) {
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
