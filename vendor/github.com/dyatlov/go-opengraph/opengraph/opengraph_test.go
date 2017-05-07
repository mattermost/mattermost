package opengraph_test

import (
	"strings"
	"testing"
	"time"

	"github.com/dyatlov/go-opengraph/opengraph"
)

const html = `
  <!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" dir="ltr" lang="en-US">
<head profile="http://gmpg.org/xfn/11">
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>WordPress &#8250;   WordPress 4.3 &#8220;Billie&#8221;</title>

<!-- Jetpack Open Graph Tags -->
<meta property="og:type" content="article" />
<meta property="og:title" content="WordPress 4.3 &quot;Billie&quot;" />
<meta property="og:url" content="https://wordpress.org/news/2015/08/billie/" />
<meta property="og:description" content="Version 4.3 of WordPress, named &quot;Billie&quot; in honor of jazz singer Billie Holiday, is available for download or update in your WordPress dashboard. New features in 4.3 make it even easier to format y..." />
<meta property="article:published_time" content="2015-08-18T19:12:38+00:00" />
<meta property="article:modified_time" content="2015-08-19T13:10:24+00:00" />
<meta property="og:site_name" content="WordPress News" />
<meta property="og:image" content="https://www.gravatar.com/avatar/2370ea5912750f4cb0f3c51ae1cbca55?d=mm&amp;s=180&amp;r=G" />
<meta property="og:locale" content="en_US" />
<meta name="twitter:site" content="@WordPress" />
<meta name="twitter:card" content="summary" />
<meta name="twitter:creator" content="@WordPress" />
  `

func BenchmarkOpenGraph_ProcessHTML(b *testing.B) {
	og := opengraph.NewOpenGraph()
	b.ReportAllocs()
	b.SetBytes(int64(len(html)))
	for i := 0; i < b.N; i++ {
		if err := og.ProcessHTML(strings.NewReader(html)); err != nil {
			b.Fatal(err)
		}
	}
}

func TestOpenGraphProcessHTML(t *testing.T) {
	og := opengraph.NewOpenGraph()
	err := og.ProcessHTML(strings.NewReader(html))

	if err != nil {
		t.Fatal(err)
	}

	if og.Type != "article" {
		t.Error("type parsed incorrectly")
	}

	if len(og.Title) == 0 {
		t.Error("title parsed incorrectly")
	}

	if len(og.URL) == 0 {
		t.Error("url parsed incorrectly")
	}

	if len(og.Description) == 0 {
		t.Error("description parsed incorrectly")
	}

	if len(og.Images) == 0 {
		t.Error("images parsed incorrectly")
	} else {
		if len(og.Images[0].URL) == 0 {
			t.Error("image url parsed incorrectly")
		}
	}

	if len(og.Locale) == 0 {
		t.Error("locale parsed incorrectly")
	}

	if len(og.SiteName) == 0 {
		t.Error("site name parsed incorrectly")
	}

	if og.Article == nil {
		t.Error("articles parsed incorrectly")
	} else {
		ev, _ := time.Parse(time.RFC3339, "2015-08-18T19:12:38+00:00")
		if !og.Article.PublishedTime.Equal(ev) {
			t.Error("article published time parsed incorrectly")
		}
	}
}

func TestOpenGraphProcessMeta(t *testing.T) {
	og := opengraph.NewOpenGraph()

	og.ProcessMeta(map[string]string{"property": "og:type", "content": "book"})

	if og.Type != "book" {
		t.Error("wrong og:type processing")
	}

	og.ProcessMeta(map[string]string{"property": "book:isbn", "content": "123456"})

	if og.Book == nil {
		t.Error("wrong book type processing")
	} else {
		if og.Book.ISBN != "123456" {
			t.Error("wrong book isbn processing")
		}
	}

	og.ProcessMeta(map[string]string{"property": "article:section", "content": "testsection"})

	if og.Article != nil {
		t.Error("article processed when it should not be")
	}

	og.ProcessMeta(map[string]string{"property": "book:author:first_name", "content": "John"})

	if og.Book != nil {
		if len(og.Book.Authors) == 0 {
			t.Error("book author was not processed")
		} else {
			if og.Book.Authors[0].FirstName != "John" {
				t.Error("author first name was processed incorrectly")
			}
		}
	}
}
