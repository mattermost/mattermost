package logging

import (
	"fmt"
	"os"
	"strconv"
	"sync"
)

// FileRotateOptions struct to configure FileRotate
type FileRotateOptions struct {
	MaxBytes    int64
	BackupCount int
	Path        string
}

// FileRotate rotates a log file at MaxBytes
type FileRotate struct {
	fl      *os.File
	fm      *sync.Mutex
	options *FileRotateOptions
}

// NewFileRotate returns a pointer to a FileRotate instance
func NewFileRotate(opt *FileRotateOptions) (*FileRotate, error) {

	fileWriter, err := os.OpenFile(opt.Path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		return nil, err
	}

	fl := &FileRotate{fl: fileWriter, fm: &sync.Mutex{}, options: opt}
	return fl, nil
}

func (f *FileRotate) shouldRotate(bytesToAdd int64) bool {
	fi, err := f.fl.Stat()
	if err != nil {
		fmt.Println("Error getting stats of file")
		return false
	}

	if fi.Size()+bytesToAdd >= f.options.MaxBytes {
		return true
	}

	return false
}

func (f *FileRotate) rotate() error {

	f.fl.Close()

	for i := f.options.BackupCount - 1; i >= 0; i-- {
		var currentLog string
		if i == 0 {
			currentLog = f.options.Path
		} else {
			currentLog = f.options.Path + "." + strconv.Itoa(i)
		}

		if _, err := os.Stat(currentLog); err == nil {
			rotateLog := f.options.Path + "." + strconv.Itoa(i+1)
			err := os.Rename(currentLog, rotateLog)
			if err != nil {
				fmt.Printf("Error rotating log file: %s \n", err.Error())
				return err
			}
		}

	}

	var err error
	f.fl, err = os.OpenFile(f.options.Path, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0644)
	if err != nil {
		fmt.Printf("Error reopening log file: %s \n", err.Error())
		return err
	}

	return nil
}

func (f *FileRotate) write(p []byte) (n int, err error) {
	f.fm.Lock()
	if f.shouldRotate(int64(len(p))) {
		f.rotate()
	}

	n, err = f.fl.Write(p)
	f.fm.Unlock()

	if err != nil {
		fmt.Println("Error writing in rotated log file", f.options.Path)
		return n, err
	}

	return n, nil
}

// Write writes async the log message
func (f *FileRotate) Write(p []byte) (n int, err error) {
	dst := make([]byte, len(p))
	copy(dst, p)
	go f.write(dst)
	return len(p), nil
}
