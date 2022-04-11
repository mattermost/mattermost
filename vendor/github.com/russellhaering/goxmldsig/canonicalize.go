package dsig

import (
	"sort"

	"github.com/beevik/etree"
	"github.com/russellhaering/goxmldsig/etreeutils"
)

// Canonicalizer is an implementation of a canonicalization algorithm.
type Canonicalizer interface {
	Canonicalize(el *etree.Element) ([]byte, error)
	Algorithm() AlgorithmID
}

type NullCanonicalizer struct {
}

func MakeNullCanonicalizer() Canonicalizer {
	return &NullCanonicalizer{}
}

func (c *NullCanonicalizer) Algorithm() AlgorithmID {
	return AlgorithmID("NULL")
}

func (c *NullCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope, false, true))
}

type c14N10ExclusiveCanonicalizer struct {
	prefixList string
	comments   bool
}

// MakeC14N10ExclusiveCanonicalizerWithPrefixList constructs an exclusive Canonicalizer
// from a PrefixList in NMTOKENS format (a white space separated list).
func MakeC14N10ExclusiveCanonicalizerWithPrefixList(prefixList string) Canonicalizer {
	return &c14N10ExclusiveCanonicalizer{
		prefixList: prefixList,
		comments:   false,
	}
}

// MakeC14N10ExclusiveWithCommentsCanonicalizerWithPrefixList constructs an exclusive Canonicalizer
// from a PrefixList in NMTOKENS format (a white space separated list).
func MakeC14N10ExclusiveWithCommentsCanonicalizerWithPrefixList(prefixList string) Canonicalizer {
	return &c14N10ExclusiveCanonicalizer{
		prefixList: prefixList,
		comments:   true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10ExclusiveCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	err := etreeutils.TransformExcC14n(el, c.prefixList, c.comments)
	if err != nil {
		return nil, err
	}

	return canonicalSerialize(el)
}

func (c *c14N10ExclusiveCanonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML10ExclusiveWithCommentsAlgorithmId
	}
	return CanonicalXML10ExclusiveAlgorithmId
}

type c14N11Canonicalizer struct {
	comments bool
}

// MakeC14N11Canonicalizer constructs an inclusive canonicalizer.
func MakeC14N11Canonicalizer() Canonicalizer {
	return &c14N11Canonicalizer{
		comments: false,
	}
}

// MakeC14N11WithCommentsCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N11WithCommentsCanonicalizer() Canonicalizer {
	return &c14N11Canonicalizer{
		comments: true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N11Canonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope, true, c.comments))
}

func (c *c14N11Canonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML11WithCommentsAlgorithmId
	}
	return CanonicalXML11AlgorithmId
}

type c14N10RecCanonicalizer struct {
	comments bool
}

// MakeC14N10RecCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10RecCanonicalizer() Canonicalizer {
	return &c14N10RecCanonicalizer{
		comments: false,
	}
}

// MakeC14N10WithCommentsCanonicalizer constructs an inclusive canonicalizer.
func MakeC14N10WithCommentsCanonicalizer() Canonicalizer {
	return &c14N10RecCanonicalizer{
		comments: true,
	}
}

// Canonicalize transforms the input Element into a serialized XML document in canonical form.
func (c *c14N10RecCanonicalizer) Canonicalize(el *etree.Element) ([]byte, error) {
	scope := make(map[string]struct{})
	return canonicalSerialize(canonicalPrep(el, scope, true, c.comments))
}

func (c *c14N10RecCanonicalizer) Algorithm() AlgorithmID {
	if c.comments {
		return CanonicalXML10WithCommentsAlgorithmId
	}
	return CanonicalXML10RecAlgorithmId

}

func composeAttr(space, key string) string {
	if space != "" {
		return space + ":" + key
	}

	return key
}

type c14nSpace struct {
	a    etree.Attr
	used bool
}

const nsSpace = "xmlns"

// canonicalPrep accepts an *etree.Element and transforms it into one which is ready
// for serialization into inclusive canonical form. Specifically this
// entails:
//
// 1. Stripping re-declarations of namespaces
// 2. Sorting attributes into canonical order
//
// Inclusive canonicalization does not strip unused namespaces.
//
// TODO(russell_h): This is very similar to excCanonicalPrep - perhaps they should
// be unified into one parameterized function?
func canonicalPrep(el *etree.Element, seenSoFar map[string]struct{}, strip bool, comments bool) *etree.Element {
	_seenSoFar := make(map[string]struct{})
	for k, v := range seenSoFar {
		_seenSoFar[k] = v
	}

	ne := el.Copy()
	sort.Sort(etreeutils.SortedAttrs(ne.Attr))
	n := 0
	for _, attr := range ne.Attr {
		if attr.Space != nsSpace {
			ne.Attr[n] = attr
			n++
			continue
		}
		key := attr.Space + ":" + attr.Key
		if _, seen := _seenSoFar[key]; !seen {
			ne.Attr[n] = attr
			n++
			_seenSoFar[key] = struct{}{}
		}
	}
	ne.Attr = ne.Attr[:n]

	if !comments {
		c := 0
		for c < len(ne.Child) {
			if _, ok := ne.Child[c].(*etree.Comment); ok {
				ne.RemoveChildAt(c)
			} else {
				c++
			}
		}
	}

	for i, token := range ne.Child {
		childElement, ok := token.(*etree.Element)
		if ok {
			ne.Child[i] = canonicalPrep(childElement, _seenSoFar, strip, comments)
		}
	}

	return ne
}

func canonicalSerialize(el *etree.Element) ([]byte, error) {
	doc := etree.NewDocument()
	doc.SetRoot(el.Copy())

	doc.WriteSettings = etree.WriteSettings{
		CanonicalAttrVal: true,
		CanonicalEndTags: true,
		CanonicalText:    true,
	}

	return doc.WriteToBytes()
}
