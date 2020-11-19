package justext

import (
	"fmt"
	"log"
	"strings"

	"github.com/levigross/exp-html"
)

/**
This should be a separate package!
And it should be a Writer!
*/

var selfClosingTags = map[string]bool{
	"area":     true,
	"base":     true,
	"basefont": true,
	"br":       true,
	"hr":       true,
	"input":    true,
	"img":      true,
	"link":     true,
	"meta":     true,
}

// nodesToString loops over a node tree and generate HTML string
// Should be moved into html/utils package
func nodesToString(node *html.Node) string {
	var response string = ""

	switch node.Type {
	case html.TextNode:
		response = html.EscapeString(strings.TrimSpace(node.Data))

	case html.ElementNode, html.DoctypeNode:
		var att string = ""
		if len(node.Attr) > 0 {
			for _, a := range node.Attr {
				att = fmt.Sprintf("%s %s=\"%s\"", att, a.Key, a.Val)
			}
		}

		if _, ok := selfClosingTags[node.Data]; ok {
			return fmt.Sprintf("<%s%s>", node.Data, att)
		}

		var content string = ""
		if len(node.Child) > 0 {
			for _, n := range node.Child {
				content = fmt.Sprintf("%s%s", content, nodesToString(n))
			}
		}
		response = fmt.Sprintf("<%s%s>%s</%s>", node.Data, att, content, node.Data)

	case html.DocumentNode:
		if len(node.Child) > 0 {
			for _, n := range node.Child {
				response = nodesToString(n)
			}
		}

	case html.CommentNode:
		// ignore

	default:
		log.Printf("Unhandled node: %s", nodeTypeToString(node))
	}
	return response
}

func nodeTypeToString(n *html.Node) (t string) {
	switch n.Type {
	case html.ErrorNode:
		t = "Error"
	case html.TextNode:
		t = "Text"
	case html.DocumentNode:
		t = "Document"
	case html.ElementNode:
		t = "Element"
	case html.CommentNode:
		t = "Comment"
	case html.DoctypeNode:
		t = "Doctype"
	}
	return t
}
