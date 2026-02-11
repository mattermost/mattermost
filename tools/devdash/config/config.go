package config

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

const configFile = ".devdash.json"

// Favorites are stored as strings: "relativePath::cellID"
// e.g. "mattermost/server::mattermost/server:run-server"
const favSep = "::"

// Config holds all persisted DevDash state.
type Config struct {
	FavsOnly  bool     `json:"favsOnly,omitempty"`
	Depth     int      `json:"depth,omitempty"`
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

	sort.Strings(c.Favorites)

	data, err := json.MarshalIndent(c, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}

// parseFav splits a "path::id" string into (path, id).
func parseFav(entry string) (path, id string) {
	if i := strings.Index(entry, favSep); i >= 0 {
		return entry[:i], entry[i+len(favSep):]
	}
	// Legacy format: just an id with no path
	return "", entry
}

// makeFav joins a relative path and cellID into "path::id".
func makeFav(relPath, id string) string {
	return relPath + favSep + id
}

// FavoritesMap returns a set of favorite cellIDs for fast grid lookup.
func (c Config) FavoritesMap() map[string]bool {
	m := make(map[string]bool, len(c.Favorites))
	for _, entry := range c.Favorites {
		_, id := parseFav(entry)
		m[id] = true
	}
	return m
}

// FavPathsMap returns a map from cellID to relative repo path.
func (c Config) FavPathsMap() map[string]string {
	m := make(map[string]string, len(c.Favorites))
	for _, entry := range c.Favorites {
		path, id := parseFav(entry)
		m[id] = path
	}
	return m
}

// UniqueFavPaths returns the unique relative repo paths from all favorites.
func (c Config) UniqueFavPaths() []string {
	seen := make(map[string]bool)
	var paths []string
	for _, entry := range c.Favorites {
		path, _ := parseFav(entry)
		if path != "" && !seen[path] {
			seen[path] = true
			paths = append(paths, path)
		}
	}
	return paths
}

// BuildFavorites constructs the favorites string slice from the ID set and path map.
// Paths should be relative (caller converts absolute → relative before calling).
func BuildFavorites(favs map[string]bool, relPaths map[string]string) []string {
	var list []string
	for id := range favs {
		list = append(list, makeFav(relPaths[id], id))
	}
	return list
}
