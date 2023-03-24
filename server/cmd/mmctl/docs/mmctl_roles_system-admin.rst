.. _mmctl_roles_system-admin:

mmctl roles system-admin
------------------------

Set a user as system admin

Synopsis
~~~~~~~~


Make some users system admins.

::

  mmctl roles system-admin [users] [flags]

Examples
~~~~~~~~

::

    # You can make one user a sysadmin
    $ mmctl roles system-admin john_doe

    # Or promote multiple users at the same time
    $ mmctl roles system-admin john_doe jane_doe

Options
~~~~~~~

::

  -h, --help   help for system-admin

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

* `mmctl roles <mmctl_roles.rst>`_ 	 - Manage user roles

