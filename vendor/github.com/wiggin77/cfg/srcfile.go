package cfg

import (
	"os"
	"time"

	"github.com/wiggin77/cfg/ini"
)

// SrcFile is a configuration `Source` backed by a file containing
// name/value pairs or INI format.
type SrcFile struct {
	AbstractSourceMonitor
	ini  ini.Ini
	file *os.File
}

// NewSrcFileFromFilespec creates a new SrcFile with the specified filespec.
func NewSrcFileFromFilespec(filespec string) (*SrcFile, error) {
	file, err := os.Open(filespec)
	if err != nil {
		return nil, err
	}
	return NewSrcFile(file)
}

// NewSrcFile creates a new SrcFile with the specified os.File.
func NewSrcFile(file *os.File) (*SrcFile, error) {
	sf := &SrcFile{}
	sf.freq = time.Minute
	sf.file = file
	if err := sf.ini.LoadFromFile(file); err != nil {
		return nil, err
	}
	return sf, nil
}

// GetProps fetches all the properties from a source and returns
// them as a map.
func (sf *SrcFile) GetProps() (map[string]string, error) {
	lm, err := sf.GetLastModified()
	if err != nil {
		return nil, err
	}

	// Check if we need to reload.
	if sf.ini.GetLastModified() != lm {
		if err := sf.ini.LoadFromFile(sf.file); err != nil {
			return nil, err
		}
	}
	return sf.ini.ToMap(), nil
}

// GetLastModified returns the time of the latest modification to any
// property value within the source.
func (sf *SrcFile) GetLastModified() (time.Time, error) {
	fi, err := sf.file.Stat()
	if err != nil {
		return time.Now(), err
	}
	return fi.ModTime(), nil
}
