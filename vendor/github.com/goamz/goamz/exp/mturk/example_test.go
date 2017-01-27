package mturk_test

import (
	"fmt"
	"github.com/goamz/goamz/aws"
	"github.com/goamz/goamz/exp/mturk"
)

var turk *mturk.MTurk

func ExampleNew() {
	// These are your AWS tokens. Note that Turk do not support IAM.
	// So you'll have to use your main profile's tokens.
	var auth = aws.Auth{AccessKey: "<ACCESS_KEY>", SecretKey: "<SECRET_KEY>"}
	turk = mturk.New(auth, true) // true to use sandbox mode
}

func Examplemturk_CreateHIT_withExternalQuestion() {
	question := mturk.ExternalQuestion{
		ExternalURL: "http://www.amazon.com",
		FrameHeight: 200,
	}
	reward := mturk.Price{
		Amount:       "0.01",
		CurrencyCode: "USD",
	}

	hit, err := turk.CreateHIT("title", "description", question, reward, 30, 30, "key1,key2", 3, nil, "annotation")

	if err == nil {
		fmt.Println(hit)
	}
}

func Examplemturk_CreateHIT_withHTMLQuestion() {
	question := mturk.HTMLQuestion{
		HTMLContent: mturk.HTMLContent{`<![CDATA[
<!DOCTYPE html>
<html>
 <head>
  <meta http-equiv='Content-Type' content='text/html; charset=UTF-8'/>
  <script type='text/javascript' src='https://s3.amazonaws.com/mturk-public/externalHIT_v1.js'></script>
 </head>
 <body>
  <form name='mturk_form' method='post' id='mturk_form' action='https://www.mturk.com/mturk/externalSubmit'>
  <input type='hidden' value='' name='assignmentId' id='assignmentId'/>
  <h1>What's up?</h1>
  <p><textarea name='comment' cols='80' rows='3'></textarea></p>
  <p><input type='submit' id='submitButton' value='Submit' /></p></form>
  <script language='Javascript'>turkSetAssignmentID();</script>
 </body>
</html>
]]>`},
		FrameHeight: 200,
	}
	reward := mturk.Price{
		Amount:       "0.01",
		CurrencyCode: "USD",
	}

	hit, err := turk.CreateHIT("title", "description", question, reward, 30, 30, "key1,key2", 3, nil, "")

	if err == nil {
		fmt.Println(hit)
	}
}
