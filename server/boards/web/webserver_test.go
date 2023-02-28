package web

import (
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/v6/platform/shared/mlog"
)

func Test_NewServer(t *testing.T) {
	tests := []struct {
		name               string
		rootPath           string
		serverRoot         string
		ssl                bool
		port               int
		localOnly          bool
		logger             mlog.LoggerIFace
		expectedBaseURL    string
		expectedServerAddr string
	}{
		{
			name:               "should return server with given properties",
			rootPath:           "./test/path/to/root",
			serverRoot:         "https://some-fake-server.com/fake-url",
			ssl:                false,
			port:               9999, // fake port number
			localOnly:          false,
			logger:             &mlog.Logger{},
			expectedBaseURL:    "/fake-url",
			expectedServerAddr: ":9999",
		},
		{
			name:               "should return local server with given properties",
			rootPath:           "./test/path/to/root",
			serverRoot:         "https://some-fake-server.com/fake-url",
			ssl:                false,
			port:               3000, // fake port number
			localOnly:          true,
			logger:             &mlog.Logger{},
			expectedBaseURL:    "/fake-url",
			expectedServerAddr: "localhost:3000",
		},
		{
			name:               "should match Server properties when ssl true",
			rootPath:           "./test/path/to/root",
			serverRoot:         "https://some-fake-server.com/fake-url",
			ssl:                true,
			port:               8000, // fake port number
			localOnly:          false,
			logger:             &mlog.Logger{},
			expectedBaseURL:    "/fake-url",
			expectedServerAddr: ":8000",
		},
		{
			name:               "should return local server when ssl true",
			rootPath:           "./test/path/to/root",
			serverRoot:         "https://localhost:8080/fake-url",
			ssl:                true,
			port:               9999, // fake port number
			localOnly:          true,
			logger:             &mlog.Logger{},
			expectedBaseURL:    "/fake-url",
			expectedServerAddr: "localhost:9999",
		},
		{
			name:               "should return '/' as base url is not good!",
			rootPath:           "",
			serverRoot:         "https://localhost:8080/#!@$@#@",
			ssl:                true,
			port:               9999, // fake port number
			localOnly:          true,
			logger:             &mlog.Logger{},
			expectedBaseURL:    "/",
			expectedServerAddr: "localhost:9999",
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			ws := NewServer(test.rootPath, test.serverRoot, test.port, test.ssl, test.localOnly, test.logger)

			require.NotNil(t, ws, "The webserver object is nil!")

			require.Equal(t, test.expectedBaseURL, ws.baseURL, "baseURL does not match")
			require.Equal(t, test.rootPath, ws.rootPath, "rootPath does not match")
			require.Equal(t, test.port, ws.port, "rootPath does not match")
			require.Equal(t, test.ssl, ws.ssl, "logger pointer does not match")
			require.Equal(t, test.logger, ws.logger, "logger pointer does not match")

			if test.localOnly == true {
				require.Equal(t, test.expectedServerAddr, ws.Server.Addr, "localhost address not as matching!")
			} else {
				require.Equal(t, test.expectedServerAddr, ws.Server.Addr, "server address not matching!")
			}
		})
	}
}
