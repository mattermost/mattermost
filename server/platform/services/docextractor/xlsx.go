// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/xuri/excelize/v2"
)

type xlsxExtractor struct{
	logger mlog.LoggerIFace
}

func (xe *xlsxExtractor) Name() string {
	return "xlsxExtractor"
}

func (xe *xlsxExtractor) Match(filename string) bool {
	supportedExtensions := map[string]bool{
		"xlsx": true,
		"xlsm": true,
		"xls":  true,
		"xltx": true,
		"xltm": true,
	}
	extension := strings.TrimPrefix(path.Ext(filename), ".")
	return supportedExtensions[strings.ToLower(extension)]
}

func (xe *xlsxExtractor) Extract(filename string, r io.ReadSeeker) (out string, outErr error) {
	defer func() {
		if r := recover(); r != nil {
			if xe.logger != nil {
				xe.logger.Debug("XLSX extraction panic recovered", mlog.String("filename", filename), mlog.Any("error", r))
			}
			out = ""
			outErr = errors.New("error extracting xlsx text")
		}
	}()

	if xe.logger != nil {
		xe.logger.Debug("Starting XLSX extraction", mlog.String("filename", filename))
	}

	// Read the file into memory
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, r); err != nil {
		if xe.logger != nil {
			xe.logger.Debug("Failed to read XLSX file", mlog.String("filename", filename), mlog.Err(err))
		}
		return "", fmt.Errorf("error reading xlsx file: %v", err)
	}

	// Open the Excel file from bytes
	f, err := excelize.OpenReader(buf)
	if err != nil {
		if xe.logger != nil {
			xe.logger.Debug("Failed to open XLSX file", mlog.String("filename", filename), mlog.Err(err))
		}
		return "", fmt.Errorf("error opening xlsx file: %v", err)
	}
	defer f.Close()

	var textBuilder strings.Builder
	
	// Get all sheet names
	sheetNames := f.GetSheetList()
	if xe.logger != nil {
		xe.logger.Debug("Processing XLSX sheets", mlog.String("filename", filename), mlog.Int("sheet_count", len(sheetNames)))
	}
	
	for i, sheetName := range sheetNames {
		// Add sheet separator for multiple sheets
		if i > 0 {
			textBuilder.WriteString("\n\n")
		}
		
		// Add sheet name as header
		textBuilder.WriteString(fmt.Sprintf("=== %s ===\n", sheetName))
		
		// Get all rows for the sheet
		rows, err := f.GetRows(sheetName)
		if err != nil {
			if xe.logger != nil {
				xe.logger.Debug("Failed to read sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Err(err))
			}
			// Skip sheets that can't be read
			continue
		}
		
		// Process each row
		nonEmptyRows := 0
		for _, row := range rows {
			// Skip completely empty rows
			hasContent := false
			for _, cell := range row {
				if strings.TrimSpace(cell) != "" {
					hasContent = true
					break
				}
			}
			
			if !hasContent {
				continue
			}
			
			nonEmptyRows++
			
			// Add row content
			if nonEmptyRows > 1 {
				textBuilder.WriteString("\n")
			}
			
			// Join cells with tab separator
			rowText := strings.Join(row, "\t")
			textBuilder.WriteString(rowText)
		}
		
		if xe.logger != nil {
			xe.logger.Debug("Processed XLSX sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Int("rows", nonEmptyRows))
		}
	}
	
	result := textBuilder.String()
	if xe.logger != nil {
		xe.logger.Debug("XLSX extraction completed", mlog.String("filename", filename), mlog.Int("text_length", len(result)))
	}
	
	return result, nil
}