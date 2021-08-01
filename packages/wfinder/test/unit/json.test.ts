import { expect } from "chai";
import { get, isEqual, range, setWith } from "lodash";
import { JsonMore, TypeJsonData, TypeJsonObject } from "../../src/tools/json";
import { joinPropertyPath, randomPick, traversalObject } from "../testTools";

const dataTemplates: TypeJsonData[] = [
  null,
  Infinity,
  -Infinity,
  NaN,
  undefined,
  "test string",
  new Date(),
  BigInt(12343),
];
dataTemplates.push(new Set(dataTemplates));
dataTemplates.push(
  new Map(dataTemplates.map((v) => [v, randomPick(dataTemplates)]))
);
dataTemplates.push(
  range(0, dataTemplates.length, 3).map((v) =>
    range(v).map(() => randomPick(dataTemplates))
  )
);

const getDesc = (data: TypeJsonData) => {
  if (data instanceof Object) return "Object name: " + data.constructor?.name;
  else return String(data);
};

describe("JsonMore", () => {
  it("Stringify and parse single data", () => {
    dataTemplates.forEach((v) => {
      const res = JsonMore.parse(JsonMore.stringify(v));
      expect(isEqual(res, v), `Origin "${getDesc(v)}" equal to res "${res}"`)
        .true;
    });
  });

  it("Stringify and parse complex data", () => {
    const originData = {};
    const paths = [""];
    dataTemplates.forEach((v) => {
      const propName = getDesc(v).replace(/[ :]/g, "");
      const path = joinPropertyPath(randomPick(paths), propName);
      paths.push(path);
      setWith(originData, joinPropertyPath(path, "value"), v, Object);
    });
    const res = JsonMore.parse(JsonMore.stringify(originData));
    traversalObject(originData, (v, path) => {
      const resValue = get(res, path);
      expect(
        isEqual(v, resValue),
        `Origin sub property data "${getDesc(v)}" equal to res "${getDesc(
          resValue
        )}"`
      ).true;
    });
    expect(
      isEqual(res, originData),
      `Origin "${getDesc(originData)}" equal to res "${getDesc(res)}"`
    ).true;
  });

  it("Stringify and parse thesame data", () => {
    const theSameData = dataTemplates.map((v) => [
      v,
      ...range(dataTemplates.length).map(() => randomPick(dataTemplates)),
    ]);
    const theSameObject = { data: theSameData };
    const originData: Record<string, any> = { theSameData, theSameObject };
    const dataPrefix = "data_";
    const objectPrefix = "object_";
    range(10).forEach(() => {
      originData[dataPrefix + Math.random().toString(36).slice(2)] =
        theSameData;
      originData[objectPrefix + Math.random().toString(36).slice(2)] =
        theSameObject;
    });
    const res = JsonMore.parse(
      JsonMore.stringify(originData)
    ) as TypeJsonObject;
    expect(
      isEqual(res, originData),
      `Origin "${getDesc(originData)}" equal to res "${getDesc(res)}"`
    ).true;
    const resThesameData = res["theSameData"];
    const resThesameObject = res["theSameObject"];
    Object.entries(res).forEach(([k, v]) => {
      let thesameTo: any;
      if (String(k).slice(0, objectPrefix.length) === objectPrefix)
        thesameTo = resThesameObject;
      else if (String(k).slice(0, dataPrefix.length) === dataPrefix)
        thesameTo = resThesameData;
      else return;
      expect(v === thesameTo, "Thesame data full equals").true;
    });
  });
});
