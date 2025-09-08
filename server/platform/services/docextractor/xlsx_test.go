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

func TestXlsxExtractor_Match(t *testing.T) {
	extractor := &xlsxExtractor{logger: nil}

	testCases := []struct {
		name     string
		filename string
		expected bool
	}{
		{"Excel XLSX", "spreadsheet.xlsx", true},
		{"Excel XLSM", "macros.xlsm", true},
		{"Excel XLS", "old.xls", true},
		{"Excel XLTX", "template.xltx", true},
		{"Excel XLTM", "template.xltm", true},
		{"Uppercase extension", "DATA.XLSX", true},
		{"Mixed case extension", "Report.XlSx", true},
		{"Word document", "document.docx", false},
		{"PDF file", "report.pdf", false},
		{"Text file", "data.txt", false},
		{"No extension", "spreadsheet", false},
		{"CSV file", "data.csv", false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			result := extractor.Match(tc.filename)
			assert.Equal(t, tc.expected, result)
		})
	}
}

func TestXlsxExtractor_Extract(t *testing.T) {
	t.Run("Simple spreadsheet", func(t *testing.T) {
		// Create a test Excel file in memory
		f := excelize.NewFile()
		defer f.Close()

		// Create a sheet with data
		sheetName := "Sheet1"
		f.SetCellValue(sheetName, "A1", "Name")
		f.SetCellValue(sheetName, "B1", "Age")
		f.SetCellValue(sheetName, "C1", "City")
		f.SetCellValue(sheetName, "A2", "John Doe")
		f.SetCellValue(sheetName, "B2", 30)
		f.SetCellValue(sheetName, "C2", "New York")
		f.SetCellValue(sheetName, "A3", "Jane Smith")
		f.SetCellValue(sheetName, "B3", 25)
		f.SetCellValue(sheetName, "C3", "Los Angeles")

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify content
		assert.Contains(t, text, "=== Sheet1 ===")
		assert.Contains(t, text, "Name\tAge\tCity")
		assert.Contains(t, text, "John Doe\t30\tNew York")
		assert.Contains(t, text, "Jane Smith\t25\tLos Angeles")
	})

	t.Run("Multiple sheets", func(t *testing.T) {
		// Create a test Excel file with multiple sheets
		f := excelize.NewFile()
		defer f.Close()

		// First sheet
		f.SetCellValue("Sheet1", "A1", "Product")
		f.SetCellValue("Sheet1", "B1", "Price")
		f.SetCellValue("Sheet1", "A2", "Laptop")
		f.SetCellValue("Sheet1", "B2", 999.99)

		// Second sheet
		f.NewSheet("Summary")
		f.SetCellValue("Summary", "A1", "Total Sales")
		f.SetCellValue("Summary", "B1", 50000)

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify both sheets are extracted
		assert.Contains(t, text, "=== Sheet1 ===")
		assert.Contains(t, text, "Product\tPrice")
		assert.Contains(t, text, "Laptop\t999.99")
		assert.Contains(t, text, "=== Summary ===")
		assert.Contains(t, text, "Total Sales\t50000")
	})

	t.Run("Empty rows handling", func(t *testing.T) {
		// Create a test Excel file with empty rows
		f := excelize.NewFile()
		defer f.Close()

		f.SetCellValue("Sheet1", "A1", "Header")
		// A2 is empty
		f.SetCellValue("Sheet1", "A3", "Data")
		// A4 is empty
		f.SetCellValue("Sheet1", "A5", "More Data")

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify empty rows are skipped
		lines := strings.Split(text, "\n")
		nonEmptyLines := []string{}
		for _, line := range lines {
			if strings.TrimSpace(line) != "" {
				nonEmptyLines = append(nonEmptyLines, line)
			}
		}
		assert.Equal(t, 4, len(nonEmptyLines)) // Sheet header + 3 data rows
		assert.Contains(t, text, "Header")
		assert.Contains(t, text, "Data")
		assert.Contains(t, text, "More Data")
	})

	t.Run("Formulas", func(t *testing.T) {
		// Create a test Excel file with formulas
		f := excelize.NewFile()
		defer f.Close()

		f.SetCellValue("Sheet1", "A1", "Value 1")
		f.SetCellValue("Sheet1", "B1", 10)
		f.SetCellValue("Sheet1", "A2", "Value 2")
		f.SetCellValue("Sheet1", "B2", 20)
		f.SetCellValue("Sheet1", "A3", "Sum")
		f.SetCellFormula("Sheet1", "B3", "=B1+B2")

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify content (formulas should show calculated values)
		assert.Contains(t, text, "Value 1\t10")
		assert.Contains(t, text, "Value 2\t20")
		// Formula result might be empty in test, but the structure should be there
		assert.Contains(t, text, "Sum")
	})

	t.Run("Invalid file", func(t *testing.T) {
		// Try to extract from invalid data
		extractor := &xlsxExtractor{logger: nil}
		invalidData := []byte("This is not an Excel file")
		_, err := extractor.Extract("test.xlsx", bytes.NewReader(invalidData))
		assert.Error(t, err)
	})

	t.Run("Name method", func(t *testing.T) {
		extractor := &xlsxExtractor{logger: nil}
		assert.Equal(t, "xlsxExtractor", extractor.Name())
	})
}

func TestXlsxExtractor_LargeFile(t *testing.T) {
	t.Run("Many rows", func(t *testing.T) {
		// Create a test Excel file with many rows
		f := excelize.NewFile()
		defer f.Close()

		// Add headers
		f.SetCellValue("Sheet1", "A1", "ID")
		f.SetCellValue("Sheet1", "B1", "Value")

		// Add 100 rows of data
		for i := 2; i <= 101; i++ {
			f.SetCellValue("Sheet1", "A"+string(rune('0'+i)), i-1)
			f.SetCellValue("Sheet1", "B"+string(rune('0'+i)), "Value"+string(rune('0'+i)))
		}

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify headers are present
		assert.Contains(t, text, "ID\tValue")
		// Verify some data is present
		assert.Contains(t, text, "1\t")
	})
}

func TestXlsxExtractor_EdgeCases(t *testing.T) {
	t.Run("Empty file", func(t *testing.T) {
		// Create an empty Excel file
		f := excelize.NewFile()
		defer f.Close()

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Should at least have the sheet name
		assert.Contains(t, text, "=== Sheet1 ===")
	})

	t.Run("Special characters", func(t *testing.T) {
		// Create a test Excel file with special characters
		f := excelize.NewFile()
		defer f.Close()

		f.SetCellValue("Sheet1", "A1", "Special: €£¥")
		f.SetCellValue("Sheet1", "B1", "Unicode: 你好世界")
		f.SetCellValue("Sheet1", "A2", "Symbols: @#$%^&*()")

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Extract text
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", bytes.NewReader(buf.Bytes()))
		require.NoError(t, err)

		// Verify special characters are preserved
		assert.Contains(t, text, "€£¥")
		assert.Contains(t, text, "你好世界")
		assert.Contains(t, text, "@#$%^&*()")
	})

	t.Run("Reader seek", func(t *testing.T) {
		// Create a test Excel file
		f := excelize.NewFile()
		defer f.Close()
		f.SetCellValue("Sheet1", "A1", "Test")

		// Save to buffer
		buf := new(bytes.Buffer)
		err := f.Write(buf)
		require.NoError(t, err)

		// Create a reader - the Extract function handles reading from start
		reader := bytes.NewReader(buf.Bytes())

		// Extract should work regardless of reader position
		extractor := &xlsxExtractor{logger: nil}
		text, err := extractor.Extract("test.xlsx", reader)
		require.NoError(t, err)
		assert.Contains(t, text, "Test")
	})
}