// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package docextractor

import (
	"bytes"
	"context"
	"fmt"
	"slices"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	"github.com/mattermost/mattermost/server/v8/channels/utils/testutils"
)

func TestPdfEmptyFile(t *testing.T) {
	extractor := pdfExtractor{}
	_, err := extractor.Extract(context.Background(), "test.pdf", bytes.NewReader([]byte{}), 0, testBudget())
	require.Error(t, err)
}

func TestPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	contentText := "\nThis is a simple document that contains some text."
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	extractedText, err := extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 0, testBudget())
	require.NoError(t, err)
	require.Equal(t, contentText, extractedText)
}

func TestPdfDeeplyNestedObjects(t *testing.T) {
	// Test for MM-63434
	var buf bytes.Buffer
	buf.WriteString("%PDF-1.0\n")
	for range 10_000 {
		buf.WriteString("0\n0\nobj\n")
	}
	buf.WriteString("startxref\n0\n%%EOF\n")

	extractor := pdfExtractor{}
	text, err := extractor.Extract(context.Background(), "excessive-nests.pdf", bytes.NewReader(buf.Bytes()), 0, testBudget())
	require.Error(t, err)
	require.Empty(t, text)
}

func TestWrongPdfFile(t *testing.T) {
	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.docx")
	require.NoError(t, err)
	_, err = extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 0, testBudget())
	require.Error(t, err)
}

func TestPdfMaxFileSize(t *testing.T) {
	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	require.Greater(t, len(content), 16, "fixture must be larger than the tight limit under test")

	t.Run("a zero limit means unlimited and extracts the content", func(t *testing.T) {
		text, err := extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 0, testBudget())
		require.NoError(t, err)
		require.Contains(t, text, "simple")
	})

	t.Run("a generous limit extracts the content", func(t *testing.T) {
		text, err := extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 10*1024*1024, testBudget())
		require.NoError(t, err)
		require.Contains(t, text, "simple")
	})

	t.Run("a tight limit prevents extraction", func(t *testing.T) {
		// The reader errors once it reads past the limit, so io.Copy to the
		// temp file fails and no text is extracted.
		text, err := extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 16, testBudget())
		require.Error(t, err)
		require.Empty(t, text)
	})
}

const pdfExtractBound = 2 * time.Second

// TestPdfExtractReturnsWithinBound checks that Extract returns within a short
// bound for page-tree, inherited-parent, xref-prev, and object-stream-extends
// document shapes. Returning at all (including with an error or empty text)
// satisfies the contract.
func TestPdfExtractReturnsWithinBound(t *testing.T) {
	// Returning at all (including with an error or empty text) satisfies these rows.
	tests := []struct {
		name string
		pdf  func() []byte
	}{
		{
			name: "page tree kids list includes the pages node",
			pdf:  pdfWithPagesKidsIncludingPagesNode,
		},
		{
			name: "two pages nodes list each other as kids",
			pdf:  pdfWithTwoPagesNodesListingEachOther,
		},
		{
			name: "three pages nodes list the next as kids",
			pdf:  pdfWithThreePagesNodesListingNext,
		},
		{
			name: "pages node parent refers to the pages node",
			pdf:  pdfWithPagesParentReferringToPagesNode,
		},
		{
			name: "three nodes in the parent walk",
			pdf:  pdfWithThreeNodeParentWalk,
		},
		{
			name: "classic xref prev refers to the same table",
			pdf:  pdfWithClassicXrefPrevAtSameOffset,
		},
		{
			name: "three classic xref sections each prev names the next",
			pdf:  pdfWithClassicXrefPrevThreeSectionRing,
		},
		{
			name: "xref stream prev refers to the same stream",
			pdf:  pdfWithXRefStreamPrevAtSameOffset,
		},
		{
			name: "three xref streams each prev names the next",
			pdf:  pdfWithXRefStreamPrevThreeSectionRing,
		},
		{
			name: "object stream extends refers to the same stream",
			pdf:  pdfWithObjectStreamExtendsSameStream,
		},
		{
			name: "three object streams each extends the next",
			pdf:  pdfWithThreeObjectStreamsExtending,
		},
		{
			name: "pages node omits kids",
			pdf:  pdfWithPagesOmittingKids,
		},
		{
			name: "pages node kids is empty",
			pdf:  pdfWithPagesEmptyKids,
		},
		{
			name: "pages node kids is null",
			pdf:  pdfWithPagesNullKids,
		},
		{
			name: "page omits parent and resources",
			pdf:  pdfWithPageOmittingParentAndResources,
		},
		{
			name: "trailer prev is null",
			pdf:  pdfWithClassicXrefPrevNull,
		},
		{
			name: "trailer prev is a name",
			pdf:  pdfWithClassicXrefPrevName,
		},
		{
			name: "classic xref prev is an unpadded integer at the same table",
			pdf:  pdfWithClassicXrefPrevUnpaddedSameOffset,
		},
		{
			name: "object stream extends is null",
			pdf:  pdfWithObjectStreamExtendsNull,
		},
		{
			name: "object stream extends is a name",
			pdf:  pdfWithObjectStreamExtendsName,
		},
		{
			name: "direct pages kids is a direct pages dictionary",
			pdf:  pdfWithDirectPagesKidsDirectPages,
		},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			_ = requireExtractReturnsWithinBound(t, tc.pdf())
		})
	}

	// These shapes must both return within the bound and yield the page text.
	extracts := []struct {
		name string
		pdf  func() []byte
	}{
		{
			name: "nested pages nodes end at a page with text",
			pdf:  pdfWithNestedPagesEndingAtPage,
		},
		{
			name: "page inherits resources from parent",
			pdf:  pdfWithParentResourcesOnPages,
		},
		{
			name: "classic xref prev points at an earlier table",
			pdf:  pdfWithClassicXrefPrevAtEarlierOffset,
		},
		{
			name: "xref stream prev points at an earlier stream",
			pdf:  pdfWithXRefStreamPrevAtEarlierOffset,
		},
		{
			name: "object stream extends a different stream that holds the catalog",
			pdf:  pdfWithObjectStreamExtendsOtherStream,
		},
		{
			name: "object stream holds the catalog and omits extends",
			pdf:  pdfWithObjectStreamHoldingCatalog,
		},
		{
			name: "trailer lowercase prev names the same table",
			pdf:  pdfWithClassicXrefLowercasePrevAtSameOffset,
		},
		{
			name: "catalog and pages are direct dictionaries",
			pdf:  pdfWithDirectCatalogAndPages,
		},
	}

	for _, tc := range extracts {
		t.Run(tc.name, func(t *testing.T) {
			text := requireExtractReturnsWithinBound(t, tc.pdf())
			require.Contains(t, text, "Hi")
		})
	}
}

// TestPdfExtractConcurrentReturnsThenExtractsSample runs N concurrent Extract
// calls on a page tree whose kids list includes the pages node, each expected
// to return within the same bound, then extracts sample-doc.pdf.
func TestPdfExtractConcurrentReturnsThenExtractsSample(t *testing.T) {
	const n = 20
	pdf := pdfWithPagesKidsIncludingPagesNode()

	var wg sync.WaitGroup
	wg.Add(n)
	for i := 0; i < n; i++ {
		go func() {
			defer wg.Done()
			extractor := pdfExtractor{}
			_, _ = extractor.Extract(context.Background(), "doc.pdf", bytes.NewReader(pdf), 0, testBudget())
		}()
	}

	done := make(chan struct{})
	go func() {
		wg.Wait()
		close(done)
	}()

	select {
	case <-done:
	case <-time.After(pdfExtractBound):
		require.FailNow(t, "concurrent extractions did not return within the bound")
	}

	extractor := pdfExtractor{}
	content, err := testutils.ReadTestFile("sample-doc.pdf")
	require.NoError(t, err)
	text, err := extractor.Extract(context.Background(), "sample-doc.pdf", bytes.NewReader(content), 0, testBudget())
	require.NoError(t, err)
	require.Contains(t, text, "simple")
}

func requireExtractReturnsWithinBound(t *testing.T, pdf []byte) string {
	t.Helper()
	extractor := pdfExtractor{}
	var text string
	done := make(chan struct{})
	go func() {
		defer close(done)
		text, _ = extractor.Extract(context.Background(), "doc.pdf", bytes.NewReader(pdf), 0, testBudget())
	}()
	select {
	case <-done:
		return text
	case <-time.After(pdfExtractBound):
		require.FailNow(t, "extraction did not return within the bound")
		return ""
	}
}

func samplePageObjects() []string {
	return []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}
}

func samplePageObjMap() map[int]string {
	objs := samplePageObjects()
	out := make(map[int]string, len(objs))
	for i, obj := range objs {
		out[i+1] = obj
	}
	return out
}

func pdfWithPagesKidsIncludingPagesNode() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [2 0 R] >>",
	}, false)
}

func pdfWithTwoPagesNodesListingEachOther() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Pages /Count 1 /Kids [2 0 R] >>",
	}, false)
}

func pdfWithThreePagesNodesListingNext() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Pages /Count 1 /Kids [4 0 R] >>",
		"<< /Type /Pages /Count 1 /Kids [2 0 R] >>",
	}, false)
}

func pdfWithPagesParentReferringToPagesNode() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] /Parent 2 0 R >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
	}, false)
}

func pdfWithThreeNodeParentWalk() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] /Parent 4 0 R >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] /Parent 2 0 R >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
	}, false)
}

func pdfWithClassicXrefPrevAtSameOffset() []byte {
	return classicPDF("1.4", samplePageObjects(), true)
}

func pdfWithXRefStreamPrevAtSameOffset() []byte {
	return xrefStreamPDF(samplePageObjMap(), nil, true)
}

func pdfWithObjectStreamExtendsSameStream() []byte {
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends 6 0 R"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithThreeObjectStreamsExtending() []byte {
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends 7 0 R"),
		7: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends 8 0 R"),
		8: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends 6 0 R"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithPagesOmittingKids() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 >>",
	}, false)
}

func pdfWithPagesEmptyKids() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [] >>",
	}, false)
}

func pdfWithPagesNullKids() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids null >>",
	}, false)
}

func pdfWithPageOmittingParentAndResources() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Page /MediaBox [0 0 612 792] /Contents 4 0 R >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
	}, false)
}

func pdfWithClassicXrefPrevNull() []byte {
	return classicPDFWithTrailerExtra("1.4", samplePageObjects(), " /Prev null")
}

func pdfWithClassicXrefPrevName() []byte {
	return classicPDFWithTrailerExtra("1.4", samplePageObjects(), " /Prev /None")
}

func pdfWithClassicXrefPrevUnpaddedSameOffset() []byte {
	return classicPDFWithTrailerExtra("1.4", samplePageObjects(), " /Prev %d")
}

func pdfWithClassicXrefLowercasePrevAtSameOffset() []byte {
	return classicPDFWithTrailerExtra("1.4", samplePageObjects(), " /prev %010d")
}

func pdfWithObjectStreamExtendsNull() []byte {
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends null"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithObjectStreamExtendsName() []byte {
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends /None"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithDirectPagesKidsDirectPages() []byte {
	return classicPDFWithTrailerExtra("1.4", nil,
		" /Root << /Type /Catalog /Pages << /Type /Pages /Count 1 /Kids [ << /Type /Pages /Count 1 /Kids [] >> ] >> >>")
}

func pdfWithNestedPagesEndingAtPage() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		"<< /Type /Pages /Count 1 /Kids [4 0 R] >>",
		"<< /Type /Page /Parent 3 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 6 0 R >> >> >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}, false)
}

func pdfWithParentResourcesOnPages() []byte {
	return classicPDF("1.4", []string{
		"<< /Type /Catalog /Pages 2 0 R >>",
		"<< /Type /Pages /Count 1 /Kids [3 0 R] /Resources << /Font << /F1 5 0 R >> >> >>",
		"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}, false)
}

func pdfWithClassicXrefPrevAtEarlierOffset() []byte {
	return classicPDFWithEarlierPrev(samplePageObjects())
}

func pdfWithClassicXrefPrevThreeSectionRing() []byte {
	return classicPDFWithXrefRing(samplePageObjects(), 3)
}

func pdfWithXRefStreamPrevAtEarlierOffset() []byte {
	objs := samplePageObjMap()
	objs[6] = minimalXRefStreamBody("")
	return xrefStreamPDFPrevObj(objs, nil, 6)
}

func pdfWithXRefStreamPrevThreeSectionRing() []byte {
	return xrefStreamPDFPrevRing(samplePageObjMap(), 3)
}

func pdfWithObjectStreamExtendsOtherStream() []byte {
	catalog := "<< /Type /Catalog /Pages 2 0 R >>"
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody(" ", " /Type /ObjStm /N 0 /First 1 /Extends 7 0 R"),
		7: pdfStreamBody("1 0 "+catalog, " /Type /ObjStm /N 1 /First 4"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithObjectStreamHoldingCatalog() []byte {
	catalog := "<< /Type /Catalog /Pages 2 0 R >>"
	return xrefStreamPDF(map[int]string{
		2: "<< /Type /Pages /Count 1 /Kids [3 0 R] >>",
		3: "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
		4: pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		5: "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
		6: pdfStreamBody("1 0 "+catalog, " /Type /ObjStm /N 1 /First 4"),
	}, map[int][2]int{1: {6, 0}}, false)
}

func pdfWithDirectCatalogAndPages() []byte {
	return classicPDFWithTrailerExtra("1.4", []string{
		"<< /Type /Page /MediaBox [0 0 612 792] /Contents 2 0 R /Resources << /Font << /F1 3 0 R >> >> >>",
		pdfStreamBody("BT /F1 12 Tf 10 700 Td (Hi) Tj ET", ""),
		"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
	}, " /Root << /Type /Catalog /Pages << /Type /Pages /Count 1 /Kids [1 0 R] >> >>")
}

func pdfStreamBody(data, extraDict string) string {
	return fmt.Sprintf("<< /Length %d%s >>\nstream\n%s\nendstream", len(data), extraDict, data)
}

func classicPDF(version string, objs []string, prevSelf bool) []byte {
	extra := ""
	if prevSelf {
		extra = " /Prev %010d"
	}
	return classicPDFWithTrailerExtra(version, objs, extra)
}

func classicPDFWithTrailerExtra(version string, objs []string, trailerExtra string) []byte {
	var body bytes.Buffer
	fmt.Fprintf(&body, "%%PDF-%s\n%% %s\n", version, strings.Repeat("p", 80))
	offsets := make([]int, len(objs)+1)
	for i, obj := range objs {
		offsets[i+1] = body.Len()
		fmt.Fprintf(&body, "%d 0 obj\n%s\nendobj\n", i+1, obj)
	}
	xrefOffset := body.Len()
	n := len(objs) + 1
	fmt.Fprintf(&body, "xref\n0 %d\n", n)
	fmt.Fprintf(&body, "%010d 65535 f \r\n", 0)
	for i := 1; i < n; i++ {
		fmt.Fprintf(&body, "%010d 00000 n \r\n", offsets[i])
	}
	extra := trailerExtra
	if strings.Contains(trailerExtra, "%") {
		extra = fmt.Sprintf(trailerExtra, xrefOffset)
	}
	root := " /Root 1 0 R"
	if strings.Contains(extra, "/Root") {
		root = ""
	}
	fmt.Fprintf(&body, "trailer\n<< /Size %d%s%s >>\nstartxref\n%d\n%%%%EOF\n", n, root, extra, xrefOffset)
	return body.Bytes()
}

func writeClassicXrefSection(body *bytes.Buffer, offsets []int, extra string) int {
	xrefOffset := body.Len()
	n := len(offsets)
	fmt.Fprintf(body, "xref\n0 %d\n", n)
	fmt.Fprintf(body, "%010d 65535 f \r\n", 0)
	for i := 1; i < n; i++ {
		fmt.Fprintf(body, "%010d 00000 n \r\n", offsets[i])
	}
	if strings.Contains(extra, "%") {
		extra = fmt.Sprintf(extra, xrefOffset)
	}
	fmt.Fprintf(body, "trailer\n<< /Size %d /Root 1 0 R%s >>\nstartxref\n%d\n%%%%EOF\n", n, extra, xrefOffset)
	return xrefOffset
}

func classicPDFWithEarlierPrev(objs []string) []byte {
	var body bytes.Buffer
	fmt.Fprintf(&body, "%%PDF-1.4\n%% %s\n", strings.Repeat("p", 80))
	offsets := make([]int, len(objs)+1)
	for i, obj := range objs {
		offsets[i+1] = body.Len()
		fmt.Fprintf(&body, "%d 0 obj\n%s\nendobj\n", i+1, obj)
	}
	first := writeClassicXrefSection(&body, offsets, "")
	writeClassicXrefSection(&body, offsets, fmt.Sprintf(" /Prev %010d", first))
	return body.Bytes()
}

func classicPDFWithXrefRing(objs []string, sections int) []byte {
	var body bytes.Buffer
	fmt.Fprintf(&body, "%%PDF-1.4\n%% %s\n", strings.Repeat("p", 80))
	offsets := make([]int, len(objs)+1)
	for i, obj := range objs {
		offsets[i+1] = body.Len()
		fmt.Fprintf(&body, "%d 0 obj\n%s\nendobj\n", i+1, obj)
	}
	type sec struct {
		xrefAt int
		prevAt int
	}
	written := make([]sec, sections)
	for i := 0; i < sections; i++ {
		written[i].xrefAt = body.Len()
		n := len(offsets)
		fmt.Fprintf(&body, "xref\n0 %d\n", n)
		fmt.Fprintf(&body, "%010d 65535 f \r\n", 0)
		for j := 1; j < n; j++ {
			fmt.Fprintf(&body, "%010d 00000 n \r\n", offsets[j])
		}
		fmt.Fprintf(&body, "trailer\n<< /Size %d /Root 1 0 R /Prev ", n)
		written[i].prevAt = body.Len()
		body.WriteString("0000000000")
		fmt.Fprintf(&body, " >>\nstartxref\n%d\n%%%%EOF\n", written[i].xrefAt)
	}
	out := body.Bytes()
	for i := 0; i < sections; i++ {
		target := written[(i+1)%sections].xrefAt
		copy(out[written[i].prevAt:written[i].prevAt+10], []byte(fmt.Sprintf("%010d", target)))
	}
	return out
}

func xrefStreamPDF(objs map[int]string, compressed map[int][2]int, prevSelf bool) []byte {
	prevObj := 0
	if prevSelf {
		prevObj = -1
	}
	return buildXrefStreamPDF(objs, compressed, prevObj)
}

func xrefStreamPDFPrevObj(objs map[int]string, compressed map[int][2]int, prevObj int) []byte {
	return buildXrefStreamPDF(objs, compressed, prevObj)
}

func buildXrefStreamPDF(objs map[int]string, compressed map[int][2]int, prevObj int) []byte {
	maxObj := 0
	for n := range objs {
		if n > maxObj {
			maxObj = n
		}
	}
	for n := range compressed {
		if n > maxObj {
			maxObj = n
		}
	}
	xrefNum := maxObj + 1

	var body bytes.Buffer
	body.WriteString("%PDF-1.5\n")
	body.WriteString("% " + strings.Repeat("p", 80) + "\n")

	offsets := make(map[int]int, len(objs))
	nums := make([]int, 0, len(objs))
	for n := range objs {
		nums = append(nums, n)
	}
	slices.Sort(nums)
	for _, n := range nums {
		offsets[n] = body.Len()
		fmt.Fprintf(&body, "%d 0 obj\n%s\nendobj\n", n, objs[n])
	}

	xrefOffset := body.Len()
	size := xrefNum + 1
	var data bytes.Buffer
	for i := 0; i < size; i++ {
		if i == 0 {
			data.Write([]byte{0, 0, 0, 0})
			continue
		}
		if c, ok := compressed[i]; ok {
			data.Write([]byte{2, byte(c[0] >> 8), byte(c[0]), byte(c[1])})
			continue
		}
		off := xrefOffset
		if i != xrefNum {
			off = offsets[i]
		}
		data.Write([]byte{1, byte(off >> 8), byte(off), 0})
	}

	extra := ""
	switch {
	case prevObj == -1:
		extra = fmt.Sprintf(" /Prev %010d", xrefOffset)
	case prevObj > 0:
		extra = fmt.Sprintf(" /Prev %010d", offsets[prevObj])
	}
	fmt.Fprintf(&body, "%d 0 obj\n<< /Type /XRef /Size %d /Root 1 0 R /W [1 2 1] /Length %d%s >>\nstream\n",
		xrefNum, size, data.Len(), extra)
	body.Write(data.Bytes())
	fmt.Fprintf(&body, "\nendstream\nendobj\nstartxref\n%d\n%%%%EOF\n", xrefOffset)
	return body.Bytes()
}

func minimalXRefStreamBody(prev string) string {
	data := string([]byte{0, 0, 0, 0})
	extra := ""
	if prev != "" {
		extra = " /Prev " + prev
	}
	return fmt.Sprintf("<< /Type /XRef /Size 1 /W [1 2 1] /Length %d%s >>\nstream\n%s\nendstream",
		len(data), extra, data)
}

func xrefStreamPDFPrevRing(objs map[int]string, sections int) []byte {
	maxObj := 0
	for n := range objs {
		if n > maxObj {
			maxObj = n
		}
	}
	// Extra XRef streams occupy object numbers after the document objects.
	// The last section is written as startxref by buildXrefStreamPDF.
	var body bytes.Buffer
	body.WriteString("%PDF-1.5\n")
	body.WriteString("% " + strings.Repeat("p", 80) + "\n")

	offsets := make(map[int]int, len(objs)+sections)
	nums := make([]int, 0, len(objs))
	for n := range objs {
		nums = append(nums, n)
	}
	slices.Sort(nums)
	for _, n := range nums {
		offsets[n] = body.Len()
		fmt.Fprintf(&body, "%d 0 obj\n%s\nendobj\n", n, objs[n])
	}

	type sec struct {
		obj    int
		xrefAt int
		prevAt int
	}
	// Write sections-1 extra XRef streams, then the final startxref stream.
	extraCount := sections - 1
	written := make([]sec, 0, sections)
	for i := 0; i < extraCount; i++ {
		obj := maxObj + 1 + i
		s := sec{obj: obj, xrefAt: body.Len()}
		fmt.Fprintf(&body, "%d 0 obj\n", obj)
		body.WriteString("<< /Type /XRef /Size 1 /W [1 2 1] /Length 4 /Prev ")
		s.prevAt = body.Len()
		body.WriteString("0000000000")
		body.WriteString(" >>\nstream\n")
		body.Write([]byte{0, 0, 0, 0})
		body.WriteString("\nendstream\nendobj\n")
		offsets[obj] = s.xrefAt
		written = append(written, s)
	}

	finalObj := maxObj + extraCount + 1
	finalAt := body.Len()
	size := finalObj + 1
	var data bytes.Buffer
	for i := 0; i < size; i++ {
		if i == 0 {
			data.Write([]byte{0, 0, 0, 0})
			continue
		}
		off := finalAt
		if i != finalObj {
			off = offsets[i]
		}
		data.Write([]byte{1, byte(off >> 8), byte(off), 0})
	}
	prevTarget := written[0].xrefAt
	fmt.Fprintf(&body, "%d 0 obj\n<< /Type /XRef /Size %d /Root 1 0 R /W [1 2 1] /Length %d /Prev %010d >>\nstream\n",
		finalObj, size, data.Len(), prevTarget)
	body.Write(data.Bytes())
	fmt.Fprintf(&body, "\nendstream\nendobj\nstartxref\n%d\n%%%%EOF\n", finalAt)

	out := body.Bytes()
	// final → extra0 → extra1 → … → final.
	for i := 0; i < extraCount; i++ {
		var target int
		if i+1 < extraCount {
			target = written[i+1].xrefAt
		} else {
			target = finalAt
		}
		copy(out[written[i].prevAt:written[i].prevAt+10], []byte(fmt.Sprintf("%010d", target)))
	}
	return out
}
