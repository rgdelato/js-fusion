import { useState, useEffect, useRef } from "react";
import deepEqual from "lodash/isEqual";
import createFusionSubscription, { ConfigType, ResultType } from "../base";

function useSameObject<T>(obj: T) {
  const ref = useRef<T>(obj);

  if (!deepEqual(obj, ref.current)) {
    ref.current = obj;
  }

  return ref.current;
}

export function useFusionSubscription<T>(
  defaultData: T,
  url: string | null,
  argParams?: object | null,
  argConfig?: ConfigType
) {
  const [result, setResult] = useState<ResultType<T>>({
    loading: true,
    error: null,
    data: defaultData,
    cancel: () => {},
  });

  const params = useSameObject(argParams);
  const config = useSameObject(argConfig);

  const unsubscribe = useRef<(() => void) | null>(null);

  useEffect(() => {
    let isMounted = true;

    // Allow the user to pass null "url" arg to unsubscribe
    if (url) {
      unsubscribe.current = createFusionSubscription<T>(
        defaultData,
        url,
        params,
        config
      ).subscribeToUpdates((result: ResultType<T>) => {
        if (isMounted) {
          setResult(result);
        }
      });
    }

    return () => {
      isMounted = false;

      return unsubscribe.current?.();
    };
  }, [defaultData, url, params, config]);

  return result;
}
