# GOvatar
[![License](http://img.shields.io/:license-mit-blue.svg)](LICENSE)
[![GoDoc](https://godoc.org/github.com/o1egl/govatar?status.svg)](https://godoc.org/github.com/o1egl/govatar)
[![Build Status](http://img.shields.io/travis/o1egl/govatar.svg?style=flat-square)](https://travis-ci.org/o1egl/govatar)
[![Coverage Status](http://img.shields.io/coveralls/o1egl/govatar.svg?style=flat-square)](https://coveralls.io/r/o1egl/govatar)
[![Go Report Card](https://goreportcard.com/badge/github.com/o1egl/govatar)](https://goreportcard.com/report/github.com/o1egl/govatar)

![GOvatar image](files/avatars.jpg)

GOvatar is an avatar generation library writen in GO

## Install

To install the library and command line program, use the following:

```
$ go get -u github.com/o1egl/govatar/...
```

[Binary packages](https://github.com/o1egl/govatar/releases) are available for Mac, Linux and Windows.

## Usage

```bash
    $ govatar generate male -o avatar.png                        # Generates random avatar.png for male
    $ govatar generate female -o avatar.png                      # Generates random avatar.png for female
    $ govatar generate male -u username@site.com -o avatar.png   # Generates avatar.png for specified username
    $ govatar -h                                                 # Display help message
```

#### As lib

Generates avatar and save it to filePath

```go
    err := govatar.GenerateFile(govatar.MALE, "/path/to/avatar.jpg"
    err := govatar.GenerateFileFromUsername(govatar.MALE, "username", "/path/to/avatar.jpg")
````

Generates avatar and return it as image.Image

```go
    img, err := govatar.Generate(govatar.MALE)
    img, err := govatar.GenerateFromUsername(govatar.MALE, "username")
````


## Copyright, License & Contributors

### Adding new skins

1. Add new skins to background, male/clothes, female/hair and etc...
2. Run ``$ make assets`` for building embedded assets.
3. Submit pull request :)

### Submitting a Pull Request

1. Fork it.
2. Create a branch (`git checkout -b my_branch`)
3. Commit your changes (`git commit -am "Added new awesome avatars"`)
4. Push to the branch (`git push origin my_branch`)
5. Open a [Pull Request](https://github.com/o1egl/govatar/pulls)
6. Enjoy a refreshing Diet Coke and wait

GOvatar is released under the MIT license. See [LICENSE](LICENSE)
