// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package api4

import (
	"net/http"
	"net/url"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
)

func TestGetImage(t *testing.T) {
	th := Setup().InitBasic()
	defer th.TearDown()

	th.Client.HttpClient.CheckRedirect = func(*http.Request, []*http.Request) error {
		return http.ErrUseLastResponse
	}

	originURL := "http://foo.bar/baz.gif"

	r, err := http.NewRequest("GET", th.Client.ApiUrl+"/image?url="+url.QueryEscape(originURL), nil)
	require.NoError(t, err)
	r.Header.Set(model.HEADER_AUTH, th.Client.AuthType+" "+th.Client.AuthToken)

	imageProxyType := th.App.Config().ServiceSettings.ImageProxyType
	imageProxyOptions := th.App.Config().ServiceSettings.ImageProxyOptions
	imageProxyURL := th.App.Config().ServiceSettings.ImageProxyURL
	defer func() {
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.ImageProxyType = imageProxyType })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.ImageProxyOptions = imageProxyOptions })
		th.App.UpdateConfig(func(cfg *model.Config) { cfg.ServiceSettings.ImageProxyOptions = imageProxyURL })
	}()

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.ImageProxyType = nil
	})

	resp, err := th.Client.HttpClient.Do(r)
	require.NoError(t, err)
	assert.Equal(t, http.StatusNotFound, resp.StatusCode)

	th.App.UpdateConfig(func(cfg *model.Config) {
		cfg.ServiceSettings.ImageProxyType = model.NewString("atmos/camo")
		cfg.ServiceSettings.ImageProxyOptions = model.NewString("foo")
		cfg.ServiceSettings.ImageProxyURL = model.NewString("https://proxy.foo.bar")
	})

	r, err = http.NewRequest("GET", th.Client.ApiUrl+"/image?url="+originURL, nil)
	require.NoError(t, err)
	r.Header.Set(model.HEADER_AUTH, th.Client.AuthType+" "+th.Client.AuthToken)

	resp, err = th.Client.HttpClient.Do(r)
	require.NoError(t, err)
	assert.Equal(t, http.StatusFound, resp.StatusCode)
	assert.Equal(t, "https://proxy.foo.bar/004afe2ef382eb5f30c4490f793f8a8c5b33d8a2/687474703a2f2f666f6f2e6261722f62617a2e676966", resp.Header.Get("Location"))
}
