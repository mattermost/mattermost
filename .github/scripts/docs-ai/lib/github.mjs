const PER_PAGE = 100;

export async function gh(path, {method = 'GET', body} = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      'content-type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    throw new Error(`GitHub ${method} ${path} -> ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

export async function* issueComments(repo, pr, {request = gh, perPage = PER_PAGE} = {}) {
  for (let page = 1; ; page++) {
    const batch = await request(`/repos/${repo}/issues/${pr}/comments?per_page=${perPage}&page=${page}`);
    yield* batch;
    if (batch.length < perPage) return;
  }
}

export async function upsertStickyComment(repo, pr, {marker, body, request = gh}) {
  for await (const c of issueComments(repo, pr, {request})) {
    if (c.body?.includes(marker) && c.user?.type === 'Bot') {
      await request(`/repos/${repo}/issues/comments/${c.id}`, {method: 'PATCH', body: {body}});
      return {action: 'updated', id: c.id};
    }
  }

  const created = await request(`/repos/${repo}/issues/${pr}/comments`, {method: 'POST', body: {body}});
  return {action: 'created', id: created?.id};
}
