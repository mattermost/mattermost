// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"path"
	"strings"

	"github.com/mattermost/mattermost/server/public/shared/mlog"
	"github.com/xuri/excelize/v2"
)

// XLSXOutputFormat defines how the extracted text should be formatted
type XLSXOutputFormat int

const (
	// XLSXFormatTSV outputs tab-separated values (current default)
	XLSXFormatTSV XLSXOutputFormat = iota
	// XLSXFormatCSV outputs comma-separated values with proper escaping
	XLSXFormatCSV
	// XLSXFormatSingleSheet treats all sheets as one continuous CSV
	XLSXFormatSingleSheet
	// XLSXFormatJSON outputs a JSON-like structure (sheet: [[row1], [row2]])
	XLSXFormatJSON
)

type xlsxExtractorCSV struct {
	logger mlog.LoggerIFace
	format XLSXOutputFormat
}

func (xe *xlsxExtractorCSV) Name() string {
	return "xlsxExtractorCSV"
}

func (xe *xlsxExtractorCSV) Match(filename string) bool {
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

func (xe *xlsxExtractorCSV) Extract(filename string, r io.ReadSeeker) (out string, outErr error) {
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
		xe.logger.Debug("Starting XLSX extraction", mlog.String("filename", filename), mlog.String("format", xe.getFormatName()))
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

	// Get all sheet names
	sheetNames := f.GetSheetList()
	if xe.logger != nil {
		xe.logger.Debug("Processing XLSX sheets", mlog.String("filename", filename), mlog.Int("sheet_count", len(sheetNames)))
	}

	switch xe.format {
	case XLSXFormatCSV:
		return xe.extractAsCSV(f, sheetNames, filename)
	case XLSXFormatSingleSheet:
		return xe.extractAsSingleCSV(f, sheetNames, filename)
	case XLSXFormatJSON:
		return xe.extractAsJSON(f, sheetNames, filename)
	default: // XLSXFormatTSV
		return xe.extractAsTSV(f, sheetNames, filename)
	}
}

func (xe *xlsxExtractorCSV) extractAsCSV(f *excelize.File, sheetNames []string, filename string) (string, error) {
	var output strings.Builder
	
	for i, sheetName := range sheetNames {
		if i > 0 {
			output.WriteString("\n\n")
		}
		
		// Add sheet name as comment
		output.WriteString(fmt.Sprintf("# Sheet: %s\n", sheetName))
		
		rows, err := f.GetRows(sheetName)
		if err != nil {
			if xe.logger != nil {
				xe.logger.Debug("Failed to read sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Err(err))
			}
			continue
		}
		
		// Use CSV writer for proper escaping
		csvBuffer := new(bytes.Buffer)
		csvWriter := csv.NewWriter(csvBuffer)
		
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
			
			if err := csvWriter.Write(row); err != nil {
				if xe.logger != nil {
					xe.logger.Debug("Failed to write CSV row", mlog.String("filename", filename), mlog.Err(err))
				}
				continue
			}
		}
		
		csvWriter.Flush()
		output.Write(csvBuffer.Bytes())
	}
	
	return output.String(), nil
}

func (xe *xlsxExtractorCSV) extractAsSingleCSV(f *excelize.File, sheetNames []string, filename string) (string, error) {
	csvBuffer := new(bytes.Buffer)
	csvWriter := csv.NewWriter(csvBuffer)
	
	for _, sheetName := range sheetNames {
		rows, err := f.GetRows(sheetName)
		if err != nil {
			if xe.logger != nil {
				xe.logger.Debug("Failed to read sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Err(err))
			}
			continue
		}
		
		// Add sheet name as a row
		csvWriter.Write([]string{fmt.Sprintf("=== Sheet: %s ===", sheetName)})
		
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
			
			if err := csvWriter.Write(row); err != nil {
				if xe.logger != nil {
					xe.logger.Debug("Failed to write CSV row", mlog.String("filename", filename), mlog.Err(err))
				}
				continue
			}
		}
	}
	
	csvWriter.Flush()
	return csvBuffer.String(), nil
}

func (xe *xlsxExtractorCSV) extractAsJSON(f *excelize.File, sheetNames []string, filename string) (string, error) {
	var output strings.Builder
	
	for i, sheetName := range sheetNames {
		if i > 0 {
			output.WriteString("\n")
		}
		
		rows, err := f.GetRows(sheetName)
		if err != nil {
			if xe.logger != nil {
				xe.logger.Debug("Failed to read sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Err(err))
			}
			continue
		}
		
		// Simple JSON-like format (not actual JSON for search purposes)
		output.WriteString(fmt.Sprintf("%s:\n", sheetName))
		
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
			
			// Format as array-like structure
			output.WriteString("[")
			for j, cell := range row {
				if j > 0 {
					output.WriteString(", ")
				}
				// Simple escaping for readability
				escaped := strings.ReplaceAll(cell, "\"", "\\\"")
				output.WriteString(fmt.Sprintf("\"%s\"", escaped))
			}
			output.WriteString("]\n")
		}
	}
	
	return output.String(), nil
}

func (xe *xlsxExtractorCSV) extractAsTSV(f *excelize.File, sheetNames []string, filename string) (string, error) {
	var textBuilder strings.Builder
	
	for i, sheetName := range sheetNames {
		if i > 0 {
			textBuilder.WriteString("\n\n")
		}
		
		textBuilder.WriteString(fmt.Sprintf("=== %s ===\n", sheetName))
		
		rows, err := f.GetRows(sheetName)
		if err != nil {
			if xe.logger != nil {
				xe.logger.Debug("Failed to read sheet", mlog.String("filename", filename), mlog.String("sheet", sheetName), mlog.Err(err))
			}
			continue
		}
		
		nonEmptyRows := 0
		for rowIdx, row := range rows {
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
			
			if rowIdx > 0 {
				textBuilder.WriteString("\n")
			}
			
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

func (xe *xlsxExtractorCSV) getFormatName() string {
	switch xe.format {
	case XLSXFormatCSV:
		return "CSV"
	case XLSXFormatSingleSheet:
		return "SingleCSV"
	case XLSXFormatJSON:
		return "JSON-like"
	default:
		return "TSV"
	}
}