import KarmaTestRunner from './src/KarmaTestRunner';


const runner = new KarmaTestRunner({
  port: 7654,
  fileNames: [],
  strykerOptions: {
    karmaConfigFile: 'src/karma.conf.js'
  }
});

runner.init()
  .then(() => runner.run({}))
  .then(runResult => {
    console.log(runResult);
    debugger;
  });