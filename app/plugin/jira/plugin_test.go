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
	for name, tc := range map[string]struct {
		Configuration      Configuration
		Request            *http.Request
		CreatePostError    *model.AppError
		IsValidRequest     bool
		ExpectedStatusCode int
	}{
		"no configuration": {
			Configuration:      Configuration{},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"no user configuration": {
			Configuration: Configuration{
				Secret: "thesecret",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"wrong secret": {
			Configuration: Configuration{
				Secret: "differentsecret",
				UserId: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusForbidden,
		},
		"invalid body": {
			Configuration: Configuration{
				Secret: "thesecret",
				UserId: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", ioutil.NopCloser(bytes.NewBufferString("foo"))),
			ExpectedStatusCode: http.StatusBadRequest,
		},
		"valid request": {
			Configuration: Configuration{
				Secret: "thesecret",
				UserId: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			IsValidRequest:     true,
			ExpectedStatusCode: http.StatusOK,
		},
		"create post error": {
			Configuration: Configuration{
				Secret: "thesecret",
				UserId: "theuser",
			},
			CreatePostError:    model.NewAppError("foo", "bar", nil, "", http.StatusInternalServerError),
			Request:            httptest.NewRequest("POST", "/webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			IsValidRequest:     true,
			ExpectedStatusCode: http.StatusInternalServerError,
		},
		"wrong path": {
			Configuration: Configuration{
				Secret: "thesecret",
				UserId: "theuser",
			},
			Request:            httptest.NewRequest("POST", "/not-webhook?team=theteam&channel=thechannel&secret=thesecret", validRequestBody()),
			ExpectedStatusCode: http.StatusNotFound,
		},
	} {
		api := &plugintest.APIMock{}
		defer api.AssertExpectations(t)

		api.On("LoadConfiguration", mock.AnythingOfType("*jira.Configuration")).Run(func(args mock.Arguments) {
			*args.Get(0).(*Configuration) = tc.Configuration
		}).Return(nil)

		if tc.IsValidRequest {
			f, err := os.Open("testdata/webhook_sample.json")
			require.NoError(t, err)
			defer f.Close()
			var w Webhook
			require.NoError(t, json.NewDecoder(f).Decode(&w))
			expectedText, err := w.PostText()
			require.NoError(t, err)
			api.On("CreatePost", "theteam", "theuser", "thechannel", expectedText).Return(&model.Post{}, tc.CreatePostError)
		}

		p := Plugin{}
		p.Initialize(api)

		w := httptest.NewRecorder()
		api.Router().ServeHTTP(w, tc.Request)
		assert.Equal(t, tc.ExpectedStatusCode, w.Result().StatusCode, "test case: "+name)
	}
}
