import { requireModule } from '../utils';

export async function start(): Promise<void> {
  const karma = requireModule('karma');
  new karma.Server({
    configFile: require.resolve('../stryker-karma.conf'),
  }).start();
}