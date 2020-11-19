package justext

import (
	"errors"
	"fmt"
	"github.com/levigross/exp-html"
	"io"
	"io/ioutil"
	"strings"
)

type Reader struct {
	LengthLow          int
	LengthHigh         int
	Stoplist           map[string]bool
	StopwordsLow       float64
	StopwordsHigh      float64
	MaxLinkDensity     float64
	MaxHeadingDistance int
	NoHeadings         bool
	r                  io.Reader
}

func NewReader(r io.Reader) *Reader {
	return &Reader{
		LengthLow:          70,
		LengthHigh:         200,
		StopwordsLow:       0.30,
		StopwordsHigh:      0.32,
		MaxLinkDensity:     0.2,
		MaxHeadingDistance: 200,
		NoHeadings:         false,
		r:                  r,
	}
}

func (r *Reader) ReadAll() ([]*Paragraph, error) {
	in, err := ioutil.ReadAll(r.r)
	if err != nil {
		return nil, err
	}

	root, err := preprocess(string(in), "utf-8", "utf-8", "errors")
	if err != nil {
		return nil, err
	}
	if root == nil {
		return nil, errors.New("Preprocess has resulted in nil")
	}

	htmlSource := nodesToString(root)
	if len(htmlSource) == 0 {
		return nil, errors.New("MAIN: perprocess has returned an empty string")
	}

	p, err := paragraphObjectModel(htmlSource)
	if err != nil {
		return nil, err
	}
	if p == nil {
		return nil, errors.New("MAIN: P is nil")
	}

	classifyParagraphs(p, r.Stoplist, r.LengthLow, r.LengthHigh, r.StopwordsLow, r.StopwordsHigh, r.MaxLinkDensity, r.NoHeadings)
	reviseParagraphClassification(p, r.MaxHeadingDistance)

	return p, nil
}

func dumpNodes(n *html.Node, tab int, exploreChildNodes bool) string {
	var childNodes string = ""
	if exploreChildNodes == true {
		if len(n.Child) > 0 {
			for _, c := range n.Child {
				childNodes = fmt.Sprintf("%s%s\n", childNodes, dumpNodes(c, tab+1, true))
			}
		}
	}

	var t string
	switch n.Type {
	case html.ErrorNode:
		t = "Err"
	case html.TextNode:
		t = "T"
	case html.DocumentNode:
		t = "D"
	case html.ElementNode:
		t = "E"
	case html.CommentNode:
		t = "C"
	case html.DoctypeNode:
		t = "Dt"
	}

	tabStr := strings.Repeat(" ", tab)
	return fmt.Sprintf("%s%s:%s\n%s", tabStr, t, strings.TrimSpace(strings.Replace(n.Data, "\n", "", -1)), childNodes)
}
