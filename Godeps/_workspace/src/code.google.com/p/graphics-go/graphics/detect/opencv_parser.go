// Copyright 2011 The Graphics-Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

package detect

import (
	"bytes"
	"encoding/xml"
	"errors"
	"fmt"
	"image"
	"io"
	"io/ioutil"
	"strconv"
	"strings"
)

type xmlFeature struct {
	Rects     []string `xml:"grp>feature>rects>grp"`
	Tilted    int      `xml:"grp>feature>tilted"`
	Threshold float64  `xml:"grp>threshold"`
	Left      float64  `xml:"grp>left_val"`
	Right     float64  `xml:"grp>right_val"`
}

type xmlStages struct {
	Trees           []xmlFeature `xml:"trees>grp"`
	Stage_threshold float64      `xml:"stage_threshold"`
	Parent          int          `xml:"parent"`
	Next            int          `xml:"next"`
}

type opencv_storage struct {
	Any struct {
		XMLName xml.Name
		Type    string      `xml:"type_id,attr"`
		Size    string      `xml:"size"`
		Stages  []xmlStages `xml:"stages>grp"`
	} `xml:",any"`
}

func buildFeature(r string) (f Feature, err error) {
	var x, y, w, h int
	var weight float64
	_, err = fmt.Sscanf(r, "%d %d %d %d %f", &x, &y, &w, &h, &weight)
	if err != nil {
		return
	}
	f.Rect = image.Rect(x, y, x+w, y+h)
	f.Weight = weight
	return
}

func buildCascade(s *opencv_storage) (c *Cascade, name string, err error) {
	if s.Any.Type != "opencv-haar-classifier" {
		err = fmt.Errorf("got %s want opencv-haar-classifier", s.Any.Type)
		return
	}
	name = s.Any.XMLName.Local

	c = &Cascade{}
	sizes := strings.Split(s.Any.Size, " ")
	w, err := strconv.Atoi(sizes[0])
	if err != nil {
		return nil, "", err
	}
	h, err := strconv.Atoi(sizes[1])
	if err != nil {
		return nil, "", err
	}
	c.Size = image.Pt(w, h)
	c.Stage = []CascadeStage{}

	for _, stage := range s.Any.Stages {
		cs := CascadeStage{
			Classifier: []Classifier{},
			Threshold:  stage.Stage_threshold,
		}
		for _, tree := range stage.Trees {
			if tree.Tilted != 0 {
				err = errors.New("Cascade does not support tilted features")
				return
			}

			cls := Classifier{
				Feature:   []Feature{},
				Threshold: tree.Threshold,
				Left:      tree.Left,
				Right:     tree.Right,
			}

			for _, rect := range tree.Rects {
				f, err := buildFeature(rect)
				if err != nil {
					return nil, "", err
				}
				cls.Feature = append(cls.Feature, f)
			}

			cs.Classifier = append(cs.Classifier, cls)
		}
		c.Stage = append(c.Stage, cs)
	}

	return
}

// ParseOpenCV produces a detection Cascade from an OpenCV XML file.
func ParseOpenCV(r io.Reader) (cascade *Cascade, name string, err error) {
	// BUG(crawshaw): tag-based parsing doesn't seem to work with <_>
	buf, err := ioutil.ReadAll(r)
	if err != nil {
		return
	}
	buf = bytes.Replace(buf, []byte("<_>"), []byte("<grp>"), -1)
	buf = bytes.Replace(buf, []byte("</_>"), []byte("</grp>"), -1)

	s := &opencv_storage{}
	err = xml.Unmarshal(buf, s)
	if err != nil {
		return
	}
	return buildCascade(s)
}
