// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package utils

import (
	"crypto/sha256"
	"encoding/base64"
	"fmt"
	"net/url"
	"os"
	"path"
	"path/filepath"
	"regexp"
	"strings"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/mattermost/mattermost-server/v6/shared/mlog"
	"github.com/mattermost/mattermost-server/v6/utils/fileutils"
)

// getSubpathScript renders the inline script that defines window.publicPath to change how webpack loads assets.
func getSubpathScript(subpath string) string {
	if subpath == "" {
		subpath = "/"
	}

	newPath := path.Join(subpath, "static") + "/"

	return fmt.Sprintf("window.publicPath='%s'", newPath)
}

// GetSubpathScriptHash computes the script-src addition required for the subpath script to bypass CSP protections.
func GetSubpathScriptHash(subpath string) string {
	// No hash is required for the default subpath.
	if subpath == "" || subpath == "/" {
		return ""
	}

	scriptHash := sha256.Sum256([]byte(getSubpathScript(subpath)))

	return fmt.Sprintf(" 'sha256-%s'", base64.StdEncoding.EncodeToString(scriptHash[:]))
}

// UpdateAssetsSubpathInDir rewrites assets in the given directory to assume the application is
// hosted at the given subpath instead of at the root. No changes are written unless necessary.
func UpdateAssetsSubpathInDir(subpath, directory string) error {
	if subpath == "" {
		subpath = "/"
	}

	staticDir, found := fileutils.FindDir(directory)
	if !found {
		return errors.New("failed to find client dir")
	}

	staticDir, err := filepath.EvalSymlinks(staticDir)
	if err != nil {
		return errors.Wrapf(err, "failed to resolve symlinks to %s", staticDir)
	}

	rootHTMLPath := filepath.Join(staticDir, "root.html")
	oldRootHTML, err := os.ReadFile(rootHTMLPath)
	if err != nil {
		return errors.Wrap(err, "failed to open root.html")
	}

	oldSubpath := "/"

	// Determine if a previous subpath had already been rewritten into the assets.
	reWebpackPublicPathScript := regexp.MustCompile("window.publicPath='([^']+/)static/'")
	alreadyRewritten := false
	if matches := reWebpackPublicPathScript.FindStringSubmatch(string(oldRootHTML)); matches != nil {
		oldSubpath = matches[1]
		alreadyRewritten = true
	}

	pathToReplace := path.Join(oldSubpath, "static") + "/"
	newPath := path.Join(subpath, "static") + "/"

	mlog.Debug("Rewriting static assets", mlog.String("from_subpath", oldSubpath), mlog.String("to_subpath", subpath))

	newRootHTML := string(oldRootHTML)

	reCSP := regexp.MustCompile(`<meta http-equiv="Content-Security-Policy" content="script-src 'self' cdn.rudderlabs.com/ js.stripe.com/v3([^"]*)">`)
	if results := reCSP.FindAllString(newRootHTML, -1); len(results) == 0 {
		return fmt.Errorf("failed to find 'Content-Security-Policy' meta tag to rewrite")
	}

	newRootHTML = reCSP.ReplaceAllLiteralString(newRootHTML, fmt.Sprintf(
		`<meta http-equiv="Content-Security-Policy" content="script-src 'self' cdn.rudderlabs.com/ js.stripe.com/v3%s">`,
		GetSubpathScriptHash(subpath),
	))

	// Rewrite the root.html references to `/static/*` to include the given subpath.
	// This potentially includes a previously injected inline script that needs to
	// be updated (and isn't covered by the cases above).
	newRootHTML = strings.Replace(newRootHTML, pathToReplace, newPath, -1)

	if alreadyRewritten && subpath == "/" {
		// Remove the injected script since no longer required. Note that the rewrite above
		// will have affected the script, so look for the new subpath, not the old one.
		oldScript := getSubpathScript(subpath)
		newRootHTML = strings.Replace(newRootHTML, fmt.Sprintf("</style><script>%s</script>", oldScript), "</style>", 1)

	} else if !alreadyRewritten && subpath != "/" {
		// Otherwise, inject the script to define `window.publicPath`.
		script := getSubpathScript(subpath)
		newRootHTML = strings.Replace(newRootHTML, "</style>", fmt.Sprintf("</style><script>%s</script>", script), 1)
	}

	// Write out the updated root.html.
	if err = os.WriteFile(rootHTMLPath, []byte(newRootHTML), 0); err != nil {
		return errors.Wrapf(err, "failed to update root.html with subpath %s", subpath)
	}

	// Rewrite the manifest.json and *.css references to `/static/*` (or a previously rewritten subpath).
	err = filepath.Walk(staticDir, func(walkPath string, info os.FileInfo, err error) error {
		if filepath.Base(walkPath) == "manifest.json" || filepath.Ext(walkPath) == ".css" {
			old, err := os.ReadFile(walkPath)
			if err != nil {
				return errors.Wrapf(err, "failed to open %s", walkPath)
			}
			new := strings.Replace(string(old), pathToReplace, newPath, -1)
			if err = os.WriteFile(walkPath, []byte(new), 0); err != nil {
				return errors.Wrapf(err, "failed to update %s with subpath %s", walkPath, subpath)
			}
		}

		return nil
	})
	if err != nil {
		return errors.Wrapf(err, "error walking %s", staticDir)
	}

	return nil
}

// UpdateAssetsSubpath rewrites assets in the /client directory to assume the application is hosted
// at the given subpath instead of at the root. No changes are written unless necessary.
func UpdateAssetsSubpath(subpath string) error {
	return UpdateAssetsSubpathInDir(subpath, model.ClientDir)
}

// UpdateAssetsSubpathFromConfig uses UpdateAssetsSubpath and any path defined in the SiteURL.
func UpdateAssetsSubpathFromConfig(config *model.Config) error {
	// Don't rewrite in development environments, since webpack in developer mode constantly
	// updates the assets and must be configured separately.
	if model.BuildNumber == "dev" {
		mlog.Debug("Skipping update to assets subpath since dev build")
		return nil
	}

	// Similarly, don't rewrite during a CI build, when the assets may not even be present.
	if os.Getenv("IS_CI") == "true" {
		mlog.Debug("Skipping update to assets subpath since CI build")
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
