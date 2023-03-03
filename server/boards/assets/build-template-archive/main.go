// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package main

import (
	"archive/zip"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

const (
	defArchiveFilename = "templates.boardarchive"
	versionFilename    = "version.json"
	boardFilename      = "board.jsonl"
	minArchiveVersion  = 2
	maxArchiveVersion  = 2
)

type archiveVersion struct {
	Version int   `json:"version"`
	Date    int64 `json:"date"`
}

type appConfig struct {
	dir     string
	out     string
	verbose bool
}

func main() {
	cfg := appConfig{}

	flag.StringVar(&cfg.dir, "dir", "", "source directory of templates")
	flag.StringVar(&cfg.out, "out", defArchiveFilename, "output filename")
	flag.BoolVar(&cfg.verbose, "verbose", false, "enable verbose output")
	flag.Parse()

	if cfg.dir == "" {
		flag.Usage()
		os.Exit(-1)
	}

	var code int
	if err := build(cfg); err != nil {
		code = -1
		fmt.Fprintf(os.Stderr, "error creating archive: %v\n", err)
	} else if cfg.verbose {
		fmt.Fprintf(os.Stdout, "archive created: %s\n", cfg.out)
	}

	os.Exit(code)
}

func build(cfg appConfig) (err error) {
	version, err := getVersionFile(cfg)
	if err != nil {
		return err
	}

	// create the output archive zip file
	archiveFile, err := os.Create(cfg.out)
	if err != nil {
		return fmt.Errorf("error creating %s: %w", cfg.out, err)
	}
	archiveZip := zip.NewWriter(archiveFile)
	defer func() {
		if err2 := archiveZip.Close(); err2 != nil {
			if err == nil {
				err = fmt.Errorf("error closing zip %s: %w", cfg.out, err2)
			}
		}
		if err2 := archiveFile.Close(); err2 != nil {
			if err == nil {
				err = fmt.Errorf("error closing %s: %w", cfg.out, err2)
			}
		}
	}()

	// write the version file
	v, err := archiveZip.Create(versionFilename)
	if err != nil {
		return fmt.Errorf("error creating %s: %w", cfg.out, err)
	}
	if _, err = v.Write(version); err != nil {
		return fmt.Errorf("error writing %s: %w", cfg.out, err)
	}

	// each board is a subdirectory; write each to the archive
	files, err := os.ReadDir(cfg.dir)
	if err != nil {
		return fmt.Errorf("error reading directory %s: %w", cfg.dir, err)
	}
	for _, f := range files {
		if !f.IsDir() {
			if f.Name() != versionFilename && cfg.verbose {
				fmt.Fprintf(os.Stdout, "skipping non-directory %s\n", f.Name())
			}
			continue
		}
		if err = writeBoard(archiveZip, f.Name(), cfg); err != nil {
			return fmt.Errorf("error writing board %s: %w", f.Name(), err)
		}
	}
	return nil
}

func getVersionFile(cfg appConfig) ([]byte, error) {
	path := filepath.Join(cfg.dir, versionFilename)
	buf, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("cannot read %s: %w", path, err)
	}

	var version archiveVersion
	if err := json.Unmarshal(buf, &version); err != nil {
		return nil, fmt.Errorf("cannot parse %s: %w", path, err)
	}

	if version.Version < minArchiveVersion || version.Version > maxArchiveVersion {
		return nil, errUnsupportedVersion{Min: minArchiveVersion, Max: maxArchiveVersion, Got: version.Version}
	}

	return buf, nil
}

func writeBoard(w *zip.Writer, boardID string, cfg appConfig) error {
	// copy the board's jsonl file first.  BoardID is also the directory name.
	srcPath := filepath.Join(cfg.dir, boardID, boardFilename)
	destPath := filepath.Join(boardID, boardFilename)
	if err := writeFile(w, srcPath, destPath, cfg); err != nil {
		return err
	}

	boardPath := filepath.Join(cfg.dir, boardID)
	files, err := os.ReadDir(boardPath)
	if err != nil {
		return fmt.Errorf("error reading board directory %s: %w", cfg.dir, err)
	}
	for _, f := range files {
		if f.IsDir() {
			if cfg.verbose {
				fmt.Fprintf(os.Stdout, "skipping directory %s\n", f.Name())
			}
			continue
		}
		if f.Name() == boardFilename {
			continue
		}

		srcPath = filepath.Join(cfg.dir, boardID, f.Name())
		destPath = filepath.Join(boardID, f.Name())
		if err = writeFile(w, srcPath, destPath, cfg); err != nil {
			return fmt.Errorf("error writing %s: %w", destPath, err)
		}
	}
	return nil
}

func writeFile(w *zip.Writer, srcPath string, destPath string, cfg appConfig) (err error) {
	inFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("error reading %s: %w", srcPath, err)
	}
	defer inFile.Close()

	outFile, err := w.Create(destPath)
	if err != nil {
		return fmt.Errorf("error creating %s: %w", destPath, err)
	}
	size, err := io.Copy(outFile, inFile)
	if err != nil {
		return fmt.Errorf("error writing %s: %w", destPath, err)
	}

	if cfg.verbose {
		fmt.Fprintf(os.Stdout, "%s written (%d bytes)\n", destPath, size)
	}

	return nil
}

type errUnsupportedVersion struct {
	Min int
	Max int
	Got int
}

func (e errUnsupportedVersion) Error() string {
	return fmt.Sprintf("unsupported archive version; require between %d and %d inclusive, got %d", e.Min, e.Max, e.Got)
}
