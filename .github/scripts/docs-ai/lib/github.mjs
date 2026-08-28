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
  return res.status === 204 ? null : res.json();
}

export async function* issueComments(repo, pr, {request = gh, perPage = PER_PAGE} = {}) {
  for (let page = 1; ; page++) {
    const batch = await request(`/repos/${repo}/issues/${pr}/comments?per_page=${perPage}&page=${page}`);
    yield* batch;
    if (batch.length < perPage) return;
  }
}

export async function findStickyComment(repo, pr, {marker, request = gh}) {
  for await (const c of issueComments(repo, pr, {request})) {
    // The marker is an invisible HTML comment, so anyone able to comment could
    // plant one and have the next run overwrite their post.
    if (c.body?.includes(marker) && c.user?.type === 'Bot') return c;
  }
  return null;
}

export async function createComment(repo, pr, body, {request = gh} = {}) {
  const created = await request(`/repos/${repo}/issues/${pr}/comments`, {method: 'POST', body: {body}});
  return created?.id;
}

export async function updateComment(repo, id, body, {request = gh} = {}) {
  await request(`/repos/${repo}/issues/comments/${id}`, {method: 'PATCH', body: {body}});
}

export async function upsertStickyComment(repo, pr, {marker, body, request = gh}) {
  const existing = await findStickyComment(repo, pr, {marker, request});
  if (existing) {
    await updateComment(repo, existing.id, body, {request});
    return {action: 'updated', id: existing.id};
  }
  return {action: 'created', id: await createComment(repo, pr, body, {request})};
}

export async function issueLabels(repo, pr, {request = gh} = {}) {
  const labels = await request(`/repos/${repo}/issues/${pr}/labels?per_page=${PER_PAGE}`);
  return labels.map((l) => l.name);
}

export async function addLabel(repo, pr, label, {request = gh} = {}) {
  await request(`/repos/${repo}/issues/${pr}/labels`, {method: 'POST', body: {labels: [label]}});
}

export async function removeLabel(repo, pr, label, {request = gh} = {}) {
  // Label names contain a slash, so they must be encoded into the path.
  const path = `/repos/${repo}/issues/${pr}/labels/${encodeURIComponent(label)}`;
  try {
    await request(path, {method: 'DELETE'});
  } catch (e) {
    // A human getting there first is a race we win by doing nothing.
    if (!/-> 404/.test(e.message)) throw e;
  }
}
