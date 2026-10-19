/* Retry only chapters from the user's own saved queue and unchanged catalog. */
(function(root){
    const identity=entry=>JSON.stringify([entry.index,entry.title]);
    function plan(records,catalog,scope){
        const seen=new Set();
        return records.filter(x=>x.scope===scope && x.status!=='reviewed' && !x.uncertainSubmission)
            .flatMap(x=>{const chapter=catalog[x.index];if(!chapter||chapter.title!==x.title||seen.has(identity(x)))return[];seen.add(identity(x));return[{index:x.index,title:x.title}];});
    }
    function record(records,entry){
        const previous=records.find(x=>x.scope===entry.scope&&identity(x)===identity(entry));
        const rest=records.filter(x=>x.scope!==entry.scope||identity(x)!==identity(entry));
        return [...rest,{...entry,uncertainSubmission:!!(entry.uncertainSubmission||previous?.uncertainSubmission),status:'pending'}].slice(-100);
    }
    const api={plan,record,identity};if(typeof module==='object'&&module.exports)module.exports=api;root.XxtRunLedger=api;
})(typeof globalThis!=='undefined'?globalThis:this);
