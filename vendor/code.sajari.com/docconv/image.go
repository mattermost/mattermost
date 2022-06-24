// +build !ocr

package docconv

import (
	"fmt"
	"io"
)

// ConvertImage converts images to text.
// Requires gosseract (ocr build tag).
func ConvertImage(r io.Reader) (string, map[string]string, error) {
	return "", nil, fmt.Errorf("docconv not built with `ocr` build tag")
}

// SetImageLanguages sets the languages parameter passed to gosseract.
func SetImageLanguages(...string) {}
