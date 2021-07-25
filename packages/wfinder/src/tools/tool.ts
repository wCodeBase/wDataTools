import dayjs from "dayjs";
import { isUndefined, omitBy } from "lodash";

export const interactYield = (() => {
  let lastYield = 0;
  const interval = 1000 / 10;
  return async (wait = 5) => {
    if (Date.now() - lastYield < interval) return;
    lastYield = Date.now();
    await new Promise((r) => setTimeout(r, wait));
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
