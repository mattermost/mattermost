# filetype [![Build Status](https://travis-ci.org/h2non/filetype.png)](https://travis-ci.org/h2non/filetype) [![GoDoc](https://godoc.org/github.com/h2non/filetype?status.svg)](https://godoc.org/github.com/h2non/filetype) [![Go Report Card](http://goreportcard.com/badge/h2non/filetype)](http://goreportcard.com/report/h2non/filetype) [![Go Version](https://img.shields.io/badge/go-v1.0+-green.svg?style=flat)](https://github.com/h2non/gentleman)

Small and dependency free [Go](https://golang.org) package to infer file and MIME type checking the [magic numbers](https://en.wikipedia.org/wiki/Magic_number_(programming)#Magic_numbers_in_files) signature.

For SVG file type checking, see [go-is-svg](https://github.com/h2non/go-is-svg) package.

## Features

- Supports a [wide range](#supported-types) of file types
- Provides file extension and proper MIME type
- File discovery by extension or MIME type
- File discovery by class (image, video, audio...)
- Provides a bunch of helpers and file matching shortcuts
- [Pluggable](#add-additional-file-type-matchers): add custom new types and matchers
- Simple and semantic API
- [Blazing fast](#benchmarks), even processing large files
- Only first 262 bytes representing the max file header is required, so you can just [pass a slice](#file-header)
- Dependency free (just Go code, no C compilation needed)
- Cross-platform file recognition

## Installation

```bash
go get github.com/h2non/filetype
```

## API

See [Godoc](https://godoc.org/github.com/h2non/filetype) reference.

### Subpackages

- [`github.com/h2non/filetype/types`](https://godoc.org/github.com/h2non/filetype/types)
- [`github.com/h2non/filetype/matchers`](https://godoc.org/github.com/h2non/filetype/matchers)

## Examples

#### Simple file type checking

```go
package main

import (
  "fmt"
  "io/ioutil"

  "github.com/h2non/filetype"
)

func main() {
  buf, _ := ioutil.ReadFile("sample.jpg")

  kind, _ := filetype.Match(buf)
  if kind == filetype.Unknown {
    fmt.Println("Unknown file type")
    return
  }

  fmt.Printf("File type: %s. MIME: %s\n", kind.Extension, kind.MIME.Value)
}
```

#### Check type class

```go
package main

import (
  "fmt"
  "io/ioutil"

  "github.com/h2non/filetype"
)

func main() {
  buf, _ := ioutil.ReadFile("sample.jpg")

  if filetype.IsImage(buf) {
    fmt.Println("File is an image")
  } else {
    fmt.Println("Not an image")
  }
}
```

#### Supported type

```go
package main

import (
  "fmt"

  "github.com/h2non/filetype"
)

func main() {
  // Check if file is supported by extension
  if filetype.IsSupported("jpg") {
    fmt.Println("Extension supported")
  } else {
    fmt.Println("Extension not supported")
  }

  // Check if file is supported by extension
  if filetype.IsMIMESupported("image/jpeg") {
    fmt.Println("MIME type supported")
  } else {
    fmt.Println("MIME type not supported")
  }
}
```

#### File header

```go
package main

import (
  "fmt"
  "io/ioutil"
  
  "github.com/h2non/filetype"
)

func main() {
  // Open a file descriptor
  file, _ := os.Open("movie.mp4")

  // We only have to pass the file header = first 261 bytes
  head := make([]byte, 261)
  file.Read(head)

  if filetype.IsImage(head) {
    fmt.Println("File is an image")
  } else {
    fmt.Println("Not an image")
  }
}
```

#### Add additional file type matchers

```go
package main

import (
  "fmt"
  
  "github.com/h2non/filetype"
)

var fooType = filetype.NewType("foo", "foo/foo")

func fooMatcher(buf []byte) bool {
  return len(buf) > 1 && buf[0] == 0x01 && buf[1] == 0x02
}

func main() {
  // Register the new matcher and its type
  filetype.AddMatcher(fooType, fooMatcher)

  // Check if the new type is supported by extension
  if filetype.IsSupported("foo") {
    fmt.Println("New supported type: foo")
  }

  // Check if the new type is supported by MIME
  if filetype.IsMIMESupported("foo/foo") {
    fmt.Println("New supported MIME type: foo/foo")
  }

  // Try to match the file
  fooFile := []byte{0x01, 0x02}
  kind, _ := filetype.Match(fooFile)
  if kind == filetype.Unknown {
    fmt.Println("Unknown file type")
  } else {
    fmt.Printf("File type matched: %s\n", kind.Extension)
  }
}
```

## Supported types

#### Image

- **jpg** - `image/jpeg`
- **png** - `image/png`
- **gif** - `image/gif`
- **webp** - `image/webp`
- **cr2** - `image/x-canon-cr2`
- **tif** - `image/tiff`
- **bmp** - `image/bmp`
- **heif** - `image/heif`
- **jxr** - `image/vnd.ms-photo`
- **psd** - `image/vnd.adobe.photoshop`
- **ico** - `image/x-icon`
- **dwg** - `image/vnd.dwg`

#### Video

- **mp4** - `video/mp4`
- **m4v** - `video/x-m4v`
- **mkv** - `video/x-matroska`
- **webm** - `video/webm`
- **mov** - `video/quicktime`
- **avi** - `video/x-msvideo`
- **wmv** - `video/x-ms-wmv`
- **mpg** - `video/mpeg`
- **flv** - `video/x-flv`
- **3gp** - `video/3gpp`

#### Audio

- **mid** - `audio/midi`
- **mp3** - `audio/mpeg`
- **m4a** - `audio/m4a`
- **ogg** - `audio/ogg`
- **flac** - `audio/x-flac`
- **wav** - `audio/x-wav`
- **amr** - `audio/amr`
- **aac** - `audio/aac`

#### Archive

- **epub** - `application/epub+zip`
- **zip** - `application/zip`
- **tar** - `application/x-tar`
- **rar** - `application/x-rar-compressed`
- **gz** - `application/gzip`
- **bz2** - `application/x-bzip2`
- **7z** - `application/x-7z-compressed`
- **xz** - `application/x-xz`
- **pdf** - `application/pdf`
- **exe** - `application/x-msdownload`
- **swf** - `application/x-shockwave-flash`
- **rtf** - `application/rtf`
- **iso** - `application/x-iso9660-image`
- **eot** - `application/octet-stream`
- **ps** - `application/postscript`
- **sqlite** - `application/x-sqlite3`
- **nes** - `application/x-nintendo-nes-rom`
- **crx** - `application/x-google-chrome-extension`
- **cab** - `application/vnd.ms-cab-compressed`
- **deb** - `application/x-deb`
- **ar** - `application/x-unix-archive`
- **Z** - `application/x-compress`
- **lz** - `application/x-lzip`
- **rpm** - `application/x-rpm`
- **elf** - `application/x-executable`
- **dcm** - `application/dicom`

#### Documents

- **doc** - `application/msword`
- **docx** - `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- **xls** - `application/vnd.ms-excel`
- **xlsx** - `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- **ppt** - `application/vnd.ms-powerpoint`
- **pptx** - `application/vnd.openxmlformats-officedocument.presentationml.presentation`

#### Font

- **woff** - `application/font-woff`
- **woff2** - `application/font-woff`
- **ttf** - `application/font-sfnt`
- **otf** - `application/font-sfnt`

#### Application

- **wasm** - `application/wasm`

## Benchmarks

Measured using [real files](https://github.com/h2non/filetype/tree/master/fixtures).

Environment: OSX x64 i7 2.7 Ghz

```bash
BenchmarkMatchTar-8    1000000        1083 ns/op
BenchmarkMatchZip-8    1000000        1162 ns/op
BenchmarkMatchJpeg-8   1000000        1280 ns/op
BenchmarkMatchGif-8    1000000        1315 ns/op
BenchmarkMatchPng-8    1000000        1121 ns/op
```

## License

MIT - Tomas Aparicio
