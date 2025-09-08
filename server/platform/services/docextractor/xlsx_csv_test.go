// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"strings"
	"testing"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/xuri/excelize/v2"
)

func TestXlsxExtractorCSV_Formats(t *testing.T) {
	// Create a test Excel file with sample data
	createTestFile := func() *bytes.Buffer {
		f := excelize.NewFile()
		defer f.Close()

		// First sheet with headers and data
		f.SetCellValue("Sheet1", "A1", "Name")
		f.SetCellValue("Sheet1", "B1", "Age")
		f.SetCellValue("Sheet1", "C1", "City")
		f.SetCellValue("Sheet1", "A2", "John Doe")
		f.SetCellValue("Sheet1", "B2", "30")
		f.SetCellValue("Sheet1", "C2", "New York, NY")  // Contains comma
		f.SetCellValue("Sheet1", "A3", "Jane \"Smith\"") // Contains quotes
		f.SetCellValue("Sheet1", "B3", "25")
		f.SetCellValue("Sheet1", "C3", "Los Angeles")

		// Second sheet
		f.NewSheet("Summary")
		f.SetCellValue("Summary", "A1", "Total")
		f.SetCellValue("Summary", "B1", "55")

		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)
		return buf
	}

	t.Run("CSV Format", func(t *testing.T) {
		buf := createTestFile()
		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatCSV,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Check CSV formatting with proper escaping
		assert.Contains(t, text, "# Sheet: Sheet1")
		assert.Contains(t, text, "Name,Age,City")
		assert.Contains(t, text, "John Doe,30,\"New York, NY\"") // Comma in field should be quoted
		assert.Contains(t, text, "\"Jane \"\"Smith\"\"\",25,Los Angeles") // Quotes should be escaped
		assert.Contains(t, text, "# Sheet: Summary")
		assert.Contains(t, text, "Total,55")
	})

	t.Run("TSV Format", func(t *testing.T) {
		buf := createTestFile()
		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatTSV,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Check TSV formatting
		assert.Contains(t, text, "=== Sheet1 ===")
		assert.Contains(t, text, "Name\tAge\tCity")
		assert.Contains(t, text, "John Doe\t30\tNew York, NY") // Comma is fine in TSV
		assert.Contains(t, text, "Jane \"Smith\"\t25\tLos Angeles") // Quotes are preserved
		assert.Contains(t, text, "=== Summary ===")
		assert.Contains(t, text, "Total\t55")
	})

	t.Run("Single Sheet CSV Format", func(t *testing.T) {
		buf := createTestFile()
		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatSingleSheet,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Check that all sheets are combined into one CSV
		// Should have sheet markers as rows
		assert.Contains(t, text, "=== Sheet: Sheet1 ===")
		assert.Contains(t, text, "=== Sheet: Summary ===")
		
		// All data should be in CSV format
		assert.Contains(t, text, "Name,Age,City")
		assert.Contains(t, text, "Total,55")
		
		// No empty lines between sheets (continuous CSV)
		assert.NotContains(t, text, "\n\n")
	})

	t.Run("JSON-like Format", func(t *testing.T) {
		buf := createTestFile()
		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatJSON,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Check JSON-like formatting
		assert.Contains(t, text, "Sheet1:")
		assert.Contains(t, text, "[\"Name\", \"Age\", \"City\"]")
		assert.Contains(t, text, "[\"John Doe\", \"30\", \"New York, NY\"]")
		assert.Contains(t, text, "[\"Jane \\\"Smith\\\"\", \"25\", \"Los Angeles\"]") // Escaped quotes
		assert.Contains(t, text, "Summary:")
		assert.Contains(t, text, "[\"Total\", \"55\"]")
	})

	t.Run("Empty Rows Handling", func(t *testing.T) {
		f := excelize.NewFile()
		defer f.Close()

		f.SetCellValue("Sheet1", "A1", "Header")
		// A2 is empty
		f.SetCellValue("Sheet1", "A3", "Data")

		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Test CSV format
		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatCSV,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		lines := strings.Split(strings.TrimSpace(text), "\n")
		// Should have comment line + 2 data lines (empty row skipped)
		dataLines := 0
		for _, line := range lines {
			if !strings.HasPrefix(line, "#") {
				dataLines++
			}
		}
		assert.Equal(t, 2, dataLines)
	})

	t.Run("Special Characters in CSV", func(t *testing.T) {
		f := excelize.NewFile()
		defer f.Close()

		// Test various special characters
		f.SetCellValue("Sheet1", "A1", "Line\nBreak")
		f.SetCellValue("Sheet1", "B1", "Tab\tChar")
		f.SetCellValue("Sheet1", "C1", "Comma,Here")
		f.SetCellValue("Sheet1", "A2", "\"Quotes\"")
		f.SetCellValue("Sheet1", "B2", "Backslash\\")

		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		extractor := &xlsxExtractorCSV{
			logger: nil,
			format: XLSXFormatCSV,
		}

		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// CSV should properly escape special characters
		assert.Contains(t, text, "\"Line\nBreak\"") // Line breaks should be quoted
		assert.Contains(t, text, "Tab\tChar") // Tabs don't need quoting in CSV (not a delimiter)
		assert.Contains(t, text, "\"Comma,Here\"") // Commas should be quoted
		assert.Contains(t, text, "\"\"\"Quotes\"\"\"") // Quotes should be escaped and quoted
		assert.Contains(t, text, "Backslash\\") // Backslash doesn't need special handling in CSV
	})
}

func TestXlsxExtractorCSV_Methods(t *testing.T) {
	t.Run("Name method", func(t *testing.T) {
		extractor := &xlsxExtractorCSV{format: XLSXFormatCSV}
		assert.Equal(t, "xlsxExtractorCSV", extractor.Name())
	})

	t.Run("Match method", func(t *testing.T) {
		extractor := &xlsxExtractorCSV{}
		assert.True(t, extractor.Match("file.xlsx"))
		assert.True(t, extractor.Match("file.XLSX"))
		assert.True(t, extractor.Match("file.xls"))
		assert.False(t, extractor.Match("file.csv"))
		assert.False(t, extractor.Match("file.txt"))
	})

	t.Run("Format names", func(t *testing.T) {
		tests := []struct {
			format   XLSXOutputFormat
			expected string
		}{
			{XLSXFormatTSV, "TSV"},
			{XLSXFormatCSV, "CSV"},
			{XLSXFormatSingleSheet, "SingleCSV"},
			{XLSXFormatJSON, "JSON-like"},
		}

		for _, test := range tests {
			extractor := &xlsxExtractorCSV{format: test.format}
			assert.Equal(t, test.expected, extractor.getFormatName())
		}
	})
}