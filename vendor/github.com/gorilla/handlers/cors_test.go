package handlers

import (
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

func TestDefaultCORSHandlerReturnsOk(t *testing.T) {
	r := newRequest("GET", "http://www.example.com/")
	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS()(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusFound)
	}
}

func TestDefaultCORSHandlerReturnsOkWithOrigin(t *testing.T) {
	r := newRequest("GET", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS()(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusFound)
	}
}

func TestCORSHandlerIgnoreOptionsFallsThrough(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusTeapot)
	})

	CORS(IgnoreOptions())(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusTeapot {
		t.Fatalf("bad status: got %v want %v", status, http.StatusTeapot)
	}
}

func TestCORSHandlerSetsExposedHeaders(t *testing.T) {
	// Test default configuration.
	r := newRequest("GET", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(ExposedHeaders([]string{"X-CORS-TEST"}))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsExposeHeadersHeader)
	if header != "X-Cors-Test" {
		t.Fatal("bad header: expected X-Cors-Test header, got empty header for method.")
	}
}

func TestCORSHandlerUnsetRequestMethodForPreflightBadRequest(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(AllowedMethods([]string{"DELETE"}))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusBadRequest {
		t.Fatalf("bad status: got %v want %v", status, http.StatusBadRequest)
	}
}

func TestCORSHandlerInvalidRequestMethodForPreflightMethodNotAllowed(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "DELETE")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS()(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusMethodNotAllowed {
		t.Fatalf("bad status: got %v want %v", status, http.StatusMethodNotAllowed)
	}
}

func TestCORSHandlerOptionsRequestMustNotBePassedToNextHandler(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "GET")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		t.Fatal("Options request must not be passed to next handler")
	})

	CORS()(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}
}

func TestCORSHandlerAllowedMethodForPreflight(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "DELETE")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(AllowedMethods([]string{"DELETE"}))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsAllowMethodsHeader)
	if header != "DELETE" {
		t.Fatalf("bad header: expected DELETE method header, got empty header.")
	}
}

func TestCORSHandlerAllowMethodsNotSetForSimpleRequestPreflight(t *testing.T) {
	for _, method := range defaultCorsMethods {
		r := newRequest("OPTIONS", "http://www.example.com/")
		r.Header.Set("Origin", r.URL.String())
		r.Header.Set(corsRequestMethodHeader, method)

		rr := httptest.NewRecorder()

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

		CORS()(testHandler).ServeHTTP(rr, r)

		if status := rr.Code; status != http.StatusOK {
			t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
		}

		header := rr.HeaderMap.Get(corsAllowMethodsHeader)
		if header != "" {
			t.Fatalf("bad header: expected empty method header, got %s.", header)
		}
	}
}

func TestCORSHandlerAllowedHeaderNotSetForSimpleRequestPreflight(t *testing.T) {
	for _, simpleHeader := range defaultCorsHeaders {
		r := newRequest("OPTIONS", "http://www.example.com/")
		r.Header.Set("Origin", r.URL.String())
		r.Header.Set(corsRequestMethodHeader, "GET")
		r.Header.Set(corsRequestHeadersHeader, simpleHeader)

		rr := httptest.NewRecorder()

		testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

		CORS()(testHandler).ServeHTTP(rr, r)

		if status := rr.Code; status != http.StatusOK {
			t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
		}

		header := rr.HeaderMap.Get(corsAllowHeadersHeader)
		if header != "" {
			t.Fatalf("bad header: expected empty header, got %s.", header)
		}
	}
}

func TestCORSHandlerAllowedHeaderForPreflight(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "POST")
	r.Header.Set(corsRequestHeadersHeader, "Content-Type")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(AllowedHeaders([]string{"Content-Type"}))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsAllowHeadersHeader)
	if header != "Content-Type" {
		t.Fatalf("bad header: expected Content-Type header, got empty header.")
	}
}

func TestCORSHandlerInvalidHeaderForPreflightForbidden(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "POST")
	r.Header.Set(corsRequestHeadersHeader, "Content-Type")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS()(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusForbidden {
		t.Fatalf("bad status: got %v want %v", status, http.StatusForbidden)
	}
}

func TestCORSHandlerMaxAgeForPreflight(t *testing.T) {
	r := newRequest("OPTIONS", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())
	r.Header.Set(corsRequestMethodHeader, "POST")

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(MaxAge(3500))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsMaxAgeHeader)
	if header != "600" {
		t.Fatalf("bad header: expected %s to be %s, got %s.", corsMaxAgeHeader, "600", header)
	}
}

func TestCORSHandlerAllowedCredentials(t *testing.T) {
	r := newRequest("GET", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(AllowCredentials())(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsAllowCredentialsHeader)
	if header != "true" {
		t.Fatalf("bad header: expected %s to be %s, got %s.", corsAllowCredentialsHeader, "true", header)
	}
}

func TestCORSHandlerMultipleAllowOriginsSetsVaryHeader(t *testing.T) {
	r := newRequest("GET", "http://www.example.com/")
	r.Header.Set("Origin", r.URL.String())

	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	CORS(AllowedOrigins([]string{r.URL.String(), "http://google.com"}))(testHandler).ServeHTTP(rr, r)

	if status := rr.Code; status != http.StatusOK {
		t.Fatalf("bad status: got %v want %v", status, http.StatusOK)
	}

	header := rr.HeaderMap.Get(corsVaryHeader)
	if header != corsOriginHeader {
		t.Fatalf("bad header: expected %s to be %s, got %s.", corsVaryHeader, corsOriginHeader, header)
	}
}

func TestCORSWithMultipleHandlers(t *testing.T) {
	var lastHandledBy string
	corsMiddleware := CORS()

	testHandler1 := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastHandledBy = "testHandler1"
	})
	testHandler2 := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		lastHandledBy = "testHandler2"
	})

	r1 := newRequest("GET", "http://www.example.com/")
	rr1 := httptest.NewRecorder()
	handler1 := corsMiddleware(testHandler1)

	corsMiddleware(testHandler2)

	handler1.ServeHTTP(rr1, r1)
	if lastHandledBy != "testHandler1" {
		t.Fatalf("bad CORS() registration: Handler served should be Handler registered")
	}
}

func TestCORSHandlerWithCustomValidator(t *testing.T) {
	r := newRequest("GET", "http://a.example.com")
	r.Header.Set("Origin", r.URL.String())
	rr := httptest.NewRecorder()

	testHandler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {})

	originValidator := func(origin string) bool {
		if strings.HasSuffix(origin, ".example.com") {
			return true
		}
		return false
	}

	CORS(AllowedOriginValidator(originValidator))(testHandler).ServeHTTP(rr, r)
	header := rr.HeaderMap.Get(corsAllowOriginHeader)
	if header != r.URL.String() {
		t.Fatalf("bad header: expected %s to be %s, got %s.", corsAllowOriginHeader, r.URL.String(), header)
	}

}
