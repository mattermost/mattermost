package discovery

import (
	"encoding/json"
	"os"
	"strings"

	"github.com/mattermost/mattermost/tools/devdash/model"
)

func ParseNpmScripts(path string) ([]model.NpmScript, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	var pkg struct {
		Scripts map[string]string `json:"scripts"`
	}
	if err := json.Unmarshal(data, &pkg); err != nil {
		return nil, err
	}

	var scripts []model.NpmScript
	for name, cmd := range pkg.Scripts {
		// Skip lifecycle hooks
		if strings.HasPrefix(name, "pre") || strings.HasPrefix(name, "post") {
			continue
		}
		scripts = append(scripts, model.NpmScript{
			Name:    name,
			Command: cmd,
		})
	}
	return scripts, nil
}
