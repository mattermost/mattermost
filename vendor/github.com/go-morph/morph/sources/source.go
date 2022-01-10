package sources

import (
	"fmt"
	"sync"

	"github.com/go-morph/morph/models"
)

var sourcesMu sync.RWMutex
var registeredSources = make(map[string]Source)

type Source interface {
	Open(sourceURL string) (source Source, err error)
	Close() (err error)
	Migrations() (migrations []*models.Migration)
}

func Register(name string, source Source) {
	sourcesMu.Lock()
	defer sourcesMu.Unlock()

	registeredSources[name] = source
}

func List() []string {
	sourcesMu.Lock()
	defer sourcesMu.Unlock()

	sources := make([]string, 0, len(registeredSources))
	for source := range registeredSources {
		sources = append(sources, source)
	}

	return sources
}

func Open(sourceName, sourceURL string) (Source, error) {
	sourcesMu.RLock()
	source, ok := registeredSources[sourceName]
	sourcesMu.RUnlock()
	if !ok {
		return nil, fmt.Errorf("unsupported source %q found", sourceName)
	}

	return source.Open(sourceURL)
}
