// Copyright (c) 2017-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

// The plugintest package provides mocks that can be used to test plugins. For example, to test the
// ServeHTTP method of the plugin package's HelloUser example:
//
//    package plugin_test
//
//    import (
//        "io/ioutil"
//        "net/http/httptest"
//        "testing"
//
//        "github.com/stretchr/testify/assert"
//        "github.com/stretchr/testify/require"
//
//        "github.com/mattermost/mattermost-server/model"
//        "github.com/mattermost/mattermost-server/plugin/plugintest"
//    )
//
//    func TestHelloUserPlugin(t *testing.T) {
//        user := &model.User{
//            Id:       model.NewId(),
//            Username: "billybob",
//        }
//
//        api := &plugintest.API{}
//        api.On("GetUser", user.Id).Return(user, nil)
//        defer api.AssertExpectations(t)
//
//        p := &HelloUserPlugin{}
//        p.OnActivate(api)
//
//        w := httptest.NewRecorder()
//        r := httptest.NewRequest("GET", "/", nil)
//        r.Header.Add("Mattermost-User-Id", user.Id)
//        p.ServeHTTP(w, r)
//        body, err := ioutil.ReadAll(w.Result().Body)
//        require.NoError(t, err)
//        assert.Equal(t, "Welcome back, billybob!", string(body))
//    }
//
// The mocks are created using testify's mock package:
// https://godoc.org/github.com/stretchr/testify/mock
//
// If you need to import the mock package, you can import it with
// "github.com/mattermost/mattermost-server/plugin/plugintest/mock".
package plugintest
