// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

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

var doconvConverterByExtensions = map[string]func(io.Reader) (string, map[string]string, error){
	"doc":   docconv.ConvertDoc,
	"docx":  docconv.ConvertDocx,
	"pptx":  docconv.ConvertPptx,
	"odt":   docconv.ConvertODT,
	"html":  func(r io.Reader) (string, map[string]string, error) { return docconv.ConvertHTML(r, true) },
	"pages": docconv.ConvertPages,
	"rtf":   docconv.ConvertRTF,
	"pdf":   docconv.ConvertPDF,
}

func (de *documentExtractor) Match(filename string) bool {
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	_, ok := doconvConverterByExtensions[extension]
	return ok
}

func (de *documentExtractor) Extract(filename string, r io.ReadSeeker) (string, error) {
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	converter, ok := doconvConverterByExtensions[extension]
	if !ok {
		return "", errors.New("unknown converter")
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
