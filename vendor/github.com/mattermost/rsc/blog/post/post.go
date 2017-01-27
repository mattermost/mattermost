// Copyright 2011 The Go Authors.  All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package post

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"html/template"
	"net/http"
	"os"
	"path"
	"runtime/debug"
	"sort"
	"strings"
	"time"

	"github.com/mattermost/rsc/appfs/fs"
	"github.com/mattermost/rsc/appfs/proto"
	"github.com/mattermost/rsc/blog/atom"
)

func init() {
	fs.Root = os.Getenv("HOME") + "/app/"
	http.HandleFunc("/", serve)
	http.Handle("/feeds/posts/default", http.RedirectHandler("/feed.atom", http.StatusFound))
}

var funcMap = template.FuncMap{
	"now":  time.Now,
	"date": timeFormat,
}

func timeFormat(fmt string, t time.Time) string {
	return t.Format(fmt)
}

type blogTime struct {
	time.Time
}

var timeFormats = []string{
	time.RFC3339,
	"Monday, January 2, 2006",
	"January 2, 2006 15:00 -0700",
}

func (t *blogTime) UnmarshalJSON(data []byte) (err error) {
	str := string(data)
	for _, f := range timeFormats {
		tt, err := time.Parse(`"`+f+`"`, str)
		if err == nil {
			t.Time = tt
			return nil
		}
	}
	return fmt.Errorf("did not recognize time: %s", str)
}

type PostData struct {
	FileModTime time.Time
	FileSize int64

	Title    string
	Date     blogTime
	Name     string
	OldURL   string
	Summary  string
	Favorite bool
	
	Reader []string

	PlusAuthor string // Google+ ID of author
	PlusPage   string // Google+ Post ID for comment post
	PlusAPIKey string // Google+ API key
	PlusURL    string
	HostURL string // host URL
	Comments bool
	
	article string
}

func (d *PostData) canRead(user string) bool {
	for _, r := range d.Reader {
		if r == user {
			return true
		}
	}
	return false
}

func (d *PostData) IsDraft() bool {
	return d.Date.IsZero() || d.Date.After(time.Now())
}

// To find PlusPage value:
// https://www.googleapis.com/plus/v1/people/116810148281701144465/activities/public?key=AIzaSyB_JO6hyAJAL659z0Dmu0RUVVvTx02ZPMM
//

const owner = "rsc@swtch.com"
const plusRsc = "116810148281701144465"
const plusKey = "AIzaSyB_JO6hyAJAL659z0Dmu0RUVVvTx02ZPMM"
const feedID = "tag:research.swtch.com,2012:research.swtch.com"

var replacer = strings.NewReplacer(
	"⁰", "<sup>0</sup>",
	"¹", "<sup>1</sup>",
	"²", "<sup>2</sup>",
	"³", "<sup>3</sup>",
	"⁴", "<sup>4</sup>",
	"⁵", "<sup>5</sup>",
	"⁶", "<sup>6</sup>",
	"⁷", "<sup>7</sup>",
	"⁸", "<sup>8</sup>",
	"⁹", "<sup>9</sup>",
	"ⁿ", "<sup>n</sup>",
	"₀", "<sub>0</sub>",
	"₁", "<sub>1</sub>",
	"₂", "<sub>2</sub>",
	"₃", "<sub>3</sub>",
	"₄", "<sub>4</sub>",
	"₅", "<sub>5</sub>",
	"₆", "<sub>6</sub>",
	"₇", "<sub>7</sub>",
	"₈", "<sub>8</sub>",
	"₉", "<sub>9</sub>",
	"``", "&ldquo;",
	"''", "&rdquo;",
)

func serve(w http.ResponseWriter, req *http.Request) {
	ctxt := fs.NewContext(req)

	defer func() {
		if err := recover(); err != nil {
			var buf bytes.Buffer
			fmt.Fprintf(&buf, "panic: %s\n\n", err)
			buf.Write(debug.Stack())
			ctxt.Criticalf("%s", buf.String())

			http.Error(w, buf.String(), 500)
		}
	}()

	p := path.Clean("/" + req.URL.Path)
/*
	if strings.Contains(req.Host, "appspot.com") {
		http.Redirect(w, req, "http://research.swtch.com" + p, http.StatusFound)
	}
*/	
	if p != req.URL.Path {
		http.Redirect(w, req, p, http.StatusFound)
		return
	}

	if p == "/feed.atom" {
		atomfeed(w, req)
		return
	}
	
	if strings.HasPrefix(p, "/20") && strings.Contains(p[1:], "/") {
		// Assume this is an old-style URL.
		oldRedirect(ctxt, w, req, p)
	}

	user := ctxt.User()
	isOwner := ctxt.User() == owner || len(os.Args) >= 2 && os.Args[1] == "LISTEN_STDIN"
	if p == "" || p == "/" || p == "/draft" {
		if p == "/draft" && user == "?" {
			ctxt.Criticalf("/draft loaded by %s", user)
			notfound(ctxt, w, req)
			return
		}
		toc(w, req, p == "/draft", isOwner, user)
		return
	}

	draft := false
	if strings.HasPrefix(p, "/draft/") {
		if user == "?" {
			ctxt.Criticalf("/draft loaded by %s", user)
			notfound(ctxt, w, req)
			return
		}
		draft = true
		p = p[len("/draft"):]
	}

	if strings.Contains(p[1:], "/") {
		notfound(ctxt, w, req)
		return
	}

	if strings.Contains(p, ".") {
		// Let Google's front end servers cache static
		// content for a short amount of time.
		httpCache(w, 5*time.Minute)
		ctxt.ServeFile(w, req, "blog/static/"+p)
		return
	}

	// Use just 'blog' as the cache path so that if we change
	// templates, all the cached HTML gets invalidated.
	var data []byte
	pp := "bloghtml:"+p
	if draft && !isOwner {
		pp += ",user="+user
	}
	if key, ok := ctxt.CacheLoad(pp, "blog", &data); !ok {
		meta, article, err := loadPost(ctxt, p, req)
		if err != nil || meta.IsDraft() != draft || (draft && !isOwner && !meta.canRead(user)) {
			ctxt.Criticalf("no %s for %s", p, user)
			notfound(ctxt, w, req)
			return
		}
		t := mainTemplate(ctxt)
		template.Must(t.New("article").Parse(article))

		var buf bytes.Buffer
		meta.Comments = true
		if err := t.Execute(&buf, meta); err != nil {
			panic(err)
		}
		data = buf.Bytes()
		ctxt.CacheStore(key, data)
	}
	w.Write(data)
}

func notfound(ctxt *fs.Context, w http.ResponseWriter, req *http.Request) {
	var buf bytes.Buffer
	var data struct {
		HostURL string
	}
	data.HostURL = hostURL(req)
	t := mainTemplate(ctxt)
	if err := t.Lookup("404").Execute(&buf, &data); err != nil {
		panic(err)
	}
	w.WriteHeader(404)
	w.Write(buf.Bytes())
}

func mainTemplate(c *fs.Context) *template.Template {
	t := template.New("main")
	t.Funcs(funcMap)

	main, _, err := c.Read("blog/main.html")
	if err != nil {
		panic(err)
	}
	style, _, _ := c.Read("blog/style.html")
	main = append(main, style...)
	_, err = t.Parse(string(main))
	if err != nil {
		panic(err)
	}
	return t
}

func loadPost(c *fs.Context, name string, req *http.Request) (meta *PostData, article string, err error) {
	meta = &PostData{
		Name:       name,
		Title:      "TITLE HERE",
		PlusAuthor: plusRsc,
		PlusAPIKey: plusKey,
		HostURL: hostURL(req),
	}

	art, fi, err := c.Read("blog/post/" + name)
	if err != nil {
		return nil, "", err
	}
	if bytes.HasPrefix(art, []byte("{\n")) {
		i := bytes.Index(art, []byte("\n}\n"))
		if i < 0 {
			panic("cannot find end of json metadata")
		}
		hdr, rest := art[:i+3], art[i+3:]
		if err := json.Unmarshal(hdr, meta); err != nil {
			panic(fmt.Sprintf("loading %s: %s", name, err))
		}
		art = rest
	}
	meta.FileModTime = fi.ModTime
	meta.FileSize = fi.Size

	return meta, replacer.Replace(string(art)), nil
}

type byTime []*PostData

func (x byTime) Len() int           { return len(x) }
func (x byTime) Swap(i, j int)      { x[i], x[j] = x[j], x[i] }
func (x byTime) Less(i, j int) bool { return x[i].Date.Time.After(x[j].Date.Time) }

type TocData struct {
	Draft bool
	HostURL string
	Posts []*PostData
}

func toc(w http.ResponseWriter, req *http.Request, draft bool, isOwner bool, user string) {
	c := fs.NewContext(req)

	var data []byte
	keystr := fmt.Sprintf("blog:toc:%v", draft)
	if req.FormValue("readdir") != "" {
		keystr += ",readdir=" + req.FormValue("readdir")
	}
	if draft {
		keystr += ",user="+user
	}

	if key, ok := c.CacheLoad(keystr, "blog", &data); !ok {
		c := fs.NewContext(req)
		dir, err := c.ReadDir("blog/post")
		if err != nil {
			panic(err)
		}

		if req.FormValue("readdir") == "1" {
			fmt.Fprintf(w, "%d dir entries\n", len(dir))
			return
		}

		postCache := map[string]*PostData{}
		if data, _, err := c.Read("blogcache"); err == nil {
			if err := json.Unmarshal(data, &postCache); err != nil {
				c.Criticalf("unmarshal blogcache: %v", err)
			}
		}
		
		ch := make(chan *PostData, len(dir))
		const par = 20
		var limit = make(chan bool, par)
		for i := 0; i < par; i++ {
			limit <- true
		}
		for _, d := range dir {
			if meta := postCache[d.Name]; meta != nil && meta.FileModTime.Equal(d.ModTime) && meta.FileSize == d.Size {
				ch <- meta
				continue
			}

			<-limit
			go func(d proto.FileInfo) {
				defer func() { limit <- true }() 
				meta, _, err := loadPost(c, d.Name, req)
				if err != nil {
					// Should not happen: we just listed the directory.
					c.Criticalf("loadPost %s: %v", d.Name, err)
					return
				}
				ch <- meta
			}(d)
		}
		for i := 0; i < par; i++ {
			<-limit
		}
		close(ch)
		postCache = map[string]*PostData{}
		var all []*PostData
		for meta := range ch {
			postCache[meta.Name] = meta
			if meta.IsDraft() == draft && (!draft || isOwner || meta.canRead(user)) {
				all = append(all, meta)
			}
		}
		sort.Sort(byTime(all))
		
		if data, err := json.Marshal(postCache); err != nil {
			c.Criticalf("marshal blogcache: %v", err)
		} else if err := c.Write("blogcache", data); err != nil {
			c.Criticalf("write blogcache: %v", err)
		}

		var buf bytes.Buffer
		t := mainTemplate(c)
		if err := t.Lookup("toc").Execute(&buf, &TocData{draft, hostURL(req), all}); err != nil {
			panic(err)
		}
		data = buf.Bytes()
		c.CacheStore(key, data)
	}
	w.Write(data)
}

func oldRedirect(ctxt *fs.Context, w http.ResponseWriter, req *http.Request, p string) {
	m := map[string]string{}
	if key, ok := ctxt.CacheLoad("blog:oldRedirectMap", "blog/post", &m); !ok {	
		dir, err := ctxt.ReadDir("blog/post")
		if err != nil {
			panic(err)
		}
		
		for _, d := range dir {
			meta, _, err := loadPost(ctxt, d.Name, req)
			if err != nil {
				// Should not happen: we just listed the directory.
				panic(err)
			}
			m[meta.OldURL] = "/" + d.Name
		}
		
		ctxt.CacheStore(key, m)
	}
	
	if url, ok := m[p]; ok {
		http.Redirect(w, req, url, http.StatusFound)
		return	
	}

	notfound(ctxt, w, req)
}

func hostURL(req *http.Request) string {
	if strings.HasPrefix(req.Host, "localhost") {
		return "http://localhost:8080"
	}
	return "http://research.swtch.com"
}

func atomfeed(w http.ResponseWriter, req *http.Request) {
	c := fs.NewContext(req)
	
	c.Criticalf("Header: %v", req.Header)

	var data []byte
	if key, ok := c.CacheLoad("blog:atomfeed", "blog/post", &data); !ok {	
		dir, err := c.ReadDir("blog/post")
		if err != nil {
			panic(err)
		}
	
		var all []*PostData
		for _, d := range dir {
			meta, article, err := loadPost(c, d.Name, req)
			if err != nil {
				// Should not happen: we just loaded the directory.
				panic(err)
			}
			if meta.IsDraft() {
				continue
			}
			meta.article = article
			all = append(all, meta)
		}
		sort.Sort(byTime(all))
	
		show := all
		if len(show) > 10 {
			show = show[:10]
			for _, meta := range all[10:] {
				if meta.Favorite {
					show = append(show, meta)
				}
			}
		}
		
		feed := &atom.Feed{
			Title: "research!rsc",
			ID: feedID,
			Updated: atom.Time(show[0].Date.Time),
			Author: &atom.Person{
				Name: "Russ Cox",
				URI: "https://plus.google.com/" + plusRsc,
				Email: "rsc@swtch.com",
			},
			Link: []atom.Link{
				{Rel: "self", Href: hostURL(req) + "/feed.atom"},
			},
		}
		
		for _, meta := range show {
			t := template.New("main")
			t.Funcs(funcMap)
			main, _, err := c.Read("blog/atom.html")
			if err != nil {
				panic(err)
			}
			_, err = t.Parse(string(main))
			if err != nil {
				panic(err)
			}
			template.Must(t.New("article").Parse(meta.article))		
			var buf bytes.Buffer
			if err := t.Execute(&buf, meta); err != nil {
				panic(err)
			}
	
			e := &atom.Entry{
				Title: meta.Title,
				ID: feed.ID + "/" + meta.Name,
				Link: []atom.Link{
					{Rel: "alternate", Href: meta.HostURL + "/" + meta.Name},
				},
				Published: atom.Time(meta.Date.Time),
				Updated: atom.Time(meta.Date.Time),
				Summary: &atom.Text{
					Type: "text",
					Body: meta.Summary,
				},
				Content: &atom.Text{
					Type: "html",
					Body: buf.String(),
				},
			}
			
			feed.Entry = append(feed.Entry, e)
		}
		
		data, err = xml.Marshal(&feed)
		if err != nil {
			panic(err)
		}
		
		c.CacheStore(key, data)
	}

	// Feed readers like to hammer us; let Google cache the
	// response to reduce the traffic we have to serve.
	httpCache(w, 15*time.Minute)

	w.Header().Set("Content-Type", "application/atom+xml")
	w.Write(data)
}

func httpCache(w http.ResponseWriter, dt time.Duration) {
	w.Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", int(dt.Seconds())))
}
