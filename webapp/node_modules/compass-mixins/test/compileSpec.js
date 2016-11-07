var sass = require('node-sass');
var chalk = require('chalk');

describe("Imports", function () {
  it("should import all the provided files without an error", function (done) {
    var success = jasmine.createSpy('ImportSuccess');

    function complete() {
      expect(success).toHaveBeenCalled();
      done();
    }

    ["imports.scss", "imports_animation.scss"].forEach(function(importFile) {
      sass.render({
        file: __dirname + "/" + importFile,
      }, function(e, s) {
        if (e) {
          console.log(chalk.red("Sass error:"), e);
        } else {
          success();
        }
        complete();
      });
    });

  });
});
