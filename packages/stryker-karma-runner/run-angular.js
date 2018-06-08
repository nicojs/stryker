"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var KarmaTestRunner_1 = require("./src/KarmaTestRunner");
var runner = new KarmaTestRunner_1.default({
    port: 7654,
    fileNames: [],
    strykerOptions: {
        karmaConfigFile: 'src/karma.conf.js'
    }
});
runner.init()
    .then(function () { return runner.run({}); })
    .then(function (runResult) {
    console.log(runResult);
    debugger;
});
//# sourceMappingURL=run-angular.js.map