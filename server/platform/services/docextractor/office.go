// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"archive/zip"
	"context"
	"encoding/xml"
	"errors"
	"io"
	"slices"
	"strings"
	"sync"
)

// officePartReadLimit is the per-part read cap for content-type metadata and part XML.
const officePartReadLimit int64 = 1 << 20

var (
	ooxmlBreakElements = []string{"br", "p", "tab"}
	ooxmlSkipElements  = []string{"instrText", "script"}
	odtBreakElements   = []string{"br", "p", "tab"}
)

type officeOverride struct {
	PartName    string `xml:"PartName,attr"`
	ContentType string `xml:"ContentType,attr"`
}

type officeContentTypes struct {
	Overrides []officeOverride `xml:"Override"`
}

// ctxReaderAt reads a ReadSeeker at absolute offsets and checks ctx before each Read.
type ctxReaderAt struct {
	ctx context.Context
	r   io.ReadSeeker
	mu  sync.Mutex
}

func (c *ctxReaderAt) ReadAt(p []byte, off int64) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if err := contextErr(c.ctx); err != nil {
		return 0, err
	}
	if _, err := c.r.Seek(off, io.SeekStart); err != nil {
		return 0, err
	}

	read := 0
	for read < len(p) {
		if err := contextErr(c.ctx); err != nil {
			return read, err
		}
		n, err := c.r.Read(p[read:])
		read += n
		if err != nil {
			return read, err
		}
		if n == 0 {
			return read, io.ErrUnexpectedEOF
		}
	}
	return read, nil
}

func contextErr(ctx context.Context) error {
	if ctx == nil {
		return nil
	}
	return ctx.Err()
}

// officeRetainLimit is the text size kept for one docx, pptx, or odt extraction.
// A nil budget still uses the aggregate cap. A smaller remaining budget wins.
func officeRetainLimit(budget *ExtractionBudget) int {
	limit := maxArchiveExtractedText
	if budget == nil {
		return int(limit)
	}
	remaining := budget.Remaining()
	if remaining <= 0 {
		return 0
	}
	if remaining < limit {
		limit = remaining
	}
	return int(limit)
}

// extractOfficeText converts a docx, pptx, or odt package.
// Each part name is read once, and retained text stops at limit.
func extractOfficeText(ctx context.Context, extension string, r io.ReadSeeker, maxFileSize int64, budget *ExtractionBudget) (string, error) {
	limit := officeRetainLimit(budget)
	if limit <= 0 {
		return "", nil
	}
	if err := contextErr(ctx); err != nil {
		return "", nil
	}

	size, err := r.Seek(0, io.SeekEnd)
	if err != nil {
		return "", err
	}
	if maxFileSize > 0 && size > maxFileSize {
		return "", nil
	}

	zr, err := zip.NewReader(&ctxReaderAt{ctx: ctx, r: r}, size)
	if err != nil {
		if contextErr(ctx) != nil {
			return "", nil
		}
		return "", err
	}

	switch extension {
	case "odt":
		return extractODTText(ctx, zr, limit)
	default:
		return extractOOXMLText(ctx, extension, zr, limit)
	}
}

func extractOOXMLText(ctx context.Context, extension string, zr *zip.Reader, limit int) (string, error) {
	contentTypes := firstZipFile(zr.File, "[Content_Types].xml")
	if contentTypes == nil {
		return "", errors.New("error extracting document text")
	}
	overrides, err := readOfficeOverrides(ctx, contentTypes)
	if err != nil {
		if contextErr(ctx) != nil {
			return "", nil
		}
		return "", err
	}

	files := zipFilesByName(zr.File)
	// Keyed by data offset so differently named entries sharing one part's data are read once.
	seen := make(map[int64]struct{})
	var b strings.Builder
	for _, ov := range overrides {
		if contextErr(ctx) != nil {
			return b.String(), nil
		}
		if !officeContentTypeIsText(extension, ov.ContentType) {
			continue
		}
		if b.Len() >= limit {
			break
		}
		f := lookupZipFile(files, ov.PartName)
		if f == nil {
			continue
		}
		offset, err := f.DataOffset()
		if err != nil {
			if contextErr(ctx) != nil {
				return b.String(), nil
			}
			return "", err
		}
		if _, ok := seen[offset]; ok {
			continue
		}
		seen[offset] = struct{}{}
		text, err := readOfficePart(ctx, f, func(r io.Reader) (string, error) {
			return officeXMLToText(ctx, r, ooxmlBreakElements, ooxmlSkipElements, limit, officePartReadLimit)
		})
		if contextErr(ctx) != nil {
			return b.String(), nil
		}
		if err != nil {
			return "", err
		}
		if !appendOfficeText(&b, text, limit) {
			break
		}
	}
	return b.String(), nil
}

func extractODTText(ctx context.Context, zr *zip.Reader, limit int) (string, error) {
	var b strings.Builder
	seen := make(map[string]struct{})
	for _, f := range zr.File {
		if contextErr(ctx) != nil {
			return b.String(), nil
		}
		if f.Name != "content.xml" {
			continue
		}
		if _, ok := seen[f.Name]; ok {
			continue
		}
		seen[f.Name] = struct{}{}
		if b.Len() >= limit {
			break
		}
		text, err := readOfficePart(ctx, f, func(r io.Reader) (string, error) {
			return officeXMLToText(ctx, r, odtBreakElements, nil, limit, officePartReadLimit)
		})
		if contextErr(ctx) != nil {
			return b.String(), nil
		}
		if err != nil {
			return "", err
		}
		if !appendOfficeText(&b, text, limit) {
			break
		}
	}
	return b.String(), nil
}

var errOfficePartCap = errors.New("office part read cap reached")

// capReader reads up to remaining bytes, then fails with errOfficePartCap.
type capReader struct {
	r         io.Reader
	remaining int64
}

func (c *capReader) Read(p []byte) (int, error) {
	if c.remaining <= 0 {
		return 0, errOfficePartCap
	}
	if int64(len(p)) > c.remaining {
		p = p[:c.remaining]
	}
	n, err := c.r.Read(p)
	c.remaining -= int64(n)
	return n, err
}

// officeXMLToText extracts character data from strict XML, emitting a newline
// for each break element and dropping skip subtrees. It stops once limit bytes
// are collected or readCap bytes are read, keeping the text gathered so far,
// and returns ctx's error if ctx ends first.
func officeXMLToText(ctx context.Context, r io.Reader, breaks, skip []string, limit int, readCap int64) (string, error) {
	dec := xml.NewDecoder(&capReader{r: r, remaining: readCap})
	var b strings.Builder
	for b.Len() < limit {
		if err := contextErr(ctx); err != nil {
			return "", err
		}
		t, err := dec.Token()
		if err != nil {
			if err == io.EOF {
				break
			}
			if errors.Is(err, errOfficePartCap) {
				return truncateUTF8(b.String()), nil
			}
			return "", err
		}

		switch v := t.(type) {
		case xml.CharData:
			b.Write(v)
		case xml.StartElement:
			if slices.Contains(breaks, v.Name.Local) {
				b.WriteByte('\n')
			}
			if !slices.Contains(skip, v.Name.Local) {
				continue
			}
			for depth := 1; depth > 0; {
				if err := contextErr(ctx); err != nil {
					return "", err
				}
				t, err := dec.Token()
				if err != nil {
					if errors.Is(err, errOfficePartCap) {
						return truncateUTF8(b.String()), nil
					}
					return "", err
				}
				switch t.(type) {
				case xml.StartElement:
					depth++
				case xml.EndElement:
					depth--
				}
			}
		}
	}
	return b.String(), nil
}

func officeContentTypeIsText(extension, contentType string) bool {
	switch extension {
	case "docx":
		switch contentType {
		case "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.header+xml",
			"application/vnd.openxmlformats-officedocument.wordprocessingml.footer+xml":
			return true
		}
	case "pptx":
		switch contentType {
		case "application/vnd.openxmlformats-officedocument.presentationml.slide+xml",
			"application/vnd.openxmlformats-officedocument.drawingml.diagramData+xml":
			return true
		}
	}
	return false
}

func readOfficeOverrides(ctx context.Context, f *zip.File) ([]officeOverride, error) {
	if err := contextErr(ctx); err != nil {
		return nil, err
	}
	rc, err := f.Open()
	if err != nil {
		return nil, err
	}
	var def officeContentTypes
	err = xml.NewDecoder(io.LimitReader(rc, officePartReadLimit)).Decode(&def)
	closeErr := rc.Close()
	if err != nil {
		return nil, err
	}
	if closeErr != nil {
		return nil, closeErr
	}
	return def.Overrides, nil
}

func readOfficePart(ctx context.Context, f *zip.File, parse func(io.Reader) (string, error)) (string, error) {
	if err := contextErr(ctx); err != nil {
		return "", err
	}
	rc, err := f.Open()
	if err != nil {
		return "", err
	}
	text, err := parse(rc)
	closeErr := rc.Close()
	if err != nil {
		return "", err
	}
	if closeErr != nil {
		return "", closeErr
	}
	return text, nil
}

// appendOfficeText keeps text up to limit bytes. It reports whether more text fits.
func appendOfficeText(b *strings.Builder, s string, limit int) bool {
	if b.Len() >= limit {
		return false
	}
	if s == "" {
		return true
	}
	if b.Len() > 0 {
		b.WriteByte('\n')
		if b.Len() >= limit {
			return false
		}
	}
	remain := limit - b.Len()
	if len(s) > remain {
		b.WriteString(truncateUTF8(s[:remain]))
		return false
	}
	b.WriteString(s)
	return b.Len() < limit
}

func zipFilesByName(files []*zip.File) map[string]*zip.File {
	m := make(map[string]*zip.File, len(files)*2)
	for _, f := range files {
		if _, ok := m[f.Name]; ok {
			continue
		}
		m[f.Name] = f
		trimmed := strings.TrimPrefix(f.Name, "/")
		if _, ok := m[trimmed]; !ok {
			m[trimmed] = f
		}
		withSlash := "/" + trimmed
		if _, ok := m[withSlash]; !ok {
			m[withSlash] = f
		}
	}
	return m
}

func lookupZipFile(files map[string]*zip.File, partName string) *zip.File {
	if f := files[partName]; f != nil {
		return f
	}
	trimmed := strings.TrimPrefix(partName, "/")
	if f := files[trimmed]; f != nil {
		return f
	}
	return files["/"+trimmed]
}

func firstZipFile(files []*zip.File, name string) *zip.File {
	for _, f := range files {
		if f.Name == name || strings.TrimPrefix(f.Name, "/") == name {
			return f
		}
	}
	return nil
}
