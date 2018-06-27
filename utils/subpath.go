// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See License.txt for license information.

package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/mlog"
	"github.com/mattermost/mattermost-server/model"
)

// UpdateAssetsSubpath rewrites assets in the /client directory to assume the application is hosted
// at the given subpath instead of at the root. No changes are written unless necessary.
func UpdateAssetsSubpath(subpath string) error {
	if subpath == "" {
		subpath = "/"
	}

	staticDir, found := FindDir(model.CLIENT_DIR)
	if !found {
		return errors.New("failed to find client dir")
	}

	staticDir, err := filepath.EvalSymlinks(staticDir)
	if err != nil {
		return errors.Wrapf(err, "failed to resolve symlinks to %s", staticDir)
	}

	rootHtmlPath := filepath.Join(staticDir, "root.html")
	oldRootHtml, err := ioutil.ReadFile(rootHtmlPath)
	if err != nil {
		return errors.Wrap(err, "failed to open root.html")
	}

	pathToReplace := "/static/"
	newPath := path.Join(subpath, "static") + "/"

	// Determine if a previous subpath had already been rewritten into the assets.
	reWebpackPublicPathScript := regexp.MustCompile("window.publicPath='([^']+)'")
	alreadyRewritten := false
	if matches := reWebpackPublicPathScript.FindStringSubmatch(string(oldRootHtml)); matches != nil {
		pathToReplace = matches[1]
		alreadyRewritten = true
	}

	if pathToReplace == newPath {
		mlog.Debug("No rewrite required for static assets", mlog.String("path", pathToReplace))
		return nil
	}

	mlog.Debug("Rewriting static assets", mlog.String("from_path", pathToReplace), mlog.String("to_path", newPath))

	newRootHtml := string(oldRootHtml)

	// Compute the sha256 hash for the inline script and reference same in the CSP meta tag.
	// This allows the inline script defining `window.publicPath` to bypass CSP protections.
	script := fmt.Sprintf("window.publicPath='%s'", newPath)
	scriptHash := sha256.Sum256([]byte(script))

	reCSP := regexp.MustCompile(`<meta http-equiv=Content-Security-Policy content="script-src 'self' cdn.segment.com/analytics.js/ 'unsafe-eval'([^"]*)">`)
	newRootHtml = reCSP.ReplaceAllLiteralString(newRootHtml, fmt.Sprintf(
		`<meta http-equiv=Content-Security-Policy content="script-src 'self' cdn.segment.com/analytics.js/ 'unsafe-eval' 'sha256-%s'">`,
		base64.StdEncoding.EncodeToString(scriptHash[:]),
	))

	// Rewrite the root.html references to `/static/*` to include the given subpath. This
	// potentially includes a previously injected inline script.
	newRootHtml = strings.Replace(newRootHtml, pathToReplace, newPath, -1)

	// Inject the script, if needed, to define `window.publicPath`.
	if !alreadyRewritten {
		newRootHtml = strings.Replace(newRootHtml, "</style>", fmt.Sprintf("</style><script>%s</script>", script), 1)
	}

	// Write out the updated root.html.
	if err = ioutil.WriteFile(rootHtmlPath, []byte(newRootHtml), 0); err != nil {
		return errors.Wrapf(err, "failed to update root.html with subpath %s", subpath)
	}

	// Rewrite the manifest.json and *.css references to `/static/*` (or a previously rewritten subpath).
	err = filepath.Walk(staticDir, func(walkPath string, info os.FileInfo, err error) error {
		if filepath.Base(walkPath) == "manifest.json" || filepath.Ext(walkPath) == ".css" {
			if old, err := ioutil.ReadFile(walkPath); err != nil {
				return errors.Wrapf(err, "failed to open %s", walkPath)
			} else {
				new := strings.Replace(string(old), pathToReplace, newPath, -1)
				if err = ioutil.WriteFile(walkPath, []byte(new), 0); err != nil {
					return errors.Wrapf(err, "failed to update %s with subpath %s", walkPath, subpath)
				}
			}
		}

		return nil
	})
	if err != nil {
		return errors.Wrapf(err, "error walking %s", staticDir)
	}

	return nil
}

// UpdateAssetsSubpathFromConfig uses UpdateAssetsSubpath and any path defined in the SiteURL.
func UpdateAssetsSubpathFromConfig(config *model.Config) error {
	// Don't rewrite in development environments, since webpack in developer mode constantly
	// updates the assets and must be configured separately.
	if model.BuildNumber == "dev" {
		mlog.Debug("Skipping update to assets subpath since dev build")
		return nil
	}

	subpath, err := GetSubpathFromConfig(config)
	if err != nil {
		return err
	}

	return UpdateAssetsSubpath(subpath)
}

func GetSubpathFromConfig(config *model.Config) (string, error) {
	if config == nil {
		return "", errors.New("no config provided")
	} else if config.ServiceSettings.SiteURL == nil {
		return "/", nil
	}

	u, err := url.Parse(*config.ServiceSettings.SiteURL)
	if err != nil {
		return "", errors.Wrap(err, "failed to parse SiteURL from config")
	}

	if u.Path == "" {
		return "/", nil
	}

	return path.Clean(u.Path), nil
}
