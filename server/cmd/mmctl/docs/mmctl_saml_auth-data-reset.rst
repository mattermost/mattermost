.. _mmctl_saml_auth-data-reset:

mmctl saml auth-data-reset
--------------------------

Reset AuthData field to Email

Synopsis
~~~~~~~~


Resets the AuthData field for SAML users to their email. Run this utility after setting the 'id' SAML attribute to an empty value.

::

  mmctl saml auth-data-reset [flags]

Examples
~~~~~~~~

::

    # Reset all SAML users' AuthData field to their email, including deleted users
    $ mmctl saml auth-data-reset --include-deleted

    # Show how many users would be affected by the reset
    $ mmctl saml auth-data-reset --dry-run

    # Skip confirmation for resetting the AuthData
    $ mmctl saml auth-data-reset -y

    # Only reset the AuthData for the following SAML users
    $ mmctl saml auth-data-reset --users userid1,userid2

Options
~~~~~~~

::

      --dry-run           Dry run only
  -h, --help              help for auth-data-reset
      --include-deleted   Include deleted users
      --users strings     Comma-separated list of user IDs to which the operation will be applied
  -y, --yes               Skip confirmation

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

* `mmctl saml <mmctl_saml.rst>`_ 	 - SAML related utilities

