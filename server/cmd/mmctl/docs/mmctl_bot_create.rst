.. _mmctl_bot_create:

mmctl bot create
----------------

Create bot

Synopsis
~~~~~~~~


Create bot.

::

  mmctl bot create [username] [flags]

Examples
~~~~~~~~

::

    bot create testbot

Options
~~~~~~~

::

      --description string    Optional. The description text for the new bot.
      --display-name string   Optional. The display name for the new bot.
  -h, --help                  help for create
      --with-token            Optional. Auto genreate access token for the bot.

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

* `mmctl bot <mmctl_bot.rst>`_ 	 - Management of bots

