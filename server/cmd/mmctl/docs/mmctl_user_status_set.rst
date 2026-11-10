.. _mmctl_user_status_set:

mmctl user status set
---------------------

Set a user's status

Synopsis
~~~~~~~~


Set a user's presence status. Allowed values are online, away, dnd and offline.

::

  mmctl user status set [status] [flags]

Examples
~~~~~~~~

::

    # You can set the status of the currently authenticated user
    $ mmctl user status set away

    # You can set the status of a specific user
    $ mmctl user status set --user user@example.com dnd

    # You can set a "dnd" status that expires at a given time (ISO 8601)
    $ mmctl user status set --user user@example.com --dnd-end-time 2100-01-02T15:04:05-07:00 dnd

Options
~~~~~~~

::

      --dnd-end-time string   Optional. The time at which a "dnd" status expires, formatted as ISO 8601 (e.g. 2006-01-02T15:04:05-07:00). Only valid with the "dnd" status.
  -h, --help                  help for set
      --user string           Optional. The user (specified by email, username or ID) whose status to set. Defaults to the currently authenticated user. Required in local mode.

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

* `mmctl user status <mmctl_user_status.rst>`_ 	 - Get a user's status

