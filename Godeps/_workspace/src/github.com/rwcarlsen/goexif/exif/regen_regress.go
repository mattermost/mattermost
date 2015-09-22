// +build ignore

package main

import (
	"flag"
	"fmt"
	"io"
	"log"
	"os"
	"path/filepath"
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
	for i, name := range names {
		names[i] = filepath.Join("samples", name)
	}
	makeExpected(names, dst)
}

func makeExpected(files []string, w io.Writer) {
	fmt.Fprintf(w, "package exif\n\n")
	fmt.Fprintf(w, "var regressExpected = map[string]map[FieldName]string{\n")

	for _, name := range files {
		f, err := os.Open(name)
		if err != nil {
			continue
		}

		x, err := exif.Decode(f)
		if err != nil {
			f.Close()
			continue
		}

		fmt.Fprintf(w, "\"%v\": map[FieldName]string{\n", filepath.Base(name))
		x.Walk(&regresswalk{w})
		fmt.Fprintf(w, "},\n")
		f.Close()
	}
	fmt.Fprintf(w, "}")
}

type regresswalk struct {
	wr io.Writer
}

func (w *regresswalk) Walk(name exif.FieldName, tag *tiff.Tag) error {
	if strings.HasPrefix(string(name), exif.UnknownPrefix) {
		fmt.Fprintf(w.wr, "\"%v\": `%v`,\n", name, tag.String())
	} else {
		fmt.Fprintf(w.wr, "%v: `%v`,\n", name, tag.String())
	}
	return nil
}
