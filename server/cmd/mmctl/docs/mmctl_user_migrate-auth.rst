.. _mmctl_user_migrate-auth:

mmctl user migrate-auth
-----------------------

Mass migrate user accounts authentication type

Synopsis
~~~~~~~~


Migrates accounts from one authentication provider to either LDAP or SAML. For example, you can upgrade your authentication provider from Email to LDAP.

Arguments:
  from_auth:
    The authentication service to migrate users accounts from.
    Supported options: email, gitlab, google, ldap, office365, saml.

  to_auth:
    The authentication service to migrate users to.
    Supported options: ldap, saml.

  migration-options (ldap):
    match_field:
      The field that is guaranteed to be the same in both authentication services. For example, if the users emails are consistent set to email.
      Supported options: email, username.

  migration-options (saml):
    users_file:
      The path of a json file with the usernames and emails of all users to migrate to SAML. The username and email must be the same that the SAML service provider store. And the email must match with the email in mattermost database.

      Example json content:
        {
          "usr1@email.com": "usr.one",
          "usr2@email.com": "usr.two"
        }


::

  mmctl user migrate-auth [from_auth] [to_auth] [migration-options] [flags]

Examples
~~~~~~~~

::

  user migrate-auth email saml users.json

Options
~~~~~~~

::

      --auto      Automatically migrate all users. Assumes the usernames and emails are identical between Mattermost and SAML services. (saml only)
      --confirm   Confirm you really want to proceed with auto migration. (saml only)
      --force     Force the migration to occur even if there are duplicates on the LDAP server. Duplicates will not be migrated. (ldap only)
  -h, --help      help for migrate-auth

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

