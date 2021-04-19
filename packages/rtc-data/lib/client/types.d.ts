import { TypeTagList } from "../common/types";
export declare type TypeClientEvent = {
    'connect': (id: string) => void;
    'data': (id: string, data: any) => void;
    'inited': () => void;
    'tagList': (tagList: TypeTagList) => void;
};
