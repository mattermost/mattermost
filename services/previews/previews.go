package previews

import (
	"bytes"
	"io"
	"mime/multipart"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/pkg/errors"
)

func GeneratePreview(mmpreviewURL string, mmpreviewSecret string, fileInfo *model.FileInfo, fileReader io.Reader, writeFile func(io.Reader, string) (int64, *model.AppError)) error {
	if fileInfo.IsMMPreviewSupported() {
		return generateMMPreviewPreview(mmpreviewURL, mmpreviewSecret, fileInfo, fileReader, writeFile)
	}
	return nil
}

func generateMMPreviewPreview(mmpreviewURL string, mmpreviewSecret string, fileInfo *model.FileInfo, fileReader io.Reader, writeFile func(io.Reader, string) (int64, *model.AppError)) error {
	if fileInfo.PreviewPath == "" {
		return errors.New("Invalid preview path")
	}
	b, w, err := createMultipartFormData("file", fileInfo.Name, fileReader)
	if err != nil {
		return errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	req, err := http.NewRequest("POST", mmpreviewURL+"/toPDF", &b)
	if err != nil {
		return errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	req.Header.Set("Content-Type", w.FormDataContentType())
	if mmpreviewSecret != "" {
		req.Header.Add("Authentication", mmpreviewSecret)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errors.Wrap(err, "Unable to generate file preview using mmpreview.")
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return errors.New("Unable to generate file preview using mmpreview (The server has replied with an error)")
	}
	_, appErr := writeFile(resp.Body, fileInfo.PreviewPath)
	if appErr != nil {
		return appErr
	}
	return nil
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
