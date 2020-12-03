package docconv

import (
	"fmt"
	"os/exec"
	"strings"
	"time"
)

// Meta data
type MetaResult struct {
	meta map[string]string
	err  error
}

type BodyResult struct {
	body string
	err  error
}

// Convert PDF

func ConvertPDFText(path string) (BodyResult, MetaResult, error) {
	metaResult := MetaResult{meta: make(map[string]string)}
	bodyResult := BodyResult{}
	mr := make(chan MetaResult, 1)
	go func() {
		metaStr, err := exec.Command("pdfinfo", path).Output()
		if err != nil {
			metaResult.err = err
			mr <- metaResult
			return
		}

		// Parse meta output
		for _, line := range strings.Split(string(metaStr), "\n") {
			if parts := strings.SplitN(line, ":", 2); len(parts) > 1 {
				metaResult.meta[strings.TrimSpace(parts[0])] = strings.TrimSpace(parts[1])
			}
		}

		// Convert parsed meta
		if x, ok := metaResult.meta["ModDate"]; ok {
			if t, ok := pdfTimeLayouts.Parse(x); ok {
				metaResult.meta["ModifiedDate"] = fmt.Sprintf("%d", t.Unix())
			}
		}
		if x, ok := metaResult.meta["CreationDate"]; ok {
			if t, ok := pdfTimeLayouts.Parse(x); ok {
				metaResult.meta["CreatedDate"] = fmt.Sprintf("%d", t.Unix())
			}
		}

		mr <- metaResult
	}()

	br := make(chan BodyResult, 1)
	go func() {
		body, err := exec.Command("pdftotext", "-q", "-nopgbrk", "-enc", "UTF-8", "-eol", "unix", path, "-").Output()
		if err != nil {
			bodyResult.err = err
		}

		bodyResult.body = string(body)

		br <- bodyResult
	}()

	return <-br, <-mr, nil
}

var pdfTimeLayouts = timeLayouts{time.ANSIC, "Mon Jan _2 15:04:05 2006 MST"}

type timeLayouts []string

func (tl timeLayouts) Parse(x string) (time.Time, bool) {
	for _, layout := range tl {
		t, err := time.Parse(layout, x)
		if err == nil {
			return t, true
		}
	}
	return time.Time{}, false
}
