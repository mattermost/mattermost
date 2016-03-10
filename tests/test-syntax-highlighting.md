# Code Syntax Highlighting

Verify the following code blocks render as code blocks and highlight properly. 

### Diff

``` diff
*** /path/to/original	''timestamp''
--- /path/to/new	''timestamp''
***************
*** 1 ****
! This is a line.
--- 1 ---
! This is a replacement line.
It is important to spell
-removed line
+new line
```

### Apache

``` apache
<VirtualHost *:80>
DocumentRoot /www/example1
ServerName www.example.com
</VirtualHost>
```

### Makefile

``` makefile
CC=gcc
CFLAGS=-I.

hellomake: hellomake.o hellofunc.o
     $(CC) -o hellomake hellomake.o hellofunc.o -I.
```

### HTTP

``` http
HTTP/1.1 200 OK
Date: Sun, 28 Dec 2014 08:56:53 GMT
Content-Length: 44
Content-Type: text/html
  
<html><body><h1>It works!</h1></body></html>
```

### JSON

``` json
{"employees":[
    {"firstName":"John", "lastName":"Doe"},
]}
```

### Markdown

``` markdown
**bold** 
*italics* 
[link](www.example.com)
```

### JavaScript

``` javascript
document.write('Hello, world!');
```

### CSS

``` css
body {
    background-color: red;
}
```

### NGINX

``` nginx
server { # simple reverse-proxy
    listen       80;
    server_name  domain2.com www.domain2.com;
    access_log   logs/domain2.access.log  main;
```

### Objective C

``` objectivec
#import <stdio.h>

int main (void)
{
	printf ("Hello world!\n");
}
```

### Python

``` python
print "Hello, world!"
```

### XML

``` xml
<employees>
    <employee>
        <firstName>John</firstName> <lastName>Doe</lastName>
    </employee>
</employees>
```

### Perl

``` perl
print "Hello, World!\n";
```

### Bash

``` bash
echo "Hello World"
```

### PHP

``` php
 <?php echo '<p>Hello World</p>'; ?> 
```

### CoffeeScript

``` coffeescript
console.log(“Hello world!”);
```

### C#

``` cs
using System;
class Program
{
    public static void Main(string[] args)
    {
        Console.WriteLine("Hello, world!");
    }
}
```

### C++

``` cpp
#include <iostream.h>

main()
{
    cout << "Hello World!";
    return 0;
}
```

### SQL 

``` sql
SELECT column_name,column_name
FROM table_name;
```

### Go

``` go
package main
import "fmt"
func main() {
    fmt.Println("Hello, 世界")
}
```

### Ruby

``` ruby
puts "Hello, world!"
```

### Java

``` java
import javax.swing.JFrame;  //Importing class JFrame
import javax.swing.JLabel;  //Importing class JLabel
public class HelloWorld {
    public static void main(String[] args) {
        JFrame frame = new JFrame();           //Creating frame
        frame.setTitle("Hi!");                 //Setting title frame
        frame.add(new JLabel("Hello, world!"));//Adding text to frame
        frame.pack();                          //Setting size to smallest
        frame.setLocationRelativeTo(null);     //Centering frame
        frame.setVisible(true);                //Showing frame
    }
}
```

### INI

``` ini
; last modified 1 April 2011 by John Doe
[owner]
name=John Doe
organization=Mattermost
```

### Latex Equation

``` latex
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x).
```

### Latex Document

``` latex
\documentclass{article} 
\begin{document} 
\noindent
Are $a, b \in \mathbb{R}, then applies (a+b)^{2} = a^{2} + ab + b^{2} $ \\ 
better \\ 
are $a, b \in \mathbb{R}, \textrm{then applies} \, (a+b)^{2 } = a^{2 } + ab + b^{2}$\\ 
\end{document} 
```

