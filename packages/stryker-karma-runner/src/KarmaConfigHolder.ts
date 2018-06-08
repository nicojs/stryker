import { ConfigOptions } from 'karma';

export default class KarmaConfigHolder {
  static karmaConfig: ConfigOptions | undefined;
  static karmaConfigFile: string | undefined;
  static port: number;
}