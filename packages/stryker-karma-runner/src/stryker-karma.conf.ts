import { Config, ConfigOptions } from 'karma';
import * as path from 'path';
import KarmaConfigHolder from './KarmaConfigHolder';
import { requireModule, touchSync } from './utils';
import TestHooksMiddleware, { TEST_HOOKS_FILE_NAME } from './TestHooksMiddleware';
import StrykerReporter from './StrykerReporter';
import { getLogger } from 'log4js';

const log = getLogger('stryker-karma.conf');

function setDefaultOptions(config: Config) {
  config.set({
    browsers: ['PhantomJS'],
    frameworks: ['jasmine']
  });
}

function setUserKarmaConfigFile(config: Config) {
  if (KarmaConfigHolder.karmaConfigFile && typeof KarmaConfigHolder.karmaConfigFile === 'string') {
    const configFileName = path.resolve(KarmaConfigHolder.karmaConfigFile);
    log.info('Importing config from "%s"', configFileName);
    try {
      const userConfig = requireModule(configFileName);
      userConfig(config);
      config.configFile = configFileName; // override config file so base path is resolved from correct dir.
    } catch (error) {
      log.error(`Could not read karma configuration from ${KarmaConfigHolder.karmaConfigFile}.`, error);
    }
  }
}

function setForcedOptions(config: Config) {
  config.set({
    // Override browserNoActivityTimeout. Default value 10000 might not enough to send perTest coverage results
    browserNoActivityTimeout: 1000000,
    // No auto watch, stryker will inform us when we need to test
    autoWatch: false,
    // Don't stop after first run
    singleRun: false,
    // Never detach, always run in this same process (is already a separate process)
    detached: false
  });
}

function setPort(config: Config) {
  config.set({
    port: KarmaConfigHolder.port
  })
}

function setUserKarmaConfig(config: Config) {
  if (KarmaConfigHolder.karmaConfig) {
    config.set(KarmaConfigHolder.karmaConfig);
  }
}

function addPlugin(karmaConfig: ConfigOptions, karmaPlugin: any) {
  karmaConfig.plugins = karmaConfig.plugins || ['karma-*'];
  karmaConfig.plugins.push(karmaPlugin);
}


/**
 * Configures the test hooks middleware. 
 * It adds a non-existing file to the top `files` array. 
 * Further more it configures a middleware that serves the file.
 */
function configureTestHooksMiddleware(config: Config) {
  // Add test run middleware file
  config.files = config.files || [];
  
  config.files.unshift({ pattern: TEST_HOOKS_FILE_NAME, included: true, watched: false, served: false, nocache: true }); // Add a custom hooks file to provide hooks
  const middleware: string[] = (config as any).middleware || ((config as any).middleware = []);
  middleware.unshift(TestHooksMiddleware.name);
  addPlugin(config, { [`middleware:${TestHooksMiddleware.name}`]: ['value', TestHooksMiddleware.instance.handler()] });
}

function configureStrykerReporter(config: Config) {
  addPlugin(config, { [`reporter:${StrykerReporter.name}`]: ['value', StrykerReporter.instance] });
  if (!config.reporters) {
    config.reporters = [];
  }
  config.reporters.push(StrykerReporter.name);
}

export = function (config: Config) {
  setDefaultOptions(config);
  setUserKarmaConfigFile(config);
  const basePath = config.basePath;
  setUserKarmaConfig(config);
  setForcedOptions(config);
  setPort(config);
  configureTestHooksMiddleware(config);
  configureStrykerReporter(config);
  config.basePath = basePath;
}
