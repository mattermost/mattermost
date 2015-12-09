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
http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80  
http://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:8065  
https://[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:443  
http://username:password@example.com  
http://username:password@127.0.0.1  
http://username:password@[2001:0:5ef5:79fb:303a:62d5:3312:ff42]:80  
test@example.com  
 
#### These strings should not auto-link: 
 
example.com  
readme.md  
http://  
@example.com  
./make-compiled-client.sh  
test.:test  
https://<your-mattermost-url>/signup/gitlab  
https://your-mattermost-url>/signup/gitlab  

#### Only the links within these sentences should auto-link:

(http://example.com)  
(test@example.com)  
This is a sentence with a http://example.com in it.  
This is a sentence with a [link](http://example.com) in it.  
This is a sentence with a http://example.com/_/underscore in it.  
This is a sentence with a link (http://example.com) in it.  
This is a sentence with a (https://en.wikipedia.org/wiki/Rendering_(computer_graphics)) in it.  
This is a sentence with a http://192.168.1.1:4040 in it.  
This is a sentence with a https://[::1]:80 in it.  
This is a link to http://example.com.  

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
