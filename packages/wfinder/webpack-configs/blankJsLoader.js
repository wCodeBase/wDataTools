module.exports = function () {
  return `
    function tpl() { };
    let obj = {};
    let proxy = new Proxy(obj, { get: () => tpl });
    module.exports=proxy;
`;
};
