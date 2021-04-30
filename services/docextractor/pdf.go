// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"

	"github.com/ledongthuc/pdf"
)

type pdfExtractor struct{}

func (pe *pdfExtractor) Match(filename string) bool {
	supportedExtensions := map[string]bool{
		"pdf": true,
	}
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	return supportedExtensions[extension]
}

func (pe *pdfExtractor) Extract(filename string, r io.ReadSeeker) (string, error) {
	f, err := ioutil.TempFile(os.TempDir(), "pdflib")
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer f.Close()
	defer os.Remove(f.Name())
	size, err := io.Copy(f, r)
	if err != nil {
		return "", fmt.Errorf("error copying data into temporary file: %v", err)
	}

	reader, err := pdf.NewReader(f, size)
	if err != nil {
		return "", err
	}

	var buf bytes.Buffer
	b, err := reader.GetPlainText()
	if err != nil {
		return "", err
	}
	buf.ReadFrom(b)
	return buf.String(), nil
}
