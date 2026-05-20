.. _mmctl_user_deactivate:

mmctl user deactivate
---------------------

Deactivate users

Synopsis
~~~~~~~~


Deactivate users. Deactivated users are immediately logged out of all sessions and are unable to log back in.

::

  mmctl user deactivate [emails, usernames, userIds] [flags]

Examples
~~~~~~~~

::

    user deactivate user@example.com
    user deactivate username

Options
~~~~~~~

::

  -h, --help   help for deactivate

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

