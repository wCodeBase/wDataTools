export const exitCallbacks:(()=>Promise<void>)[] = [];

export const doInkExit = async ()=>{
    for(const cb of exitCallbacks){
        await cb();
    }
    process.exit();
}