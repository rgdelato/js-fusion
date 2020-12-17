import createFusionSubscription, {
  configure,
  ConfigType,
  ResultType,
} from "./base";
import { useFusionSubscription } from "./hooks";
import { fusion, makeFusionObservable } from "./mobx";

export {
  createFusionSubscription as default,
  configure,
  useFusionSubscription,
  fusion,
  makeFusionObservable,
};

export type { ConfigType, ResultType };
