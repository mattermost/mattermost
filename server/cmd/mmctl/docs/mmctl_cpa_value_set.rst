.. _mmctl_cpa_value_set:

mmctl cpa value set
-------------------

Set a CPA value for a user

Synopsis
~~~~~~~~


Set a Custom Profile Attribute field value for a specific user.

::

  mmctl cpa value set [user] [field-id] [flags]

Examples
~~~~~~~~

::

    cpa value set john.doe@company.com kx8m2w4r9p3q7n5t1j6h8s4c9e --value "Engineering"
    cpa value set johndoe q7n3t8w5r2m9k4x6p1j3h7s8c4 --value "Go" --value "React" --value "Python"
    cpa value set user123 w9r5t2n8k4x7p3q6m1j9h4s7c2 --value "Senior"

Options
~~~~~~~

::

  -h, --help            help for set
      --value strings   Value(s) to set for the field. Can be specified multiple times for multiselect/multiuser fields

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

