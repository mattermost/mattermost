package command

import (
	"fmt"
	"regexp"
	"runtime/debug"
	"strings"
	"time"

	"github.com/pkg/errors"

	"github.com/mattermost/mattermost/server/public/model"
)

var versionRegexp = regexp.MustCompile(`/v\d$`)

func BuildInfoAutocomplete(cmd string) *model.AutocompleteData {
	return model.NewAutocompleteData(cmd, "", "Display build info")
}

func BuildInfo(manifest model.Manifest) (string, error) {
	info, ok := debug.ReadBuildInfo()
	if !ok {
		return "", errors.New("failed to read build info")
	}

	var (
		revision      string
		revisionShort string
		buildTime     time.Time
		dirty         bool
	)
	for _, s := range info.Settings {
		switch s.Key {
		case "vcs.revision":
			revision = s.Value
			revisionShort = revision[0:7]
		case "vcs.time":
			var err error
			buildTime, err = time.Parse(time.RFC3339, s.Value)

			if err != nil {
				return "", err
			}
		case "vcs.modified":
			if s.Value == "true" {
				dirty = true
			}
		}
	}

	path := info.Main.Path

	matches := versionRegexp.FindAllString(path, -1)
	if len(matches) > 0 {
		path = strings.TrimSuffix(path, matches[len(matches)-1])
	}

	dirtyText := ""
	if dirty {
		dirtyText = " (dirty)"
	}

	commit := fmt.Sprintf("[%s](https://%s/commit/%s)", revisionShort, path, revision)

	return fmt.Sprintf("%s version: %s, %s%s, built %s with %s\n",
			manifest.Name,
			manifest.Version,
			commit,
			dirtyText,
			buildTime.Format(time.RFC1123),
			info.GoVersion),
		nil
}
