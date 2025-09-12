.. _mmctl_cpa_field_edit:

mmctl cpa field edit
--------------------

Edit a CPA field

Synopsis
~~~~~~~~


Edit an existing Custom Profile Attribute field.

::

  mmctl cpa field edit [field-id] [flags]

Examples
~~~~~~~~

::

    cpa field edit n4qdbtro4j8x3n8z81p48ww9gr --name "Department Name" --managed
    cpa field edit 8kj9xm4p6f3y7n2z9q5w8r1t4v --option Go --option React --option Python --option Java
    cpa field edit 3h7k9m2x5b8v4n6p1q9w7r3t2y --managed=false

Options
~~~~~~~

::

      --attrs string     Update full attrs JSON object
  -h, --help             help for edit
      --managed          Mark field as admin-managed (overrides --attrs)
      --name string      Update field name
      --option strings   Add an option for select/multiselect fields (overrides --attrs, can be repeated)

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

* `mmctl cpa field <mmctl_cpa_field.rst>`_ 	 - Management of CPA fields

