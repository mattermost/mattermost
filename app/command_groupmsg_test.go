package app

import (
	"testing"
)

func TestGroupMsgUsernames(t *testing.T) {
	if users, parsedMessage := groupMsgUsernames(""); len(users) != 0 || parsedMessage != "" {
		t.Fatal("error parsing empty message")
	}
	if users, parsedMessage := groupMsgUsernames("test"); len(users) != 1 || parsedMessage != "" {
		t.Fatal("error parsing simple user")
	}
	if users, parsedMessage := groupMsgUsernames("test1, test2, test3 , test4"); len(users) != 4 || parsedMessage != "" {
		t.Fatal("error parsing various users")
	}

	if users, parsedMessage := groupMsgUsernames("test1, test2 message with spaces"); len(users) != 2 || parsedMessage != "message with spaces" {
		t.Fatal("error parsing message")
	}

	if users, parsedMessage := groupMsgUsernames("test1, test2 message with, comma"); len(users) != 2 || parsedMessage != "message with, comma" {
		t.Fatal("error parsing messages with comma")
	}

	if users, parsedMessage := groupMsgUsernames("test1,,,test2"); len(users) != 2 || parsedMessage != "" {
		t.Fatal("error parsing multiple commas in username ")
	}

	if users, parsedMessage := groupMsgUsernames("    test1,       test2     other message         "); len(users) != 2 || parsedMessage != "other message" {
		t.Fatal("error parsing strange usage of spaces")
	}

	if users, _ := groupMsgUsernames("    test1,       test2,,123,@321,+123"); len(users) != 5 || users[0] != "test1" || users[1] != "test2" || users[2] != "123" || users[3] != "321" || users[4] != "+123" {
		t.Fatal("error parsing different types of users")
	}
}
