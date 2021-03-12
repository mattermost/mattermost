package ini

import (
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"sync"
	"time"
)

// Ini provides parsing and querying of INI format or simple name/value pairs
// such as a simple config file.
// A name/value pair format is just an INI with no sections, and properties can
// be queried using an empty section name.
type Ini struct {
	mutex sync.RWMutex
	m     map[string]*Section
	lm    time.Time
}

// LoadFromFilespec loads an INI file from string containing path and filename.
func (ini *Ini) LoadFromFilespec(filespec string) error {
	f, err := os.Open(filespec)
	if err != nil {
		return err
	}
	return ini.LoadFromFile(f)
}

// LoadFromFile loads an INI file from `os.File`.
func (ini *Ini) LoadFromFile(file *os.File) error {

	fi, err := file.Stat()
	if err != nil {
		return err
	}
	lm := fi.ModTime()

	if err := ini.LoadFromReader(file); err != nil {
		return err
	}
	ini.lm = lm
	return nil
}

// LoadFromReader loads an INI file from an `io.Reader`.
func (ini *Ini) LoadFromReader(reader io.Reader) error {
	data, err := ioutil.ReadAll(reader)
	if err != nil {
		return err
	}
	return ini.LoadFromString(string(data))
}

// LoadFromString parses an INI from a string .
func (ini *Ini) LoadFromString(s string) error {
	m, err := getSections(s)
	if err != nil {
		return err
	}
	ini.mutex.Lock()
	ini.m = m
	ini.lm = time.Now()
	ini.mutex.Unlock()
	return nil
}

// GetLastModified returns the last modified timestamp of the
// INI contents.
func (ini *Ini) GetLastModified() time.Time {
	return ini.lm
}

// GetSectionNames returns the names of all sections in this INI.
// Note, the returned section names are a snapshot in time, meaning
// other goroutines may change the contents of this INI as soon as
// the method returns.
func (ini *Ini) GetSectionNames() []string {
	ini.mutex.RLock()
	defer ini.mutex.RUnlock()

	arr := make([]string, 0, len(ini.m))
	for key := range ini.m {
		arr = append(arr, key)
	}
	return arr
}

// GetKeys returns the names of all keys in the specified section.
// Note, the returned key names are a snapshot in time, meaning other
// goroutines may change the contents of this INI as soon as the
// method returns.
func (ini *Ini) GetKeys(sectionName string) ([]string, error) {
	sec, err := ini.getSection(sectionName)
	if err != nil {
		return nil, err
	}
	return sec.getKeys(), nil
}

// getSection returns the named section.
func (ini *Ini) getSection(sectionName string) (*Section, error) {
	ini.mutex.RLock()
	defer ini.mutex.RUnlock()

	sec, ok := ini.m[sectionName]
	if !ok {
		return nil, fmt.Errorf("section '%s' not found", sectionName)
	}
	return sec, nil
}

// GetFlattenedKeys returns all section names plus keys as one
// flattened array.
func (ini *Ini) GetFlattenedKeys() []string {
	ini.mutex.RLock()
	defer ini.mutex.RUnlock()

	arr := make([]string, 0, len(ini.m)*2)
	for _, section := range ini.m {
		keys := section.getKeys()
		for _, key := range keys {
			name := section.GetName()
			if name != "" {
				key = name + "." + key
			}
			arr = append(arr, key)
		}
	}
	return arr
}

// GetProp returns the value of the specified key in the named section.
func (ini *Ini) GetProp(section string, key string) (val string, ok bool) {
	sec, err := ini.getSection(section)
	if err != nil {
		return val, false
	}
	return sec.GetProp(key)
}

// ToMap returns a flattened map of the section name plus keys mapped
// to values.
func (ini *Ini) ToMap() map[string]string {
	m := make(map[string]string)

	ini.mutex.RLock()
	defer ini.mutex.RUnlock()

	for _, section := range ini.m {
		for _, key := range section.getKeys() {
			val, ok := section.GetProp(key)
			if ok {
				name := section.GetName()
				var mapkey string
				if name != "" {
					mapkey = name + "." + key
				} else {
					mapkey = key
				}
				m[mapkey] = val
			}
		}
	}
	return m
}
