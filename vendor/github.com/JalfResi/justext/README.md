justext
=======

A Go package that implements the JusText boilerplate removal algorithm (http://code.google.com/p/justext/)

## Install

    go get github.com/JalfResi/justext

And import:

    import "github.com/JalfResi/justext"

## Usage

Supports all stoplist files available at http://code.google.com/p/justext/source/browse/#svn%2Ftrunk%2Fjustext%2Fstoplists

Justext expects valid HTML; it is your responsability to ensure that valid HTML is passed to Justext. To make things easier 
I have written a CGO wrapper around libtidy which you can find here: [github.com/JalfResi/GoTidy](https://github.com/JalfResi/GoTidy)
In the future, once exp/html is part of the standard packages I will refactor JusText to accept only valid HTML documents/strings.

Justext use the reader-writer idiom, alowing you to setup the reader with a common configuration and just pump out 
articles to the writer.

Example usage:

    // Create a justext reader from another reader
    reader := justext.NewReader(os.Stdin)
    
    // Configure the reader
    reader.LengthLow = 70
    reader.LengthHigh = 200
    reader.Stoplist = stoplist // The stoplist map[string]bool
    reader.StopwordsLow = 0.3
    reader.StopwordsHigh = 0.32
    reader.MaxLinkDensity = 0.2
    reader.MaxHeadingDistance = 200
    reader.NoHeadings = false
    
    // Read from the reader to generate a paragraph set
    paragraphSet, _ := reader.ReadAll()
    
    // Create a writer from another writer
    writer := justext.NewWriter(os.Stdout)
    // Write the paragraph set to the writer
    writer.WriteAll(paragraphSet)
    
    
