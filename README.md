# STL.Fusion JS Client (work-in-progress)

## React Hooks

```tsx
import React from "react";
import { useFusionSubscription } from "stl.fusion";

function Time() {
  const { loading, error, data } = useFusionSubscription<string>(
    "",
    "/api/Time/get"
  );

  return loading ? (
    <>Loading...</>
  ) : error ? (
    <>There was an error!</>
  ) : (
    <>{data}</>
  );
}
```

The `useFusionSubscription` hook expects a default value for data and a URL endpoint. You may also optionally pass a third argument for `params` (which is passed to your fetcher function, which is `fetch` by default) and a fourth argument for `config` (which allows you to customize the `wait` (delay between updates) and use a custom `fetcher`).

## MobX (Simple)

```tsx
import React from "react";
import { makeAutoObservable } from "mobx";
import { observer } from "mobx-react-lite";
import { fusionData, makeFusionObservable } from "stl.fusion";

class TimeStore {
  @fusionData("/api/Time/get")
  time = "";

  constructor() {
    makeAutoObservable(this);
    makeFusionObservable(this);
  }
}

const Time = observer(() => {
  const [{ time }] = useState(() => new TimeStore());

  return !time ? <>Loading...</> : <>{time}</>;
});
```

The MobX integration currently uses a decorator that expects the similar arguments to the React Hook (`url`, `params?`, and `config?`). The `@fusionData` decorator only returns the value for `data`, but you can also use the `@fusion` decorator to return `{ loading, error, data, cancel }`.

## Configuration

```tsx
import { configure } from "stl.fusion";

configure({
  uri: "ws://localhost:5005/fusion/ws",
  options: { wait: 600 },
});
```

`configure` allows you to set a base URI and default config. You'll likely only want to call this once at the top of the app.

## Cancel Function

```tsx
function Chat() {
  const [loading, setLoading] = useState(false);
  const { loading, error, data, cancel } = useFusionSubscription<ChatTailType>(
    null,
    "/api/Chat/getChatTail?length=5"
  );

  function addMessage() {
    setLoading(true);
    fetch(`/api/Chat/addMessage`, {
      method: "POST",
    })
      .then((res) => res.json())
      .then((data) => {
        cancel();
        setLoading(false);
      });
  }

  // ...
}
```

The client also returns a `cancel` function, which can be called to immediately ask the server for an update. This is typically useful just after the user has updated some server data and we want to show them their update as soon as possible, for example, after sending a chat message.

## Types

The return type of `{ loading, error, data, cancel }` is exported from `stl.fusion` as `ResultType<T>` and the `config` param type is exported as `ConfigType`.

## Vanilla JS

```tsx
import createFusionSubscription, { ConfigType, ResultType } from "stl.fusion";

let unsubscribe = createFusionSubscription<T>(
  defaultData,
  url,
  params,
  config
).subscribeToUpdates((result: ResultType<T>) => {
  // ...
});
```

There is also a non-framework-specific version that allows you to subscribe/unsubscribe to fusion values.
