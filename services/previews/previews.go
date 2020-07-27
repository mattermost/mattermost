package previews

import (
	"fmt"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v5/model"

	"github.com/pkg/errors"
)

func GeneratePreview(unoconvURL string, fileInfo *model.FileInfo, fileReader io.Reader, writeFile func(io.Reader, string) (int64, *model.AppError)) error {
	if fileInfo.IsUnoconvSupported() {
		return generateUnoconvPreview(unoconvURL, fileInfo, fileReader, writeFile)
	}
	return nil
}

func generateUnoconvPreview(unoconvURL string, fileInfo *model.FileInfo, fileReader io.Reader, writeFile func(io.Reader, string) (int64, *model.AppError)) error {
	if fileInfo.PreviewPath == "" {
		return errors.New("Invalid preview path")
	}
	req, err := http.NewRequest("POST", unoconvURL+"/convert/format/pdf", fileReader)
	req.Header.Add("Content-Type", fileInfo.MimeType)
	req.Header.Add("Content-Disposition", fmt.Sprintf("attachment; filename=\"%s\"", fileInfo.Name))
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return errors.Wrap(err, "Unable to generate file preview using unoconv.")
	}
	defer resp.Body.Close()
	_, appErr := writeFile(resp.Body, fileInfo.PreviewPath)
	if appErr != nil {
		return appErr
	}
	return nil
}
