package ini

import (
	"fmt"
	"strings"
	"sync"
)

// Section represents a section in an INI file. The section has a name, which is
// enclosed in square brackets in the file. The section also has an array of
// key/value pairs.
type Section struct {
	name  string
	props map[string]string
	mtx   sync.RWMutex
}

func newSection(name string) *Section {
	sec := &Section{}
	sec.name = name
	sec.props = make(map[string]string)
	return sec
}

// addLines addes an array of strings containing name/value pairs
// of the format `key=value`.
//func addLines(lines []string) {
// TODO
//}

// GetName returns the name of the section.
func (sec *Section) GetName() (name string) {
	sec.mtx.RLock()
	name = sec.name
	sec.mtx.RUnlock()
	return
}

// GetProp returns the value associated with the given key, or
// `ok=false` if key does not exist.
func (sec *Section) GetProp(key string) (val string, ok bool) {
	sec.mtx.RLock()
	val, ok = sec.props[key]
	sec.mtx.RUnlock()
	return
}

// SetProp sets the value associated with the given key.
func (sec *Section) setProp(key string, val string) {
	sec.mtx.Lock()
	sec.props[key] = val
	sec.mtx.Unlock()
}

// hasKeys returns true if there are one or more properties in
// this section.
func (sec *Section) hasKeys() (b bool) {
	sec.mtx.RLock()
	b = len(sec.props) > 0
	sec.mtx.RUnlock()
	return
}

// getKeys returns an array containing all keys in this section.
func (sec *Section) getKeys() []string {
	sec.mtx.RLock()
	defer sec.mtx.RUnlock()

	arr := make([]string, len(sec.props))
	idx := 0
	for k := range sec.props {
		arr[idx] = k
		idx++
	}
	return arr
}

// combine the given section with this one.
func (sec *Section) combine(sec2 *Section) {
	sec.mtx.Lock()
	sec2.mtx.RLock()
	defer sec.mtx.Unlock()
	defer sec2.mtx.RUnlock()

	for k, v := range sec2.props {
		sec.props[k] = v
	}
}

// String returns a string representation of this section.
func (sec *Section) String() string {
	return fmt.Sprintf("[%s]\n%s", sec.GetName(), sec.StringPropsOnly())
}

// StringPropsOnly returns a string representation of this section
// without the section header.
func (sec *Section) StringPropsOnly() string {
	sec.mtx.RLock()
	defer sec.mtx.RUnlock()
	sb := &strings.Builder{}

	for k, v := range sec.props {
		sb.WriteString(k)
		sb.WriteString("=")
		sb.WriteString(v)
		sb.WriteString("\n")
	}
	return sb.String()
}
