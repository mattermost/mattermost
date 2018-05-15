package web

import (
	"net/http"
	"testing"
)

func TestRequireHookId(t *testing.T) {
	c := &Context{}
	t.Run("WhenHookIdIsValid", func(t *testing.T) {
		c.Params = &Params{HookId: "abcdefghijklmnopqrstuvwxyz"}
		c.RequireHookId()

		if c.Err != nil {
			t.Fatal("Hook Id is Valid. Should not have set error in context")
		}
	})

	t.Run("WhenHookIdIsInvalid", func(t *testing.T) {
		c.Params = &Params{HookId: "abc"}
		c.RequireHookId()

		if c.Err == nil {
			t.Fatal("Should have set Error in context")
		}

		if c.Err.StatusCode != http.StatusBadRequest {
			t.Fatal("Should have set status as 400")
		}
	})
}
