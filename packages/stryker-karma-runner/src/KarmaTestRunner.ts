import * as log4js from 'log4js';
import { TestRunner, TestResult, TestStatus, RunStatus, RunResult, RunnerOptions, CoverageCollection, CoveragePerTestResult } from 'stryker-api/test_runner';
import * as karma from 'karma';
import * as rawCoverageReporter from './RawCoverageReporter';
import { KARMA_CONFIG, KARMA_CONFIG_FILE } from './configKeys';
import TestHooksMiddleware, { TEST_HOOKS_FILE_NAME } from './TestHooksMiddleware';
import { touchSync } from './utils';
import { setGlobalLogLevel } from 'log4js';
import KarmaConfigReader from './KarmaConfigReader';
import KarmaConfigHolder from './KarmaConfigHolder';
import StrykerReporter from './StrykerReporter';
let cli = require('@angular/cli/lib/cli');
if ('default' in cli) {
  cli = cli.default;
}

export interface ConfigOptions extends karma.ConfigOptions {
  coverageReporter?: { type: string, dir?: string, subdir?: string };
  detached?: boolean;
}

interface KarmaSpec {
  description: string;
  id: string;
  skipped: boolean;
  success: boolean;
  time: number;
  suite: string[];
  log: string[];
}

const FORCED_OPTIONS = (() => {
  const config: ConfigOptions = {
    // Override browserNoActivityTimeout. Default value 10000 might not enough to send perTest coverage results
    browserNoActivityTimeout: 1000000,
    // Override base, we don't want to original karma baseDir to be interfering with the stryker setup
    basePath: '.',
    // No auto watch, stryker will inform us when we need to test
    autoWatch: false,
    // Don't stop after first run
    singleRun: false,
    // Never detach, always run in this same process (is already a separate process)
    detached: false
  };
  return Object.freeze(config);
})();

function defaultOptions(): Readonly<ConfigOptions> {
  return Object.freeze({
    browsers: ['PhantomJS'],
    frameworks: ['jasmine'],
  });
}

export default class KarmaTestRunner implements TestRunner {

  private log = log4js.getLogger(KarmaTestRunner.name);
  // private server: karma.Server;
  // private serverStartedPromise: Promise<void>;
  private currentTestResults: TestResult[];
  private currentErrorMessages: string[];
  private currentCoverageReport?: CoverageCollection | CoveragePerTestResult;
  private currentRunStatus: RunStatus;
  private readonly testHooksMiddleware = TestHooksMiddleware.instance;

  constructor(private options: RunnerOptions) {
    setGlobalLogLevel(options.strykerOptions.logLevel || 'info');
    KarmaConfigHolder.karmaConfig = options.strykerOptions[KARMA_CONFIG];
    KarmaConfigHolder.karmaConfigFile = options.strykerOptions[KARMA_CONFIG_FILE];
    KarmaConfigHolder.port = options.port;
    // let karmaConfig = this.readConfig(options);
    // karmaConfig = this.configureTestRunner(karmaConfig);
    // karmaConfig = this.configureCoverageIfEnabled(karmaConfig);
    // karmaConfig = this.configureProperties(karmaConfig);
    // karmaConfig = this.configureTestHooksMiddleware(karmaConfig);

    // this.log.debug(`using config ${JSON.stringify(karmaConfig, null, 2)}`);
    // this.server = new karma.Server(karmaConfig, function (exitCode) {
    //   process.exit(exitCode);
    // });
    this.resetRun() 
    this.listenToRunComplete();
    this.listenToSpecComplete();
    this.listenToCoverage();
    this.listenToBrowserError();

    // this.server.start();
  }

  // private readConfig(options: RunnerOptions): ConfigOptions {
  //   return Object.assign({}, new KarmaConfigReader(options.strykerOptions[KARMA_CONFIG_FILE]).read(), options.strykerOptions[KARMA_CONFIG]);
  // }

  init(): Promise<void> {
    return new Promise((res, rej) => {
      StrykerReporter.instance.on('browsers_ready', res);
      cli({
        cliArgs: ['test', `--karma-config=${require.resolve('./stryker-karma.conf')}`],
        inputStream: process.stdin,
        outputStream: process.stdout
      }).then(() => {
        console.log('cli done');
      }).catch(rej);
    });
  }

  resetRun() {
    this.currentTestResults = [];
    this.currentErrorMessages = [];
    this.currentCoverageReport = undefined;
    this.currentRunStatus = RunStatus.Complete;
  }

  run({ testHooks }: { testHooks?: string }): Promise<RunResult> {
    this.testHooksMiddleware.currentTestHooks = testHooks || '';
    this.resetRun();
    return this.runServer().then(() => this.collectRunResult());
  }

  // Don't use dispose() to stop karma (using karma.stopper.stop)
  // It only works when in `detached` mode, as specified here: http://karma-runner.github.io/1.0/config/configuration-file.html

  // private listenToBrowserStarted() {
  //   this.serverStartedPromise = new Promise<void>((res) => this.server.on('browsers_ready', res));
  // }

  private listenToSpecComplete() {
    StrykerReporter.instance.on('test_result', (testResult: TestResult) => {
      this.currentTestResults.push(testResult);
    });
  }

  private listenToCoverage() {
    StrykerReporter.instance.on('coverage_report', (coverageReport: CoverageCollection | CoveragePerTestResult) => {
      this.currentCoverageReport = coverageReport;
    });
  }

  private listenToRunComplete() {
    StrykerReporter.instance.on('run_complete', (runStatus: RunStatus) => {
      this.currentRunStatus = runStatus;
    });
  }

  private listenToBrowserError() {
    StrykerReporter.instance.on('browser_error', (error: string) => {
      this.currentErrorMessages.push(error);
    });
  }

  private runServer() {
    return new Promise<void>(resolve => {
      karma.runner.run({ port: this.options.port }, (exitCode) => {
        this.log.debug('karma run done with ', exitCode);
        resolve();
      });
    });
  }

  private collectRunResult(): RunResult {
    return {
      tests: this.currentTestResults,
      status: this.determineRunState(),
      coverage: this.currentCoverageReport,
      errorMessages: this.currentErrorMessages
    };
  }

  private determineRunState() {
    if (this.currentRunStatus === RunStatus.Error && !this.currentErrorMessages.length) {
      return RunStatus.Complete;
    }
    else {
      return this.currentRunStatus;
    }
  }
}
