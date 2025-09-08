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

	"github.com/xuri/excelize/v2"
)

type xlsxExtractor struct{}

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
			out = ""
			outErr = errors.New("error extracting xlsx text")
		}
	}()

	// Read the file into memory
	buf := new(bytes.Buffer)
	if _, err := io.Copy(buf, r); err != nil {
		return "", fmt.Errorf("error reading xlsx file: %v", err)
	}

	// Open the Excel file from bytes
	f, err := excelize.OpenReader(buf)
	if err != nil {
		return "", fmt.Errorf("error opening xlsx file: %v", err)
	}
	defer f.Close()

	var textBuilder strings.Builder
	
	// Get all sheet names
	sheetNames := f.GetSheetList()
	
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
			// Skip sheets that can't be read
			continue
		}
		
		// Process each row
		for rowIdx, row := range rows {
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
			
			// Add row content
			if rowIdx > 0 {
				textBuilder.WriteString("\n")
			}
			
			// Join cells with tab separator
			rowText := strings.Join(row, "\t")
			textBuilder.WriteString(rowText)
		}
	}
	
	return textBuilder.String(), nil
}