package goose

import (
	"github.com/PuerkitoBio/goquery"
	"golang.org/x/net/html"
)

// Parser is an HTML parser specialised in extraction of main content and other properties
type Parser struct{}

// NewParser returns an HTML parser
func NewParser() *Parser {
	return &Parser{}
}

func (p Parser) dropTag(selection *goquery.Selection) {
	selection.Each(func(i int, s *goquery.Selection) {
		replaceTagWithContents(s, whitelistedTextAtomTypes)
	})
}

func (p Parser) indexOfAttribute(selection *goquery.Selection, attr string) int {
	node := selection.Get(0)
	for i, a := range node.Attr {
		if a.Key == attr {
			return i
		}
	}
	return -1
}

func (p Parser) delAttr(selection *goquery.Selection, attr string) {
	idx := p.indexOfAttribute(selection, attr)
	if idx > -1 {
		node := selection.Get(0)
		node.Attr = append(node.Attr[:idx], node.Attr[idx+1:]...)
	}
}

func (p Parser) getElementsByTags(div *goquery.Selection, tags []string) *goquery.Selection {
	selection := new(goquery.Selection)
	for _, tag := range tags {
		selections := div.Find(tag)
		if selections != nil {
			selection = selection.Union(selections)
		}
	}
	return selection
}

func (p Parser) clear(selection *goquery.Selection) {
	selection.Nodes = make([]*html.Node, 0)
}

func (p Parser) removeNode(selection *goquery.Selection) {
	if selection != nil {
		node := selection.Get(0)
		if node != nil && node.Parent != nil {
			node.Parent.RemoveChild(node)
		}
	}
}

func (p Parser) name(selector string, selection *goquery.Selection) string {
	value, exists := selection.Attr(selector)
	if exists {
		return value
	}
	return ""
}

func (p Parser) setAttr(selection *goquery.Selection, attr string, value string) {
	if selection.Size() > 0 {
		node := selection.Get(0)
		var attrs []html.Attribute
		for _, a := range node.Attr {
			if a.Key != attr {
				newAttr := new(html.Attribute)
				newAttr.Key = a.Key
				newAttr.Val = a.Val
				attrs = append(attrs, *newAttr)
			}
		}
		newAttr := new(html.Attribute)
		newAttr.Key = attr
		newAttr.Val = value
		attrs = append(attrs, *newAttr)
		node.Attr = attrs
	}
}
