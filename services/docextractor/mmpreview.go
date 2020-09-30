package docextractor

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"

	"code.sajari.com/docconv"
	"github.com/pkg/errors"
)

type mmPreviewExtractor struct {
	url    string
	secret string
}

func newMMPreviewExtractor(url string, secret string) *mmPreviewExtractor {
	return &mmPreviewExtractor{url: url, secret: secret}
}

func (mpe *mmPreviewExtractor) Match(filename string) bool {
	supportedExtensions := map[string]bool{
		"ppt":  true,
		"odp":  true,
		"xls":  true,
		"xlsx": true,
		"ods":  true,
	}
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	if supportedExtensions[extension] {
		return true
	}
	return false
}

func (mpe *mmPreviewExtractor) Extract(filename string, file io.Reader) (string, error) {
	b, w, err := createMultipartFormData("file", filename, file)
	if err != nil {
		return "", errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	req, err := http.NewRequest("POST", mpe.url+"/toPDF", &b)
	if err != nil {
		return "", errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	if mpe.secret != "" {
		req.Header.Add("Authentication", mpe.secret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return "", errors.New("Unable to generate file preview using mmpreview (The server has replied with an error)")
	}
	text, _, err := docconv.ConvertPDF(resp.Body)
	if err != nil {
		return "", err
	}
	return string(text), nil
}

func createMultipartFormData(fieldName, fileName string, fileData io.Reader) (bytes.Buffer, *multipart.Writer, error) {
	var b bytes.Buffer
	var err error
	w := multipart.NewWriter(&b)
	var fw io.Writer
	if fw, err = w.CreateFormFile(fieldName, fileName); err != nil {
		return b, nil, err
	}
	if _, err = io.Copy(fw, fileData); err != nil {
		return b, nil, err
	}
	w.Close()
	return b, w, nil
}
