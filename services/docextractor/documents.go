package docextractor

import (
	"errors"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"

	"code.sajari.com/docconv"
)

type documentExtractor struct{}

func (de *documentExtractor) Match(filename string) bool {
	supportedExtensions := map[string]bool{
		"doc":   true,
		"docx":  true,
		"pptx":  true,
		"odt":   true,
		"html":  true,
		"pages": true,
		"rtf":   true,
	}
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	return supportedExtensions[extension]
}

func (de *documentExtractor) Extract(filename string, r io.Reader) (string, error) {
	convertersByExtensions := map[string]func(io.Reader) (string, map[string]string, error){
		"doc":   docconv.ConvertDoc,
		"docx":  docconv.ConvertDocx,
		"pptx":  docconv.ConvertPptx,
		"odt":   docconv.ConvertODT,
		"html":  func(r io.Reader) (string, map[string]string, error) { return docconv.ConvertHTML(r, true) },
		"pages": docconv.ConvertPages,
		"rtf":   docconv.ConvertRTF,
	}

	extension := strings.TrimPrefix(path.Ext(filename), ".")
	converter, ok := convertersByExtensions[extension]
	if !ok {
		return "", errors.New("Unknown converter")
	}

	f, err := ioutil.TempFile(os.TempDir(), "docconv")
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	_, err = io.Copy(f, r)
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	text, _, err := converter(f)
	if err != nil {
		return "", err
	}

	return text, nil
}
