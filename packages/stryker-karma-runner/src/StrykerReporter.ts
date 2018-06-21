import { TestStatus, TestResult, CoverageCollection, CoverageCollectionPerTest, RunStatus } from 'stryker-api/test_runner';
import { EventEmitter } from 'events';
import * as karma from 'karma';

export interface KarmaSpec {
  description: string;
  id: string;
  skipped: boolean;
  success: boolean;
  time: number;
  suite: string[];
  log: string[];
}

/**
 * This is a singleton implementation of a KarmaReporter.
 * It is loaded by 
 */
export default class StrykerReporter extends EventEmitter {

  private constructor() {
    super();
  }

  private static _instance = new StrykerReporter();
  static get instance(): StrykerReporter {
    if (!this._instance) {
      this._instance = new StrykerReporter();
    }
    return this._instance;
  }

  onSpecComplete(browser: any, spec: KarmaSpec) {
    const name = `${spec.suite.join(' ')} ${spec.description}`;
    let status = TestStatus.Failed;
    if (spec.skipped) {
      status = TestStatus.Skipped;
    } else if (spec.success) {
      status = TestStatus.Success;
    }
    const testResult: TestResult = {
      name,
      status,
      timeSpentMs: spec.time,
      failureMessages: spec.log
    };
    this.emit('test_result', testResult);
  }

  onRunComplete(runResult: karma.TestResults) {
    this.emit('run_complete', this.collectRunState(runResult));
  }

  private collectRunState(runResult: karma.TestResults): RunStatus {
    if (runResult.disconnected) {
      return RunStatus.Timeout;
    } else if (runResult.error) {
      return RunStatus.Error;
    } else {
      return RunStatus.Complete;
    }
  }
  onBrowserComplete(browser: any, result: { coverage: CoverageCollection | CoverageCollectionPerTest }) {
    this.emit('coverage_report', result.coverage);
  }

  onBrowserReady(){
    this.emit('browsers_ready');
  }

  onBrowserError(browser: any, error: any) {
    // Karma 2.0 has different error messages
    if (error.message) {
      this.emit('browser_error', error.message);
    } else {
      this.emit('browser_error', error.toString());
    }
  };

}