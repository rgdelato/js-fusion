import merge from "lodash/merge";
import throttle from "lodash/throttle";
import { v4 as uuidv4 } from "uuid";
import DEFAULT_FETCHER from "./defaultFetcher";
import { isDocumentVisible, isOnline } from "./utils";

// BUG: Look into issues with reconnecting and offline interaction
// TODO: Add concept of grouping multiple API calls together and update all
//       inconsistent data in the group when one member would update

// types
export type ConfigType = {
  uri?: string;
  options?: {
    wait?: number;
    fetcher?: typeof DEFAULT_FETCHER;
  };
};

type CallbackArgsType<T> = {
  loading: boolean;
  error?: Error | null;
  data: T;
};

export type ResultType<T> = CallbackArgsType<T> & { cancel: () => void };

type FusionType = {
  clientId: string;
  publishers: Map<
    string,
    {
      socket: WebSocket;
      publications: Map<
        string,
        {
          throttledRequestUpdates: Set<ReturnType<typeof throttle>>;
        }
      >;
    }
  >;
  waitingForReconnect: Set<() => Promise<void>>;
};

type HeaderType = {
  PublicationRef: {
    PublisherId: string;
    PublicationId: string;
  };
};

type MessageDataType = {
  PublisherId: string;
  PublicationId: string;
};

// constants
const CLIENT_ID = uuidv4();
const MESSAGE_HEADER =
  "Stl.Fusion.Bridge.Messages.SubscribeMessage, Stl.Fusion";
const SOCKET_TIMEOUT = 30000; // hardcoded 30-second timeout for socket connection
const DEFAULT_URI = `${
  window.location.protocol === "https:" ? "wss:" : "ws:"
}//${window.location.host}/fusion/ws`;
const DEFAULT_WAIT = 300;
const DEFAULT_CONFIG = {
  uri: DEFAULT_URI,
  options: {
    wait: DEFAULT_WAIT,
    fetcher: DEFAULT_FETCHER,
  },
};

// global state
let FUSION: FusionType = {
  clientId: CLIENT_ID,
  publishers: new Map(),
  waitingForReconnect: new Set(),
};

// global state helpers
function getPublisher(PublisherId: string) {
  if (FUSION.publishers.has(PublisherId)) {
    return FUSION.publishers.get(PublisherId);
  }

  return null;
}

function getPublication(PublisherId: string, PublicationId: string) {
  const publisher = getPublisher(PublisherId);

  if (publisher && publisher.publications.has(PublicationId)) {
    return publisher.publications.get(PublicationId);
  }

  return null;
}

// allow override of default config
let config = DEFAULT_CONFIG;
export function configure(overrideConfig: ConfigType): void {
  config = merge({}, DEFAULT_CONFIG, overrideConfig);
}

// reconnecting when we're back online
if (window) {
  const checkForReconnect = () => {
    if (
      isDocumentVisible() &&
      isOnline() &&
      FUSION.waitingForReconnect.size > 0
    ) {
      FUSION.waitingForReconnect.forEach((reconnect) => reconnect());
      FUSION.waitingForReconnect = new Set();
    }
  };

  window.addEventListener("visibilitychange", checkForReconnect, false);
  window.addEventListener("focus", checkForReconnect, false);
  window.addEventListener("online", checkForReconnect, false);
}

// main Fusion subscribe function
export default function createFusionSubscription<T>(
  defaultData: T,
  url: string | null,
  params?: object | null,
  argConfig?: ConfigType // TODO: merge argConfig into existing config
) {
  let loading = true;
  let error: Error | null | undefined = null;
  let data: T = defaultData;

  let PublisherId: string | null = null;
  let PublicationId: string | null = null;

  // default no-op so we can just call without checks
  let callback = (args?: CallbackArgsType<T>) => {};

  // adding a wait delay to update requests
  const throttledRequestUpdate = throttle(
    sendRequestUpdateMessage,
    config.options.wait,
    { leading: false }
  );

  // socket message handler needs to be named so we can remove the
  // event listener on unsubscribe
  function handleSocketMessage(event: MessageEvent) {
    const socket = event.target as WebSocket;
    const data = JSON.parse(event.data);
    if (
      data.PublisherId === PublisherId &&
      data.PublicationId === PublicationId
    ) {
      if (data.IsConsistent === false) {
        throttledRequestUpdate(socket, data);
      }

      if (data.Output) {
        callback({ loading: false, data: data.Output.UnsafeValue });
      }
    }
  }

  function unsubscribe() {
    const publisher = PublisherId && getPublisher(PublisherId);
    const publication =
      PublisherId &&
      PublicationId &&
      getPublication(PublisherId, PublicationId);

    if (publisher && publication) {
      // remove saved functions
      publication.throttledRequestUpdates.delete(throttledRequestUpdate);

      // if empty, remove publication
      if (publication.throttledRequestUpdates.size === 0) {
        if (PublicationId != null) {
          publisher.publications.delete(PublicationId);
        }
      }
    }

    if (publisher) {
      publisher.socket.removeEventListener("message", handleSocketMessage);

      // if empty, close socket and remove publisher
      // HACK: add a 1s delay so we don't unnecessarily churn through sockets
      if (publisher.publications.size === 0) {
        let currentPublisherId = PublisherId;
        setTimeout(() => {
          if (publisher.publications.size === 0) {
            publisher.socket.close(1000);
            if (currentPublisherId != null) {
              FUSION.publishers.delete(currentPublisherId);
            }
          }
        }, 1000);
      }
    }
  }

  function onError(message: string) {
    unsubscribe();
    callback({
      loading: false,
      error: new Error(message),
      data,
    });
    PublisherId = null;
    PublicationId = null;

    if (isDocumentVisible() && isOnline()) {
      setup();
    } else {
      FUSION.waitingForReconnect.add(setup);
    }
  }

  // main function to make initial API call and set up socket/listeners
  async function setup() {
    if (url != null) {
      try {
        const { data, header } = await initialFetch(url, params);

        callback({ loading: false, data });

        PublisherId = header?.PublicationRef?.PublisherId;
        PublicationId = header?.PublicationRef?.PublicationId;

        if (
          !header ||
          !header.PublicationRef ||
          !PublisherId ||
          !PublicationId
        ) {
          throw new Error("Fusion publication header was not in response");
        }

        // create publisher if it doesn't exist
        let publisher = getPublisher(PublisherId);

        if (!publisher) {
          publisher = {
            publications: new Map(),
            socket: new WebSocket(
              `${config.uri}?publisherId=${PublisherId}&clientId=${FUSION.clientId}`
            ),
          };
          FUSION.publishers.set(PublisherId, publisher);
        }

        const socket = await getOpenedSocket(publisher.socket);

        // reconnect when socket closes
        socket.addEventListener("close", (event: CloseEvent) =>
          onError(event.reason)
        );

        // listen for messages
        socket.addEventListener("message", handleSocketMessage);

        // create publication if it doesn't exist
        let publication = getPublication(PublisherId, PublicationId);
        if (!publication) {
          publication = { throttledRequestUpdates: new Set() };
          publisher.publications.set(PublicationId, publication);
          sendSubscribeMessage(socket, { PublisherId, PublicationId });
        }

        publication.throttledRequestUpdates.add(throttledRequestUpdate);
      } catch (error) {
        console.error(error);
        callback({ loading: false, error, data });
      }
    }
  }

  // run the initial setup if we can or wait until we're back online
  if (isDocumentVisible() && isOnline()) {
    setup();
  } else {
    FUSION.waitingForReconnect.add(setup);
  }

  // return subscribe and unsubscribe functions for bindings
  return {
    subscribeToUpdates: (listener: (result: ResultType<T>) => void) => {
      callback = (args: CallbackArgsType<T> = { loading, error, data }) => {
        loading = args.loading;
        error = args.error;
        data = args.data;

        // send the registered listener loading/error/data and cancel
        // TODO: allow multiple listeners
        listener({
          loading,
          error,
          data,
          cancel: () => {
            if (PublisherId && PublicationId) {
              const publisher = getPublisher(PublisherId);
              if (publisher) {
                throttledRequestUpdate.cancel();
                sendRequestUpdateMessage(publisher.socket, {
                  PublisherId,
                  PublicationId,
                });
              }
            }
          },
        });
      };

      // immediately respond with current state
      callback();

      return unsubscribe;
    },
  };
}

// initial REST call to fetch data and PublicationRef IDs
async function initialFetch(
  url: string,
  params: object | null | undefined,
  retryCount = 0
): Promise<{ data: any; header: HeaderType }> {
  try {
    return await config.options.fetcher(url, params);
  } catch (error) {
    // if the initial API call fails, try again with exponential backoff
    // TODO: Check first if we're offline before making another call
    await delay(1000 * 2 ** retryCount);
    return await initialFetch(url, params, retryCount + 1);
    // throw error; // makes promises easier to debug
  }
}

// utility promise used for delaying REST call retries
function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

// utility promise to wait until the socket is open and ready for messages
function getOpenedSocket(socket: WebSocket): Promise<WebSocket> {
  return new Promise((resolve, reject) => {
    // if the socket connection isn't ready yet, wait until it's open
    if (socket.readyState < 1) {
      socket.addEventListener("open", () => {
        resolve(socket);
      });
    } else {
      resolve(socket);
    }

    setTimeout(() => reject(socket), SOCKET_TIMEOUT); // reject after arbitrary timeout
  });
}

function sendSubscribeMessage(socket: WebSocket, data: MessageDataType) {
  if (socket.readyState === 1) {
    socket.send(
      `${MESSAGE_HEADER}|${JSON.stringify({
        ...data,
        $type: MESSAGE_HEADER,
        IsConsistent: true,
        IsUpdateRequested: false,
      })}`
    );
  }
}

function sendRequestUpdateMessage(socket: WebSocket, data: MessageDataType) {
  // cancel any other messages in progress
  const { PublisherId, PublicationId } = data;
  let publication = getPublication(PublisherId, PublicationId);
  if (publication) {
    publication.throttledRequestUpdates.forEach(({ cancel }) => {
      cancel();
    });
  }

  if (socket.readyState === 1) {
    socket.send(
      `${MESSAGE_HEADER}|${JSON.stringify({
        ...data,
        $type: MESSAGE_HEADER,
        IsConsistent: false,
        IsUpdateRequested: true,
      })}`
    );
  }
}
