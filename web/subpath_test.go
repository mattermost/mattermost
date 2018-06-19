package web_test

import (
	"io/ioutil"
	"os"
	"path/filepath"
	"testing"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost-server/model"
	"github.com/mattermost/mattermost-server/web"
)

func TestUpdateAssetsSubpath(t *testing.T) {
	t.Run("no client dir", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "test_update_assets_subpath")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)
		os.Chdir(tempDir)

		err = web.UpdateAssetsSubpath("/")
		require.Error(t, err)
	})

	t.Run("valid", func(t *testing.T) {
		tempDir, err := ioutil.TempDir("", "test_update_assets_subpath")
		require.NoError(t, err)
		defer os.RemoveAll(tempDir)
		os.Chdir(tempDir)

		err = os.Mkdir(model.CLIENT_DIR, 0700)
		require.NoError(t, err)

		testCases := []struct {
			Description      string
			RootHTML         string
			MainCSS          string
			Subpath          string
			ExpectedRootHTML string
			ExpectedMainCSS  string
		}{
			{
				"no changes required, empty subpath provided",
				baseRootHtml,
				baseCss,
				"",
				baseRootHtml,
				baseCss,
			},
			{
				"no changes required",
				baseRootHtml,
				baseCss,
				"/",
				baseRootHtml,
				baseCss,
			},
			{
				"subpath",
				baseRootHtml,
				baseCss,
				"/subpath",
				subpathRootHtml,
				subpathCss,
			},
			{
				"new subpath from old",
				subpathRootHtml,
				subpathCss,
				"/nested/subpath",
				newSubpathRootHtml,
				newSubpathCss,
			},
			{
				"resetting to /",
				subpathRootHtml,
				subpathCss,
				"/",
				resetRootHtml,
				baseCss,
			},
		}

		for _, testCase := range testCases {
			t.Run(testCase.Description, func(t *testing.T) {
				ioutil.WriteFile(filepath.Join(tempDir, model.CLIENT_DIR, "root.html"), []byte(testCase.RootHTML), 0700)
				ioutil.WriteFile(filepath.Join(tempDir, model.CLIENT_DIR, "main.css"), []byte(testCase.MainCSS), 0700)
				err := web.UpdateAssetsSubpath(testCase.Subpath)
				require.NoError(t, err)

				contents, err := ioutil.ReadFile(filepath.Join(tempDir, model.CLIENT_DIR, "root.html"))
				require.NoError(t, err)
				require.Equal(t, testCase.ExpectedRootHTML, string(contents))

				contents, err = ioutil.ReadFile(filepath.Join(tempDir, model.CLIENT_DIR, "main.css"))
				require.NoError(t, err)
				require.Equal(t, testCase.ExpectedMainCSS, string(contents))

			})
		}
	})
}

func TestGetSubpathFromConfig(t *testing.T) {
	testCases := []struct {
		Description     string
		SiteURL         string
		ExpectedError   bool
		ExpectedSubpath string
	}{
		{
			"empty SiteURL",
			"",
			false,
			"",
		},
		{
			"invalid SiteURL",
			"cache_object:foo/bar",
			true,
			"",
		},
		{
			"no trailing slash",
			"http://localhost:8065",
			false,
			"",
		},
		{
			"trailing slash",
			"http://localhost:8065/",
			false,
			"/",
		},
		{
			"subpath, no trailing slash",
			"http://localhost:8065/subpath",
			false,
			"/subpath",
		},
		{
			"trailing slash",
			"http://localhost:8065/subpath/",
			false,
			"/subpath/",
		},
	}

	for _, testCase := range testCases {
		t.Run(testCase.Description, func(t *testing.T) {
			config := &model.Config{
				ServiceSettings: model.ServiceSettings{
					SiteURL: &testCase.SiteURL,
				},
			}

			subpath, err := web.GetSubpathFromConfig(config)
			if testCase.ExpectedError {
				require.Error(t, err)
			} else {
				require.NoError(t, err)
			}

			require.Equal(t, testCase.ExpectedSubpath, subpath)
		})
	}
}
