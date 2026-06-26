.. _mmctl_system_nuke_users:

mmctl system nuke users
-----------------------

Delete all users and all posts. Local command only.

Synopsis
~~~~~~~~


Permanently delete all users and all related information including posts. This command can only be run in local mode.

::

  mmctl system nuke users [flags]

Examples
~~~~~~~~

::

    system nuke users

Options
~~~~~~~

::

      --confirm   Confirm you really want to permanently delete all users, posts, and related data, and that a DB backup has been performed
  -h, --help      help for users

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

* `mmctl system nuke <mmctl_system_nuke.rst>`_ 	 - Destructive operations that permanently delete data

