// Shape produced by docs/site/scripts/gen-plugin-godocs — kept in sync manually since the
// generator is Go and can't share TS types directly.
export type GoField = {
  Names?: string[];
  Type: string;
};

export type GoMethodDocs = {
  Name: string;
  Tags?: string[];
  HTML: string;
  Parameters?: GoField[];
  Results?: GoField[];
};

export type GoInterfaceDocs = {
  HTML: string;
  Tags?: string[] | null;
  Methods?: GoMethodDocs[] | null;
};

export type GoExampleDocs = {
  HTML: string;
  Code: string;
};

export type GoDocs = {
  HTML: string;
  API: GoInterfaceDocs;
  Hooks: GoInterfaceDocs;
  Helpers: GoInterfaceDocs;
  Examples: Record<string, GoExampleDocs>;
};

// "[]" / "*" / "..." prefixes, and package-qualified names (e.g.
// "github.com/mattermost/mattermost/server/public/model.Manifest"), mirroring the old Hugo
// `TypeString` shortcode define — take the last "/"-delimited segment, keeping the "pkg.Type"
// suffix intact.
export function typeText(type: string): string {
  if (type.startsWith('[]')) return '[]' + typeText(type.slice(2));
  if (type.startsWith('*')) return '*' + typeText(type.slice(1));
  if (type.startsWith('...')) return '...' + typeText(type.slice(3));
  if (type.startsWith('map[')) {
    let depth = 0;
    let i = 4;
    for (; i < type.length; i++) {
      if (type[i] === '[') depth++;
      else if (type[i] === ']') {
        if (depth === 0) break;
        depth--;
      }
    }
    return `map[${typeText(type.slice(4, i))}]${typeText(type.slice(i + 1))}`;
  }
  const parts = type.split('/');
  return parts[parts.length - 1];
}

export function fieldsText(fields?: GoField[]): string {
  if (!fields || fields.length === 0) return '';
  return fields
    .map((f) => (f.Names?.length ? `${f.Names.join(', ')} ` : '') + typeText(f.Type))
    .join(', ');
}

export function resultsText(results?: GoField[]): string {
  if (!results || results.length === 0) return '';
  const needsParens = results.length > 1 || Boolean(results[0].Names?.length);
  const inner = fieldsText(results);
  return needsParens ? `(${inner})` : inner;
}

export function signatureText(method: GoMethodDocs): string {
  const params = fieldsText(method.Parameters);
  const results = resultsText(method.Results);
  return `${method.Name}(${params})${results ? ' ' + results : ''}`;
}

export function displayExampleName(name: string): string {
  const stripped = name.replace(/^_/, '');
  return stripped.charAt(0).toUpperCase() + stripped.slice(1);
}
