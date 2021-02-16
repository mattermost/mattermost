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

var _mysql000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x8c\x92\x4f\x4f\x83\x40\x10\xc5\xef\xfd\x14\x73\x84\xc4\x83\x62\xdb\x34\x31\x3d\x50\xd8\xea\x46\xa4\xca\x9f\xc4\x9e\xc8\x16\x46\xbb\x09\xec\x12\xd8\xd6\xf6\xdb\x1b\x96\x52\x1b\x45\xe5\xc2\x61\xdf\x8f\xc9\xbc\x79\xcf\x09\x88\x1d\x11\x88\xec\x85\x47\x80\x2e\xc1\x5f\x45\x40\x5e\x69\x18\x85\x10\x21\x2b\x6a\x30\x46\x00\x00\x34\x83\x3d\xab\xd2\x2d\xab\x0c\x6b\x6a\x6a\xca\x8f\x3d\xef\x4a\x8b\x4e\x85\x4c\xa1\xad\x60\xc3\xdf\xb9\x50\x86\x75\x6d\x82\x4b\x96\x76\xec\x5d\x52\x71\x99\x0d\xa0\x5c\xcc\x71\x00\xc5\xeb\x32\x67\x47\x9f\x15\x78\xde\x6b\x3a\xee\x23\x07\x20\x2e\xd6\x69\xc5\x4b\xc5\xa5\xf8\x32\x39\x99\xf4\xa1\xa4\x60\x3c\x3f\x43\x37\xd6\xac\x0f\x8a\x8e\x25\xfe\x37\xc8\x91\x45\xc9\xc4\x10\x03\x76\x9e\xcb\x0f\xcc\x5c\x59\x30\x2e\x6a\x50\x78\x50\xad\x40\xc5\x9e\x2b\xbc\x08\xe6\xd6\xfa\xf5\xff\x55\x89\xa2\xe5\x61\x23\x65\xde\x2a\x1e\xab\x55\x93\x31\x4d\xa5\x68\xc3\x39\x1d\xbd\x95\xc3\x74\x8b\x05\x7e\x0b\xfe\xe7\xfc\xe7\x80\x3e\xd9\xc1\x1a\x1e\xc9\x1a\x0c\x9a\x99\xa7\xb0\x7d\xfa\x12\x13\xfd\xa8\x3d\x1a\xcd\xf7\xa4\x35\x8f\x3c\x3b\x24\xaa\xe9\x57\x22\xfe\x96\xb9\xde\x3a\xe1\x19\x18\x9d\xe1\x5e\x6e\xa7\x0d\x24\x4c\x81\xd1\x15\xad\x97\x4b\x75\x57\x35\xd7\xd5\xb6\x97\xcb\x74\x0f\x35\xd7\x55\xb2\x97\xab\xf5\x95\xf4\x7e\xdd\xc1\xcc\x91\x09\xc4\xbf\xa7\x3e\x99\x53\x21\xa4\xbb\x38\x5f\xcd\x79\xb0\x83\x90\x44\xf3\x9d\x7a\x9b\x15\x9b\xf1\xdd\xe8\x33\x00\x00\xff\xff\xa5\x1d\x95\x0c\x7e\x03\x00\x00")

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

	info := bindataFileInfo{name: "mysql/000001_create_teams.up.sql", size: 894, mode: os.FileMode(420), modTime: time.Unix(1613493296, 0)}
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

var _mysql000002_create_team_membersUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x84\x90\x41\x4b\xc3\x30\x14\xc7\xef\xfd\x14\xef\xd8\xc2\x0e\x32\xca\x10\x64\x87\x6c\xcd\x66\xb0\xab\x92\xa6\xe0\x4e\x25\x5d\x9e\x2e\xb0\x64\x90\xa4\xa2\xdf\x5e\x9a\x76\x82\x88\xdb\x2d\xbc\xdf\x2f\x8f\xf7\xff\xaf\x39\x25\x82\x82\x20\xab\x92\x02\xdb\x40\xf5\x2c\x80\xbe\xb2\x5a\xd4\x20\x50\x9a\x1d\x9a\x0e\x9d\x87\x34\x01\x80\x38\x61\x0a\x3e\xa4\x3b\x1c\xa5\x4b\xe7\x8b\x2c\xfa\x55\x53\x96\xb3\x28\x34\x1e\xdd\x55\x81\x9f\x4f\xe8\x7f\xf8\x22\xcf\xc6\x71\x81\x27\x0c\x48\x02\x74\xfa\x5d\xdb\x90\xce\xef\x26\x50\x1f\x8e\x68\x70\x58\x0b\x41\xdb\xaf\x81\xe5\xbf\x10\x51\x46\xdb\x7f\xd8\xb6\x47\x1f\xfe\xb0\x17\xce\x76\x84\xef\xe1\x89\xee\x21\x1d\x13\xcd\xa6\xc3\x27\x63\x20\x5a\x7d\xb6\x01\xa5\x31\x63\x01\xf1\xdd\x6a\x75\xf9\x71\xc5\xec\x3d\xba\x68\xde\xdc\xa9\x62\xea\x56\x06\x48\x2f\x05\x64\x49\x06\xb4\xda\xb2\x8a\x2e\x99\xb5\xe7\x62\x05\x05\xdd\x90\xa6\x14\xb0\x7e\x24\xbc\xa6\x62\xd9\x87\xb7\x7b\xd3\xe5\x0f\xc9\x77\x00\x00\x00\xff\xff\xbc\xbe\xa9\x49\xba\x01\x00\x00")

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

	info := bindataFileInfo{name: "mysql/000002_create_team_members.up.sql", size: 442, mode: os.FileMode(420), modTime: time.Unix(1613493440, 0)}
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

var _postgres000001_create_teamsUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x8c\x92\xcf\x4f\xbb\x40\x10\xc5\xef\xfc\x15\x73\x2c\xc9\xf7\xd0\x6f\xb5\x8d\x49\x4f\x58\xd7\x48\x54\xaa\x94\x9a\xf6\x44\x46\x76\xa2\x93\x2c\xbb\xa4\xac\x3f\xfa\xdf\x1b\x58\x68\xa1\xd6\x84\xeb\x7b\x33\x1f\x78\x6f\x76\x11\x8b\x20\x11\x90\x04\xd7\x0f\x02\xc2\x5b\x88\x96\x09\x88\x4d\xb8\x4a\x56\x60\x09\xf3\x12\x46\x1e\x00\x00\x4b\x78\x09\xe2\xc5\x5d\x10\x8f\x26\x33\x1f\x9e\xe2\xf0\x31\x88\xb7\x70\x2f\xb6\xff\x6a\x5f\x72\x59\x28\xdc\x6b\xcc\xe9\x30\x38\xbb\xf4\x9d\x79\x5e\x95\x54\x66\x3b\x2e\x2c\x1b\x7d\x64\x4f\xa7\x8d\x4b\x39\xb2\x3a\xe8\xff\x27\x57\x8d\x6e\xf7\x05\x9d\x19\xcf\x4c\x5e\xa0\xfe\xe3\xfb\xa8\x94\xf9\x22\x29\x4d\x8e\xac\xcb\x23\x74\x3c\x1e\x37\x13\xac\x3f\xd9\x52\x27\xe4\xc5\xa4\x71\xca\xec\x9d\x72\xea\xc7\xef\x50\x4d\x41\xda\x2d\xc3\xab\x31\x8a\x50\x3b\x53\x61\x69\xab\xfe\x38\x33\xfa\xa3\x90\x58\xf9\xfc\xc6\xda\x36\xbf\xbb\x23\xb4\x84\xb6\x27\xba\xb9\x13\x51\x92\xa2\x5f\xe2\x3a\x0a\x9f\xd7\x62\x54\xa5\xf5\x3d\x7f\xee\x79\xcd\x15\xc3\xe8\x46\x6c\x4e\xae\xc8\xf2\x3b\xad\x2f\x99\xd6\xe5\x2c\xa3\xf6\xae\xf5\x36\xcc\x87\xed\xba\x8c\x29\xcb\x0e\xa0\x2d\xcd\x1f\xc8\x70\xf9\x52\xb4\x1d\x46\x9b\x79\x28\xc3\x15\xd7\x67\xb4\x65\x0e\x65\xb8\x4a\xfb\x8c\xb6\xe6\xa1\x0c\xf7\x2c\xfa\x7d\xb4\x4f\xc5\x9f\x7b\x3f\x01\x00\x00\xff\xff\xdc\x66\x30\x93\x56\x03\x00\x00")

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

	info := bindataFileInfo{name: "postgres/000001_create_teams.up.sql", size: 854, mode: os.FileMode(420), modTime: time.Unix(1613490689, 0)}
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

var _postgres000002_create_team_membersUpSql = []byte("\x1f\x8b\x08\x00\x00\x00\x00\x00\x00\xff\x94\x90\x41\x4b\xc3\x30\x1c\xc5\xef\xf9\x14\xef\xd8\xc0\x4e\x22\xbb\xf4\x14\x67\xc4\x62\xd7\x49\x16\x65\x3b\x95\xd4\xfc\x99\x81\xa6\x85\x26\x03\x3f\xbe\xac\xe9\x64\xea\x18\xf4\x16\xde\xff\xf1\xe3\xe5\xb7\x52\x52\x68\x09\x2d\x1e\x4a\x89\xe2\x09\xd5\x46\x43\xee\x8a\xad\xde\x22\x92\xf1\x9e\x7c\x43\x43\x40\xc6\x00\x8c\x89\xb3\x78\x17\x6a\xf5\x2c\x54\x76\xb7\xe4\x63\xbf\x7a\x2b\xcb\xc5\x58\x38\x06\x1a\x6e\x16\x86\xbe\xa5\xf0\x73\x5f\xde\xf3\x14\x5b\x6a\x29\x92\x89\x68\xdc\xc1\x75\x31\x85\xe1\xe3\x93\x3c\x9d\x90\x68\xfa\xbe\x25\xd3\x5d\xe6\xc6\x7a\xd7\x5d\x3b\x1c\x8e\x14\xe2\xef\xc3\xab\x2a\xd6\x42\xed\xf1\x22\xf7\xc8\xd2\x27\x16\xd3\x56\xce\x78\xce\xd8\x64\xa1\xa8\x1e\xe5\xee\x8f\x05\x67\xbf\xea\x0b\x13\xe3\xbb\x76\x16\x9b\x0a\x9a\x8c\x5f\x9f\x05\x25\x2c\xcf\xe7\xb0\x4e\x13\xae\xb1\xa6\x69\xb3\x58\x49\x61\x6d\xe2\x3f\xda\x59\x2e\xcf\xd9\x77\x00\x00\x00\xff\xff\x54\x5b\x4a\x7f\xee\x01\x00\x00")

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

	info := bindataFileInfo{name: "postgres/000002_create_team_members.up.sql", size: 494, mode: os.FileMode(420), modTime: time.Unix(1613490256, 0)}
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
