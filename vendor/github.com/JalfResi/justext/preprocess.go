package justext

import (
	"github.com/levigross/exp-html"
	"regexp"
	"strings"
)

func preprocess(htmlStr, encoding, defaultEncoding, encErrors string) (*html.Node, error) {

	root, err := html.Parse(strings.NewReader(htmlStr))
	if err != nil {
		return nil, err
	}

	addKwTags(root)
	removeElements(root, []string{"head", "script", "style"})

	return root, nil
}

type nodeIterator func(n *html.Node)

func nodeIter(n *html.Node, f nodeIterator) {
	f(n)
	for _, c := range n.Child {
		nodeIter(c, f)
	}
}

func addKwTags(root *html.Node) *html.Node {
	var blankText *regexp.Regexp = regexp.MustCompile("^[\n\r\t ]*$")
	var nodesWithText []*html.Node

	var markTextAndTail nodeIterator
	markTextAndTail = func(node *html.Node) {
		if node.Type != html.CommentNode || node.Type != html.DoctypeNode {
			if node.Type == html.TextNode {
				nodesWithText = append(nodesWithText, node)
			}
		}
	}
	nodeIter(root, markTextAndTail)

	for _, node := range nodesWithText {
		if blankText.MatchString(node.Data) {
			node.Data = ""
		} else {
			kw := &html.Node{
				Parent: nil,
				Type:   html.ElementNode,
				Data:   "kw",
			}
			node2 := CopyNode(node, true)
			kw.Child = append(kw.Child, node2)
			insertNode(node, kw)
			node.Parent.Remove(node)
		}
	}

	return root
}

func removeElements(root *html.Node, elementsToRemove []string) {
	var toBeRemoved []*html.Node
	var markRemovableNodes = func(node *html.Node) {
		if node.Type == html.ElementNode {
			for _, nodeName := range elementsToRemove {
				if node.Data == nodeName {
					toBeRemoved = append(toBeRemoved, node)
				}
			}
		}
	}
	nodeIter(root, markRemovableNodes)

	for _, node := range toBeRemoved {
		node.Parent.Remove(node)
	}
}

// insertsNode inserts a Node in a Node tree at the position of another node.
// Should be moved into html/utils package
func insertNode(originalNode *html.Node, newNode *html.Node) {
	slice := originalNode.Parent.Child
	for position, n := range slice {
		if n == originalNode {
			originalNode.Parent.Child = append(slice[:position], append([]*html.Node{newNode}, slice[position:]...)...)
			return
		}
	}
}

func CopyNode(node *html.Node, deep bool) *html.Node {
	newNode := &html.Node{
		Type: node.Type,
		Data: node.Data,
	}

	if deep && len(node.Child) > 0 {
		for _, n := range node.Child {
			newNode.Child = append(newNode.Child, CopyNode(n, true))
		}
	}

	for _, i := range node.Attr {
		newNode.Attr = append(newNode.Attr, html.Attribute{Key: i.Key, Val: i.Val})
	}

	return newNode
}
