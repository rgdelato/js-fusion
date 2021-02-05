import createFusionSubscription, { ConfigType, ResultType } from "../base";
import { onBecomeObserved, onBecomeUnobserved, runInAction } from "mobx";

const fusionSymbol = Symbol();

export function fusion(url: string, params?: object, config?: ConfigType) {
  return function (target: any, propertyKey: string) {
    if (!target[fusionSymbol]) {
      target[fusionSymbol] = {};
    }

    target[fusionSymbol][propertyKey] = [url, params, config];
  };
}

const fusionDataSymbol = Symbol();

export function fusionData(url: string, params?: object, config?: ConfigType) {
  return function (target: any, propertyKey: string) {
    if (!target[fusionDataSymbol]) {
      target[fusionDataSymbol] = {};
    }

    target[fusionDataSymbol][propertyKey] = [url, params, config];
  };
}

export function makeFusionObservable(target: any) {
  const proto = Object.getPrototypeOf(target);
  const decoratedKeys = Object.keys(proto[fusionSymbol]);

  decoratedKeys.forEach((propertyKey) => {
    let unsubscribe: (() => void) | null = null;

    onBecomeObserved(target, propertyKey, () => {
      const defaultData = target[propertyKey];
      const [url, params, config] = proto[fusionSymbol][propertyKey];

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
  });
}
