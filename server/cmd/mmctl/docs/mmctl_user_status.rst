.. _mmctl_user_status:

mmctl user status
-----------------

Get a user's status

Synopsis
~~~~~~~~


Get a user's presence status: online, away, dnd or offline.

::

  mmctl user status [flags]

Examples
~~~~~~~~

::

    # You can get the status of the currently authenticated user
    $ mmctl user status

    # You can get the status of a specific user
    $ mmctl user status --user user@example.com

    # In local mode there is no authenticated user, so the --user flag is required
    $ mmctl --local user status --user user@example.com

Options
~~~~~~~

::

  -h, --help          help for status
      --user string   Optional. The user (specified by email, username or ID) whose status to get. Defaults to the currently authenticated user. Required in local mode.

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

* `mmctl user <mmctl_user.rst>`_ 	 - Management of users
* `mmctl user status set <mmctl_user_status_set.rst>`_ 	 - Set a user's status

