package app

import (
	"fmt"
	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/stretchr/testify/require"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestDownloadFromURL(t *testing.T) {
	th := Setup(t).InitBasic()
	defer th.TearDown()

	app := th.App
	app.Config().PluginSettings.AllowInsecureDownloadUrl = model.NewBool(true)

	retries := 0

	mux := http.NewServeMux()
	mux.HandleFunc("/succeeds-after-retry", func(w http.ResponseWriter, r *http.Request) {
		if retries < 2 {
			http.Error(w, "Request Timed out", http.StatusGatewayTimeout)
			retries++
			return
		}

		_, _ = w.Write([]byte("Your request is successful."))
	})

	mux.HandleFunc("/fails-forever", func(w http.ResponseWriter, r *http.Request) {
		http.Error(w, "This would fail forever", http.StatusInternalServerError)
	})

	testServer := httptest.NewServer(mux)

	type args struct {
		downloadURL string
	}

	tests := []struct {
		name    string
		args    args
		wantErr bool
	}{
		{
			name: "Should succeed after two retries",
			args: args{
				downloadURL: fmt.Sprintf("%s/succeeds-after-retry", testServer.URL),
			},
			wantErr: false,
		},
		{
			name: "Should not retry forever",
			args: args{
				downloadURL: fmt.Sprintf("%s/fails-forever", testServer.URL),
			},
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			retries = 0
			_, err := th.App.DownloadFromURL(tt.args.downloadURL)

			if tt.wantErr {
				require.NotNil(t, err)
			} else {
				require.Nil(t, err)
			}
		})
	}
}
