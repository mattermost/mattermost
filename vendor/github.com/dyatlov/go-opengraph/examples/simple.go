package main

import (
	"fmt"
	"strings"

	"github.com/dyatlov/go-opengraph/opengraph"
)

func main() {
	html := `<html><head><meta property="og:type" content="article" />
  <meta property="og:title" content="WordPress 4.3 &quot;Billie&quot;" />
  <meta property="og:url" content="https://wordpress.org/news/2015/08/billie/" /></head><body></body></html>`

	og := opengraph.NewOpenGraph()
	err := og.ProcessHTML(strings.NewReader(html))

	if err != nil {
		fmt.Println(err)
		return
	}

	fmt.Printf("Type: %s\n", og.Type)
	fmt.Printf("Title: %s\n", og.Title)
	fmt.Printf("URL: %s\n", og.URL)
	fmt.Printf("String/JSON Representation: %s\n", og)
}
