package throttled

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"time"

	"github.com/PuerkitoBio/boom/commands"
)

type stats struct {
	sync.Mutex
	ok      int
	dropped int
	ts      []time.Time

	body func()
}

func (s *stats) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if s.body != nil {
		s.body()
	}
	s.Lock()
	defer s.Unlock()
	s.ts = append(s.ts, time.Now())
	s.ok++
	w.WriteHeader(200)
}

func (s *stats) DeniedHTTP(w http.ResponseWriter, r *http.Request) {
	s.Lock()
	defer s.Unlock()
	s.dropped++
	w.WriteHeader(deniedStatus)
}

func (s *stats) Stats() (int, int, []time.Time) {
	s.Lock()
	defer s.Unlock()
	return s.ok, s.dropped, s.ts
}

func runTest(h http.Handler, b ...commands.Boom) []*commands.Report {
	srv := httptest.NewServer(h)
	defer srv.Close()

	var rpts []*commands.Report
	var wg sync.WaitGroup
	var mu sync.Mutex
	wg.Add(len(b))
	for i, bo := range b {
		bo.Req.Url = srv.URL + fmt.Sprintf("/%d", i)
		go func(bo commands.Boom) {
			mu.Lock()
			defer mu.Unlock()
			rpts = append(rpts, bo.Run())
			wg.Done()
		}(bo)
	}
	wg.Wait()
	return rpts
}
