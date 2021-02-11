import createFusionSubscription, { ConfigType, ResultType } from "../base";
import { onBecomeObserved, onBecomeUnobserved, runInAction } from "mobx";

const MOBX_FUSION = Symbol.for("MOBX_FUSION");
const MOBX_FUSION_DATA_ONLY = Symbol.for("MOBX_FUSION_DATA_ONLY");

export function fusion(url: string, params?: object, config?: ConfigType) {
  return function (target: any, propertyKey: string) {
    if (!target[MOBX_FUSION]) {
      target[MOBX_FUSION] = new Map();
    }

    target[MOBX_FUSION].set(propertyKey, [url, params, config]);
  };
}

export function fusionData(url: string, params?: object, config?: ConfigType) {
  return function (target: any, propertyKey: string) {
    if (!target[MOBX_FUSION_DATA_ONLY]) {
      target[MOBX_FUSION_DATA_ONLY] = new Map();
    }

    target[MOBX_FUSION_DATA_ONLY].set(propertyKey, [url, params, config]);
  };
}

export function makeFusionObservable(target: any) {
  const proto = Object.getPrototypeOf(target);
  const fusionMap = proto[MOBX_FUSION];
  const fusionDataOnlyMap = proto[MOBX_FUSION_DATA_ONLY];

  if (fusionMap) {
    for (const [propertyKey, [url, params, config]] of fusionMap) {
      let unsubscribe: (() => void) | null = null;

      onBecomeObserved(target, propertyKey, () => {
        const defaultData = target[propertyKey];

        unsubscribe = createFusionSubscription<any>(
          defaultData,
          url,
          params,
          config
        ).subscribeToUpdates((result: ResultType<any>) => {
          runInAction(() => {
            target[propertyKey] = result;
          });
        });
      });

      onBecomeUnobserved(target, propertyKey, () => {
        unsubscribe && unsubscribe();
        unsubscribe = null;
      });
    }
  }

  if (fusionDataOnlyMap) {
    for (const [propertyKey, [url, params, config]] of fusionDataOnlyMap) {
      let unsubscribe: (() => void) | null = null;

      onBecomeObserved(target, propertyKey, () => {
        const defaultData = target[propertyKey];

        unsubscribe = createFusionSubscription<any>(
          defaultData,
          url,
          params,
          config
        ).subscribeToUpdates(({ data }: ResultType<any>) => {
          runInAction(() => {
            target[propertyKey] = data;
          });
        });
      });

      onBecomeUnobserved(target, propertyKey, () => {
        unsubscribe && unsubscribe();
        unsubscribe = null;
      });
    }
  }
}
