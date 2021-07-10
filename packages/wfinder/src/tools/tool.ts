export const interactYield = (() => {
  let lastYield = 0;
  const interval = 1000 / 10;
  return async (wait = 5) => {
    if (Date.now() - lastYield < interval) return;
    lastYield = Date.now();
    await new Promise((r) => setTimeout(r, wait));
  };
})();
