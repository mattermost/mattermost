UPDATE PropertyFields
SET Attrs = Attrs - 'ldap' - 'saml'
WHERE ObjectType != 'user'
  AND ObjectType != 'template'
  AND (Attrs ? 'ldap' OR Attrs ? 'saml');
