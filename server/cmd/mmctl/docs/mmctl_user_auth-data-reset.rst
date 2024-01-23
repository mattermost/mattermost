.. _mmctl_user_auth-data-reset:

mmctl user auth-data-reset
--------------------------

Reset AuthData field to Email

Synopsis
~~~~~~~~


Resets the AuthData field for all OpenId, Gitlab, Office365, Google or SAML users to their email. For SAML, run this utility after setting the 'id' SAML attribute to an empty value.

::

  mmctl user auth-data-reset [auth_service] [flags]

Examples
~~~~~~~~

::

    # Reset all SAML users' AuthData field to their email, including deleted users
    $ mmctl user auth-data-reset saml --include-deleted

    # Show how many Office365 users would be affected by the reset
    $ mmctl user auth-data-reset office365 --dry-run

    # Skip confirmation for resetting the AuthData for openid users
    $ mmctl user auth-data-reset openid -y

    # Only reset the AuthData for the following Gitlab users
    $ mmctl user auth-data-reset gitlab --users userid1,userid2

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

* `mmctl user <mmctl_user.rst>`_ 	 - Management of users

