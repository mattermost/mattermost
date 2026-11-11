// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package web

import (
	"io/fs"
	"net/http"
	"path"
	"path/filepath"
	"strings"
)

const (
	// DocsDir is the client subdirectory for the offline docs bundle.
	DocsDir = "_documentation"

	// DocsURLPrefix matches BASE_URL=/_documentation/ (not configurable).
	// Leading underscore keeps it out of the webapp team-URL namespace.
	DocsURLPrefix = "_documentation"
)

// docsStaticExts are real asset/page suffixes. path.Ext treats "v10.5" as
// having extension ".5", so clean-URL .html fallback must key off this set
// rather than "Ext == \"\"".
var docsStaticExts = map[string]bool{
	".html": true, ".htm": true,
	".css": true, ".js": true, ".mjs": true, ".map": true, ".json": true,
	".png": true, ".jpg": true, ".jpeg": true, ".gif": true, ".svg": true,
	".webp": true, ".ico": true, ".avif": true,
	".woff": true, ".woff2": true, ".ttf": true, ".eot": true, ".otf": true,
	".mp4": true, ".webm": true,
	".txt": true, ".xml": true, ".pdf": true,
}

func hasDocsStaticExt(name string) bool {
	return docsStaticExts[strings.ToLower(path.Ext(name))]
}

// docsFileSystem maps clean URLs to trailingSlash:false Docusaurus output
// (<path>.html / <path>/index.html). The hosted site does this in CDN; http.FileServer does not.
type docsFileSystem struct {
	root http.FileSystem
}

func (d docsFileSystem) Open(name string) (http.File, error) {
	// No FileServer in front — normalize containment ourselves (root is an interface).
	if strings.Contains(name, "..") {
		return nil, fs.ErrNotExist
	}

	if f, err := d.root.Open(name); err == nil {
		st, statErr := f.Stat()
		if statErr == nil && !st.IsDir() {
			return f, nil
		}
		f.Close()
	}

	// Try "<name>.html" before "<name>/index.html" so a sibling directory of
	// the same name does not shadow the content page. Skip when name already
	// has a real static extension so we do not probe "styles.css.html".
	if !hasDocsStaticExt(name) {
		if f, err := d.root.Open(name + ".html"); err == nil {
			return f, nil
		}
	}

	if f, err := d.root.Open(path.Join(name, "index.html")); err == nil {
		return f, nil
	}

	return nil, fs.ErrNotExist
}

// NewDocsHandler serves <staticDir>/_documentation. Shared with `mattermost docs`.
func NewDocsHandler(staticDir, subpath string) http.Handler {
	return NewDocsHandlerForDir(filepath.Join(staticDir, DocsDir), subpath)
}

// NewDocsHandlerForDir serves a bundle at docsDir (e.g. an unpackaged Docusaurus build via --dir).
func NewDocsHandlerForDir(docsDir, subpath string) http.Handler {
	docsFS := docsFileSystem{root: http.Dir(docsDir)}
	prefix := path.Join(subpath, DocsURLPrefix)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w = &notFoundNoCacheResponseWriter{ResponseWriter: w}
		setStaticSecurityHeaders(w)

		upath := strings.TrimPrefix(r.URL.Path, prefix)
		if upath == "" || upath[0] != '/' {
			upath = "/" + upath
		}

		f, err := docsFS.Open(upath)
		if err != nil {
			http.NotFound(w, r)
			return
		}
		defer f.Close()

		st, err := f.Stat()
		if err != nil || st.IsDir() {
			http.NotFound(w, r)
			return
		}

		// Docs HTML must not inherit the year-long asset cache; hashed static
		// assets keep the default from setStaticSecurityHeaders.
		if strings.HasSuffix(strings.ToLower(st.Name()), ".html") {
			w.Header().Set("Cache-Control", "no-cache, public")
		}

		// Use the resolved filename so Content-Type follows the real extension.
		http.ServeContent(w, r, st.Name(), st.ModTime(), f)
	})
}
