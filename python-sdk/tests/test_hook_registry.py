# Copyright (c) 2015-present Mattermost, Inc. All Rights Reserved.
# See LICENSE.txt for license information.

"""
Tests for hook registration mechanism.

Tests verify:
- Decorated methods are discovered via __init_subclass__
- Duplicate registration fails loudly
- implemented_hooks() emits canonical names
- Various decorator forms work correctly
"""

import pytest

from mattermost_plugin import Plugin, hook, HookName, HookRegistrationError


class TestHookDecorator:
    """Tests for the @hook decorator."""

    def test_hook_with_enum(self) -> None:
        """Test @hook(HookName.X) form."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def my_activate(self) -> None:
                pass

        assert TestPlugin.has_hook("OnActivate")
        assert "OnActivate" in TestPlugin.implemented_hooks()

    def test_hook_with_string(self) -> None:
        """Test @hook("HookName") form."""

        class TestPlugin(Plugin):
            @hook("OnDeactivate")
            def handle_deactivate(self) -> None:
                pass

        assert TestPlugin.has_hook("OnDeactivate")
        assert "OnDeactivate" in TestPlugin.implemented_hooks()

    def test_hook_inferred_from_name(self) -> None:
        """Test @hook form that infers name from method."""

        class TestPlugin(Plugin):
            @hook
            def OnActivate(self) -> None:
                pass

        assert TestPlugin.has_hook("OnActivate")

    def test_hook_preserves_function_metadata(self) -> None:
        """Test that @hook preserves __name__ and __doc__."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def my_activate(self) -> None:
                """My activation handler."""
                pass

        # Get the handler from registry
        handler = TestPlugin._hook_registry.get("OnActivate")
        assert handler is not None
        assert handler.__name__ == "my_activate"
        assert handler.__doc__ == "My activation handler."

    def test_invalid_hook_name_raises(self) -> None:
        """Test that invalid hook names raise HookRegistrationError."""
        with pytest.raises(HookRegistrationError, match="Unknown hook name"):

            class TestPlugin(Plugin):
                @hook("InvalidHookName")
                def bad_hook(self) -> None:
                    pass


class TestPluginRegistration:
    """Tests for Plugin base class hook discovery."""

    def test_multiple_hooks_registered(self) -> None:
        """Test that multiple hooks are discovered."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

            @hook(HookName.OnDeactivate)
            def deactivate(self) -> None:
                pass

            @hook(HookName.MessageWillBePosted)
            def filter_message(self, context: object, post: object) -> tuple:
                return post, ""

        hooks = TestPlugin.implemented_hooks()
        assert len(hooks) == 3
        assert "OnActivate" in hooks
        assert "OnDeactivate" in hooks
        assert "MessageWillBePosted" in hooks

    def test_duplicate_hook_raises(self) -> None:
        """Test that registering the same hook twice raises error."""
        with pytest.raises(HookRegistrationError, match="Duplicate hook registration"):

            class TestPlugin(Plugin):
                @hook(HookName.OnActivate)
                def activate1(self) -> None:
                    pass

                @hook(HookName.OnActivate)
                def activate2(self) -> None:
                    pass

    def test_implemented_hooks_is_sorted(self) -> None:
        """Test that implemented_hooks() returns sorted list."""

        class TestPlugin(Plugin):
            @hook(HookName.UserHasLoggedIn)
            def login(self) -> None:
                pass

            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

            @hook(HookName.MessageWillBePosted)
            def message(self, c: object, p: object) -> tuple:
                return p, ""

        hooks = TestPlugin.implemented_hooks()
        assert hooks == sorted(hooks)

    def test_subclass_does_not_inherit_parent_hooks(self) -> None:
        """Test that subclasses have their own hook registry."""

        class ParentPlugin(Plugin):
            @hook(HookName.OnActivate)
            def parent_activate(self) -> None:
                pass

        class ChildPlugin(ParentPlugin):
            @hook(HookName.OnDeactivate)
            def child_deactivate(self) -> None:
                pass

        # Child should have both inherited and own hooks
        # (because dir() sees inherited methods)
        child_hooks = ChildPlugin.implemented_hooks()
        assert "OnActivate" in child_hooks
        assert "OnDeactivate" in child_hooks

        # Parent should only have its own hook
        parent_hooks = ParentPlugin.implemented_hooks()
        assert "OnActivate" in parent_hooks
        assert "OnDeactivate" not in parent_hooks

    def test_has_hook_returns_false_for_missing(self) -> None:
        """Test has_hook returns False for unimplemented hooks."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

        assert TestPlugin.has_hook("OnActivate")
        assert not TestPlugin.has_hook("OnDeactivate")
        assert not TestPlugin.has_hook("NonExistentHook")


class TestPluginInvocation:
    """Tests for hook invocation via Plugin instance."""

    def test_invoke_hook_calls_handler(self) -> None:
        """Test that invoke_hook calls the registered handler."""
        call_count = [0]

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> str:
                call_count[0] += 1
                return "activated"

        plugin = TestPlugin()
        result = plugin.invoke_hook("OnActivate")

        assert call_count[0] == 1
        assert result == "activated"

    def test_invoke_hook_returns_none_for_missing(self) -> None:
        """Test that invoke_hook returns None for unimplemented hooks."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> None:
                pass

        plugin = TestPlugin()
        result = plugin.invoke_hook("OnDeactivate")
        assert result is None

    def test_invoke_hook_passes_arguments(self) -> None:
        """Test that invoke_hook passes arguments to handler."""
        received_args = []

        class TestPlugin(Plugin):
            @hook(HookName.MessageWillBePosted)
            def filter_message(self, context: object, post: object) -> tuple:
                received_args.append((context, post))
                return post, ""

        plugin = TestPlugin()
        ctx = {"request_id": "123"}
        post = {"message": "hello"}

        plugin.invoke_hook("MessageWillBePosted", ctx, post)

        assert len(received_args) == 1
        assert received_args[0] == (ctx, post)

    def test_get_hook_handler_returns_bound_method(self) -> None:
        """Test that get_hook_handler returns a callable bound method."""

        class TestPlugin(Plugin):
            @hook(HookName.OnActivate)
            def activate(self) -> str:
                return "from handler"

        plugin = TestPlugin()
        handler = plugin.get_hook_handler("OnActivate")

        assert handler is not None
        assert callable(handler)
        assert handler() == "from handler"

    def test_get_hook_handler_returns_none_for_missing(self) -> None:
        """Test that get_hook_handler returns None for missing hooks."""

        class TestPlugin(Plugin):
            pass

        plugin = TestPlugin()
        handler = plugin.get_hook_handler("OnActivate")
        assert handler is None


class TestHookNameEnum:
    """Tests for HookName enum."""

    def test_enum_values_are_strings(self) -> None:
        """Test that HookName values are strings."""
        assert HookName.OnActivate == "OnActivate"
        assert HookName.MessageWillBePosted == "MessageWillBePosted"

    def test_enum_can_be_used_in_comparisons(self) -> None:
        """Test that HookName can be compared with strings."""
        assert HookName.OnActivate == "OnActivate"
        assert "OnActivate" == HookName.OnActivate

    def test_all_hooks_from_proto_are_present(self) -> None:
        """Test that key hooks from hooks.proto are in the enum."""
        expected_hooks = [
            "OnActivate",
            "OnDeactivate",
            "OnConfigurationChange",
            "OnInstall",
            "MessageWillBePosted",
            "MessageWillBeUpdated",
            "MessageHasBeenPosted",
            "UserHasBeenCreated",
            "UserWillLogIn",
            "ChannelHasBeenCreated",
            "ExecuteCommand",
            "OnWebSocketConnect",
        ]

        for hook_name in expected_hooks:
            assert hasattr(HookName, hook_name), f"Missing hook: {hook_name}"
            assert HookName[hook_name].value == hook_name
