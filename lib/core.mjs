function createCore(D){
  const Y0=D.years[0], Y1=D.years[1];
  const METRICS={
    co2:{unit:"Mt CO₂",label:"CO₂",desc:"Annual territorial fossil CO₂ (fossil fuels and industry), million tonnes"},
    co2_per_capita:{unit:"t per person",label:"CO₂ per person",desc:"Annual territorial fossil CO₂ per person, tonnes"},
    share_global_co2:{unit:"% of world",label:"share of world CO₂",desc:"Share of world annual fossil CO₂, percent"},
    coal_co2:{unit:"Mt CO₂",label:"coal CO₂",desc:"Annual CO₂ from coal, million tonnes"},
    oil_co2:{unit:"Mt CO₂",label:"oil CO₂",desc:"Annual CO₂ from oil, million tonnes"},
    gas_co2:{unit:"Mt CO₂",label:"gas CO₂",desc:"Annual CO₂ from gas, million tonnes"},
    cumulative_co2:{unit:"Mt CO₂",label:"cumulative CO₂",desc:"Cumulative fossil CO₂ since 1750 up to that year, million tonnes. Use for 'historically' or 'in total' claims"},
    consumption_co2:{unit:"Mt CO₂",label:"consumption CO₂",desc:"Consumption-based CO₂ (adjusted for trade), million tonnes. Not available for 2024; latest is 2023"},
    population:{unit:"million people",label:"population",desc:"Population, millions"}
  };
  const ALIAS={"us":"United States","usa":"United States","u.s.":"United States","america":"United States","united states of america":"United States","eu":"European Union (27)","european union":"European Union (27)","eu27":"European Union (27)","eu-27":"European Union (27)","uk":"United Kingdom","britain":"United Kingdom","great britain":"United Kingdom","korea":"South Korea","global":"World","world":"World","holland":"Netherlands","the netherlands":"Netherlands","russian federation":"Russia","turkiye":"Turkey","türkiye":"Turkey"};
  function ent(name){const l=String(name||"").trim().toLowerCase(); if(ALIAS[l]) return ALIAS[l]; return D.entities.find(e=>e.toLowerCase()===l)||null;}
  function val(e,m,y){const E=ent(e); if(!E||!D.m[m]) return null; y=Number(y); if(!(y>=Y0&&y<=Y1)) return null; const v=D.m[m][E][y-Y0]; return v==null?null:v;}
  const r1=n=>n==null?"–":(Math.abs(n)>=100?n.toLocaleString("en",{maximumFractionDigits:0}):n.toLocaleString("en",{maximumFractionDigits:2}));
  const TOOLS=[
    {name:"list_coverage",description:"Returns the countries/regions, metrics (with units and meaning) and year range covered by the dataset snapshot.",input_schema:{type:"object",properties:{}}},
    {name:"get_values",description:"Returns values for one entity and metric for the requested years, as {year: value}. Missing values are null. Errors if the entity or metric is not covered.",input_schema:{type:"object",properties:{entity:{type:"string"},metric:{type:"string",enum:Object.keys(METRICS)},years:{type:"array",items:{type:"integer"}}},required:["entity","metric","years"]}},
    {name:"compute_change",description:"Returns the absolute and percentage change of one metric for one entity between two years.",input_schema:{type:"object",properties:{entity:{type:"string"},metric:{type:"string"},from_year:{type:"integer"},to_year:{type:"integer"}},required:["entity","metric","from_year","to_year"]}},
    {name:"submit_verdict",description:"Submit the ruling exactly once. figures must list every value relied on, as returned by get_values.",input_schema:{type:"object",properties:{verdict:{type:"string",enum:["SUPPORTED","REFUTED","NOT_IN_DATA"]},reason:{type:"string"},figures:{type:"array",items:{type:"object",properties:{entity:{type:"string"},metric:{type:"string"},year:{type:"integer"},value:{type:"number"}},required:["entity","metric","year","value"]}}},required:["verdict","reason","figures"]}}
  ];
  const LABEL={SUPPORTED:"Supported",REFUTED:"Refuted",NOT_IN_DATA:"Not in data"};
  function newState(){return {submissions:0,verdict:null,reason:"",figures:[]};}
  function exec(name,i,state,ev){
    i=i||{}; ev=ev||function(){};
    if(name==="list_coverage"){ev("read","list_coverage()",`${D.entities.length} places · ${Object.keys(METRICS).length} metrics · ${Y0}–${Y1}`);return {entities:D.entities,metrics:METRICS,years:`${Y0}-${Y1}`};}
    if(name==="get_values"){
      const E=ent(i.entity), m=String(i.metric||""), ys=(Array.isArray(i.years)?i.years:[i.years]).map(Number).slice(0,40);
      if(!E){ev("err","get_values()",`${i.entity}: not in the snapshot`);throw new Error(`Entity "${i.entity}" is not in the snapshot.`);}
      if(!METRICS[m]){ev("err","get_values()",`${m}: not a covered metric`);throw new Error(`Metric "${m}" is not covered.`);}
      const out={}; ys.forEach(y=>out[y]=val(E,m,y));
      ev("read",`get_values(${E}, ${m})`,ys.map(y=>`${y}: ${r1(out[y])}`).join(" · "));
      return {entity:E,metric:m,unit:METRICS[m].unit,values:out};
    }
    if(name==="compute_change"){
      const E=ent(i.entity), a=val(E,i.metric,i.from_year), b=val(E,i.metric,i.to_year);
      if(a==null||b==null){ev("err","compute_change()","a value is missing");throw new Error("One or both values are not in the snapshot.");}
      const res={entity:E,metric:i.metric,from:{year:Number(i.from_year),value:a},to:{year:Number(i.to_year),value:b},abs_change:+(b-a).toFixed(3),pct_change:+((b/a-1)*100).toFixed(2)};
      ev("read",`compute_change(${E}, ${i.metric})`,`${i.from_year}→${i.to_year}: ${res.pct_change>0?"+":""}${res.pct_change}%`); return res;
    }
    if(name==="submit_verdict"){
      state.submissions++; state.verdict=String(i.verdict||"").toUpperCase(); state.reason=String(i.reason||"");
      state.figures=(Array.isArray(i.figures)?i.figures:[]).slice(0,20).map(f=>({entity:String(f.entity||""),metric:String(f.metric||""),year:Number(f.year),value:Number(f.value)}));
      ev("act","submit_verdict()",`${LABEL[state.verdict]||state.verdict} · ${state.figures.length} figure${state.figures.length===1?"":"s"} cited`); return {received:true};
    }
    throw new Error("Unknown tool "+name);
  }
  function instructions(claim,lessons){
    return `You are Carbon Receipts, an agent that fact-checks claims about national CO₂ emissions using ONLY a snapshot of Our World in Data's CO₂ dataset (${Y0}–${Y1}), reached through your tools. You have no internet access and must not use numbers from memory.

VERDICTS
- SUPPORTED: the data shows the claim is true.
- REFUTED: the data shows the claim is false.
- NOT_IN_DATA: the claim needs a country, metric or year the snapshot does not cover (for example methane, or any year after ${Y1}). Do not guess.
If the input is not a factual claim about emissions, answer NOT_IN_DATA with no figures.

PROCESS
1. Call list_coverage once.
2. Call get_values for every figure you need (one call per place and metric, all in the same round where possible). Use compute_change for percentage changes.
3. Call submit_verdict exactly once, listing every figure you relied on with the exact value the tool returned (you may round to 1 decimal).
4. Then write two sentences for a general reader: the ruling and the key numbers with units and years. No markdown.

DEFAULTS
- Unless the claim says otherwise, "emissions" means annual territorial fossil CO₂ (metric co2) in the latest year, ${Y1}.

EXAMPLES
- "Germany emits more than in 1990" → get_values Germany co2 [1990, ${Y1}] → ${Y1} is lower → REFUTED.
- "Global methane rose in 2022" → methane is not covered → NOT_IN_DATA with no figures.

LESSONS FILE
${String(lessons||"").slice(0,2000)}

CLAIM TO CHECK
"""${String(claim||"").slice(0,400)}"""`;
  }
  function verify(state,expected){
    const checks=[]; const bad=[];
    state.figures.forEach(f=>{const t=val(f.entity,f.metric,f.year); f.truth=t; f.ok=t!=null&&Math.abs(f.value-t)<=Math.max(0.051,Math.abs(t)*0.005); if(!f.ok) bad.push(f);});
    checks.push({ok:state.submissions===1,label:state.submissions===1?"Gave exactly one ruling":`Gave ${state.submissions} rulings (should be 1)`});
    if(state.verdict==="NOT_IN_DATA") checks.push({ok:!bad.length,label:bad.length?`${bad.length} quoted number${bad.length>1?"s don't":" doesn't"} match the data`:"Didn't invent numbers for a claim it can't check"});
    else{
      checks.push({ok:state.figures.length>0,label:state.figures.length?`Showed ${state.figures.length} number${state.figures.length>1?"s":""} as evidence`:"Showed no numbers as evidence"});
      checks.push({ok:state.figures.length>0&&!bad.length,label:bad.length?`${bad.length} quoted number${bad.length>1?"s don't":" doesn't"} match the data`:"Every quoted number matches the dataset"});
    }
    if(expected) checks.push({ok:state.verdict===expected,label:`Ruling matches the answer key (${LABEL[expected]})`});
    return {checks,pass:checks.every(c=>c.ok)};
  }
  return {Y0,Y1,METRICS,ent,val,r1,TOOLS,LABEL,newState,exec,instructions,verify,data:D};
}

export { createCore };
