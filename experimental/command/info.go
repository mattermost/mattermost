package command

import (
	"fmt"
	"regexp"
	"runtime/debug"
	"strings"
	"time"

	"github.com/mattermost/mattermost-server/v6/model"
	"github.com/pkg/errors"
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
		}
	}

	path := info.Main.Path

	matches := versionRegexp.FindAllString(path, -1)
	if len(matches) > 0 {
		path = strings.TrimSuffix(path, matches[len(matches)-1])
	}

	commit := fmt.Sprintf("[%s](https://%s/commit/%s)", revisionShort, path, revision)

	return fmt.Sprintf("%s version: %s, %s, built %s with %s\n",
			manifest.Name,
			manifest.Version,
			commit,
			buildTime.Format(time.RFC1123),
			info.GoVersion),
		nil
}
