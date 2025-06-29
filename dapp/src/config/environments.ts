import { BUILD_ENV } from "@mocanetwork/airkit";

export interface EnvironmentConfig {
  widgetUrl: string;
  apiUrl: string;
}

export const ENVIRONMENT_CONFIGS: Record<string, EnvironmentConfig> = {
  [BUILD_ENV.STAGING]: {
    widgetUrl: "https://credential-widget.test.air3.com",
    apiUrl: "https://credential.api.test.air3.com",
  },
  [BUILD_ENV.SANDBOX]: {
    widgetUrl: "https://credential-widget.sandbox.air3.com",
    apiUrl: "https://credential.api.sandbox.air3.com",
  },
};

export const getEnvironmentConfig = (env: string): EnvironmentConfig => {
  return ENVIRONMENT_CONFIGS[env] || ENVIRONMENT_CONFIGS[BUILD_ENV.SANDBOX];
};
