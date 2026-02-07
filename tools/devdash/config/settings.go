package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const settingsFile = ".devdash-settings.json"

type Settings struct {
	FavsOnly bool `json:"favsOnly"`
}

func settingsPath(root string) string {
	if root == "" {
		return ""
	}
	return filepath.Join(root, settingsFile)
}

func LoadSettings(root string) Settings {
	path := settingsPath(root)
	if path == "" {
		return Settings{}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return Settings{}
	}

	var s Settings
	if err := json.Unmarshal(data, &s); err != nil {
		return Settings{}
	}
	return s
}

func SaveSettings(root string, s Settings) error {
	path := settingsPath(root)
	if path == "" {
		return nil
	}

	data, err := json.MarshalIndent(s, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
