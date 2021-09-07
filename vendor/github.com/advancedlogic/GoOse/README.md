# GoOse

*HTML Content / Article Extractor in Golang*

[![Build Status](https://secure.travis-ci.org/advancedlogic/GoOse.png?branch=master)](https://travis-ci.org/advancedlogic/GoOse?branch=master)
[![Coverage Status](https://coveralls.io/repos/advancedlogic/GoOse/badge.svg?branch=master&service=github)](https://coveralls.io/github/advancedlogic/GoOse?branch=master)
[![Go Report Card](https://goreportcard.com/badge/github.com/advancedlogic/GoOse)](https://goreportcard.com/report/github.com/advancedlogic/GoOse)
[![GoDoc](https://godoc.org/github.com/advancedlogic/GoOse?status.svg)](http://godoc.org/github.com/advancedlogic/GoOse)


## Description

This is a golang port of "Goose" originaly licensed to Gravity.com
under one or more contributor license agreements.  See the NOTICE file
distributed with this work for additional information
regarding copyright ownership.

Golang port was written by Antonio Linari

Gravity.com licenses this file
to you under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance
with the License.  You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.

## INSTALL

```bash
go get github.com/advancedlogic/GoOse
```

## HOW TO USE IT

```Go
package main

import (
	"github.com/advancedlogic/GoOse"
)

func main() {
	g := goose.New()
	article, _ := g.ExtractFromURL("http://edition.cnn.com/2012/07/08/opinion/banzi-ted-open-source/index.html")
	println("title", article.Title)
	println("description", article.MetaDescription)
	println("keywords", article.MetaKeywords)
	println("content", article.CleanedText)
	println("url", article.FinalURL)
	println("top image", article.TopImage)
}
```

## Development - Getting started

This application is written in GO language, please refere to the guides in https://golang.org for getting started.

This project include a Makefile that allows you to test and build the project with simple commands.
To see all available options:
```bash
make help
```

Before committing the code, please check if it passes all tests using
```bash
make deps
make qa
```

## TODO
- [ ] better organize code
- [ ] improve "xpath" like queries
- [ ] add other image extractions techniques (imagemagick)

## THANKS TO
```
@Martin Angers for goquery
@Fatih Arslan for set
GoLang team for the amazing language and net/html
```
