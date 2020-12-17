import createFusionSubscription, { ConfigType, ResultType } from "../base";
import { onBecomeObserved, onBecomeUnobserved, runInAction } from "mobx";

const symbol = Symbol.for("__fusion-mobx-observable__");

export function fusion(url: string, params?: object, config?: ConfigType) {
  return function (target: any, propertyKey: string) {
    if (!target[symbol]) {
      target[symbol] = {};
    }

    target[symbol][propertyKey] = [url, params, config];
  };
}

export function makeFusionObservable(target: any) {
  const proto = Object.getPrototypeOf(target);
  const decoratedKeys = Object.keys(proto[symbol]);

  decoratedKeys.forEach((propertyKey) => {
    let unsubscribe: (() => void) | null = null;

    onBecomeObserved(target, propertyKey, () => {
      const defaultData = target[propertyKey];
      const [url, params, config] = proto[symbol][propertyKey];

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

// export default function createFusionObservable<T>(
//   url: string,
//   params?: object,
//   config?: ConfigType
// ) {
//   return function (target: any, propertyKey: string) {
//     // console.log(
//     //   "createFusionObservable",
//     //   target,
//     //   Object.getPrototypeOf(target)
//     // );

//     let unsubscribe: (() => void) | null = null;

//     onBecomeObserved(target, propertyKey, handleBecomeObserved);
//     onBecomeUnobserved(target, propertyKey, handleBecomeUnobserved);

//     function handleBecomeObserved() {
//       unsubscribe = createFusionSubscription<T>(
//         target[propertyKey],
//         url,
//         params,
//         config
//       ).subscribeToUpdates(({ data, cancel }: ResultType<T>) => {
//         runInAction(() => {
//           target[propertyKey] = data;
//         });
//       });
//     }

//     function handleBecomeUnobserved() {
//       unsubscribe && unsubscribe();
//       unsubscribe = null;
//     }
//   };
// }
