// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package commands

import (
	"fmt"

	"github.com/pkg/errors"
	"github.com/spf13/cobra"

	"github.com/mattermost/mattermost-server/v5/model"
	"github.com/mattermost/mattermost-server/v5/shared/mlog"
)

var ExtractContentCmd = &cobra.Command{
	Use:     "extract-documents-content",
	Short:   "Extracts the documents content",
	Long:    "Extracts the documents content and stores it in the database for document searche",
	Example: "extract-documents-content --from=12345",
	RunE:    extractContentCmdF,
}

func init() {
	ExtractContentCmd.Flags().Int64("from", 0, "The timestamp of the earliest file to extract, expressed in seconds since the unix epoch.")
	ExtractContentCmd.Flags().Int64("to", model.GetMillis(), "The timestamp of the latest file to extract, expressed in seconds since the unix epoch.")
	RootCmd.AddCommand(ExtractContentCmd)
}

func extractContentCmdF(command *cobra.Command, args []string) error {
	a, err := InitDBCommandContextCobra(command)
	if err != nil {
		return err
	}
	defer a.Srv().Shutdown()

	if !*a.Config().FileSettings.ExtractContent || !a.Config().FeatureFlags.FilesSearch {
		return errors.New("ERROR: Document extraction is not enabled")
	}

	startTime, err := command.Flags().GetInt64("from")
	if err != nil {
		return errors.New("\"from\" flag error")
	}
	if startTime < 0 {
		return errors.New("\"from\" must be a positive integer")
	}

	endTime, err := command.Flags().GetInt64("to")
	if err != nil {
		return errors.New("\"to\" flag error")
	}
	if endTime < startTime {
		return errors.New("\"to\" must be greater than from")
	}

	since := startTime
	for {
		opts := model.GetFileInfosOptions{
			Since:          since,
			SortBy:         model.FILEINFO_SORT_BY_CREATED,
			IncludeDeleted: false,
		}
		fileInfos, err := a.Srv().Store.FileInfo().GetWithOptions(0, 1000, &opts)
		if err != nil {
			return fmt.Errorf("ERROR: Document extraction failed %v", err.Error())
		}
		if len(fileInfos) == 0 {
			break
		}
		for _, fileInfo := range fileInfos {
			fmt.Println("extracting file", fileInfo.Name, fileInfo.Path)
			err = a.ExtractContentFromFileInfo(fileInfo)
			if err != nil {
				mlog.Error("Failed to extract file content", mlog.Err(err), mlog.String("fileInfoId", fileInfo.Id))
			}
		}
		lastFileInfo := fileInfos[len(fileInfos)-1]
		if lastFileInfo.CreateAt > endTime {
			break
		}
		since = lastFileInfo.CreateAt + 1
	}

	return nil
}
