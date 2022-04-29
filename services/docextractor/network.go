package docextractor

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
)

type NetworkExtractorService struct {
	Host string
	Port int
	Key  string
}

func (nes NetworkExtractorService) Extract(filename string, r io.ReadSeeker, settings ExtractSettings) (string, error) {
	data, err := io.ReadAll(r)
	if err != nil {
		return "", err
	}

	body := map[string]string{
		"filename": filename,
		"data":     base64.StdEncoding.EncodeToString(data),
		"key":      nes.Key,
	}

	bodyBytes, err := json.Marshal(body)
	if err != nil {
		return "", err
	}

	resp, err := http.Post(fmt.Sprintf("%s:%d", nes.Host, nes.Port), "application/json", bytes.NewBuffer(bodyBytes))
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	respData, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(respData), nil
}
