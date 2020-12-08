package docconv

import (
	"archive/zip"
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"strings"
)

// ConvertPptx converts an MS PowerPoint pptx file to text.
func ConvertPptx(r io.Reader) (string, map[string]string, error) {
	var size int64

	// Common case: if the reader is a file (or trivial wrapper), avoid
	// loading it all into memory.
	var ra io.ReaderAt
	if f, ok := r.(interface {
		io.ReaderAt
		Stat() (os.FileInfo, error)
	}); ok {
		si, err := f.Stat()
		if err != nil {
			return "", nil, err
		}
		size = si.Size()
		ra = f
	} else {
		b, err := ioutil.ReadAll(r)
		if err != nil {
			return "", nil, nil
		}
		size = int64(len(b))
		ra = bytes.NewReader(b)
	}

	zr, err := zip.NewReader(ra, size)
	if err != nil {
		return "", nil, fmt.Errorf("could not unzip: %v", err)
	}

	zipFiles := mapZipFiles(zr.File)

	contentTypeDefinition, err := getContentTypeDefinition(zipFiles["[Content_Types].xml"])
	if err != nil {
		return "", nil, err
	}

	meta := make(map[string]string)
	var textBody string
	for _, override := range contentTypeDefinition.Overrides {
		f := zipFiles[override.PartName]

		switch override.ContentType {
		case "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
			"application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml":
			body, err := parseDocxText(f)
			if err != nil {
				return "", nil, fmt.Errorf("could not parse pptx: %v", err)
			}
			textBody += body + "\n"
		}
	}
	return strings.TrimSuffix(textBody, "\n"), meta, nil
}
