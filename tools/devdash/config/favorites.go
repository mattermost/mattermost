package config

import (
	"encoding/json"
	"os"
	"path/filepath"
)

const favoritesFile = ".devdash-favorites.json"

func favoritesPath(root string) string {
	if root == "" {
		return ""
	}
	return filepath.Join(root, favoritesFile)
}

func LoadFavorites(root string) map[string]bool {
	path := favoritesPath(root)
	if path == "" {
		return make(map[string]bool)
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return make(map[string]bool)
	}

	var list []string
	if err := json.Unmarshal(data, &list); err != nil {
		return make(map[string]bool)
	}

	favs := make(map[string]bool, len(list))
	for _, id := range list {
		favs[id] = true
	}
	return favs
}

func SaveFavorites(root string, favs map[string]bool) error {
	path := favoritesPath(root)
	if path == "" {
		return nil
	}

	list := make([]string, 0, len(favs))
	for id := range favs {
		list = append(list, id)
	}

	data, err := json.MarshalIndent(list, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(path, data, 0644)
}
