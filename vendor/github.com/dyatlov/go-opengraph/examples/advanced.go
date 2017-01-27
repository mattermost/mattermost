package main

import (
	"fmt"
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
	"golang.org/x/net/html"
)

func main() {
	h := `<html><head><meta property="og:type" content="article" />
  <meta property="og:title" content="WordPress 4.3 &quot;Billie&quot;" />
  <meta property="og:url" content="https://wordpress.org/news/2015/08/billie/" /></head><body></body></html>`

	og := opengraph.NewOpenGraph()

	doc, err := html.Parse(strings.NewReader(h))
	if err != nil {
		fmt.Println(err)
		return
	}

	var parseHead func(*html.Node)
	parseHead = func(n *html.Node) {
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if c.Type == html.ElementNode && c.Data == "meta" {
				m := make(map[string]string)
				for _, a := range c.Attr {
					m[a.Key] = a.Val
				}

				og.ProcessMeta(m)
			}
		}
	}

	var f func(*html.Node)
	f = func(n *html.Node) {
		for c := n.FirstChild; c != nil; c = c.NextSibling {
			if c.Type == html.ElementNode {
				if c.Data == "head" {
					parseHead(c)
					continue
				} else if c.Data == "body" { // OpenGraph is only in head, so we don't need body
					break
				}
			}
			f(c)
		}
	}
	f(doc)

	fmt.Printf("Type: %s\n", og.Type)
	fmt.Printf("Title: %s\n", og.Title)
	fmt.Printf("URL: %s\n", og.URL)
	fmt.Printf("String/JSON Representation: %s\n", og)
}
