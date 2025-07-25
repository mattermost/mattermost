.. _mmctl_user_deleteall:

mmctl user deleteall
--------------------

Delete all users and all posts. Local command only.

Synopsis
~~~~~~~~


Permanently delete all users and all related information including posts. This command can only be run in local mode.

::

  mmctl user deleteall [flags]

Examples
~~~~~~~~

::

    user deleteall

Options
~~~~~~~

::

      --confirm   Confirm you really want to delete the user and a DB backup has been performed
  -h, --help      help for deleteall

Options inherited from parent commands
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

::

      --config string                path to the configuration file (default "$XDG_CONFIG_HOME/mmctl/config")
      --disable-pager                disables paged output
      --insecure-sha1-intermediate   allows to use insecure TLS protocols, such as SHA-1
      --insecure-tls-version         allows to use TLS versions 1.0 and 1.1
      --json                         the output format will be in json format
      --local                        allows communicating with the server through a unix socket
      --local-user-id string         allows to set the user-id for local connections
      --quiet                        prevent mmctl to generate output for the commands
      --strict                       will only run commands if the mmctl version matches the server one
      --suppress-warnings            disables printing warning messages

SEE ALSO
~~~~~~~~

* `mmctl user <mmctl_user.rst>`_ 	 - Management of users

