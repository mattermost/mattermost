// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"os"
	"path"
	"strings"

	"github.com/ledongthuc/pdf"

	"github.com/mattermost/mattermost/server/v8/channels/utils"
)

type pdfExtractor struct{}

func (pe *pdfExtractor) Name() string {
	return "pdfExtractor"
}

func (pe *pdfExtractor) Match(filename string) bool {
	supportedExtensions := map[string]bool{
		"pdf": true,
	}
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	return supportedExtensions[extension]
}

func (pe *pdfExtractor) Extract(filename string, r io.ReadSeeker, maxFileSize int64) (out string, outErr error) {
	defer func() {
		if r := recover(); r != nil {
			out = ""
			outErr = errors.New("error extracting pdf text")
		}
	}()
	f, err := os.CreateTemp(os.TempDir(), "pdflib")
	if err != nil {
		return "", fmt.Errorf("error creating temporary file: %v", err)
	}
	defer f.Close()
	defer os.Remove(f.Name())

	// Bound how much data is copied to disk so a small upload cannot expand
	// into an unbounded amount of temporary storage.
	var src io.Reader = r
	if maxFileSize > 0 {
		src = utils.NewLimitedReaderWithError(r, maxFileSize)
	}
	size, err := io.Copy(f, src)
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
