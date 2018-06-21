import * as log4js from 'log4js';
import { TestRunner, TestResult, RunStatus, RunResult, RunnerOptions, CoverageCollection, CoveragePerTestResult } from 'stryker-api/test_runner';
import * as karma from 'karma';
import { KARMA_CONFIG, KARMA_CONFIG_FILE } from './configKeys';
import TestHooksMiddleware from './TestHooksMiddleware';
import { setGlobalLogLevel } from 'log4js';
import StrykerReporter from './StrykerReporter';
import strykerKarmaConf = require('./stryker-karma.conf');

let cli = require('@angular/cli/lib/cli');
if ('default' in cli) {
  cli = cli.default;
}

export interface ConfigOptions extends karma.ConfigOptions {
  coverageReporter?: { type: string, dir?: string, subdir?: string };
  detached?: boolean;
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

    strykerKarmaConf.setGlobals({
      port: options.port,
      karmaConfig: options.strykerOptions[KARMA_CONFIG],
      karmaConfigFile: options.strykerOptions[KARMA_CONFIG_FILE]
    });

    this.resetRun()
    this.listenToRunComplete();
    this.listenToSpecComplete();
    this.listenToCoverage();
    this.listenToBrowserError();
  }

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
