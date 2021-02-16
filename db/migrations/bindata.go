// Code generated for package migrations by go-bindata DO NOT EDIT. (@generated)
// sources:
// mysql/000001_create_teams.down.sql
// mysql/000001_create_teams.up.sql
// mysql/000002_create_team_members.down.sql
// mysql/000002_create_team_members.up.sql
// postgres/000001_create_teams.down.sql
// postgres/000001_create_teams.up.sql
// postgres/000002_create_team_members.down.sql
// postgres/000002_create_team_members.up.sql
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

	info := bindataFileInfo{name: "mysql/000001_create_teams.down.sql", size: 28, mode: os.FileMode(420), modTime: time.Unix(1613474902, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x8c\x92\x41\x6f\xb2\x30\x18\xc7\xef\x7e\x8a\xe7\x58\x92\xf7\xf0\x8e\xa9\x31\x59\x3c\x54\xa9\x5b\x33\xc6\x36\x28\xc9\x3c\x91\x4a\xbb\xd9\x84\x16\x02\xd5\xe9\xb7\x5f\xec\xc4\x99\xa5\x99\x5e\x38\xf4\xff\x83\x3e\xff\xdf\xc3\x3c\x25\x98\x11\x60\x78\x16\x13\xa0\x0b\x48\x9e\x19\x90\x37\x9a\xb1\x0c\x98\xe4\xba\x03\x34\x00\x00\xa0\x02\xb6\xbc\x2d\xd7\xbc\x45\xe1\x38\x70\x54\x92\xc7\xf1\x3f\x17\x46\xaa\x6b\x2a\xbe\x4f\xb8\x96\x27\x6a\x3c\x0c\x20\x22\x0b\x9c\xc7\xe7\xe4\x15\x48\x24\xbb\xb2\x55\x8d\x55\xb5\xf9\xb9\x72\x34\xf2\xa1\x44\x73\x55\x9d\xa0\x9b\x70\xe2\x83\xd8\xbe\x91\x97\x3e\x34\xaf\x75\xc3\xcd\x35\x05\x70\x55\xd5\x9f\x52\x44\xb5\xe6\xca\x74\x60\xe5\xce\x7e\x07\xd4\x6c\x95\x95\x67\x9a\x6e\x43\xdf\xfb\x59\xb9\x96\x5a\xfe\xb2\xe9\x19\xa8\x95\xdc\x4a\x6c\x61\xa5\x3e\x94\xb1\x28\xfc\xef\xa3\xf2\x46\x5c\x41\x45\xb2\x92\x97\xa9\x97\x94\x3e\xe1\x74\x09\x8f\x64\x09\x88\x8a\xe0\x78\x43\x42\x5f\x73\xe2\x0e\x9d\x1c\x74\x78\x1e\xb3\xc3\xa1\x12\xbb\xc2\x1e\x7e\x93\xc2\xfc\x1d\x2b\xa7\xa7\x50\x02\x50\x6f\xca\xcb\x6d\x5c\xa5\x82\x5b\x40\x7d\x3b\x2f\x57\x3a\x41\x8e\xeb\x5d\x79\x39\xe1\xca\x3b\xae\xf7\xe0\xe5\x3a\xb7\x17\x37\x5f\xbf\xa2\x60\x10\x00\x49\xee\x69\x42\xa6\xd4\x98\x3a\x9a\x9d\xac\xcd\x1f\x70\x9a\x11\x36\xdd\xd8\xf7\x89\x5e\x0d\xef\x06\x5f\x01\x00\x00\xff\xff\x53\xe9\x7d\x31\x45\x03\x00\x00")

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

	info := bindataFileInfo{name: "mysql/000001_create_teams.up.sql", size: 837, mode: os.FileMode(420), modTime: time.Unix(1613482481, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000002_create_team_membersDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x09\xf2\x0f\x50\x08\x71\x74\xf2\x71\x55\xf0\x74\x53\x70\x8d\xf0\x0c\x0e\x09\x56\x08\x49\x4d\xcc\xf5\x4d\xcd\x4d\x4a\x2d\x2a\xb6\xe6\x02\x04\x00\x00\xff\xff\x17\x49\xed\x39\x22\x00\x00\x00")

func mysql000002_create_team_membersDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000002_create_team_membersDownSql,
		"mysql/000002_create_team_members.down.sql",
	)
}

func mysql000002_create_team_membersDownSql() (*asset, error) {
	bytes, err := mysql000002_create_team_membersDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000002_create_team_members.down.sql", size: 34, mode: os.FileMode(420), modTime: time.Unix(1613479946, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _mysql000002_create_team_membersUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x84\x8f\x41\x4b\xc3\x40\x10\x85\xef\xf9\x15\xef\x98\x40\x0f\x52\x4a\x11\xa4\x87\x6d\x33\xd5\xc5\x34\xca\x66\x03\xf6\x14\x36\x66\xd4\x40\x37\x85\xcd\x56\xfc\xf9\xe2\x66\x15\xf5\xd0\xde\x86\x79\xdf\xc7\x9b\xd9\x28\x12\x9a\xa0\xc5\xba\x20\xc8\x2d\xca\x07\x0d\x7a\x92\x95\xae\xa0\xd9\xd8\x1d\xdb\x96\xdd\x88\x34\x01\x10\x36\xb2\xc3\xbb\x71\xcf\x6f\xc6\xa5\xf3\x65\x16\xf8\xb2\x2e\x8a\x59\x00\xea\x91\xdd\x59\x40\x1d\x0f\x3c\xfe\xe4\xcb\x45\x36\xad\x73\x3e\xb0\x67\xe1\xd1\xf6\xaf\xfd\xe0\xd3\xf9\x55\x0c\x1e\x95\xdc\x09\xb5\xc7\x3d\xed\x91\x4e\xf5\xb3\xd8\x12\x89\xaf\xa4\xef\x3e\x1a\xcf\xc6\xda\xe9\xda\x30\x37\x7d\xf7\xfb\x83\x28\x9f\x91\x4e\x23\xbb\xff\xd2\xc5\xa6\x2e\x1c\xde\x18\xff\x47\xfb\x7e\x27\x4b\x32\x50\x79\x2b\x4b\x5a\xc9\x61\x38\xe6\x6b\xe4\xb4\x15\x75\xa1\xb1\xb9\x13\xaa\x22\xbd\x3a\xf9\x97\x6b\xdb\x2e\x6e\x92\xcf\x00\x00\x00\xff\xff\xe4\x30\x63\x35\x88\x01\x00\x00")

func mysql000002_create_team_membersUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_mysql000002_create_team_membersUpSql,
		"mysql/000002_create_team_members.up.sql",
	)
}

func mysql000002_create_team_membersUpSql() (*asset, error) {
	bytes, err := mysql000002_create_team_membersUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "mysql/000002_create_team_members.up.sql", size: 392, mode: os.FileMode(420), modTime: time.Unix(1613482436, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_teamsDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x09\xf2\x0f\x50\xf0\xf4\x73\x71\x8d\x50\xf0\x74\x53\x70\x8d\xf0\x0c\x0e\x09\x56\xc8\x4c\xa9\x88\x2f\x49\x4d\xcc\x2d\x8e\xcf\x4b\xcc\x4d\xb5\xe6\x22\xa0\x28\x33\xaf\x2c\xb3\x24\x35\x3e\x33\x85\xa0\xca\xd2\x82\x94\xc4\x92\xd4\xf8\xc4\x12\x82\x2a\x93\x8b\x52\x89\x54\x99\x92\x9a\x93\x4a\x9c\xca\xe2\xe4\x8c\xd4\x5c\x88\x3b\x21\x4a\x43\x1c\x9d\x7c\x5c\x91\x94\x86\x80\x94\x59\x73\x01\x02\x00\x00\xff\xff\x6a\xff\x00\xcc\x14\x01\x00\x00")

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

	info := bindataFileInfo{name: "postgres/000001_create_teams.down.sql", size: 276, mode: os.FileMode(420), modTime: time.Unix(1613482913, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x8c\x91\xcd\x4e\xc3\x30\x10\x84\xef\x79\x8a\x3d\xd6\x12\x87\x52\x68\x85\x94\x53\x28\x46\x44\x40\x0a\x69\x8a\xda\x53\x64\xe2\x15\xac\x14\x3b\x51\x63\x7e\xfa\xf6\x88\xd8\x6e\x13\x5a\xa4\x5c\x67\xd7\xdf\x7a\x66\xe6\x29\x8f\x32\x0e\x59\x74\xfd\xc0\x21\xbe\x85\x64\x91\x01\x5f\xc7\xcb\x6c\x09\x06\x85\x6a\x60\x14\x00\x00\x90\x84\x97\x28\x9d\xdf\x45\xe9\x68\x32\x63\xf0\x94\xc6\x8f\x51\xba\x81\x7b\xbe\x39\x6b\xe7\x92\x9a\xba\x14\x3b\x2d\x14\xee\x17\x67\x97\xcc\x0e\x4f\xab\x12\x9b\x62\x4b\xb5\xa1\x4a\x1f\xd8\xd3\xa9\x9b\xa2\x12\x54\xee\xf5\xf3\xc9\x95\xd3\xcd\xae\xc6\x13\xeb\x45\xa5\x6a\xa1\xff\xb9\x2f\xca\xb2\xfa\x42\x29\x2b\x25\x48\x37\x07\xe8\x78\x3c\x76\x1b\xa4\x3f\xc9\x60\xc7\xe4\xc5\xc4\x4d\x9a\xe2\x1d\x15\xf6\xed\xbb\x93\x5b\x14\x06\x85\x81\x57\x7a\x23\x6d\xac\xf8\x51\xcb\x63\x51\x62\x89\x47\xe2\x2a\x89\x9f\x57\x7c\xf4\xfb\x63\x16\xb0\x30\x08\x5c\x13\x71\x72\xc3\xd7\x7f\x9a\x20\xf9\x9d\xb7\x6d\xe4\xad\xc1\x45\xe2\xbb\x69\x5f\x43\x38\xec\xad\x35\x99\x93\xec\x00\xbc\x71\x36\x90\x61\xfd\xe5\xc2\x74\x18\xde\xf3\x50\x86\x0d\xae\xcf\xf0\x61\x0e\x65\xd8\x48\xfb\x0c\x1f\xf3\x50\x86\xad\xb6\x9f\x87\xaf\x9b\x85\xc1\x4f\x00\x00\x00\xff\xff\x8c\xdf\x4c\xd8\x1a\x03\x00\x00")

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

	info := bindataFileInfo{name: "postgres/000001_create_teams.up.sql", size: 794, mode: os.FileMode(420), modTime: time.Unix(1613482809, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000002_create_team_membersDownSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x72\x09\xf2\x0f\x50\xf0\xf4\x73\x71\x8d\x50\xf0\x74\x53\x70\x8d\xf0\x0c\x0e\x09\x56\xc8\x4c\xa9\x88\x2f\x49\x4d\xcc\xcd\x4d\xcd\x4d\x4a\x2d\x2a\x06\xb3\xe3\x33\x53\xac\xb9\x88\x52\x5d\x5a\x9c\x5a\x44\xbc\xea\x94\xd4\x9c\xd4\x92\xd4\xf8\xc4\x12\x6b\x2e\x88\x86\x10\x47\x27\x1f\x57\x24\x0d\x21\xa9\x89\xb9\xbe\x10\xc5\xd6\x5c\x80\x00\x00\x00\xff\xff\x15\x7f\x6d\xa7\xaf\x00\x00\x00")

func postgres000002_create_team_membersDownSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000002_create_team_membersDownSql,
		"postgres/000002_create_team_members.down.sql",
	)
}

func postgres000002_create_team_membersDownSql() (*asset, error) {
	bytes, err := postgres000002_create_team_membersDownSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000002_create_team_members.down.sql", size: 175, mode: os.FileMode(420), modTime: time.Unix(1613483044, 0)}
	a := &asset{bytes: bytes, info: info}
	return a, nil
}

var _postgres000002_create_team_membersUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x94\x90\xc1\x6a\x84\x30\x10\x86\xef\x79\x8a\x39\x1a\xf0\x54\x8a\x17\x4f\xa9\x4d\x69\xa8\xc6\x12\xd3\xa2\x27\x89\x64\x28\x01\xd3\x82\xa6\xd0\xc7\x2f\x4d\xb4\x2c\xbb\xcb\x82\xb7\xf0\xe7\xe7\x9b\x6f\xa6\x52\x9c\x69\x0e\x9a\x3d\xd4\x1c\xc4\x13\xc8\x56\x03\xef\x45\xa7\x3b\x08\x68\xbc\x47\x3f\xe1\xb2\x42\x46\x00\x20\x26\xce\xc2\x3b\x53\xd5\x33\x53\xd9\x5d\x41\x63\x5f\xbe\xd5\x75\x1e\x0b\xdf\x2b\x2e\x37\x0b\xcb\xd7\x8c\xeb\xff\x7f\x71\x4f\x53\x6c\x71\xc6\x80\x26\xc0\xe4\x3e\xdc\x67\x48\xe1\xab\x12\x0d\x53\x03\xbc\xf0\x01\xb2\x34\x3a\xdf\x26\x50\x42\x4b\x42\x36\x77\x21\x1f\x79\x7f\xe6\xee\xec\xcf\x78\xe2\x1f\xdf\xa3\xb3\xd0\x4a\xd0\x68\x7c\xb3\xaf\x95\xb0\xb4\x3c\xc2\xfa\x53\xb8\xc6\xda\xd4\x0e\xb1\xd2\xe2\xa3\x09\x17\xb4\xfd\x24\xb4\x24\xbf\x01\x00\x00\xff\xff\x55\x56\x1d\xce\xa4\x01\x00\x00")

func postgres000002_create_team_membersUpSqlBytes() ([]byte, error) {
	return bindataRead(
		_postgres000002_create_team_membersUpSql,
		"postgres/000002_create_team_members.up.sql",
	)
}

func postgres000002_create_team_membersUpSql() (*asset, error) {
	bytes, err := postgres000002_create_team_membersUpSqlBytes()
	if err != nil {
		return nil, err
	}

	info := bindataFileInfo{name: "postgres/000002_create_team_members.up.sql", size: 420, mode: os.FileMode(420), modTime: time.Unix(1613483002, 0)}
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
	"mysql/000001_create_teams.down.sql":           mysql000001_create_teamsDownSql,
	"mysql/000001_create_teams.up.sql":             mysql000001_create_teamsUpSql,
	"mysql/000002_create_team_members.down.sql":    mysql000002_create_team_membersDownSql,
	"mysql/000002_create_team_members.up.sql":      mysql000002_create_team_membersUpSql,
	"postgres/000001_create_teams.down.sql":        postgres000001_create_teamsDownSql,
	"postgres/000001_create_teams.up.sql":          postgres000001_create_teamsUpSql,
	"postgres/000002_create_team_members.down.sql": postgres000002_create_team_membersDownSql,
	"postgres/000002_create_team_members.up.sql":   postgres000002_create_team_membersUpSql,
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
		"000001_create_teams.down.sql":        &bintree{mysql000001_create_teamsDownSql, map[string]*bintree{}},
		"000001_create_teams.up.sql":          &bintree{mysql000001_create_teamsUpSql, map[string]*bintree{}},
		"000002_create_team_members.down.sql": &bintree{mysql000002_create_team_membersDownSql, map[string]*bintree{}},
		"000002_create_team_members.up.sql":   &bintree{mysql000002_create_team_membersUpSql, map[string]*bintree{}},
	}},
	"postgres": &bintree{nil, map[string]*bintree{
		"000001_create_teams.down.sql":        &bintree{postgres000001_create_teamsDownSql, map[string]*bintree{}},
		"000001_create_teams.up.sql":          &bintree{postgres000001_create_teamsUpSql, map[string]*bintree{}},
		"000002_create_team_members.down.sql": &bintree{postgres000002_create_team_membersDownSql, map[string]*bintree{}},
		"000002_create_team_members.up.sql":   &bintree{postgres000002_create_team_membersUpSql, map[string]*bintree{}},
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
