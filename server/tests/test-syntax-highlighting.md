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

### Makefile

``` makefile
CC=gcc
CFLAGS=-I.

hellomake: hellomake.o hellofunc.o
     $(CC) -o hellomake hellomake.o hellofunc.o -I.
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

### Latex Equation

``` latex
\frac{d}{dx}\left( \int_{0}^{x} f(u)\,du\right)=f(x).
```
