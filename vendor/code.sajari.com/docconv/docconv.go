package docconv // import "code.sajari.com/docconv"

import (
	"encoding/json"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path"
	"strings"
	"time"
)

// Response payload sent back to the requestor
type Response struct {
	Body  string            `json:"body"`
	Meta  map[string]string `json:"meta"`
	MSecs uint32            `json:"msecs"`
	Error string            `json:"error"`
}

// MimeTypeByExtension returns a mimetype for the given extension, or
// application/octet-stream if none can be determined.
func MimeTypeByExtension(filename string) string {
	switch strings.ToLower(path.Ext(filename)) {
	case ".doc":
		return "application/msword"
	case ".docx":
		return "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
	case ".odt":
		return "application/vnd.oasis.opendocument.text"
	case ".pages":
		return "application/vnd.apple.pages"
	case ".pdf":
		return "application/pdf"
	case ".pptx":
		return "application/vnd.openxmlformats-officedocument.presentationml.presentation"
	case ".rtf":
		return "application/rtf"
	case ".xml":
		return "text/xml"
	case ".xhtml", ".html", ".htm":
		return "text/html"
	case ".jpg", ".jpeg", ".jpe", ".jfif", ".jfif-tbnl":
		return "image/jpeg"
	case ".png":
		return "image/png"
	case ".tif":
		return "image/tif"
	case ".tiff":
		return "image/tiff"
	case ".txt":
		return "text/plain"
	}
	return "application/octet-stream"
}

// Convert a file to plain text.
func Convert(r io.Reader, mimeType string, readability bool) (*Response, error) {
	start := time.Now()

	var body string
	var meta map[string]string
	var err error
	switch mimeType {
	case "application/msword", "application/vnd.ms-word":
		body, meta, err = ConvertDoc(r)

	case "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
		body, meta, err = ConvertDocx(r)

	case "application/vnd.openxmlformats-officedocument.presentationml.presentation":
		body, meta, err = ConvertPptx(r)

	case "application/vnd.oasis.opendocument.text":
		body, meta, err = ConvertODT(r)

	case "application/vnd.apple.pages", "application/x-iwork-pages-sffpages":
		body, meta, err = ConvertPages(r)

	case "application/pdf":
		body, meta, err = ConvertPDF(r)

	case "application/rtf", "application/x-rtf", "text/rtf", "text/richtext":
		body, meta, err = ConvertRTF(r)

	case "text/html":
		body, meta, err = ConvertHTML(r, readability)

	case "text/url":
		body, meta, err = ConvertURL(r, readability)

	case "text/xml", "application/xml":
		body, meta, err = ConvertXML(r)

	case "image/jpeg", "image/png", "image/tif", "image/tiff":
		body, meta, err = ConvertImage(r)

	case "text/plain":
		var b []byte
		b, err = ioutil.ReadAll(r)
		body = string(b)
	}

	if err != nil {
		return nil, fmt.Errorf("error converting data: %v", err)
	}

	return &Response{
		Body:  strings.TrimSpace(body),
		Meta:  meta,
		MSecs: uint32(time.Since(start) / time.Millisecond),
	}, nil
}

// ConvertPath converts a local path to text.
func ConvertPath(path string) (*Response, error) {
	mimeType := MimeTypeByExtension(path)

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	return Convert(f, mimeType, true)
}

// ConvertPathReadability converts a local path to text, with the given readability
// option.
func ConvertPathReadability(path string, readability bool) ([]byte, error) {
	mimeType := MimeTypeByExtension(path)

	f, err := os.Open(path)
	if err != nil {
		return nil, err
	}
	defer f.Close()

	data, err := Convert(f, mimeType, readability)
	if err != nil {
		return nil, err
	}
	return json.Marshal(data)
}
