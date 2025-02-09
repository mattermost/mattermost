// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path/filepath"

	"github.com/mattermost/mattermost/server/public/model"
	"github.com/pkg/errors"
)

const (
	DefaultPageSize = 200
	MaxPageSize     = 200
)

func checkInteractiveTerminal() error {
	fileInfo, err := os.Stdout.Stat()
	if err != nil {
		return err
	}

	if (fileInfo.Mode() & os.ModeCharDevice) == 0 {
		return errors.New("this is not an interactive shell")
	}

	return nil
}

func zipDir(zipPath, dir string) error {
	zipFile, err := os.Create(zipPath)
	if err != nil {
		return fmt.Errorf("cannot create file %q: %w", zipPath, err)
	}
	defer zipFile.Close()

	zipWriter := zip.NewWriter(zipFile)
	defer zipWriter.Close()

	if err := addToZip(zipWriter, dir, "."); err != nil {
		return fmt.Errorf("could not add %q to zip: %w", dir, err)
	}

	return nil
}

func addToZip(zipWriter *zip.Writer, basedir, path string) error {
	dirPath := filepath.Join(basedir, path)
	dirEntries, err := os.ReadDir(dirPath)
	if err != nil {
		return fmt.Errorf("cannot read directory %q: %w", dirPath, err)
	}

	for _, dirEntry := range dirEntries {
		fileInfo, err := dirEntry.Info()
		if err != nil {
			return fmt.Errorf("cannot get file info for directory entry %q: %w", dirEntry.Name(), err)
		}

		filePath := filepath.Join(path, fileInfo.Name())
		if fileInfo.IsDir() {
			filePath += "/"
		}
		header, err := zip.FileInfoHeader(fileInfo)
		if err != nil {
			return fmt.Errorf("cannot create zip file info header for %q path: %w", filePath, err)
		}
		header.Name = filePath
		header.Method = zip.Deflate

		w, err := zipWriter.CreateHeader(header)
		if err != nil {
			return fmt.Errorf("cannot create header for path %q: %w", filePath, err)
		}

		if fileInfo.IsDir() {
			if err = addToZip(zipWriter, basedir, filePath); err != nil {
				return err
			}
			continue
		}

		file, err := os.Open(filepath.Join(dirPath, fileInfo.Name()))
		if err != nil {
			return fmt.Errorf("cannot open file %q: %w", filePath, err)
		}

		_, err = io.Copy(w, file)
		file.Close()
		if err != nil {
			return fmt.Errorf("cannot zip file contents for file %q: %w", filePath, err)
		}
	}

	return nil
}

func getPages[T any](fn func(page, numPerPage int, etag string) ([]T, *model.Response, error), perPage int) ([]T, error) {
	var (
		results []T
		etag    string
	)

	for i := 0; ; i++ {
		result, resp, err := fn(i, perPage, etag)
		if err != nil {
			return results, err
		}
		if len(result) == 0 {
			break
		}

		results = append(results, result...)
		etag = resp.Etag
	}
	return results, nil
}

func MergePluginConfigs(base, patch map[string]map[string]any) map[string]map[string]any {
	mergedConfigs := map[string]map[string]any{}
	for k, baseVal := range base {
		if patchVal, ok := patch[k]; ok {
			// both values are present, so we do a deep merge
			mergedConfigs[k] = DeepMergeMaps(baseVal, patchVal)
			continue
		}

		// value was not present in patch, so we use base
		mergedConfigs[k] = baseVal
	}

	for k, patchVal := range patch {
		if _, ok := mergedConfigs[k]; ok {
			// value has already been merged
			continue
		}

		// value was not present in base, so we use patch
		mergedConfigs[k] = patchVal
	}

	return mergedConfigs
}

func DeepMergeMaps(base, patch map[string]any) map[string]any {
	mergedMaps := map[string]any{}
	for k, baseVal := range base {
		if patchVal, ok := patch[k]; ok {
			if baseMap, ok := baseVal.(map[string]any); ok {
				if patchMap, ok := patchVal.(map[string]any); ok {
					// both values are map, so we merge recursively
					mergedMaps[k] = DeepMergeMaps(baseMap, patchMap)
					continue
				}
			}

			// either base is a map but patch is not, or base is not a
			// map; in any case, patch has precedence
			mergedMaps[k] = patchVal
			continue
		}

		// patch doesn't contain the key, so we use base
		mergedMaps[k] = baseVal
	}

	for k, patchVal := range patch {
		if _, ok := mergedMaps[k]; ok {
			// value has already been calculated
			continue
		}

		// value was not present in base, so we directly use patch
		mergedMaps[k] = patchVal
	}

	return mergedMaps
}
