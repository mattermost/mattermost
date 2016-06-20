Amazon Simple Queue Service API Client Written in Golang.
=========================================================

Merged from https://github.com/Mistobaan/sqs

Installation
------------

    go get github.com/goamz/goamz/sqs

Documentation
-------------

http://godoc.org/github.com/goamz/goamz/sqs


Sample Usage
------------

    var auth = aws.Auth{
      AccessKey: os.Getenv("AWS_ACCESS_KEY_ID"),
      SecretKey: os.Getenv("AWS_SECRET_ACCESS_KEY"),
    }

    conn := sqs.New(auth, aws.USEast)

    q, err := conn.CreateQueue(queueName)
    if err != nil {
      log.Fatalf(err.Error())
    }

    q.SendMessage(batch)


Testing
-------

    go test .
