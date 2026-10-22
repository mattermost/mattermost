// The files a run keeps in its working directory, outside the repository.
//
//   plan.json               what plan.mjs decided
//   worklists/<locale>.json one locale's work, for its translator
//   strings.json            every new and changed English string, for the
//                           description and glossary passes
//   undescribed.json        worklist keys with no description, when there are any
import fs from 'fs';
import path from 'path';

export const PLAN_VERSION = 1;

export const paths = (workdir) => ({
    plan: path.join(workdir, 'plan.json'),
    worklists: path.join(workdir, 'worklists'),
    worklist: (locale) => path.join(workdir, 'worklists', `${locale}.json`),
    strings: path.join(workdir, 'strings.json'),
    undescribed: path.join(workdir, 'undescribed.json'),
});

export const writeJSON = (file, body) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
};
