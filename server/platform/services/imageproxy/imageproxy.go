// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package imageproxy

import (
	"errors"
	"io"
	"net/http"
	"net/url"
	"strings"
	"sync"

	"github.com/mattermost/mattermost-server/server/v8/model"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/configservice"
	"github.com/mattermost/mattermost-server/server/v8/platform/services/httpservice"
	"github.com/mattermost/mattermost-server/server/v8/platform/shared/mlog"
)

var ErrNotEnabled = Error{errors.New("imageproxy.ImageProxy: image proxy not enabled")}

// An ImageProxy is the public interface for Mattermost's image proxy. An instance of ImageProxy should be created
// using MakeImageProxy which requires a configService and an HTTPService provided by the server.
type ImageProxy struct {
	ConfigService    configservice.ConfigService
	configListenerID string

	HTTPService httpservice.HTTPService

	Logger *mlog.Logger

	siteURL *url.URL
	lock    sync.RWMutex
	backend ImageProxyBackend
}

// An ImageProxyBackend provides the functionality for different types of image proxies. An ImageProxy will construct
// the required backend depending on the ImageProxySettings provided by the ConfigService.
type ImageProxyBackend interface {
	// GetImage provides a proxied image in response to an HTTP request.
	GetImage(w http.ResponseWriter, r *http.Request, imageURL string)

	// GetImageDirect returns a proxied image along with its content type.
	GetImageDirect(imageURL string) (io.ReadCloser, string, error)
}

func MakeImageProxy(configService configservice.ConfigService, httpService httpservice.HTTPService, logger *mlog.Logger) *ImageProxy {
	proxy := &ImageProxy{
		ConfigService: configService,
		HTTPService:   httpService,
		Logger:        logger,
	}

	// We deliberately ignore the error because it's from config.json.
	// The function returns a nil pointer in case of error, and we handle it when it's used.
	siteURL, _ := url.Parse(*configService.Config().ServiceSettings.SiteURL)
	proxy.siteURL = siteURL

	proxy.configListenerID = proxy.ConfigService.AddConfigListener(proxy.OnConfigChange)

	config := proxy.ConfigService.Config()
	proxy.backend = proxy.makeBackend(*config.ImageProxySettings.Enable, *config.ImageProxySettings.ImageProxyType)

	return proxy
}

func (proxy *ImageProxy) makeBackend(enable bool, proxyType string) ImageProxyBackend {
	if !enable {
		return nil
	}

	switch proxyType {
	case model.ImageProxyTypeLocal:
		return makeLocalBackend(proxy)
	case model.ImageProxyTypeAtmosCamo:
		return makeAtmosCamoBackend(proxy)
	default:
		return nil
	}
}

func (proxy *ImageProxy) Close() {
	proxy.lock.Lock()
	defer proxy.lock.Unlock()

	proxy.ConfigService.RemoveConfigListener(proxy.configListenerID)
}

func (proxy *ImageProxy) OnConfigChange(oldConfig, newConfig *model.Config) {
	if *oldConfig.ImageProxySettings.Enable != *newConfig.ImageProxySettings.Enable ||
		*oldConfig.ImageProxySettings.ImageProxyType != *newConfig.ImageProxySettings.ImageProxyType {
		proxy.lock.Lock()
		defer proxy.lock.Unlock()

		proxy.backend = proxy.makeBackend(*newConfig.ImageProxySettings.Enable, *newConfig.ImageProxySettings.ImageProxyType)
	}
}

// GetImage takes an HTTP request for an image and requests that image using the image proxy.
func (proxy *ImageProxy) GetImage(w http.ResponseWriter, r *http.Request, imageURL string) {
	proxy.lock.RLock()
	defer proxy.lock.RUnlock()

	if proxy.backend == nil {
		w.WriteHeader(http.StatusNotImplemented)
		return
	}

	proxy.backend.GetImage(w, r, imageURL)
}

// GetImageDirect takes the URL of an image and returns the image along with its content type.
func (proxy *ImageProxy) GetImageDirect(imageURL string) (io.ReadCloser, string, error) {
	proxy.lock.RLock()
	defer proxy.lock.RUnlock()

	if proxy.backend == nil {
		return nil, "", ErrNotEnabled
	}

	return proxy.backend.GetImageDirect(imageURL)
}

// GetProxiedImageURL takes the URL of an image and returns a URL that can be used to view that image through the
// image proxy.
func (proxy *ImageProxy) GetProxiedImageURL(imageURL string) string {
	if imageURL == "" || proxy.siteURL == nil {
		return imageURL
	}
	// Parse url, return siteURL in case of failure.
	// Also if the URL is opaque.
	parsedURL, err := url.Parse(imageURL)
	if err != nil || parsedURL.Opaque != "" {
		return proxy.siteURL.String()
	}
	// If host is same as siteURL host, return.
	if parsedURL.Host == proxy.siteURL.Host {
		return parsedURL.String()
	}

	// Handle protocol-relative URLs.
	if parsedURL.Scheme == "" {
		parsedURL.Scheme = proxy.siteURL.Scheme
	}

	// If it's a relative URL, fill up the hostname and return.
	if parsedURL.Host == "" {
		parsedURL.Host = proxy.siteURL.Host
		return parsedURL.String()
	}

	return proxy.siteURL.String() + "/api/v4/image?url=" + url.QueryEscape(parsedURL.String())
}

// GetUnproxiedImageURL takes the URL of an image on the image proxy and returns the original URL of the image.
func (proxy *ImageProxy) GetUnproxiedImageURL(proxiedURL string) string {
	return getUnproxiedImageURL(proxiedURL, *proxy.ConfigService.Config().ServiceSettings.SiteURL)
}

func getUnproxiedImageURL(proxiedURL, siteURL string) string {
	if !strings.HasPrefix(proxiedURL, siteURL+"/api/v4/image?url=") {
		return proxiedURL
	}

	parsed, err := url.Parse(proxiedURL)
	if err != nil {
		return proxiedURL
	}

	u := parsed.Query()["url"]
	if len(u) == 0 {
		return proxiedURL
	}

	return u[0]
}
