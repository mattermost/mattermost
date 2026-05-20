.. _mmctl_permissions_reset:

mmctl permissions reset
-----------------------

Reset default permissions for role (EE Only)

Synopsis
~~~~~~~~


Reset the given role's permissions to the set that was originally released with

::

  mmctl permissions reset <role_name> [flags]

Examples
~~~~~~~~

::

    # Reset the permissions of the 'system_read_only_admin' role.
    $ mmctl permissions reset system_read_only_admin

Options
~~~~~~~

::

  -h, --help   help for reset

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

* `mmctl permissions <mmctl_permissions.rst>`_ 	 - Management of permissions

