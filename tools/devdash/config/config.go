package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
)

const configFile = ".devdash.json"

// Config holds all persisted DevDash state.
type Config struct {
	FavsOnly  bool     `json:"favsOnly,omitempty"`
	Favorites []string `json:"favorites,omitempty"`
}

func configPath(root string) string {
	if root == "" {
		return ""
	}
	return filepath.Join(root, configFile)
}

func Load(root string) Config {
	path := configPath(root)
	if path == "" {
		return Config{}
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return Config{}
	}

	var c Config
	if err := json.Unmarshal(data, &c); err != nil {
		return Config{}
	}
	return c
}

func Save(root string, c Config) error {
	path := configPath(root)
	if path == "" {
		return nil
	}

	// Sort favorites for stable output
	sort.Strings(c.Favorites)

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// FavoritesMap returns favorites as a map for fast lookup.
func (c Config) FavoritesMap() map[string]bool {
	m := make(map[string]bool, len(c.Favorites))
	for _, id := range c.Favorites {
		m[id] = true
	}
	return m
}

// FavoritesFromMap converts a favorites map back to a sorted slice.
func FavoritesFromMap(m map[string]bool) []string {
	list := make([]string, 0, len(m))
	for id := range m {
		list = append(list, id)
	}
	return list
}

