package app

import (
	"io/ioutil"
	"net/http"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestMockHTTPService(t *testing.T) {
	getCalled := false
	putCalled := false

	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/get" && r.Method == http.MethodGet {
			getCalled = true

			w.WriteHeader(http.StatusOK)
			w.Write([]byte("OK"))
		} else if r.URL.Path == "/put" && r.Method == http.MethodPut {
			putCalled = true

			w.WriteHeader(http.StatusCreated)
			w.Write([]byte("CREATED"))
		} else {
			w.WriteHeader(http.StatusNotFound)
		}
	})

	th := Setup().MockHTTPService(handler)
	defer th.TearDown()

	url := th.MockedHTTPService.Server.URL

	t.Run("GET", func(t *testing.T) {
		client := th.App.HTTPService.MakeClient(false)

		resp, err := client.Get(url + "/get")
		defer consumeAndClose(resp)

		bodyContents, _ := ioutil.ReadAll(resp.Body)

		require.Nil(t, err)
		assert.Equal(t, http.StatusOK, resp.StatusCode)
		assert.Equal(t, "OK", string(bodyContents))
		assert.True(t, getCalled)
	})

	t.Run("PUT", func(t *testing.T) {
		client := th.App.HTTPService.MakeClient(false)

		request, _ := http.NewRequest(http.MethodPut, url+"/put", nil)
		resp, err := client.Do(request)
		defer consumeAndClose(resp)

		bodyContents, _ := ioutil.ReadAll(resp.Body)

		require.Nil(t, err)
		assert.Equal(t, http.StatusCreated, resp.StatusCode)
		assert.Equal(t, "CREATED", string(bodyContents))
		assert.True(t, putCalled)
	})
}
