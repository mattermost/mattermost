.. _mmctl_ldap_job_show:

mmctl ldap job show
-------------------

Show LDAP sync job

Synopsis
~~~~~~~~


Show LDAP sync job

::

  mmctl ldap job show [ldapJobID] [flags]

Examples
~~~~~~~~

::

   import ldap show f3d68qkkm7n8xgsfxwuo498rah

Options
~~~~~~~

::

  -h, --help   help for show

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

* `mmctl ldap job <mmctl_ldap_job.rst>`_ 	 - List and show LDAP sync jobs

