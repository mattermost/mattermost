// Code generated for package migrations by go-bindata DO NOT EDIT. (@generated)
// sources:
// mysql/000001_create_teams.down.sql
// mysql/000001_create_teams.up.sql
// postgres/000001_create_teams.down.sql
// postgres/000001_create_teams.up.sql
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

var _mysql000001_create_teamsDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x09\xf2\x0f\x50\x08\x71\x74\xf2\x71\x55\xf0\x74\x53\x70\x8d\xf0\x0c\x0e\x09\x56\x08\x49\x4d\xcc\x2d\xb6\xe6\x02\x04\x00\x00\xff\xff\x8b\x30\x82\xe6\x1c\x00\x00\x00")

func mysql000001_create_teamsDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000001_create_teamsDownSql,
		"mysql/000001_create_teams.down.sql",
	)
}

func mysql000001_create_teamsDownSql() (*asset, error) {
	bytes, err := mysql000001_create_teamsDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000001_create_teams.down.sql", size: 28, mode: os.FileMode(420), modTime: time.Unix(1613401715, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x8c\xd0\x41\x4f\x83\x30\x14\x07\xf0\xfb\x3e\xc5\x3b\x42\xe2\x41\x71\x5b\x96\x98\x1d\xba\xf5\x4d\x1b\xb1\x2a\x94\xc4\x1d\x3b\x78\xba\x26\xb4\x10\xa8\xd3\x7d\x7b\x23\x1a\x5c\x0c\xc9\xb8\xf4\xd0\xf7\xeb\x7b\x7d\xff\x75\x82\x4c\x21\x28\xb6\x8a\x11\xc4\x06\xe4\xa3\x02\x7c\x11\xa9\x4a\x41\x91\xb6\x2d\x04\x13\x00\x00\x51\xc0\x41\x37\xf9\x5e\x37\x41\x34\x0f\x3b\x25\xb3\x38\xbe\xe8\x8a\xdc\xb4\x75\xa9\x8f\x52\x5b\xea\xd5\x7c\x1a\x02\xc7\x0d\xcb\xe2\x53\x39\x82\x70\x6a\xf3\xc6\xd4\xde\x54\xee\x6f\xe4\x6c\x36\x44\xd1\x6a\x53\xf6\xe8\x2a\x5a\x0c\x21\x75\xac\xe9\x5c\xa3\x75\x65\x6b\xed\xc6\x2c\xc0\xca\xb2\xfa\xa0\x82\x57\x56\x1b\xd7\x82\xa7\x4f\xff\x53\x10\xee\x60\x3c\x9d\xc4\x74\x1d\x0d\xbd\x4f\xf3\x3d\x59\xfa\x97\xe6\xc0\x87\x1a\xd2\x9e\x98\x87\x9d\x79\x33\xce\x07\xd1\xe5\x90\xca\xea\x62\x84\xe2\x54\xd2\x79\xf5\x94\x88\x07\x96\x6c\xe1\x1e\xb7\x10\x88\x22\xfc\x9d\x20\xc5\x73\x86\xdd\x65\x17\x4e\xf0\x7d\x86\x93\x10\x50\xde\x0a\x89\x4b\xe1\x5c\xc5\x57\x7d\xbb\xf5\x1d\x4b\x52\x54\xcb\x77\xff\xba\xb0\xbb\xe9\xcd\xe4\x2b\x00\x00\xff\xff\xe6\xbb\xf9\x41\x5e\x02\x00\x00")

func mysql000001_create_teamsUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000001_create_teamsUpSql,
		"mysql/000001_create_teams.up.sql",
	)
}

func mysql000001_create_teamsUpSql() (*asset, error) {
	bytes, err := mysql000001_create_teamsUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000001_create_teams.up.sql", size: 606, mode: os.FileMode(420), modTime: time.Unix(1613401617, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_teamsDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x09\xf2\x0f\x50\x08\x71\x74\xf2\x71\x55\xf0\x74\x53\x70\x8d\xf0\x0c\x0e\x09\x56\x08\x49\x4d\xcc\x2d\xb6\xe6\x02\x04\x00\x00\xff\xff\x8b\x30\x82\xe6\x1c\x00\x00\x00")

func postgres000001_create_teamsDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000001_create_teamsDownSql,
		"postgres/000001_create_teams.down.sql",
	)
}

func postgres000001_create_teamsDownSql() (*asset, error) {
	bytes, err := postgres000001_create_teamsDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000001_create_teams.down.sql", size: 28, mode: os.FileMode(420), modTime: time.Unix(1613401783, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x74\x8f\x4f\x4b\x03\x31\x10\xc5\xef\xfb\x29\xe6\xb8\x0b\x1e\xd6\xd5\x16\xc1\x53\x2c\x11\x17\xb5\x6a\x9a\x8a\x3d\x8e\x9b\x41\x07\xf2\x8f\x26\x2a\xfd\xf6\xa2\x0d\xad\xd2\xed\xf5\xf7\x7b\xcc\x9b\x37\x53\x52\x68\x09\x5a\x5c\xdd\x49\xe8\xaf\x61\xfe\xa0\x41\xbe\xf4\x0b\xbd\x80\x4c\xe8\x12\xd4\x15\x00\x00\x1b\x78\x16\x6a\x76\x23\x54\xdd\x4d\x1b\x78\x54\xfd\xbd\x50\x2b\xb8\x95\xab\x93\x5f\x6f\x38\x45\x8b\x1b\x8f\x8e\x76\xc1\xe9\x79\xb3\x95\xe3\xd4\x50\x1a\xd6\x1c\x33\x07\xbf\xbf\x3d\x99\x14\x4b\x0e\xd9\xee\xf8\x69\x77\x51\x78\xde\x44\x1a\x89\x0f\xc1\x45\xf4\x47\xfa\xd1\xda\xf0\x45\xc6\x04\x87\xec\xd3\xfe\x68\xdb\xb6\x25\xc1\xfe\x93\x33\xfd\x19\x79\xd6\x15\x93\x86\x77\x72\xf4\x7f\x7e\xa9\x5c\x13\x66\xc2\x0c\xaf\xfc\xc6\x3e\x6f\xe1\x47\x34\x87\xd0\x90\xa5\x03\xb8\x9c\xf7\x4f\x4b\x59\xff\x7c\xdc\x54\xcd\x65\xf5\x1d\x00\x00\xff\xff\xe5\x5d\xf2\x6f\x89\x01\x00\x00")

func postgres000001_create_teamsUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000001_create_teamsUpSql,
		"postgres/000001_create_teams.up.sql",
	)
}

func postgres000001_create_teamsUpSql() (*asset, error) {
	bytes, err := postgres000001_create_teamsUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000001_create_teams.up.sql", size: 393, mode: os.FileMode(420), modTime: time.Unix(1613404961, 0)}
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
	"mysql/000001_create_teams.down.sql":    mysql000001_create_teamsDownSql,
	"mysql/000001_create_teams.up.sql":      mysql000001_create_teamsUpSql,
	"postgres/000001_create_teams.down.sql": postgres000001_create_teamsDownSql,
	"postgres/000001_create_teams.up.sql":   postgres000001_create_teamsUpSql,
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
		"000001_create_teams.down.sql": &bintree{mysql000001_create_teamsDownSql, map[string]*bintree{}},
		"000001_create_teams.up.sql":   &bintree{mysql000001_create_teamsUpSql, map[string]*bintree{}},
	}},
	"postgres": &bintree{nil, map[string]*bintree{
		"000001_create_teams.down.sql": &bintree{postgres000001_create_teamsDownSql, map[string]*bintree{}},
		"000001_create_teams.up.sql":   &bintree{postgres000001_create_teamsUpSql, map[string]*bintree{}},
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
