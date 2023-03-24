.. _mmctl_ldap_idmigrate:

mmctl ldap idmigrate
--------------------

Migrate LDAP IdAttribute to new value

Synopsis
~~~~~~~~


Migrate LDAP "IdAttribute" to a new value. Run this utility to change the value of your ID Attribute without your users losing their accounts. After running the command you can change the ID Attribute to the new value in the System Console. For example, if your current ID Attribute was "sAMAccountName" and you wanted to change it to "objectGUID", you would:

1. Wait for an off-peak time when your users won’t be impacted by a server restart.
2. Run the command "mmctl ldap idmigrate objectGUID".
3. Update the config within the System Console to the new value "objectGUID".
4. Restart the Mattermost server.

::

  mmctl ldap idmigrate <objectGUID> [flags]

Examples
~~~~~~~~

::

    ldap idmigrate objectGUID

Options
~~~~~~~

::

  -h, --help   help for idmigrate

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

* `mmctl ldap <mmctl_ldap.rst>`_ 	 - LDAP related utilities

