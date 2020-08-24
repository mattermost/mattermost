package previews

import (
	"fmt"
	"io"
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
	req, err := http.NewRequest("POST", mmpreviewURL+"/toPDF", fileReader)
	if mmpreviewSecret != "" {
		req.Header.Add("Authentication", mmpreviewSecret)
	}
	req.Header.Add("Content-Type", fileInfo.MimeType)
	req.Header.Add("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileInfo.Name))
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
