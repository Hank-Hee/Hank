export interface AppBindings {
  APP_VERSION: string;
}

export interface AppVariables {
  requestId: string;
}

export type AppEnvironment = {
  Bindings: AppBindings;
  Variables: AppVariables;
};
