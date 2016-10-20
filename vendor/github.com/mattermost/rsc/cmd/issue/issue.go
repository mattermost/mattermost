package main

import (
	"encoding/xml"
	"flag"
	"fmt"
	"html"
	"log"
	"net/http"
	"net/url"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

func usage() {
	fmt.Fprintf(os.Stderr, `usage: issue [-p project] query

If query is a single number, prints the full history for the issue.
Otherwise, prints a table of matching results.
The special query 'go1' is shorthand for 'Priority-Go1'.
`)
	os.Exit(2)
}

type Feed struct {
	Entry Entries `xml:"entry"`
}

type Entry struct {
	ID        string    `xml:"id"`
	Title     string    `xml:"title"`
	Published time.Time `xml:"published"`
	Content   string    `xml:"content"`
	Updates   []Update  `xml:"updates"`
	Author struct {
		Name string `xml:"name"`
	} `xml:"author"`
	Owner string `xml:"owner"`
	Status string `xml:"status"`
	Label []string `xml:"label"`
}

type Update struct {
	Summary string `xml:"summary"`
	Owner   string `xml:"ownerUpdate"`
	Label   string `xml:"label"`
	Status  string `xml:"status"`
}

type Entries []Entry

func (e Entries) Len() int           { return len(e) }
func (e Entries) Swap(i, j int)      { e[i], e[j] = e[j], e[i] }
func (e Entries) Less(i, j int) bool { return e[i].Title < e[j].Title }

var project = flag.String("p", "go", "code.google.com project identifier")
var v = flag.Bool("v", false, "verbose")

func main() {
	flag.Usage = usage
	flag.Parse()
	if flag.NArg() != 1 {
		usage()
	}

	full := false
	q := flag.Arg(0)
	n, _ := strconv.Atoi(q)
	if n != 0 {
		q = "id:" + q
		full = true
	}
	if q == "go1" {
		q = "label:Priority-Go1"
	}

	log.SetFlags(0)

	query := url.Values{
		"q":           {q},
		"max-results": {"400"},
	}
	if !full {
		query["can"] = []string{"open"}
	}
	u := "https://code.google.com/feeds/issues/p/" + *project + "/issues/full?" + query.Encode()
	if *v {
		log.Print(u)
	}
	r, err := http.Get(u)
	if err != nil {
		log.Fatal(err)
	}

	var feed Feed
	if err := xml.NewDecoder(r.Body).Decode(&feed); err != nil {
		log.Fatal(err)
	}
	r.Body.Close()

	sort.Sort(feed.Entry)
	for _, e := range feed.Entry {
		id := e.ID
		if i := strings.Index(id, "id="); i >= 0 {
			id = id[:i+len("id=")]
		}
		fmt.Printf("%s\t%s\n", id, e.Title)
		if full {
			fmt.Printf("Reported by %s (%s)\n", e.Author.Name, e.Published.Format("2006-01-02 15:04:05"))
			if e.Owner != "" {
				fmt.Printf("\tOwner: %s\n", e.Owner)
			}
			if e.Status != "" {
				fmt.Printf("\tStatus: %s\n", e.Status)
			}
			for _, l := range e.Label {
				fmt.Printf("\tLabel: %s\n", l)
			}
			if e.Content != "" {
				fmt.Printf("\n\t%s\n", wrap(html.UnescapeString(e.Content), "\t"))
			}
			u := "https://code.google.com/feeds/issues/p/" + *project + "/issues/" + id + "/comments/full"
			if *v {
				log.Print(u)
			}
			r, err := http.Get(u)
			if err != nil {
				log.Fatal(err)
			}

			var feed Feed
			if err := xml.NewDecoder(r.Body).Decode(&feed); err != nil {
				log.Fatal(err)
			}
			r.Body.Close()

			for _, e := range feed.Entry {
				fmt.Printf("\n%s (%s)\n", e.Title, e.Published.Format("2006-01-02 15:04:05"))
				for _, up := range e.Updates {
					if up.Summary != "" {
						fmt.Printf("\tSummary: %s\n", up.Summary)
					}
					if up.Owner != "" {
						fmt.Printf("\tOwner: %s\n", up.Owner)
					}
					if up.Status != "" {
						fmt.Printf("\tStatus: %s\n", up.Status)
					}
					if up.Label != "" {
						fmt.Printf("\tLabel: %s\n", up.Label)
					}
				}
				if e.Content != "" {
					fmt.Printf("\n\t%s\n", wrap(html.UnescapeString(e.Content), "\t"))
				}
			}
		}
	}
}

func wrap(t string, prefix string) string {
	out := ""
	t = strings.Replace(t, "\r\n", "\n", -1)
	lines := strings.Split(t, "\n")
	for i, line := range lines {
		if i > 0 {
			out += "\n" + prefix
		}
		s := line
		for len(s) > 70 {
			i := strings.LastIndex(s[:70], " ")
			if i < 0 {
				i = 69
			}
			i++
			out += s[:i] + "\n" + prefix
			s = s[i:]
		}
		out += s
	}
	return out
}
