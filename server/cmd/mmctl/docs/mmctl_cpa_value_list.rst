.. _mmctl_cpa_value_list:

mmctl cpa value list
--------------------

List CPA values for a user

Synopsis
~~~~~~~~


List all Custom Profile Attribute values for a specific user.

::

  mmctl cpa value list [user] [flags]

Examples
~~~~~~~~

::

    cpa value list john.doe@company.com
    cpa value list johndoe

Options
~~~~~~~

::

  -h, --help   help for list

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

* `mmctl cpa value <mmctl_cpa_value.rst>`_ 	 - Management of CPA values

