.. _mmctl_command_modify:

mmctl command modify
--------------------

Modify a slash command

Synopsis
~~~~~~~~


Modify a slash command. Commands can be specified by command ID.

::

  mmctl command modify [commandID] [flags]

Examples
~~~~~~~~

::

    command modify commandID --title MyModifiedCommand --description "My Modified Command Description" --trigger-word mycommand --url http://localhost:8000/my-slash-handler --creator myusername --response-username my-bot-username --icon http://localhost:8000/my-slash-handler-bot-icon.png --autocomplete --post

Options
~~~~~~~

::

      --autocomplete               Show Command in autocomplete list
      --autocompleteDesc string    Short Command Description for autocomplete list
      --autocompleteHint string    Command Arguments displayed as help in autocomplete list
      --creator string             Command Creator's username, email or id (required)
      --description string         Command Description
  -h, --help                       help for modify
      --icon string                Command Icon URL
      --post                       Use POST method for Callback URL
      --response-username string   Command Response Username
      --title string               Command Title
      --trigger-word string        Command Trigger Word (required)
      --url string                 Command Callback URL (required)

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl command <mmctl_command.rst>`_ 	 - Management of slash commands

