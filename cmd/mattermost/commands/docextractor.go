// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"github.com/mattermost/mattermost-server/v6/services/docextractor"
	"github.com/pkg/errors"
	"github.com/spf13/cobra"
)

var docExtractorCmd = &cobra.Command{
	Use:          "docextractor",
	Short:        "Run the Mattermost doc extractor service",
	RunE:         docExtractorCmdF,
	SilenceUsage: true,
}

func init() {
	docExtractorCmd.Flags().String("key", "", "Secret key")
	docExtractorCmd.Flags().String("host", "127.0.0.1", "Host")
	docExtractorCmd.Flags().Int("port", 8071, "Port used")
	docExtractorCmd.Flags().Bool("recursive", false, "Recursive extraction")

	RootCmd.AddCommand(docExtractorCmd)
}

func docExtractorCmdF(command *cobra.Command, args []string) error {
	key, err := command.Flags().GetString("key")
	if err != nil {
		return errors.New("key flag error")
	}
	host, err := command.Flags().GetString("host")
	if err != nil {
		return errors.New("host flag error")
	}
	port, err := command.Flags().GetInt("port")
	if err != nil {
		return errors.New("port flag error")
	}

	recursive, err := command.Flags().GetBool("recursive")
	if err != nil {
		return errors.New("recursive flag error")
	}

	http.HandleFunc("/", buildHandler(key, recursive))
	http.ListenAndServe(fmt.Sprintf("%s:%d", host, port), nil)
	return nil
}

type ExtractRequest struct {
	Filename string `json:"filename"`
	Data     string `json:"data"`
	Key      string `json:"key"`
}

func buildHandler(key string, recursive bool) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		data, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}
		defer r.Body.Close()

		var requestBody ExtractRequest
		err = json.Unmarshal(data, &requestBody)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}

		if requestBody.Filename == "" {
			http.Error(w, "not valid filename", http.StatusBadRequest)
			return
		}

		if requestBody.Key != key {
			http.Error(w, "not valid key", http.StatusBadRequest)
			return
		}
		decodedFileData, err := base64.StdEncoding.DecodeString(requestBody.Data)
		if err != nil {
			http.Error(w, http.StatusText(http.StatusBadRequest), http.StatusBadRequest)
			return
		}
		extractor := docextractor.BuiltinExtractorService{}
		content, err := extractor.Extract(requestBody.Filename, bytes.NewReader(decodedFileData), docextractor.ExtractSettings{ArchiveRecursion: recursive})
		if err != nil {
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
			return
		}
		w.Write([]byte(content))
		w.WriteHeader(http.StatusOK)
	}
}
