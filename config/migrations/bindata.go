// Code generated for package migrations by go-bindata DO NOT EDIT. (@generated)
// sources:
// mysql/000001_create_configurations.down.sql
// mysql/000001_create_configurations.up.sql
// mysql/000002_create_configuration_files.down.sql
// mysql/000002_create_configuration_files.up.sql
// postgres/000001_create_configurations.down.sql
// postgres/000001_create_configurations.up.sql
// postgres/000002_create_configuration_files.down.sql
// postgres/000002_create_configuration_files.up.sql
package migrations

import (
	"bytes"
	"compress/gzip"
	"fmt"
	"io"
	"io/ioutil"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func bindataRead(data []byte, name string) ([]byte, error) {
	gz, err := gzip.NewReader(bytes.NewBuffer(data))
	if err != nil {
		return nil, fmt.Errorf("Read %q: %v", name, err)
	}

	var buf bytes.Buffer
	_, err = io.Copy(&buf, gz)
	clErr := gz.Close()

	if err != nil {
		return nil, fmt.Errorf("Read %q: %v", name, err)
	}
	if clErr != nil {
		return nil, err
	}

	return buf.Bytes(), nil
}

type asset struct {
	bytes []byte
	info  os.FileInfo
}

type bindataFileInfo struct {
	name    string
	size    int64
	mode    os.FileMode
	modTime time.Time
}

// Name return file name
func (fi bindataFileInfo) Name() string {
	return fi.name
}

// Size return file size
func (fi bindataFileInfo) Size() int64 {
	return fi.size
}

// Mode return file mode
func (fi bindataFileInfo) Mode() os.FileMode {
	return fi.mode
}

// Mode return file modify time
func (fi bindataFileInfo) ModTime() time.Time {
	return fi.modTime
}

// IsDir return file whether a directory
func (fi bindataFileInfo) IsDir() bool {
	return fi.mode&os.ModeDir != 0
}

// Sys return file is sys mode
func (fi bindataFileInfo) Sys() interface{} {
	return nil
}

var _mysql000001_create_configurationsDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x14\xcb\xdd\x09\x80\x30\x0c\x04\xe0\x77\xa7\xb8\x05\xea\x1e\x8e\x71\xfd\x35\x18\x12\x68\xa3\xe0\xf6\xe2\x00\x5f\x4a\x38\x02\xb2\x20\x16\xcd\x42\xdc\xa8\xfa\x22\x1c\xe6\x81\x93\x4f\x03\x31\x5d\x35\xb3\x5c\xe8\x3e\xc1\x5a\xc5\x06\x8a\x5b\x97\x71\x4f\xfe\x66\x21\x98\xb5\xed\xdb\x17\x00\x00\xff\xff\xcc\x5e\xec\xe9\x4f\x00\x00\x00")

func mysql000001_create_configurationsDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000001_create_configurationsDownSql,
		"mysql/000001_create_configurations.down.sql",
	)
}

func mysql000001_create_configurationsDownSql() (*asset, error) {
	bytes, err := mysql000001_create_configurationsDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000001_create_configurations.down.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000001_create_configurationsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\xc4\x54\x5f\x6f\x9b\x3e\x14\x7d\xe7\x53\xdc\xdf\x13\xf0\x53\x55\x6d\xd3\x34\x4d\x8a\x98\xe6\x98\x9b\xd6\x9b\xb1\x33\xdb\x74\xcd\x13\x72\x13\xb7\x8d\x14\x48\x45\x4c\xd5\x7d\xfb\x89\x3f\xa5\x25\xfb\xff\x30\x8d\x07\x6c\x38\xe7\x1e\x9b\x73\x8f\xa1\x0a\x89\x41\x30\x64\xce\x11\xd8\x02\x84\x34\x80\x97\x4c\x1b\x0d\x74\x5f\x5d\x6f\x6f\x9a\xda\xfa\xed\xbe\x3a\x40\x14\x00\x00\xb0\x0d\x5c\x10\x45\xcf\x89\x8a\x5e\xbd\x89\x61\xa9\x58\x46\xd4\x0a\x3e\xe2\xea\xa4\xc3\x2f\xec\xae\x71\x60\xf0\xd2\x74\x52\x22\xe7\xbc\x07\x68\xed\xac\x77\xc4\xc3\x9c\x9d\x31\x71\x8c\x92\xb5\xdf\xde\x3b\x98\x4b\xc9\x91\x88\x0e\x80\x5c\xb0\x4f\x39\x06\x31\xa0\x38\x63\x02\x13\x56\x55\xfb\x74\x0e\x29\x2e\x48\xce\x0d\xb4\x7b\xd0\x68\x92\xc6\x5f\xbf\x2d\xaf\x5e\xcf\x82\x40\xa3\x81\xf7\x77\xb5\xbb\xb3\xb5\xdb\x68\x6f\xbd\x2b\x5d\xe5\x21\x81\x48\x23\x47\x6a\x80\x2d\xfa\x8f\xe8\xef\xed\x35\x00\x54\xe6\xc2\x44\xff\xc7\xb0\x50\x32\x03\x26\x16\x52\x65\xc4\x30\x29\x0a\x4d\xcf\x31\x23\xa7\x54\xf2\x3c\x13\x7a\xac\xfb\x7c\x8e\x0a\xc1\xdb\xab\x9d\x2b\x2a\x5b\x3a\x48\x20\x9c\xfa\x15\x8e\x5c\x22\xd2\x81\x79\x58\xdf\xba\xd2\x42\x02\x29\x31\x64\x4e\x34\x46\xf1\x84\xb5\xde\xef\x9a\xb2\x1a\x05\x3b\x2f\xa7\x3a\xad\x6b\x1b\xeb\x6d\xe1\xbf\xdc\x75\x9c\x0c\x53\x96\x67\xad\xdf\x3d\x31\x86\x77\xf0\xa2\xf7\x34\x24\xdc\xa0\x1a\x5a\x7b\xd4\xcc\x4c\xa6\x6c\xb1\x1a\xba\xf5\xa4\x31\x0b\x87\xd2\xc1\x97\x97\x61\x10\xc7\xb3\x20\x58\x2a\x5c\x12\x85\x60\x77\xde\xd5\xec\x1a\x1f\xb6\x07\x7f\xe8\xcd\xfa\xd6\xf0\x59\x80\x97\x48\x73\x73\x44\x9f\x05\x29\x12\xce\x25\x6d\xf3\xf6\x5d\xc1\xbf\xdb\xc2\xce\x07\x0d\x44\x83\x19\x6b\x3f\x48\x26\x7e\xd2\xee\x96\x4c\x21\xd7\x4c\x9c\x41\xd4\xd5\x0f\x84\x93\xde\xd5\x42\x90\x0c\xe3\xdf\x51\xe3\xfd\x8b\x36\xb3\x84\x1a\x54\x85\x46\x53\x90\xe5\x92\x33\x4a\xe6\x8c\x33\xb3\xea\xd6\xa2\x9a\x80\x14\x10\x99\x7e\xb7\xc5\x58\x09\x49\x07\x3e\x93\x9a\x2e\xdd\xe7\xf1\xf9\x16\x7f\x9c\x32\x7a\xda\x02\x85\x59\x2d\x11\x98\x80\x28\x74\x55\x53\x86\x27\x10\xde\xdb\x7a\x7d\x6b\xeb\x76\xfa\x38\x7a\xf7\xe0\xdb\xb1\x74\x9b\x6d\x53\x3e\x3e\xed\xf6\xd5\x4d\x37\x9f\x0a\x3f\x79\xf2\xab\xe3\x40\x4f\xa7\x4e\x74\x35\xff\x25\x10\x0e\x87\xf9\x8f\xb2\x4c\xa5\xb8\x40\x65\xc0\x48\x18\x55\xa1\x0d\xd2\xe3\x9f\xe1\x5f\x87\x3a\xf8\x1a\x00\x00\xff\xff\xca\xf0\xa8\x1a\x65\x05\x00\x00")

func mysql000001_create_configurationsUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000001_create_configurationsUpSql,
		"mysql/000001_create_configurations.up.sql",
	)
}

func mysql000001_create_configurationsUpSql() (*asset, error) {
	bytes, err := mysql000001_create_configurationsUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000001_create_configurations.up.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000002_create_configuration_filesDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x14\xcb\xd1\x0d\xc3\x20\x0c\x04\xd0\xff\x4e\x71\x0b\xd0\x3d\x3a\xc6\x01\x86\x5a\xb1\x6c\x09\x9c\x48\xd9\x3e\xca\x00\xaf\x14\xfc\x12\xba\xa1\x9e\xe2\xa9\xe1\x34\xbb\x91\x01\x8f\xc4\x9f\x97\x80\x58\x61\x56\xd9\x0e\x8c\x58\x60\xef\xea\x13\x2d\x7c\xe8\x3c\x17\x5f\x83\xa1\x26\x1b\xc9\x6a\xf2\xfd\x3c\x01\x00\x00\xff\xff\x4d\x7c\xf2\xd3\x54\x00\x00\x00")

func mysql000002_create_configuration_filesDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000002_create_configuration_filesDownSql,
		"mysql/000002_create_configuration_files.down.sql",
	)
}

func mysql000002_create_configuration_filesDownSql() (*asset, error) {
	bytes, err := mysql000002_create_configuration_filesDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000002_create_configuration_files.down.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000002_create_configuration_filesUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\xc4\x94\x51\x6b\xdb\x3c\x14\x86\xef\xfd\x2b\xce\x77\x65\xfb\xa3\x94\x0d\xca\x18\x04\x8f\x29\xf2\x71\xab\x4d\x96\x82\x24\x77\xcd\x95\x51\x1b\xb5\x0d\xc4\x4e\x70\x94\xd1\xfd\xfb\x21\xdb\x4d\x9b\x36\x1b\xdd\xc5\x58\x2e\x22\x59\xe7\x3d\xaf\xe4\xe7\x1c\x99\x2a\x24\x06\xc1\x90\x29\x47\x60\x05\x08\x69\x00\xaf\x98\x36\x1a\xe8\xba\xbd\x5d\xde\xed\x3a\xeb\x97\xeb\xb6\x58\xae\xdc\x16\x92\x08\x00\x40\xd8\xc6\xc1\x25\x51\xf4\x82\xa8\xe4\xc3\x59\x0a\x33\xc5\x4a\xa2\xe6\xf0\x15\xe7\x27\xbd\x22\xb7\xde\x82\xc1\x2b\xd3\xfb\x89\x8a\xf3\x61\x9d\x76\xce\x7a\x47\x3c\x4c\xd9\x39\x13\x2f\xa3\xd5\x66\x71\x34\x1a\xa5\x80\xe2\x9c\x09\xcc\x58\xdb\xae\xf3\x29\xe4\x58\x90\x8a\x1b\x08\x07\xd0\x68\xb2\x9d\xbf\xfd\xd8\x5c\x9f\x4d\xa2\x48\xa3\x81\xcf\x9b\xce\x6d\x6c\xe7\x16\xda\x5b\xef\x1a\xd7\x7a\xc8\x20\xd1\xc8\x91\x1a\x60\xc5\xf0\x0e\xc3\x7f\xf8\x8d\x01\x2a\x2b\x61\x92\xff\x53\x28\x94\x2c\x81\x89\x42\xaa\x92\x18\x26\x45\xad\xe9\x05\x96\xe4\x94\x4a\x5e\x95\x42\xef\xf3\xbe\x5d\xa0\x42\xf0\xf6\x7a\xe5\xea\x36\x10\xc9\x20\x7e\x8d\x2c\xde\xeb\x89\xc8\x47\xf5\xf6\xe6\xde\x35\x16\x32\xc8\x89\x21\x53\xa2\x31\x49\x0f\x54\x37\xeb\xd5\xae\x69\xf7\xa6\x01\xe6\xa1\x4d\x00\xb3\xb0\xde\xd6\xfe\xc7\xa6\x97\x94\x98\xb3\xaa\x0c\xc0\x07\x61\x0a\x9f\xe0\xdd\x00\x35\x26\xdc\xa0\x1a\x0b\x7c\xa4\xa4\xa5\xcc\x59\x31\x1f\x2a\xf6\x64\x33\x89\xc7\xec\x91\xce\xfb\x38\x4a\xd3\x49\x14\xcd\x14\xce\x88\x42\xb0\x2b\xef\x3a\x76\x8b\x0f\xcb\xad\xdf\x0e\xc8\x5e\x63\x9f\x44\x78\x85\xb4\x32\x2f\xe4\x93\x28\x47\xc2\xb9\xa4\xa1\xf1\x8e\x1a\xfe\xdd\x42\xf6\x28\x34\x10\x0d\x66\x9f\xfb\x45\x32\xf1\x9b\xa2\x07\x31\x85\x4a\x33\x71\x0e\x49\x9f\x3f\x0a\x4e\x06\xb0\xb5\x20\x25\xa6\x6f\x71\xe3\xc3\x42\xe8\x5c\x42\x0d\xaa\x5a\xa3\xa9\xc9\x6c\xc6\x19\x25\x53\xc6\x99\x99\xf7\x7b\x51\x4d\x40\x0a\x48\xcc\x70\xda\x7a\x9f\x09\x59\x1f\x7c\x66\x75\xb8\xf5\xd0\x95\xcf\x8f\xf8\xeb\x3e\xa3\xa7\x21\x50\x9b\xf9\x0c\x81\x09\x48\x62\xd7\xee\x9a\xf8\x04\xe2\xef\xb6\xbb\xb9\xb7\x5d\x98\x3e\x8e\xde\x3d\xf8\x30\x36\x6e\xb1\xdc\x35\x8f\x4f\xab\x75\x7b\xd7\xcf\x0f\x8d\x9f\x98\xbc\xe5\x52\xd0\xd3\x43\x1a\x7d\xde\x7f\x19\xc4\xe3\xb5\xfe\xe3\x96\xa6\x52\x5c\xa2\x32\x60\x24\xec\x9d\x21\x34\xd4\xe3\x77\xe2\x1f\x37\xf7\xcf\x00\x00\x00\xff\xff\xc4\x31\x65\x82\x74\x05\x00\x00")

func mysql000002_create_configuration_filesUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000002_create_configuration_filesUpSql,
		"mysql/000002_create_configuration_files.up.sql",
	)
}

func mysql000002_create_configuration_filesUpSql() (*asset, error) {
	bytes, err := mysql000002_create_configuration_filesUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000002_create_configuration_files.up.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_configurationsDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x14\xcb\xdd\x09\x80\x30\x0c\x04\xe0\x77\xa7\xb8\x05\xea\x1e\x8e\x71\xfd\x35\x18\x12\x68\xa3\xe0\xf6\xe2\x00\x5f\x4a\x38\x02\xb2\x20\x16\xcd\x42\xdc\xa8\xfa\x22\x1c\xe6\x81\x93\x4f\x03\x31\x5d\x35\xb3\x5c\xe8\x3e\xc1\x5a\xc5\x06\x8a\x5b\x97\x71\x4f\xfe\x66\x21\x98\xb5\xed\xdb\x17\x00\x00\xff\xff\xcc\x5e\xec\xe9\x4f\x00\x00\x00")

func postgres000001_create_configurationsDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000001_create_configurationsDownSql,
		"postgres/000001_create_configurations.down.sql",
	)
}

func postgres000001_create_configurationsDownSql() (*asset, error) {
	bytes, err := postgres000001_create_configurationsDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000001_create_configurations.down.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_configurationsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x5c\x8d\xb1\x8b\xc2\x30\x1c\x85\xf7\xfe\x15\x6f\x4c\xe1\xa6\x1b\x6e\xb9\x29\x77\xa6\x10\x8c\x55\xdb\x04\xec\xf8\x6b\x1a\x6b\xa0\x24\x10\xd3\xe2\x9f\x2f\xb4\x0e\xe2\xfa\xbe\xf7\xf1\xfd\x37\x82\x6b\x01\xcd\xff\x94\x80\xac\x50\x1f\x35\xc4\x45\xb6\xba\x85\x8d\xe1\xea\xc7\x39\x51\xf6\x31\xdc\xc1\x0a\x00\xf0\x03\x16\x4a\xf6\x46\x89\x7d\xff\x94\x5f\xeb\xb6\xd0\x34\x3b\x64\xf7\xc8\xab\x5e\x1b\xa5\x36\x60\x93\xa3\xec\x28\xa3\xf7\xa3\x0f\x9f\x94\x6c\xf6\x8b\x43\x1f\xe3\xe4\x28\x60\x27\x2a\x6e\xd4\xfb\xe1\xd4\xc8\x03\x6f\x3a\xec\x45\x07\xe6\x87\x57\xcd\xd4\xf2\x6c\x04\xd8\xa6\x97\x45\xf9\x5b\x3c\x03\x00\x00\xff\xff\x99\xd2\xa1\xf5\xc5\x00\x00\x00")

func postgres000001_create_configurationsUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000001_create_configurationsUpSql,
		"postgres/000001_create_configurations.up.sql",
	)
}

func postgres000001_create_configurationsUpSql() (*asset, error) {
	bytes, err := postgres000001_create_configurationsUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000001_create_configurations.up.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000002_create_configuration_filesDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x14\xcb\xd1\x0d\xc3\x20\x0c\x04\xd0\xff\x4e\x71\x0b\xd0\x3d\x3a\xc6\x01\x86\x5a\xb1\x6c\x09\x9c\x48\xd9\x3e\xca\x00\xaf\x14\xfc\x12\xba\xa1\x9e\xe2\xa9\xe1\x34\xbb\x91\x01\x8f\xc4\x9f\x97\x80\x58\x61\x56\xd9\x0e\x8c\x58\x60\xef\xea\x13\x2d\x7c\xe8\x3c\x17\x5f\x83\xa1\x26\x1b\xc9\x6a\xf2\xfd\x3c\x01\x00\x00\xff\xff\x4d\x7c\xf2\xd3\x54\x00\x00\x00")

func postgres000002_create_configuration_filesDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000002_create_configuration_filesDownSql,
		"postgres/000002_create_configuration_files.down.sql",
	)
}

func postgres000002_create_configuration_filesDownSql() (*asset, error) {
	bytes, err := postgres000002_create_configuration_filesDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000002_create_configuration_files.down.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000002_create_configuration_filesUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x0e\x72\x75\x0c\x71\x55\x08\x71\x74\xf2\x71\x55\xf0\x74\x53\xf0\xf3\x0f\x51\x70\x8d\xf0\x0c\x0e\x09\x56\x48\xce\xcf\x4b\xcb\x4c\x2f\x2d\x4a\x2c\xc9\x04\xb1\x72\x52\x8b\x15\x34\xb8\x14\x14\x14\x14\xf2\x12\x73\x53\x15\xc2\x1c\x83\x9c\x3d\x1c\x83\x34\xcc\x4c\x34\x75\xc0\xa2\x29\x89\x25\x89\x0a\x25\xa9\x15\x25\x60\x33\xfc\x42\x7d\x7c\x20\xe2\xc9\x45\xa9\x89\x25\xa9\x89\x25\x0a\x49\x99\xe9\x99\x79\xe8\xb2\xa5\x05\x29\x78\x64\x03\x82\x3c\x7d\x1d\x83\x22\x15\xbc\x5d\x23\x15\x34\x40\xd6\x6a\x72\x69\x5a\x03\x02\x00\x00\xff\xff\x5a\x1b\x37\x72\xb3\x00\x00\x00")

func postgres000002_create_configuration_filesUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000002_create_configuration_filesUpSql,
		"postgres/000002_create_configuration_files.up.sql",
	)
}

func postgres000002_create_configuration_filesUpSql() (*asset, error) {
	bytes, err := postgres000002_create_configuration_filesUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000002_create_configuration_files.up.sql", size: 0, mode: os.FileMode(0), modTime: time.Unix(0, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

// Asset loads and returns the asset for the given name.
// It returns an error if the asset could not be found or
// could not be loaded.
func Asset(name string) ([]byte, error) {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	if f, ok := _bindata[cannonicalName]; ok {
		a, err := f()
		if err != nil {
			return nil, fmt.Errorf("Asset %s can't read by error: %v", name, err)
		}
		return a.bytes, nil
	}
	return nil, fmt.Errorf("Asset %s not found", name)
}

// MustAsset is like Asset but panics when Asset would return an error.
// It simplifies safe initialization of global variables.
func MustAsset(name string) []byte {
	a, err := Asset(name)
	if err != nil {
		panic("asset: Asset(" + name + "): " + err.Error())
	}

	return a
}

// AssetInfo loads and returns the asset info for the given name.
// It returns an error if the asset could not be found or
// could not be loaded.
func AssetInfo(name string) (os.FileInfo, error) {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	if f, ok := _bindata[cannonicalName]; ok {
		a, err := f()
		if err != nil {
			return nil, fmt.Errorf("AssetInfo %s can't read by error: %v", name, err)
		}
		return a.info, nil
	}
	return nil, fmt.Errorf("AssetInfo %s not found", name)
}

// AssetNames returns the names of the assets.
func AssetNames() []string {
	names := make([]string, 0, len(_bindata))
	for name := range _bindata {
		names = append(names, name)
	}
	return names
}

// _bindata is a table, holding each asset generator, mapped to its name.
var _bindata = map[string]func() (*asset, error){
	"mysql/000001_create_configurations.down.sql":         mysql000001_create_configurationsDownSql,
	"mysql/000001_create_configurations.up.sql":           mysql000001_create_configurationsUpSql,
	"mysql/000002_create_configuration_files.down.sql":    mysql000002_create_configuration_filesDownSql,
	"mysql/000002_create_configuration_files.up.sql":      mysql000002_create_configuration_filesUpSql,
	"postgres/000001_create_configurations.down.sql":      postgres000001_create_configurationsDownSql,
	"postgres/000001_create_configurations.up.sql":        postgres000001_create_configurationsUpSql,
	"postgres/000002_create_configuration_files.down.sql": postgres000002_create_configuration_filesDownSql,
	"postgres/000002_create_configuration_files.up.sql":   postgres000002_create_configuration_filesUpSql,
}

// AssetDir returns the file names below a certain
// directory embedded in the file by go-bindata.
// For example if you run go-bindata on data/... and data contains the
// following hierarchy:
//     data/
//       foo.txt
//       img/
//         a.png
//         b.png
// then AssetDir("data") would return []string{"foo.txt", "img"}
// AssetDir("data/img") would return []string{"a.png", "b.png"}
// AssetDir("foo.txt") and AssetDir("notexist") would return an error
// AssetDir("") will return []string{"data"}.
func AssetDir(name string) ([]string, error) {
	node := _bintree
	if len(name) != 0 {
		cannonicalName := strings.Replace(name, "\\", "/", -1)
		pathList := strings.Split(cannonicalName, "/")
		for _, p := range pathList {
			node = node.Children[p]
			if node == nil {
				return nil, fmt.Errorf("Asset %s not found", name)
			}
		}
	}
	if node.Func != nil {
		return nil, fmt.Errorf("Asset %s not found", name)
	}
	rv := make([]string, 0, len(node.Children))
	for childName := range node.Children {
		rv = append(rv, childName)
	}
	return rv, nil
}

type bintree struct {
	Func     func() (*asset, error)
	Children map[string]*bintree
}

var _bintree = &bintree{nil, map[string]*bintree{
	"mysql": &bintree{nil, map[string]*bintree{
		"000001_create_configurations.down.sql":      &bintree{mysql000001_create_configurationsDownSql, map[string]*bintree{}},
		"000001_create_configurations.up.sql":        &bintree{mysql000001_create_configurationsUpSql, map[string]*bintree{}},
		"000002_create_configuration_files.down.sql": &bintree{mysql000002_create_configuration_filesDownSql, map[string]*bintree{}},
		"000002_create_configuration_files.up.sql":   &bintree{mysql000002_create_configuration_filesUpSql, map[string]*bintree{}},
	}},
	"postgres": &bintree{nil, map[string]*bintree{
		"000001_create_configurations.down.sql":      &bintree{postgres000001_create_configurationsDownSql, map[string]*bintree{}},
		"000001_create_configurations.up.sql":        &bintree{postgres000001_create_configurationsUpSql, map[string]*bintree{}},
		"000002_create_configuration_files.down.sql": &bintree{postgres000002_create_configuration_filesDownSql, map[string]*bintree{}},
		"000002_create_configuration_files.up.sql":   &bintree{postgres000002_create_configuration_filesUpSql, map[string]*bintree{}},
	}},
}}

// RestoreAsset restores an asset under the given directory
func RestoreAsset(dir, name string) error {
	data, err := Asset(name)
	if err != nil {
		return err
	}
	info, err := AssetInfo(name)
	if err != nil {
		return err
	}
	err = os.MkdirAll(_filePath(dir, filepath.Dir(name)), os.FileMode(0755))
	if err != nil {
		return err
	}
	err = ioutil.WriteFile(_filePath(dir, name), data, info.Mode())
	if err != nil {
		return err
	}
	err = os.Chtimes(_filePath(dir, name), info.ModTime(), info.ModTime())
	if err != nil {
		return err
	}
	return nil
}

// RestoreAssets restores an asset under the given directory recursively
func RestoreAssets(dir, name string) error {
	children, err := AssetDir(name)
	// File
	if err != nil {
		return RestoreAsset(dir, name)
	}
	// Dir
	for _, child := range children {
		err = RestoreAssets(dir, filepath.Join(name, child))
		if err != nil {
			return err
		}
	}
	return nil
}

func _filePath(dir, name string) string {
	cannonicalName := strings.Replace(name, "\\", "/", -1)
	return filepath.Join(append([]string{dir}, strings.Split(cannonicalName, "/")...)...)
}
