// +build ocr

package docconv

import (
	"fmt"
	"io"
	"sync"

	"github.com/otiai10/gosseract/v2"
)

var config = struct {
	langs []string
	sync.Mutex
}{
	langs: []string{"eng"},
}

func SetImageLanguages(l ...string) {
	config.Lock()
	config.langs = l
	config.Unlock()
}

// ConvertImage converts images to text.
// Requires gosseract.
func ConvertImage(r io.Reader) (string, map[string]string, error) {
	f, err := NewLocalFile(r)
	if err != nil {
		return "", nil, fmt.Errorf("error creating local file: %v", err)
	}
	defer f.Done()

	meta := make(map[string]string)

	client := gosseract.NewClient()
	defer client.Close()

	config.Lock()
	defer config.Unlock()

	client.SetLanguage(config.langs...)
	client.SetImage(f.Name())
	text, err := client.Text()
	if err != nil {
		return "", nil, err
	}

	return text, meta, nil
}
