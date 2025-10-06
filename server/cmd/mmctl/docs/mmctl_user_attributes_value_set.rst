.. _mmctl_user_attributes_value_set:

mmctl user attributes value set
-------------------------------

Set a User Attributes value for a user

Synopsis
~~~~~~~~


Set a User Attributes field value for a specific user.

::

  mmctl user attributes value set [user] [field] [flags]

Examples
~~~~~~~~

::

    user attributes value set john.doe@company.com kx8m2w4r9p3q7n5t1j6h8s4c9e --value "Engineering"
    user attributes value set johndoe Department --value "Go" --value "React" --value "Python"
    user attributes value set user123 Skills --value "Senior"

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

* `mmctl user attributes value <mmctl_user_attributes_value.rst>`_ 	 - Management of User Attributes values

