import { useCallback, useEffect, useMemo, useReducer, useState } from "react"
import { BehaviorSubject, Subject } from "rxjs";

export const useStableState = <T extends Record<any,any>>(initializer:()=>T)=>{
    const update = useUpdate();
    return useMemo(()=>{
        const state = initializer();
        const setState = (values:Partial<T>)=>{
            if(Object.entries(values).find(([key,val])=>state[key] !== val)){
                Object.assign(state,values);
                update();
            }
        };
        return [state,setState] as [typeof state, typeof setState];
    },[]);
}

export const useUpdate = ()=>{
    const [_, update] = useReducer(v=>v+1, 0);
    return update;
}

export const useBehaviorSubjectValue = <T>(subject:BehaviorSubject<T>)=>{
    const update = useUpdate();
    useEffect(()=>{
        const sub = subject.subscribe(update);
        return ()=>sub.unsubscribe();
    },[]);
    return [subject.value, subject] as [T, typeof subject];
}

export const useSubjectCallback = <T>(subject:Subject<T>, cb: (value:T)=>void, deps:any[] = [])=>{
    useEffect(()=>{
        const sub = subject.subscribe(cb);
        return ()=>sub.unsubscribe();
    },[]);
}

export const useCountDown = (initialCount: number,deps: any[] = [],duration =1000)=>{
    const [count, setCount] = useState(initialCount);
    useEffect(()=>{
        setCount(initialCount);
        const interval = setInterval(()=>{
            setCount(count=>{
                const res = count-1;
                if(res<=0) clearInterval(interval);
                return res;
            });
        },duration);
        return ()=>clearInterval(interval);
    }, deps);
    return count;
}