package model

import (
	"encoding/xml"
)

type SVGInfo struct {
	XMLName xml.Name `xml:"svg"`
	Width   string   `xml:"width,attr,omitempty"`
	Height  string   `xml:"height,attr,omitempty"`
	ViewBox string   `xml:"viewBox,attr,omitempty"`
}

func GetSVGInfoForBytes(data []byte) *SVGInfo {
	var svgInfo SVGInfo
	xml.Unmarshal(data, &svgInfo)
	return &svgInfo
}
