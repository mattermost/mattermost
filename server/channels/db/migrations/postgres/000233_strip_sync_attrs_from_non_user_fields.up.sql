UPDATE PropertyFields
SET Attrs = Attrs - 'ldap' - 'saml',
    UpdateAt = EXTRACT(EPOCH FROM NOW())::BIGINT * 1000
WHERE ObjectType != 'user'
  AND ObjectType != 'template'
  AND (Attrs ? 'ldap' OR Attrs ? 'saml');
