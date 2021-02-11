import createFusionSubscription, {
  configure,
  ConfigType,
  ResultType,
} from "./base";
import { useFusionSubscription } from "./hooks";
import { fusion, fusionData, makeFusionObservable } from "./mobx";

export {
  createFusionSubscription as default,
  configure,
  useFusionSubscription,
  fusion,
  fusionData,
  makeFusionObservable,
};

export type { ConfigType, ResultType };
