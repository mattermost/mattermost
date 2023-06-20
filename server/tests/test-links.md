# Link Testing
 
Links in Mattermosts should render as specified below.

#### These strings should auto-link:
 
http://example.com
https://example.com
www.example.com
www.example.com/index
www.example.com/index.html
www.example.com/index/sub
www.example.com/index?params=1
www.example.com/index?params=1&other=2
www.example.com/index?params=1;other=2
http://example.com:8065
http://www.example.com/_/page
www.example.com/_/page
https://en.wikipedia.org/wiki/🐬
https://en.wikipedia.org/wiki/Rendering_(computer_graphics)
http://127.0.0.1
http://192.168.1.1:4040
http://[::1]:80
http://[::1]:8065
https://[::1]:80
http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]
http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:8065
https://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]
test@example.com
http://example.com/more_(than)_one_(parens)
http://example.com/(something)?after=parens
http://foo.com/unicode_(✪)_in_parens
http://✪df.ws/1234
*https://example.com*
_https://example.com_
**https://example.com**
__https://example.com__
***https://example.com***
___https://example.com___
<https://example.com>
<https://en.wikipedia.org/wiki/Rendering_(computer_graphics)>
www1.example.com
[This whole #sentence should be a link](https://example.com)
https://groups.google.com/forum/#!msg

#### These strings should not auto-link:

example.com
readme.md
@example.com
./make-compiled-client.sh
test.:test
`https://example.com`

#### Only the links within these sentences should auto-link:

(http://example.com)
(see http://example.com)
(http://example.com watch this)
(test@example.com)
This is a sentence with a http://example.com in it.
This is a sentence with a [link](http://example.com) in it.
This is a sentence with a http://example.com/_/underscore in it.
This is a sentence with a link (http://example.com) in it.
This is a sentence with a (https://en.wikipedia.org/wiki/Rendering_(computer_graphics)) in it.
This is a sentence with a http://192.168.1.1:4040 in it.
This is a sentence with a https://[::1]:80 in it.
This is a link to http://example.com.
This is a link containing http://example.com/something?with,commas,in,url, but not at end
This is a question about a link http://example.com?

#### These links should auto-link to the specified location:

[example link](example.com) links to `http://example.com`
[example.com](example.com) links to `http://example.com`
[example.com/other](example.com) links to `http://example.com`
[example.com/other_link](example.com/example) links to `http://example.com/example`
www.example.com links to `http://www.example.com`
https://example.com links to `https://example.com` and not `http://example.com`
https://en.wikipedia.org/wiki/🐬 links to the Wikipedia article on dolphins
https://en.wikipedia.org/wiki/URLs#Syntax links to the Syntax section of the Wikipedia article on URLs
test@example.com links to `mailto:test@example.com`
[email link](mailto:test@example.com) links to `mailto:test@example.com` and not `http://mailto:test@example.com`
[other link](ts3server://example.com) links to `ts3server://example.com` and not `http://ts3server://example.com`
test_underscore@example.com links to `mailto:test_underscore@example.com`
<test@example.com> with angle brackets links to `mailto:test@example.com` and not `http://mailto:test@example.com`
[link with spaces](example.com/ spaces in the url) links to either `http://example.com/ spaces in the url` or `http://example.com/%20spaces%20in%20the%20url`

#### These links should have tooltips when you hover over them
[link](example.com "catch phrase!") should have the tooltip `catch phrase!`
[link](example.com "title with "quotes"") should have the tooltip `title with "quotes"`
[link with spaces](example.com/ spaces in the url "and a title") should have the tooltip `and a title`
