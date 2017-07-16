package jira

import (
	"bytes"
	"encoding/json"
	"io"
	"io/ioutil"
	"net/http"
	"net/http/httptest"
	"os"
	"testing"

	"github.com/mattermost/platform/app/plugin/plugintest"
	"github.com/mattermost/platform/model"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"
	"github.com/stretchr/testify/require"
)

func validRequestBody() io.ReadCloser {
	if f, err := os.Open("testdata/webhook_sample.json"); err != nil {
		panic(err)
	} else {
		return f
	}
}

func TestHandleWebhook(t *testing.T) {
	f, err := os.Open("testdata/webhook_sample.json")
	require.NoError(t, err)
	defer f.Close()
	var webhook Webhook
	require.NoError(t, json.NewDecoder(f).Decode(&webhook))
	expectedText, err := webhook.PostText()
	require.NoError(t, err)

	for name, tc := range map[string]struct {
		Configuration      Configuration
		Request            *http.Request
		CreatePostError    *model.AppError
		ExpectedStatusCode int
	}{
		"no configuration": {
			Configuration:      Configuration{},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"no user configuration": {
			Configuration: Configuration{
				Enabled: true,
				Secret:  "thesecret",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"wrong secret": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "differentsecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"invalid body": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", ioutil.NopCloser(bytes.NewBufferString("foo"))),
			ExpectedStatusCode: http.StatusBadRequest,
		},
		"invalid channel": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=notthechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusBadRequest,
		},
		"invalid team": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=nottheteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusBadRequest,
		},
		"valid request": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusOK,
		},
		"valid dm request": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?channel=@theotheruser&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusOK,
		},
		"create post error": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			CreatePostError:    model.NewAppError("foo", "bar", nil, "", http.StatusInternalServerError),
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusInternalServerError,
		},
		"wrong path": {
			Configuration: Configuration{
				Enabled:  true,
				Secret:   "thesecret",
				UserName: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/not-webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusNotFound,
		},
	} {
		api := &plugintest.APIMock{}

		api.On("LoadPluginConfiguration", mock.AnythingOfType("*jira.Configuration")).Run(func(args mock.Arguments) {
			*args.Get(0).(*Configuration) = tc.Configuration
		}).Return(nil)

		api.On("GetUserByName", mock.AnythingOfType("string")).Return(func(name string) (*model.User, *model.AppError) {
			return &model.User{
				Id: name + "id",
			}, nil
		})

		api.On("GetTeamByName", "theteam").Return(&model.Team{
			Id: "theteamid",
		}, (*model.AppError)(nil))

		api.On("GetTeamByName", "nottheteam").Return((*model.Team)(nil), model.NewAppError("foo", "bar", nil, "", http.StatusBadRequest))

		api.On("GetChannelByName", "theteamid", "thechannel").Run(func(args mock.Arguments) {
			api.On("CreatePost", "theteamid", "theuserid", "thechannelid", expectedText).Return(&model.Post{}, tc.CreatePostError)
		}).Return(&model.Channel{
			Id:     "thechannelid",
			TeamId: "theteamid",
		}, (*model.AppError)(nil))

		api.On("GetDirectChannel", "theuserid", "theotheruserid").Run(func(args mock.Arguments) {
			api.On("CreatePost", "", "theuserid", "thedmchannelid", expectedText).Return(&model.Post{}, tc.CreatePostError)
		}).Return(&model.Channel{
			Id: "thedmchannelid",
		}, (*model.AppError)(nil))

		api.On("GetChannelByName", "theteamid", "notthechannel").Return((*model.Channel)(nil), model.NewAppError("foo", "bar", nil, "", http.StatusBadRequest))

		p := Plugin{}
		p.Initialize(api)

		w := httptest.NewRecorder()
		api.PluginRouter().ServeHTTP(w, tc.Request)
		assert.Equal(t, tc.ExpectedStatusCode, w.Result().StatusCode, "test case: "+name)
	}
}
