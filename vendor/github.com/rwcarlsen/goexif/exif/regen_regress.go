// +build ignore

package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
	"sort"
	"strings"

	"github.com/rwcarlsen/goexif/exif"
	"github.com/rwcarlsen/goexif/tiff"
)

func main() {
	flag.Parse()
	fname := flag.Arg(0)

	dst, err := os.Create(fname)
	if err != nil {
		log.Fatal(err)
	}
	defer dst.Close()

	dir, err := os.Open("samples")
	if err != nil {
		log.Fatal(err)
	}
	defer dir.Close()

	names, err := dir.Readdirnames(0)
	if err != nil {
		log.Fatal(err)
	}
	sort.Strings(names)
	for i, name := range names {
		names[i] = filepath.Join("samples", name)
	}
	makeExpected(names, dst)
}

func makeExpected(files []string, w io.Writer) {
	fmt.Fprintf(w, "package exif\n\n")
	fmt.Fprintf(w, "var regressExpected = map[string]map[FieldName]string{\n")

	for _, name := range files {
		if !strings.HasSuffix(name, ".jpg") {
			continue
		}

		f, err := os.Open(name)
		if err != nil {
			continue
		}

		x, err := exif.Decode(f)
		if err != nil {
			f.Close()
			continue
		}

		var items []string
		x.Walk(walkFunc(func(name exif.FieldName, tag *tiff.Tag) error {
			if strings.HasPrefix(string(name), exif.UnknownPrefix) {
				items = append(items, fmt.Sprintf("\"%v\": `%v`,\n", name, tag.String()))
			} else {
				items = append(items, fmt.Sprintf("%v: `%v`,\n", name, tag.String()))
			}
			return nil
		}))
		sort.Strings(items)

		fmt.Fprintf(w, "\"%v\": map[FieldName]string{\n", filepath.Base(name))
		for _, item := range items {
			fmt.Fprint(w, item)
		}
		fmt.Fprintf(w, "},\n")
		f.Close()
	}
	fmt.Fprintf(w, "}")
}

type walkFunc func(exif.FieldName, *tiff.Tag) error

func (f walkFunc) Walk(name exif.FieldName, tag *tiff.Tag) error {
	return f(name, tag)
}
