A reader for Microsoft's Compound File Binary File Format.

Example usage:

    file, _ := os.Open("test/test.doc")
    defer file.Close()
    doc, err := mscfb.New(file)
    if err != nil {
      log.Fatal(err)
    }
    for entry, err := doc.Next(); err == nil; entry, err = doc.Next() {
      buf := make([]byte, 512)
      i, _ := doc.Read(buf)
      if i > 0 {
        fmt.Println(buf[:i])
      }
      fmt.Println(entry.Name)
    }

The Compound File Binary File Format is also known as the Object Linking and Embedding (OLE) or Component Object Model (COM) format and was used by early MS software such as MS Office. See [http://msdn.microsoft.com/en-us/library/dd942138.aspx](http://msdn.microsoft.com/en-us/library/dd942138.aspx) for more details

Install with `go get github.com/richardlehane/mscfb`

[![Build Status](https://travis-ci.org/richardlehane/mscfb.png?branch=master)](https://travis-ci.org/richardlehane/mscfb)