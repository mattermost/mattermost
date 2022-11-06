// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

// MMPreview is a micro-service to convert from any libreoffice supported
// format into a PDF file, and then we use the regular pdf extractor to convert
// it into plain text.

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"
	"path"
	"strings"

	"github.com/pkg/errors"
)

type mmPreviewExtractor struct {
	url          string
	secret       string
	pdfExtractor pdfExtractor
}

var mmpreviewSupportedExtensions = map[string]bool{
	"ppt":  true,
	"odp":  true,
	"xls":  true,
	"xlsx": true,
	"ods":  true,
}

func newMMPreviewExtractor(url string, secret string, pdfExtractor pdfExtractor) *mmPreviewExtractor {
	return &mmPreviewExtractor{url: url, secret: secret, pdfExtractor: pdfExtractor}
}

func (mpe *mmPreviewExtractor) Match(filename string) bool {
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	return mmpreviewSupportedExtensions[extension]
}

func (mpe *mmPreviewExtractor) Extract(filename string, file io.ReadSeeker) (string, error) {
	b, w, err := createMultipartFormData("file", filename, file)
	if err != nil {
		return "", errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	req, err := http.NewRequest(http.MethodPost, mpe.url+"/toPDF", &b)
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
	data, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", errors.Wrap(err, "unable to read the response from mmpreview")
	}
	return mpe.pdfExtractor.Extract(filename, bytes.NewReader(data))
}

func createMultipartFormData(fieldName, fileName string, fileData io.ReadSeeker) (bytes.Buffer, *multipart.Writer, error) {
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
