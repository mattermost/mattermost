import ReplaceSource from 'webpack-sources/lib/ReplaceSource';
import SourceMapSource from 'webpack-sources/lib/SourceMapSource';


function isBuilt(module) {
  return module.rawRequest && module.built;
}

function getId(module) {
  return module.rawRequest;
}

function setTrue(acc, key) {
  acc[key] = true; // eslint-disable-line no-param-reassign
  return acc;
}

function getAffectedFiles(modules) {
  return modules
    .filter(isBuilt)
    .map(getId)
    .reduce(setTrue, {});
}

function findAllDependentFiles(affectedFiles, seen, module) {
  if (seen[module.rawRequest]) return;
  seen[module.rawRequest] = true; // eslint-disable-line no-param-reassign

  if (affectedFiles[module.rawRequest]) return;
  if (!module.dependencies) return;
  if (!module.rawRequest) return;

  module.dependencies.forEach((dependency) => {
    if (!dependency.module) return;

    findAllDependentFiles(affectedFiles, seen, dependency.module);
    if (affectedFiles[dependency.module.rawRequest]) {
      affectedFiles[module.rawRequest] = true; // eslint-disable-line no-param-reassign
    }
  });
}


export default class InjectChangedFilesPlugin {

  constructor() {
    this.failedFiles = [];
    this.hotFiles = [];
  }

  testsCompleted = (failed) => {
    if (failed) {
      [].push.apply(this.failedFiles, this.hotFiles);
    } else {
      this.failedFiles = [];
    }
  };


  apply(compiler) {
    compiler.plugin('this-compilation', (compilation) => {
      compilation.plugin('optimize-chunk-assets', (chunks, callback) => {
        chunks.forEach((chunk) => {
          // find changed files
          const affectedFiles = getAffectedFiles(chunk.modules);
          chunk.modules.forEach(findAllDependentFiles.bind(null, affectedFiles, {}));
          this.hotFiles = Object.keys(affectedFiles);

          // and finally set changed files
          chunk.files.forEach((file) => {
            if (!(chunk.isInitial ? chunk.isInitial() : chunk.initial)) {
              return;
            }
            this.setChangedFiles(compilation, file);
          });
        });
        callback();
      });
    });
  }

  setChangedFiles(compilation, file) {
    const original = compilation.assets[file];
    const originalSource = original.source();
    const originalMap = original.map();

    const result = new ReplaceSource(original);
    const regex = /__webpackManifest__\s*=\s*\[\s*\]/g;
    const files = this.hotFiles.concat(this.failedFiles);
    const changedFiles = `['${files.join("', '")}']`;
    const replacement = `__webpackManifest__ = ${changedFiles}`;

    let match;
    while ((match = regex.exec(originalSource)) !== null) { // eslint-disable-line no-cond-assign
      const start = match.index;
      const end = match.index + (match[0].length - 1);
      result.replace(start, end, replacement);
    }

    const resultSource = result.source();
    const resultMap = result.map();

    compilation.assets[file] = new SourceMapSource( // eslint-disable-line no-param-reassign
      resultSource,
      file,
      resultMap,
      originalSource,
      originalMap
    );
  }

}
