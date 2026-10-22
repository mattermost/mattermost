// The files a run keeps in its working directory, outside the repository.
//
//   plan.json               what plan.mjs decided
//   worklists/<locale>.json one locale's work, with hints, for its translator
//   strings.json            every new and changed English string, for the
//                           description and glossary passes
//   undescribed.json        worklist keys with no description, when there are any
//   translations/<locale>.json  each translator's answer
import fs from 'fs';
import path from 'path';

export const PLAN_VERSION = 1;

export const paths = (workdir) => ({
    plan: path.join(workdir, 'plan.json'),
    worklists: path.join(workdir, 'worklists'),
    worklist: (locale) => path.join(workdir, 'worklists', `${locale}.json`),
    strings: path.join(workdir, 'strings.json'),
    undescribed: path.join(workdir, 'undescribed.json'),
    translations: path.join(workdir, 'translations'),
    translation: (locale) => path.join(workdir, 'translations', `${locale}.json`),
});

export const writeJSON = (file, body) => {
    fs.mkdirSync(path.dirname(file), {recursive: true});
    fs.writeFileSync(file, JSON.stringify(body, null, 2) + '\n');
};

export const readJSON = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
