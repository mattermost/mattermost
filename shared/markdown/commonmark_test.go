// Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
// See LICENSE.txt for license information.

package markdown

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCommonMarkReferenceStrings(t *testing.T) {
	// For the most part, we aim for CommonMark compliance with the features that we support. We
	// also support some GitHub flavored extensions.
	//
	// You can find most of the references used here: https://github.github.com/gfm/

	// CommonMark handles leading tabs that aren't on 4-character boundaries differently, so the
	// following reference strings will fail. The current implementation is much closer to our
	// webapp's behavior though, so I'm leaving it as is for now. It doesn't really impact anything
	// we use this package for anyways.
	//
	// "  \tfoo\tbaz\t\tbim\n": "<pre><code>foo\tbaz\t\tbim\n</code></pre>",
	// ">\t\tfoo":              "<blockquote><pre><code>   foo</code></pre></blockquote>",

	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		"0.28-gfm-1": {
			Markdown:     "\tfoo\tbaz\t\tbim\n",
			ExpectedHTML: "<pre><code>foo\tbaz\t\tbim\n</code></pre>",
		},
		"0.28-gfm-3": {
			Markdown:     "    a\ta\n    ὐ\ta\n",
			ExpectedHTML: "<pre><code>a\ta\nὐ\ta\n</code></pre>",
		},
		"0.28-gfm-4": {
			Markdown:     "  - foo\n\n\tbar\n",
			ExpectedHTML: "<ul><li><p>foo</p><p>bar</p></li></ul>",
		},
		"0.28-gfm-5": {
			Markdown:     "- foo\n\n\t\tbar",
			ExpectedHTML: "<ul><li><p>foo</p><pre><code>  bar</code></pre></li></ul>",
		},
		"0.28-gfm-8": {
			Markdown:     "    foo\n\tbar",
			ExpectedHTML: "<pre><code>foo\nbar</code></pre>",
		},
		"0.28-gfm-9": {
			Markdown:     " - foo\n   - bar\n\t - baz",
			ExpectedHTML: "<ul><li>foo<ul><li>bar<ul><li>baz</li></ul></li></ul></li></ul>",
		},
		"0.28-gfm-12": {
			Markdown:     "- `one\n- two`",
			ExpectedHTML: "<ul><li>`one</li><li>two`</li></ul>",
		},
		"0.28-gfm-76": {
			Markdown:     "    a simple\n      indented code block",
			ExpectedHTML: "<pre><code>a simple\n  indented code block</code></pre>",
		},
		"0.28-gfm-77": {
			Markdown:     "  - foo\n\n    bar",
			ExpectedHTML: "<ul><li><p>foo</p><p>bar</p></li></ul>",
		},
		"0.28-gfm-78": {
			Markdown:     "1.  foo\n\n    - bar",
			ExpectedHTML: "<ol><li><p>foo</p><ul><li>bar</li></ul></li></ol>",
		},
		"0.28-gfm-79": {
			Markdown:     "    <a/>\n    *hi*\n\n    - one",
			ExpectedHTML: "<pre><code>&lt;a/&gt;\n*hi*\n\n- one</code></pre>",
		},
		"0.28-gfm-80": {
			Markdown:     "    chunk1\n\n    chunk2\n  \n \n \n    chunk3",
			ExpectedHTML: "<pre><code>chunk1\n\nchunk2\n\n\n\nchunk3</code></pre>",
		},
		"0.28-gfm-81": {
			Markdown:     "    chunk1\n      \n      chunk2",
			ExpectedHTML: "<pre><code>chunk1\n  \n  chunk2</code></pre>",
		},
		"0.28-gfm-82": {
			Markdown:     "Foo\n    bar",
			ExpectedHTML: "<p>Foo\nbar</p>",
		},
		"0.28-gfm-83": {
			Markdown:     "    foo\nbar",
			ExpectedHTML: "<pre><code>foo\n</code></pre><p>bar</p>",
		},
		"0.28-gfm-85": {
			Markdown:     "        foo\n    bar",
			ExpectedHTML: "<pre><code>    foo\nbar</code></pre>",
		},
		"0.28-gfm-86": {
			Markdown:     "\n    \n    foo\n    ",
			ExpectedHTML: "<pre><code>foo\n</code></pre>",
		},
		"0.28-gfm-87": {
			Markdown:     "    foo  ",
			ExpectedHTML: "<pre><code>foo  </code></pre>",
		},
		"0.28-gfm-88": {
			Markdown:     "```\n<\n >\n```",
			ExpectedHTML: "<pre><code>&lt;\n &gt;\n</code></pre>",
		},
		"0.28-gfm-89": {
			Markdown:     "~~~\n<\n >\n~~~",
			ExpectedHTML: "<pre><code>&lt;\n &gt;\n</code></pre>",
		},
		"0.28-gfm-91": {
			Markdown:     "```\naaa\n~~~\n```",
			ExpectedHTML: "<pre><code>aaa\n~~~\n</code></pre>",
		},
		"0.28-gfm-92": {
			Markdown:     "~~~\naaa\n```\n~~~",
			ExpectedHTML: "<pre><code>aaa\n```\n</code></pre>",
		},
		"0.28-gfm-93": {
			Markdown:     "````\naaa\n```\n``````",
			ExpectedHTML: "<pre><code>aaa\n```\n</code></pre>",
		},
		"0.28-gfm-94": {
			Markdown:     "~~~~\naaa\n~~~\n~~~~",
			ExpectedHTML: "<pre><code>aaa\n~~~\n</code></pre>",
		},
		"0.28-gfm-95": {
			Markdown:     "```",
			ExpectedHTML: "<pre><code></code></pre>",
		},
		"0.28-gfm-96": {
			Markdown:     "`````\n\n```\naaa",
			ExpectedHTML: "<pre><code>\n```\naaa</code></pre>",
		},
		"0.28-gfm-97": {
			Markdown:     "> ```\n> aaa\n\nbbb",
			ExpectedHTML: "<blockquote><pre><code>aaa\n</code></pre></blockquote><p>bbb</p>",
		},
		"0.28-gfm-98": {
			Markdown:     "```\n\n  \n```",
			ExpectedHTML: "<pre><code>\n  \n</code></pre>",
		},
		"0.28-gfm-99": {
			Markdown:     "```\n```",
			ExpectedHTML: "<pre><code></code></pre>",
		},
		"0.28-gfm-100": {
			Markdown:     " ```\n aaa\naaa\n```",
			ExpectedHTML: "<pre><code>aaa\naaa\n</code></pre>",
		},
		"0.28-gfm-101": {
			Markdown:     "  ```\naaa\n  aaa\naaa\n  ```",
			ExpectedHTML: "<pre><code>aaa\naaa\naaa\n</code></pre>",
		},
		"0.28-gfm-102": {
			Markdown:     "   ```\n   aaa\n    aaa\n  aaa\n   ```",
			ExpectedHTML: "<pre><code>aaa\n aaa\naaa\n</code></pre>",
		},
		"0.28-gfm-103": {
			Markdown:     "    ```\n    aaa\n    ```",
			ExpectedHTML: "<pre><code>```\naaa\n```</code></pre>",
		},
		"0.28-gfm-104": {
			Markdown:     "```\naaa\n  ```",
			ExpectedHTML: "<pre><code>aaa\n</code></pre>",
		},
		"0.28-gfm-105": {
			Markdown:     "   ```\naaa\n  ```",
			ExpectedHTML: "<pre><code>aaa\n</code></pre>",
		},
		"0.28-gfm-106": {
			Markdown:     "```\naaa\n    ```",
			ExpectedHTML: "<pre><code>aaa\n    ```</code></pre>",
		},
		"0.28-gfm-108": {
			Markdown:     "~~~~~~\naaa\n~~~ ~~",
			ExpectedHTML: "<pre><code>aaa\n~~~ ~~</code></pre>",
		},
		"0.28-gfm-109": {
			Markdown:     "foo\n```\nbar\n```\nbaz",
			ExpectedHTML: "<p>foo</p><pre><code>bar\n</code></pre><p>baz</p>",
		},
		"0.28-gfm-111": {
			Markdown:     "```ruby\ndef foo(x)\n  return 3\nend\n```",
			ExpectedHTML: "<pre><code class=\"language-ruby\">def foo(x)\n  return 3\nend\n</code></pre>",
		},
		"0.28-gfm-112": {
			Markdown:     "```ruby startline=3 $%@#$\ndef foo(x)\n  return 3\nend\n```",
			ExpectedHTML: "<pre><code class=\"language-ruby\">def foo(x)\n  return 3\nend\n</code></pre>",
		},
		"0.28-gfm-113": {
			Markdown:     "````;\n````",
			ExpectedHTML: "<pre><code class=\"language-;\"></code></pre>",
		},
		"0.28-gfm-115": {
			Markdown:     "```\n``` aaa\n```",
			ExpectedHTML: "<pre><code>``` aaa\n</code></pre>",
		},
		"0.28-gfm-159": {
			Markdown:     "[foo]: /url \"title\"\n\n[foo]",
			ExpectedHTML: `<p><a href="/url" title="title">foo</a></p>`,
		},
		"0.28-gfm-160": {
			Markdown:     "   [foo]: \n      /url  \n           'the title'  \n\n[foo]",
			ExpectedHTML: `<p><a href="/url" title="the title">foo</a></p>`,
		},
		"0.28-gfm-161": {
			Markdown:     "[Foo*bar\\]]:my_(url) 'title (with parens)'\n\n[Foo*bar\\]]",
			ExpectedHTML: `<p><a href="my_(url)" title="title (with parens)">Foo*bar]</a></p>`,
		},
		"0.28-gfm-162": {
			Markdown:     "[Foo bar]:\n<my%20url>\n'title'\n\n[Foo bar]",
			ExpectedHTML: `<p><a href="my%20url" title="title">Foo bar</a></p>`,
		},
		"0.28-gfm-163": {
			Markdown:     "[foo]: /url '\ntitle\nline1\nline2\n'\n\n[foo]",
			ExpectedHTML: "<p><a href=\"/url\" title=\"\ntitle\nline1\nline2\n\">foo</a></p>",
		},
		"0.28-gfm-164": {
			Markdown:     "[foo]: /url 'title\n\nwith blank line'\n\n[foo]",
			ExpectedHTML: "<p>[foo]: /url 'title</p><p>with blank line'</p><p>[foo]</p>",
		},
		"0.28-gfm-165": {
			Markdown:     "[foo]:\n/url\n\n[foo]",
			ExpectedHTML: `<p><a href="/url">foo</a></p>`,
		},
		"0.28-gfm-166": {
			Markdown:     "[foo]:\n\n[foo]",
			ExpectedHTML: `<p>[foo]:</p><p>[foo]</p>`,
		},
		"0.28-gfm-167": {
			Markdown:     "[foo]: /url\\bar\\*baz \"foo\\\"bar\\baz\"\n\n[foo]",
			ExpectedHTML: `<p><a href="/url%5Cbar*baz" title="foo&quot;bar\baz">foo</a></p>`,
		},
		"0.28-gfm-168": {
			Markdown:     "[foo]\n\n[foo]: url",
			ExpectedHTML: `<p><a href="url">foo</a></p>`,
		},
		"0.28-gfm-169": {
			Markdown:     "[foo]\n\n[foo]: first\n[foo]: second",
			ExpectedHTML: `<p><a href="first">foo</a></p>`,
		},
		"0.28-gfm-170": {
			Markdown:     "[FOO]: /url\n\n[Foo]",
			ExpectedHTML: `<p><a href="/url">Foo</a></p>`,
		},
		"0.28-gfm-171": {
			Markdown:     "[ΑΓΩ]: /φου\n\n[αγω]",
			ExpectedHTML: `<p><a href="/%CF%86%CE%BF%CF%85">αγω</a></p>`,
		},
		"0.28-gfm-172": {
			Markdown:     "[foo]: /url",
			ExpectedHTML: ``,
		},
		"0.28-gfm-173": {
			Markdown:     "[\nfoo\n]: /url\nbar",
			ExpectedHTML: `<p>bar</p>`,
		},
		"0.28-gfm-174": {
			Markdown:     `[foo]: /url "title" ok`,
			ExpectedHTML: `<p>[foo]: /url &quot;title&quot; ok</p>`,
		},
		"0.28-gfm-175": {
			Markdown:     "[foo]: /url\n\"title\" ok",
			ExpectedHTML: `<p>&quot;title&quot; ok</p>`,
		},
		"0.28-gfm-176": {
			Markdown:     "    [foo]: /url \"title\"\n\n[foo]",
			ExpectedHTML: "<pre><code>[foo]: /url &quot;title&quot;\n</code></pre><p>[foo]</p>",
		},
		"0.28-gfm-177": {
			Markdown:     "```\n[foo]: /url\n```\n\n[foo]",
			ExpectedHTML: "<pre><code>[foo]: /url\n</code></pre><p>[foo]</p>",
		},
		"0.28-gfm-178": {
			Markdown:     "Foo\n[bar]: /baz\n\n[bar]",
			ExpectedHTML: "<p>Foo\n[bar]: /baz</p><p>[bar]</p>",
		},
		"0.28-gfm-180": {
			Markdown: "[foo]: /foo-url \"foo\"\n[bar]: /bar-url\n\"bar\"\n[baz]: /baz-url\n\n[foo],\n[bar],\n[baz]",
			ExpectedHTML: `<p><a href="/foo-url" title="foo">foo</a>,
<a href="/bar-url" title="bar">bar</a>,
<a href="/baz-url">baz</a></p>`,
		},
		"0.28-gfm-181": {
			Markdown:     "[foo]\n\n> [foo]: /url",
			ExpectedHTML: `<p><a href="/url">foo</a></p><blockquote></blockquote>`,
		},
		"0.28-gfm-182": {
			Markdown:     "aaa\n\nbbb",
			ExpectedHTML: "<p>aaa</p><p>bbb</p>",
		},
		"0.28-gfm-183": {
			Markdown:     "aaa\nbbb\n\nccc\nddd",
			ExpectedHTML: "<p>aaa\nbbb</p><p>ccc\nddd</p>",
		},
		"0.28-gfm-184": {
			Markdown:     "aaa\n\n\nbbb",
			ExpectedHTML: "<p>aaa</p><p>bbb</p>",
		},
		"0.28-gfm-185": {
			Markdown:     "  aaa\n bbb",
			ExpectedHTML: "<p>aaa\nbbb</p>",
		},
		"0.28-gfm-186": {
			Markdown:     "aaa\n             bbb\n                                       ccc",
			ExpectedHTML: "<p>aaa\nbbb\nccc</p>",
		},
		"0.28-gfm-187": {
			Markdown:     "   aaa\nbbb",
			ExpectedHTML: "<p>aaa\nbbb</p>",
		},
		"0.28-gfm-188": {
			Markdown:     "    aaa\nbbb",
			ExpectedHTML: "<pre><code>aaa\n</code></pre><p>bbb</p>",
		},
		"0.28-gfm-189": {
			Markdown:     "aaa     \nbbb     \n",
			ExpectedHTML: "<p>aaa<br />bbb</p>",
		},
		"0.28-gfm-204": {
			Markdown:     "> bar\nbaz\n> foo",
			ExpectedHTML: "<blockquote><p>bar\nbaz\nfoo</p></blockquote>",
		},
		"0.28-gfm-206": {
			Markdown:     "> - foo\n- bar",
			ExpectedHTML: "<blockquote><ul><li>foo</li></ul></blockquote><ul><li>bar</li></ul>",
		},
		"0.28-gfm-207": {
			Markdown:     ">     foo\n    bar",
			ExpectedHTML: "<blockquote><pre><code>foo\n</code></pre></blockquote><pre><code>bar</code></pre>",
		},
		"0.28-gfm-208": {
			Markdown:     "> ```\nfoo\n```",
			ExpectedHTML: "<blockquote><pre><code></code></pre></blockquote><p>foo</p><pre><code></code></pre>",
		},
		"0.28-gfm-209": {
			Markdown:     "> foo\n    - bar",
			ExpectedHTML: "<blockquote><p>foo\n- bar</p></blockquote>",
		},
		"0.28-gfm-210": {
			Markdown:     ">",
			ExpectedHTML: "<blockquote></blockquote>",
		},
		"0.28-gfm-211": {
			Markdown:     ">\n>  \n> ",
			ExpectedHTML: "<blockquote></blockquote>",
		},
		"0.28-gfm-212": {
			Markdown:     ">\n> foo\n>  ",
			ExpectedHTML: "<blockquote><p>foo</p></blockquote>",
		},
		"0.28-gfm-213": {
			Markdown:     "> foo\n\n> bar",
			ExpectedHTML: "<blockquote><p>foo</p></blockquote><blockquote><p>bar</p></blockquote>",
		},
		"0.28-gfm-214": {
			Markdown:     "> foo\n> bar",
			ExpectedHTML: "<blockquote><p>foo\nbar</p></blockquote>",
		},
		"0.28-gfm-215": {
			Markdown:     "> foo\n>\n> bar",
			ExpectedHTML: "<blockquote><p>foo</p><p>bar</p></blockquote>",
		},
		"0.28-gfm-216": {
			Markdown:     "foo\n> bar",
			ExpectedHTML: "<p>foo</p><blockquote><p>bar</p></blockquote>",
		},
		"0.28-gfm-218": {
			Markdown:     "> bar\nbaz",
			ExpectedHTML: "<blockquote><p>bar\nbaz</p></blockquote>",
		},
		"0.28-gfm-219": {
			Markdown:     "> bar\n\nbaz",
			ExpectedHTML: "<blockquote><p>bar</p></blockquote><p>baz</p>",
		},
		"0.28-gfm-220": {
			Markdown:     "> bar\n>\nbaz",
			ExpectedHTML: "<blockquote><p>bar</p></blockquote><p>baz</p>",
		},
		"0.28-gfm-221": {
			Markdown:     "> > > foo\nbar",
			ExpectedHTML: "<blockquote><blockquote><blockquote><p>foo\nbar</p></blockquote></blockquote></blockquote>",
		},
		"0.28-gfm-222": {
			Markdown:     ">>> foo\n> bar\n>>baz",
			ExpectedHTML: "<blockquote><blockquote><blockquote><p>foo\nbar\nbaz</p></blockquote></blockquote></blockquote>",
		},
		"0.28-gfm-223": {
			Markdown:     ">     code\n\n>    not code",
			ExpectedHTML: "<blockquote><pre><code>code\n</code></pre></blockquote><blockquote><p>not code</p></blockquote>",
		},
		"0.28-gfm-224": {
			Markdown:     "A paragraph\nwith two lines.\n\n    indented code\n\n> A block quote.",
			ExpectedHTML: "<p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote>",
		},
		"0.28-gfm-225": {
			Markdown:     "1.  A paragraph\n    with two lines.\n\n        indented code\n\n    > A block quote.",
			ExpectedHTML: "<ol><li><p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote></li></ol>",
		},
		"0.28-gfm-226": {
			Markdown:     "- one\n\n two",
			ExpectedHTML: "<ul><li>one</li></ul><p>two</p>",
		},
		"0.28-gfm-227": {
			Markdown:     "- one\n\n  two",
			ExpectedHTML: "<ul><li><p>one</p><p>two</p></li></ul>",
		},
		"0.28-gfm-228": {
			Markdown:     " -    one\n\n     two",
			ExpectedHTML: "<ul><li>one</li></ul><pre><code> two</code></pre>",
		},
		"0.28-gfm-229": {
			Markdown:     " -    one\n\n      two",
			ExpectedHTML: "<ul><li><p>one</p><p>two</p></li></ul>",
		},
		"0.28-gfm-230": {
			Markdown:     "   > > 1.  one\n>>\n>>     two",
			ExpectedHTML: "<blockquote><blockquote><ol><li><p>one</p><p>two</p></li></ol></blockquote></blockquote>",
		},
		"0.28-gfm-231": {
			Markdown:     ">>- one\n>>\n  >  > two",
			ExpectedHTML: "<blockquote><blockquote><ul><li>one</li></ul><p>two</p></blockquote></blockquote>",
		},
		"0.28-gfm-232": {
			Markdown:     "-one\n\n2.two",
			ExpectedHTML: "<p>-one</p><p>2.two</p>",
		},
		"0.28-gfm-233": {
			Markdown:     "- foo\n\n\n  bar",
			ExpectedHTML: "<ul><li><p>foo</p><p>bar</p></li></ul>",
		},
		"0.28-gfm-234": {
			Markdown:     "1.  foo\n\n    ```\n    bar\n    ```\n\n    baz\n\n    > bam",
			ExpectedHTML: "<ol><li><p>foo</p><pre><code>bar\n</code></pre><p>baz</p><blockquote><p>bam</p></blockquote></li></ol>",
		},
		"0.28-gfm-235": {
			Markdown:     "- Foo\n\n      bar\n\n\n      baz",
			ExpectedHTML: "<ul><li><p>Foo</p><pre><code>bar\n\n\nbaz</code></pre></li></ul>",
		},
		"0.28-gfm-236": {
			Markdown:     "123456789. ok",
			ExpectedHTML: `<ol start="123456789"><li>ok</li></ol>`,
		},
		"0.28-gfm-237": {
			Markdown:     "1234567890. not ok",
			ExpectedHTML: "<p>1234567890. not ok</p>",
		},
		"0.28-gfm-238": {
			Markdown:     "0. ok",
			ExpectedHTML: `<ol start="0"><li>ok</li></ol>`,
		},
		"0.28-gfm-239": {
			Markdown:     "003. ok",
			ExpectedHTML: `<ol start="3"><li>ok</li></ol>`,
		},
		"0.28-gfm-240": {
			Markdown:     "-1. not ok",
			ExpectedHTML: "<p>-1. not ok</p>",
		},
		"0.28-gfm-241": {
			Markdown:     "- foo\n\n      bar",
			ExpectedHTML: "<ul><li><p>foo</p><pre><code>bar</code></pre></li></ul>",
		},
		"0.28-gfm-242": {
			Markdown:     "  10.  foo\n\n           bar",
			ExpectedHTML: `<ol start="10"><li><p>foo</p><pre><code>bar</code></pre></li></ol>`,
		},
		"0.28-gfm-243": {
			Markdown:     "    indented code\n\nparagraph\n\n    more code",
			ExpectedHTML: "<pre><code>indented code\n</code></pre><p>paragraph</p><pre><code>more code</code></pre>",
		},
		"0.28-gfm-244": {
			Markdown:     "1.     indented code\n\n   paragraph\n\n       more code",
			ExpectedHTML: "<ol><li><pre><code>indented code\n</code></pre><p>paragraph</p><pre><code>more code</code></pre></li></ol>",
		},
		"0.28-gfm-245": {
			Markdown:     "1.      indented code\n\n   paragraph\n\n       more code",
			ExpectedHTML: "<ol><li><pre><code> indented code\n</code></pre><p>paragraph</p><pre><code>more code</code></pre></li></ol>",
		},
		"0.28-gfm-246": {
			Markdown:     "   foo\n\nbar",
			ExpectedHTML: "<p>foo</p><p>bar</p>",
		},
		"0.28-gfm-247": {
			Markdown:     "-    foo\n\n  bar",
			ExpectedHTML: "<ul><li>foo</li></ul><p>bar</p>",
		},
		"0.28-gfm-248": {
			Markdown:     "-  foo\n\n   bar",
			ExpectedHTML: "<ul><li><p>foo</p><p>bar</p></li></ul>",
		},
		"0.28-gfm-249": {
			Markdown:     "-\n  foo\n-\n  ```\n  bar\n  ```\n-\n      baz",
			ExpectedHTML: "<ul><li>foo</li><li><pre><code>bar\n</code></pre></li><li><pre><code>baz</code></pre></li></ul>",
		},
		"0.28-gfm-250": {
			Markdown:     "-   \n  foo",
			ExpectedHTML: "<ul><li>foo</li></ul>",
		},
		"0.28-gfm-251": {
			Markdown:     "-\n\n  foo",
			ExpectedHTML: "<ul><li></li></ul><p>foo</p>",
		},
		"0.28-gfm-252": {
			Markdown:     "- foo\n-\n- bar",
			ExpectedHTML: "<ul><li>foo</li><li></li><li>bar</li></ul>",
		},
		"0.28-gfm-253": {
			Markdown:     "- foo\n-   \n- bar",
			ExpectedHTML: "<ul><li>foo</li><li></li><li>bar</li></ul>",
		},
		"0.28-gfm-254": {
			Markdown:     "1. foo\n2.\n3. bar",
			ExpectedHTML: "<ol><li>foo</li><li></li><li>bar</li></ol>",
		},
		"0.28-gfm-255": {
			Markdown:     "*",
			ExpectedHTML: "<ul><li></li></ul>",
		},
		"0.28-gfm-256": {
			Markdown:     "foo\n*\n\nfoo\n1.",
			ExpectedHTML: "<p>foo\n*</p><p>foo\n1.</p>",
		},
		"0.28-gfm-257": {
			Markdown:     " 1.  A paragraph\n     with two lines.\n\n         indented code\n\n     > A block quote.",
			ExpectedHTML: "<ol><li><p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote></li></ol>",
		},
		"0.28-gfm-258": {
			Markdown:     "  1.  A paragraph\n      with two lines.\n\n          indented code\n\n      > A block quote.",
			ExpectedHTML: "<ol><li><p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote></li></ol>",
		},
		"0.28-gfm-259": {
			Markdown:     "   1.  A paragraph\n       with two lines.\n\n           indented code\n\n       > A block quote.",
			ExpectedHTML: "<ol><li><p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote></li></ol>",
		},
		"0.28-gfm-260": {
			Markdown:     "    1.  A paragraph\n        with two lines.\n\n            indented code\n\n        > A block quote.",
			ExpectedHTML: "<pre><code>1.  A paragraph\n    with two lines.\n\n        indented code\n\n    &gt; A block quote.</code></pre>",
		},
		"0.28-gfm-261": {
			Markdown:     "  1.  A paragraph\nwith two lines.\n\n          indented code\n\n      > A block quote.",
			ExpectedHTML: "<ol><li><p>A paragraph\nwith two lines.</p><pre><code>indented code\n</code></pre><blockquote><p>A block quote.</p></blockquote></li></ol>",
		},
		"0.28-gfm-262": {
			Markdown:     "  1.  A paragraph\n    with two lines.",
			ExpectedHTML: "<ol><li>A paragraph\nwith two lines.</li></ol>",
		},
		"0.28-gfm-263": {
			Markdown:     "> 1. > Blockquote\ncontinued here.",
			ExpectedHTML: "<blockquote><ol><li><blockquote><p>Blockquote\ncontinued here.</p></blockquote></li></ol></blockquote>",
		},
		"0.28-gfm-264": {
			Markdown:     "> 1. > Blockquote\n> continued here.",
			ExpectedHTML: "<blockquote><ol><li><blockquote><p>Blockquote\ncontinued here.</p></blockquote></li></ol></blockquote>",
		},
		"0.28-gfm-265": {
			Markdown:     "- foo\n  - bar\n    - baz\n      - boo",
			ExpectedHTML: "<ul><li>foo<ul><li>bar<ul><li>baz<ul><li>boo</li></ul></li></ul></li></ul></li></ul>",
		},
		"0.28-gfm-266": {
			Markdown:     "- foo\n - bar\n  - baz\n   - boo",
			ExpectedHTML: "<ul><li>foo</li><li>bar</li><li>baz</li><li>boo</li></ul>",
		},
		"0.28-gfm-267": {
			Markdown:     "10) foo\n    - bar",
			ExpectedHTML: `<ol start="10"><li>foo<ul><li>bar</li></ul></li></ol>`,
		},
		"0.28-gfm-268": {
			Markdown:     "10) foo\n   - bar",
			ExpectedHTML: `<ol start="10"><li>foo</li></ol><ul><li>bar</li></ul>`,
		},
		"0.28-gfm-269": {
			Markdown:     "- - foo",
			ExpectedHTML: "<ul><li><ul><li>foo</li></ul></li></ul>",
		},
		"0.28-gfm-270": {
			Markdown:     "1. - 2. foo",
			ExpectedHTML: `<ol><li><ul><li><ol start="2"><li>foo</li></ol></li></ul></li></ol>`,
		},
		"0.28-gfm-274": {
			Markdown:     "- foo\n- bar\n+ baz",
			ExpectedHTML: "<ul><li>foo</li><li>bar</li></ul><ul><li>baz</li></ul>",
		},
		"0.28-gfm-275": {
			Markdown:     "1. foo\n2. bar\n3) baz",
			ExpectedHTML: `<ol><li>foo</li><li>bar</li></ol><ol start="3"><li>baz</li></ol>`,
		},
		"0.28-gfm-276": {
			Markdown:     "Foo\n- bar\n- baz",
			ExpectedHTML: "<p>Foo</p><ul><li>bar</li><li>baz</li></ul>",
		},
		"0.28-gfm-277": {
			Markdown:     "The number of windows in my house is\n14.  The number of doors is 6.",
			ExpectedHTML: "<p>The number of windows in my house is\n14.  The number of doors is 6.</p>",
		},
		"0.28-gfm-278": {
			Markdown:     "The number of windows in my house is\n1.  The number of doors is 6.",
			ExpectedHTML: "<p>The number of windows in my house is</p><ol><li>The number of doors is 6.</li></ol>",
		},
		"0.28-gfm-279": {
			Markdown:     "- foo\n\n- bar\n\n\n- baz",
			ExpectedHTML: "<ul><li><p>foo</p></li><li><p>bar</p></li><li><p>baz</p></li></ul>",
		},
		"0.28-gfm-280": {
			Markdown:     "- foo\n  - bar\n    - baz\n\n\n      bim",
			ExpectedHTML: "<ul><li>foo<ul><li>bar<ul><li><p>baz</p><p>bim</p></li></ul></li></ul></li></ul>",
		},
		"0.28-gfm-283": {
			Markdown:     "- a\n - b\n  - c\n   - d\n    - e\n   - f\n  - g\n - h\n- i",
			ExpectedHTML: "<ul><li>a</li><li>b</li><li>c</li><li>d</li><li>e</li><li>f</li><li>g</li><li>h</li><li>i</li></ul>",
		},
		"0.28-gfm-284": {
			Markdown:     "1. a\n\n  2. b\n\n    3. c",
			ExpectedHTML: "<ol><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ol>",
		},
		"0.28-gfm-285": {
			Markdown:     "- a\n- b\n\n- c",
			ExpectedHTML: "<ul><li><p>a</p></li><li><p>b</p></li><li><p>c</p></li></ul>",
		},
		"0.28-gfm-286": {
			Markdown:     "* a\n*\n\n* c",
			ExpectedHTML: "<ul><li><p>a</p></li><li></li><li><p>c</p></li></ul>",
		},
		"0.28-gfm-287": {
			Markdown:     "- a\n- b\n\n  c\n- d",
			ExpectedHTML: "<ul><li><p>a</p></li><li><p>b</p><p>c</p></li><li><p>d</p></li></ul>",
		},
		"0.28-gfm-288": {
			Markdown:     "- a\n- b\n\n  [ref]: /url\n- d",
			ExpectedHTML: "<ul><li><p>a</p></li><li><p>b</p></li><li><p>d</p></li></ul>",
		},
		"0.28-gfm-289": {
			Markdown:     "- a\n- ```\n  b\n\n\n  ```\n- c",
			ExpectedHTML: "<ul><li>a</li><li><pre><code>b\n\n\n</code></pre></li><li>c</li></ul>",
		},
		"0.28-gfm-290": {
			Markdown:     "- a\n  - b\n\n    c\n- d",
			ExpectedHTML: "<ul><li>a<ul><li><p>b</p><p>c</p></li></ul></li><li>d</li></ul>",
		},
		"0.28-gfm-291": {
			Markdown:     "* a\n  > b\n  >\n* c",
			ExpectedHTML: "<ul><li>a<blockquote><p>b</p></blockquote></li><li>c</li></ul>",
		},
		"0.28-gfm-292": {
			Markdown:     "- a\n  > b\n  ```\n  c\n  ```\n- d",
			ExpectedHTML: "<ul><li>a<blockquote><p>b</p></blockquote><pre><code>c\n</code></pre></li><li>d</li></ul>",
		},
		"0.28-gfm-293": {
			Markdown:     "- a",
			ExpectedHTML: "<ul><li>a</li></ul>",
		},
		"0.28-gfm-294": {
			Markdown:     "- a\n  - b",
			ExpectedHTML: "<ul><li>a<ul><li>b</li></ul></li></ul>",
		},
		"0.28-gfm-295": {
			Markdown:     "1. ```\n   foo\n   ```\n\n   bar",
			ExpectedHTML: "<ol><li><pre><code>foo\n</code></pre><p>bar</p></li></ol>",
		},
		"0.28-gfm-296": {
			Markdown:     "* foo\n  * bar\n\n  baz",
			ExpectedHTML: "<ul><li><p>foo</p><ul><li>bar</li></ul><p>baz</p></li></ul>",
		},
		"0.28-gfm-297": {
			Markdown:     "- a\n  - b\n  - c\n\n- d\n  - e\n  - f",
			ExpectedHTML: "<ul><li><p>a</p><ul><li>b</li><li>c</li></ul></li><li><p>d</p><ul><li>e</li><li>f</li></ul></li></ul>",
		},
		"0.28-gfm-298": {
			Markdown:     "`hi`lo`",
			ExpectedHTML: "<p><code>hi</code>lo`</p>",
		},
		"0.28-gfm-299": {
			Markdown:     `\!\"\#\$\%\&\'\(\)\*\+\,\-\.\/\:\;\<\=\>\?\@\[\\\]\^\_` + "\\`" + `\{\|\}\~`,
			ExpectedHTML: "<p>!&quot;#$%&amp;'()*+,-./:;&lt;=&gt;?@[\\]^_`{|}~</p>",
		},
		"0.28-gfm-300": {
			Markdown:     `\→\A\a\ \3\φ\«`,
			ExpectedHTML: `<p>\→\A\a\ \3\φ\«</p>`,
		},
		"0.28-gfm-301": {
			Markdown: `\*not emphasized*
\<br/> not a tag
\[not a link](/foo)
\` + "`not code`" + `
1\. not a list
\* not a list
\# not a heading
\[foo]: /url "not a reference"`,
			ExpectedHTML: `<p>*not emphasized*
&lt;br/&gt; not a tag
[not a link](/foo)
` + "`not code`" + `
1. not a list
* not a list
# not a heading
[foo]: /url &quot;not a reference&quot;</p>`,
		},
		"0.28-gfm-304": {
			Markdown:     "`` \\[\\` ``",
			ExpectedHTML: "<p><code>\\[\\`</code></p>",
		},
		"0.28-gfm-305": {
			Markdown:     `    \[\]`,
			ExpectedHTML: `<pre><code>\[\]</code></pre>`,
		},
		"0.28-gfm-306": {
			Markdown:     "~~~\n\\[\\]\n~~~",
			ExpectedHTML: "<pre><code>\\[\\]\n</code></pre>",
		},
		"0.28-gfm-309": {
			Markdown:     `[foo](/bar\* "ti\*tle")`,
			ExpectedHTML: `<p><a href="/bar*" title="ti*tle">foo</a></p>`,
		},
		"0.28-gfm-310": {
			Markdown: `[foo]

[foo]: /bar\* "ti\*tle"`,
			ExpectedHTML: `<p><a href="/bar*" title="ti*tle">foo</a></p>`,
		},
		"0.28-gfm-311": {
			Markdown:     "``` foo\\+bar\nfoo\n```",
			ExpectedHTML: "<pre><code class=\"language-foo+bar\">foo\n</code></pre>",
		},
		"0.28-gfm-312": {
			Markdown:     "&nbsp; &amp; &copy; &AElig; &Dcaron;\n&frac34; &HilbertSpace; &DifferentialD;\n&ClockwiseContourIntegral; &ngE;",
			ExpectedHTML: "<p>\u00a0 &amp; © Æ Ď\n¾ ℋ ⅆ\n∲ ≧̸</p>",
		},
		"0.28-gfm-313": {
			Markdown:     "&#35; &#1234; &#992; &#98765432; &#0;",
			ExpectedHTML: "<p># Ӓ Ϡ � �</p>",
		},
		"0.28-gfm-314": {
			Markdown:     "&#X22; &#XD06; &#xcab;",
			ExpectedHTML: "<p>&quot; ആ ಫ</p>",
		},
		"0.28-gfm-315": {
			Markdown:     "&nbsp &x; &#; &#x;\n&ThisIsNotDefined; &hi?;",
			ExpectedHTML: "<p>&amp;nbsp &amp;x; &amp;#; &amp;#x;\n&amp;ThisIsNotDefined; &amp;hi?;</p>",
		},
		"0.28-gfm-316": {
			Markdown:     "&copy",
			ExpectedHTML: "<p>&amp;copy</p>",
		},
		"0.28-gfm-317": {
			Markdown:     "&MadeUpEntity;",
			ExpectedHTML: "<p>&amp;MadeUpEntity;</p>",
		},
		"0.28-gfm-319": {
			Markdown:     `[foo](/f&ouml;&ouml; "f&ouml;&ouml;")`,
			ExpectedHTML: `<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>`,
		},
		"0.28-gfm-320": {
			Markdown:     "[foo]\n\n[foo]: /f&ouml;&ouml; \"f&ouml;&ouml;\"",
			ExpectedHTML: `<p><a href="/f%C3%B6%C3%B6" title="föö">foo</a></p>`,
		},
		"0.28-gfm-321": {
			Markdown:     "``` f&ouml;&ouml;\nfoo\n```",
			ExpectedHTML: "<pre><code class=\"language-föö\">foo\n</code></pre>",
		},
		"0.28-gfm-322": {
			Markdown:     "`f&ouml;&ouml;`",
			ExpectedHTML: "<p><code>f&amp;ouml;&amp;ouml;</code></p>",
		},
		"0.28-gfm-323": {
			Markdown:     "    f&ouml;f&ouml;",
			ExpectedHTML: "<pre><code>f&amp;ouml;f&amp;ouml;</code></pre>",
		},
		"0.28-gfm-324": {
			Markdown:     "`foo`",
			ExpectedHTML: "<p><code>foo</code></p>",
		},
		"0.28-gfm-325": {
			Markdown:     "`` foo ` bar ``",
			ExpectedHTML: "<p><code>foo ` bar</code></p>",
		},
		"0.28-gfm-326": {
			Markdown:     "` `` `",
			ExpectedHTML: "<p><code>``</code></p>",
		},
		"0.28-gfm-327": {
			Markdown:     "``\nfoo\n``",
			ExpectedHTML: "<p><code>foo</code></p>",
		},
		"0.28-gfm-328": {
			Markdown:     "`foo   bar\n  baz`",
			ExpectedHTML: "<p><code>foo bar baz</code></p>",
		},
		"0.28-gfm-329": {
			Markdown:     "`a\xa0\xa0b`",
			ExpectedHTML: "<p><code>a\xa0\xa0b</code></p>",
		},
		"0.28-gfm-330": {
			Markdown:     "`foo `` bar`",
			ExpectedHTML: "<p><code>foo `` bar</code></p>",
		},
		"0.28-gfm-331": {
			Markdown:     "`foo\\`bar`",
			ExpectedHTML: "<p><code>foo\\</code>bar`</p>",
		},
		"0.28-gfm-332": {
			Markdown:     "*foo`*`",
			ExpectedHTML: "<p>*foo<code>*</code></p>",
		},
		"0.28-gfm-333": {
			Markdown:     "[not a `link](/foo`)",
			ExpectedHTML: "<p>[not a <code>link](/foo</code>)</p>",
		},
		"0.28-gfm-334": {
			Markdown:     "`<a href=\"`\">`",
			ExpectedHTML: "<p><code>&lt;a href=&quot;</code>&quot;&gt;`</p>",
		},
		"0.28-gfm-336": {
			Markdown:     "`<http://foo.bar.`baz>`",
			ExpectedHTML: "<p><code>&lt;http://foo.bar.</code>baz&gt;`</p>",
		},
		"0.28-gfm-338": {
			Markdown:     "```foo``",
			ExpectedHTML: "<p>```foo``</p>",
		},
		"0.28-gfm-339": {
			Markdown:     "`foo",
			ExpectedHTML: "<p>`foo</p>",
		},
		"0.28-gfm-340": {
			Markdown:     "`foo``bar``",
			ExpectedHTML: "<p>`foo<code>bar</code></p>",
		},
		"0.28-gfm-472": {
			Markdown:     `[link](/uri "title")`,
			ExpectedHTML: `<p><a href="/uri" title="title">link</a></p>`,
		},
		"0.28-gfm-473": {
			Markdown:     `[link](/uri)`,
			ExpectedHTML: `<p><a href="/uri">link</a></p>`,
		},
		"0.28-gfm-474": {
			Markdown:     `[link]()`,
			ExpectedHTML: `<p><a href="">link</a></p>`,
		},
		"0.28-gfm-475": {
			Markdown:     `[link](<>)`,
			ExpectedHTML: `<p><a href="">link</a></p>`,
		},
		"0.28-gfm-476": {
			Markdown:     `[link](/my uri)`,
			ExpectedHTML: `<p>[link](/my uri)</p>`,
		},
		"0.28-gfm-477": {
			Markdown:     `[link](</my uri>)`,
			ExpectedHTML: `<p>[link](&lt;/my uri&gt;)</p>`,
		},
		"0.28-gfm-478": {
			Markdown:     "[link](foo\nbar)",
			ExpectedHTML: "<p>[link](foo\nbar)</p>",
		},
		"0.28-gfm-480": {
			Markdown:     `[link](\(foo\))`,
			ExpectedHTML: `<p><a href="(foo)">link</a></p>`,
		},
		"0.28-gfm-481": {
			Markdown:     `[link](foo(and(bar)))`,
			ExpectedHTML: `<p><a href="foo(and(bar))">link</a></p>`,
		},
		"0.28-gfm-482": {
			Markdown:     `[link](foo\(and\(bar\))`,
			ExpectedHTML: `<p><a href="foo(and(bar)">link</a></p>`,
		},
		"0.28-gfm-483": {
			Markdown:     `[link](<foo(and(bar)>)`,
			ExpectedHTML: `<p><a href="foo(and(bar)">link</a></p>`,
		},
		"0.28-gfm-484": {
			Markdown:     `[link](foo\)\:)`,
			ExpectedHTML: `<p><a href="foo):">link</a></p>`,
		},
		"0.28-gfm-485": {
			Markdown:     "[link](#fragment)\n\n[link](http://example.com#fragment)\n\n[link](http://example.com?foo=3#frag)",
			ExpectedHTML: `<p><a href="#fragment">link</a></p><p><a href="http://example.com#fragment">link</a></p><p><a href="http://example.com?foo=3#frag">link</a></p>`,
		},
		"0.28-gfm-486": {
			Markdown:     `[link](foo\bar)`,
			ExpectedHTML: `<p><a href="foo%5Cbar">link</a></p>`,
		},
		"0.28-gfm-488": {
			Markdown:     `[link]("title")`,
			ExpectedHTML: `<p><a href="%22title%22">link</a></p>`,
		},
		"0.28-gfm-489": {
			Markdown:     "[link](/url \"title\")\n[link](/url 'title')\n[link](/url (title))",
			ExpectedHTML: "<p><a href=\"/url\" title=\"title\">link</a>\n<a href=\"/url\" title=\"title\">link</a>\n<a href=\"/url\" title=\"title\">link</a></p>",
		},
		"0.28-gfm-490": {
			Markdown:     `[link](/url "title \"&quot;")`,
			ExpectedHTML: `<p><a href="/url" title="title &quot;&quot;">link</a></p>`,
		},
		"0.28-gfm-491": {
			Markdown:     "[link](/url\u00a0\"title\")",
			ExpectedHTML: `<p><a href="/url%C2%A0%22title%22">link</a></p>`,
		},
		"0.28-gfm-492": {
			Markdown:     `[link](/url "title "and" title")`,
			ExpectedHTML: `<p>[link](/url &quot;title &quot;and&quot; title&quot;)</p>`,
		},
		"0.28-gfm-493": {
			Markdown:     `[link](/url 'title "and" title')`,
			ExpectedHTML: `<p><a href="/url" title="title &quot;and&quot; title">link</a></p>`,
		},
		"0.28-gfm-494": {
			Markdown:     "[link](   /uri\n  \"title\"  )",
			ExpectedHTML: `<p><a href="/uri" title="title">link</a></p>`,
		},
		"0.28-gfm-495": {
			Markdown:     "[link] (/uri)",
			ExpectedHTML: `<p>[link] (/uri)</p>`,
		},
		"0.28-gfm-496": {
			Markdown:     "[link [foo [bar]]](/uri)",
			ExpectedHTML: `<p><a href="/uri">link [foo [bar]]</a></p>`,
		},
		"0.28-gfm-497": {
			Markdown:     "[link] bar](/uri)",
			ExpectedHTML: `<p>[link] bar](/uri)</p>`,
		},
		"0.28-gfm-498": {
			Markdown:     "[link [bar](/uri)",
			ExpectedHTML: `<p>[link <a href="/uri">bar</a></p>`,
		},
		"0.28-gfm-499": {
			Markdown:     `[link \[bar](/uri)`,
			ExpectedHTML: `<p><a href="/uri">link [bar</a></p>`,
		},
		"0.28-gfm-501": {
			Markdown:     "[![moon](moon.jpg)](/uri)",
			ExpectedHTML: `<p><a href="/uri"><img src="moon.jpg" alt="moon" /></a></p>`,
		},
		"0.28-gfm-502": {
			Markdown:     "[foo [bar](/uri)](/uri)",
			ExpectedHTML: `<p>[foo <a href="/uri">bar</a>](/uri)</p>`,
		},
		"0.28-gfm-504": {
			Markdown:     "![[[foo](uri1)](uri2)](uri3)",
			ExpectedHTML: `<p><img src="uri3" alt="[foo](uri2)" /></p>`,
		},
		"0.28-gfm-505": {
			Markdown:     "*[foo*](/uri)",
			ExpectedHTML: `<p>*<a href="/uri">foo*</a></p>`,
		},
		"0.28-gfm-506": {
			Markdown:     "[foo *bar](baz*)",
			ExpectedHTML: `<p><a href="baz*">foo *bar</a></p>`,
		},
		"0.28-gfm-509": {
			Markdown:     "[foo`](/uri)`",
			ExpectedHTML: `<p>[foo<code>](/uri)</code></p>`,
		},
		"0.28-gfm-556": {
			Markdown:     `![foo](/url "title")`,
			ExpectedHTML: `<p><img src="/url" alt="foo" title="title" /></p>`,
		},
		"0.28-gfm-558": {
			Markdown:     `![foo ![bar](/url)](/url2)`,
			ExpectedHTML: `<p><img src="/url2" alt="foo bar" /></p>`,
		},
		"0.28-gfm-559": {
			Markdown:     `![foo [bar](/url)](/url2)`,
			ExpectedHTML: `<p><img src="/url2" alt="foo bar" /></p>`,
		},
		"0.28-gfm-562": {
			Markdown:     `![foo](train.jpg)`,
			ExpectedHTML: `<p><img src="train.jpg" alt="foo" /></p>`,
		},
		"0.28-gfm-563": {
			Markdown:     `My ![foo bar](/path/to/train.jpg  "title"   )`,
			ExpectedHTML: `<p>My <img src="/path/to/train.jpg" alt="foo bar" title="title" /></p>`,
		},
		"0.28-gfm-564": {
			Markdown:     `![foo](<url>)`,
			ExpectedHTML: `<p><img src="url" alt="foo" /></p>`,
		},
		"0.28-gfm-565": {
			Markdown:     `![](/url)`,
			ExpectedHTML: `<p><img src="/url" alt="" /></p>`,
		},
		"0.28-gfm-647": {
			Markdown:     "hello $.;'there",
			ExpectedHTML: "<p>hello $.;'there</p>",
		},
		"0.28-gfm-648": {
			Markdown:     "Foo χρῆν",
			ExpectedHTML: "<p>Foo χρῆν</p>",
		},
		"0.28-gfm-649": {
			Markdown:     "Multiple     spaces",
			ExpectedHTML: "<p>Multiple     spaces</p>",
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.ExpectedHTML, RenderHTML(tc.Markdown))
		})
	}
}

func TestCommonMarkReferenceAutolinks(t *testing.T) {
	// These tests are adapted from the GitHub-flavoured CommonMark extension tests located at
	// https://github.com/github/cmark/blob/master/test/extensions.txt
	for name, tc := range map[string]struct {
		Markdown     string
		ExpectedHTML string
	}{
		"autolinks-1": {
			Markdown: `: http://google.com https://google.com

http://google.com/å

www.github.com www.github.com/á

www.google.com/a_b

![http://inline.com/image](http://inline.com/image)

Full stop outside parens shouldn't be included http://google.com/ok.

(Full stop inside parens shouldn't be included http://google.com/ok.)

"http://google.com"

'http://google.com'

http://🍄.ga/ http://x🍄.ga/`,
			ExpectedHTML: `<p>: <a href="http://google.com">http://google.com</a> <a href="https://google.com">https://google.com</a></p><p><a href="http://google.com/%C3%A5">http://google.com/å</a></p><p><a href="http://www.github.com">www.github.com</a> <a href="http://www.github.com/%C3%A1">www.github.com/á</a></p><p><a href="http://www.google.com/a_b">www.google.com/a_b</a></p><p><img src="http://inline.com/image" alt="http://inline.com/image" /></p><p>Full stop outside parens shouldn't be included <a href="http://google.com/ok">http://google.com/ok</a>.</p><p>(Full stop inside parens shouldn't be included <a href="http://google.com/ok">http://google.com/ok</a>.)</p><p>&quot;<a href="http://google.com">http://google.com</a>&quot;</p><p>'<a href="http://google.com">http://google.com</a>'</p><p><a href="http://%F0%9F%8D%84.ga/">http://🍄.ga/</a> <a href="http://x%F0%9F%8D%84.ga/">http://x🍄.ga/</a></p>`,
		},
		"autolinks-2": {
			Markdown: `These should not link:

* @a.b.c@. x
* n@.  b`,
			ExpectedHTML: `<p>These should not link:</p><ul><li>@a.b.c@. x</li><li>n@.  b</li></ul>`,
		},
	} {
		t.Run(name, func(t *testing.T) {
			assert.Equal(t, tc.ExpectedHTML, RenderHTML(tc.Markdown))
		})
	}
}
