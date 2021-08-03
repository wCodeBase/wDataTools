import dayjs from "dayjs";

/**
 * @param wait wait milli second each yield.
 * @param echoInterval 0 for no echo, number in milli second to return true when reach interval
 */
export const interactYield = (() => {
  let lastYield = 0;
  const interval = 1000 / 4;
  let echo = 0;
  return (wait = 5, echoInterval = 0) => {
    const now = Date.now();
    if (now - lastYield < interval) return;
    lastYield = now;
    return new Promise<true | void>((r) =>
      setTimeout(() => {
        if (echoInterval && lastYield - echo > echoInterval) {
          echo = lastYield;
          r(true);
        } else r();
      }, wait)
    );
  };
})();

export const isCompleteType = <T>(a: Partial<T>, b: T): a is T => {
  return (
    Object.entries(b)
      // @ts-ignore
      .every(([key, value]) => value === undefined || a[key] !== undefined)
  );
};

export function waitMilli(timeMilli: number) {
  return new Promise<void>((r) => {
    setTimeout(() => r(undefined), timeMilli);
  });
}

export const formatDate = (date: Date) => {
  if (!date) return "";
  return dayjs(date).format("YYYY-MM-DD hh:mm:ss");
};

export const parseAddress = (address: string) => {
  const [host, portStr = "80"] = address.split(":");
  const port = parseInt(portStr);
  return { host, port };
};

export const concatUrls = (...urls: string[]): string => {
  if (urls.length <= 1) return urls[0] || "";
  const [url, ...rest] = urls;
  rest[0] = url.replace(/\/+$/, "") + rest[0].replace(/^\/*/, "/");
  return concatUrls(...rest);
};
