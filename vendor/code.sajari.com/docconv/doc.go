package docconv

import (
	"bytes"
	"fmt"
	"io"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"strings"
	"time"
)

// ConvertDoc converts an MS Word .doc to text.
func ConvertDoc(r io.Reader) (string, map[string]string, error) {
	f, err := NewLocalFile(r)
	if err != nil {
		return "", nil, fmt.Errorf("error creating local file: %v", err)
	}
	defer f.Done()

	// Meta data
	mc := make(chan map[string]string, 1)
	go func() {
		meta := make(map[string]string)
		metaStr, err := exec.Command("wvSummary", f.Name()).Output()
		if err != nil {
			// TODO: Remove this.
			log.Println("wvSummary:", err)
		}

		// Parse meta output
		for _, line := range strings.Split(string(metaStr), "\n") {
			if parts := strings.SplitN(line, "=", 2); len(parts) > 1 {
				meta[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}

		// Convert parsed meta
		if tmp, ok := meta["Last Modified"]; ok {
			if t, err := time.Parse(time.RFC3339, tmp); err == nil {
				meta["ModifiedDate"] = fmt.Sprintf("%d", t.Unix())
			}
		}
		if tmp, ok := meta["Created"]; ok {
			if t, err := time.Parse(time.RFC3339, tmp); err == nil {
				meta["CreatedDate"] = fmt.Sprintf("%d", t.Unix())
			}
		}

		mc <- meta
	}()

	// Document body
	bc := make(chan string, 1)
	go func() {

		// Save output to a file
		outputFile, err := ioutil.TempFile("/tmp", "sajari-convert-")
		if err != nil {
			// TODO: Remove this.
			log.Println("TempFile Out:", err)
			return
		}
		defer os.Remove(outputFile.Name())

		err = exec.Command("wvText", f.Name(), outputFile.Name()).Run()
		if err != nil {
			// TODO: Remove this.
			log.Println("wvText:", err)
		}

		var buf bytes.Buffer
		_, err = buf.ReadFrom(outputFile)
		if err != nil {
			// TODO: Remove this.
			log.Println("wvText:", err)
		}

		bc <- buf.String()
	}()

	// TODO: Should errors in either of the above Goroutines stop things from progressing?
	body := <-bc
	meta := <-mc

	// TODO: Check for errors instead of len(body) == 0?
	if len(body) == 0 {
		f.Seek(0, 0)
		return ConvertDocx(f)
	}
	return body, meta, nil
}
