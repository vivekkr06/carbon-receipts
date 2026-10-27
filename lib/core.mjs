const PROMPT_VERSION = "v4";
const DEFAULT_LESSONS = "- \"Historically\" or \"in total\" means cumulative_co2, not a single year.\n- \"Per person\" or \"the average American\" means co2_per_capita.\n- \"Today\" or \"now\" means the latest year with data (2024; 2023 for consumption_co2).\n- \"Roughly halved\" counts as a fall of 40–60%.\n- \"Largest\", \"highest\" or \"Nth\" about countries: use rank_places; regions are not countries.";
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
  const AL=D.alias||{}, ISO=D.iso||{};
  const norm=s=>String(s||"").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim().replace(/^the /,"");
  const ENT_N=D.entities.map(e=>[e,norm(e)]);
  function resolve(name){
    const k=norm(name); if(!k) return {};
    if(AL[k]) return {name:AL[k]};
    if(k.length>=4){
      const hits=ENT_N.filter(([,n])=>(" "+n+" ").includes(" "+k+" ")).map(x=>x[0]);
      if(hits.length===1) return {name:hits[0]};
      if(hits.length>1) return {suggest:hits.slice(0,6)};
      const near=ENT_N.filter(([,n])=>n.startsWith(k.slice(0,4))).map(x=>x[0]);
      if(near.length) return {suggest:near.slice(0,6)};
    }
    return {};
  }
  function ent(name){return resolve(name).name||null;}
  const isCountry=e=>!!ISO[e];
  function val(e,m,y){const E=ent(e); if(!E||!D.m[m]) return null; y=Number(y); if(!(y>=Y0&&y<=Y1)) return null; const v=D.m[m][E][y-Y0]; return v==null?null:v;}
  const short=e=>e==="European Union (27)"?"EU-27":e==="United States"?"US":e==="United Kingdom"?"UK":e;
  const r1=n=>n==null?"–":(Math.abs(n)>=100?n.toLocaleString("en",{maximumFractionDigits:0}):n.toLocaleString("en",{maximumFractionDigits:2}));
  const TOOLS=[
    {name:"list_coverage",description:"Returns the metrics (with units and meaning), year range and the list of aggregate regions covered. Rarely needed.",input_schema:{type:"object",properties:{}}},
    {name:"rank_places",description:"Ranks the countries (not regions) by a metric in one year. Use for claims like 'Xth largest', 'highest per person', 'top 5'. Returns the top `limit` and, if `entity` is given, that country's rank out of all ranked countries. Countries with no value that year are excluded.",input_schema:{type:"object",properties:{metric:{type:"string",enum:Object.keys(METRICS)},year:{type:"integer"},order:{type:"string",enum:["desc","asc"]},limit:{type:"integer"},entity:{type:"string"},min_population_millions:{type:"number",description:"Only rank countries with at least this population (millions)."}},required:["metric","year"]}},
    {name:"get_values",description:"Returns values for one entity and metric for the requested years, as {year: value}. Missing values are null. Accepts common names, ISO codes and nicknames (e.g. UK, Ivory Coast, DRC). Errors if the entity or metric is not covered.",input_schema:{type:"object",properties:{entity:{type:"string"},metric:{type:"string",enum:Object.keys(METRICS)},years:{type:"array",items:{type:"integer"}}},required:["entity","metric","years"]}},
    {name:"compute_change",description:"Returns the absolute and percentage change of one metric for one entity between two years.",input_schema:{type:"object",properties:{entity:{type:"string"},metric:{type:"string"},from_year:{type:"integer"},to_year:{type:"integer"}},required:["entity","metric","from_year","to_year"]}},
    {name:"submit_verdict",description:"Submit the ruling exactly once. figures must list every value relied on, as returned by get_values. reason is shown to the reader.",input_schema:{type:"object",properties:{verdict:{type:"string",enum:["SUPPORTED","REFUTED","NOT_IN_DATA"]},reason:{type:"string",description:"Two plain sentences for a general reader: the ruling and the key numbers with units and years. No markdown."},figures:{type:"array",items:{type:"object",properties:{entity:{type:"string"},metric:{type:"string"},year:{type:"integer"},value:{type:"number"}},required:["entity","metric","year","value"]}}},required:["verdict","reason","figures"]}}
  ];
  const LABEL={SUPPORTED:"Supported",REFUTED:"Refuted",NOT_IN_DATA:"Not in data"};
  function newState(){return {submissions:0,verdict:null,reason:"",figures:[]};}
  function exec(name,i,state,ev){
    i=i||{}; ev=ev||function(){};
    if(name==="list_coverage"){ev("read","list_coverage()",`${Object.keys(ISO).length} countries · ${Object.keys(METRICS).length} measures · ${Y0}–${Y1}`);return {countries:Object.keys(ISO).length,regions:D.entities.filter(e=>!ISO[e]),metrics:METRICS,years:`${Y0}-${Y1}`};}
    if(name==="rank_places"){
      const m=String(i.metric||""), y=Number(i.year); if(!METRICS[m]) throw new Error(`Metric "${m}" is not covered.`); if(!(y>=Y0&&y<=Y1)) throw new Error(`Year ${i.year} is outside ${Y0}-${Y1}.`);
      const minPop=Number(i.min_population_millions)||0, lim=Math.max(1,Math.min(20,Number(i.limit)||10)), asc=i.order==="asc";
      let rows=Object.keys(ISO).map(e=>[e,val(e,m,y),val(e,"population",y)]).filter(r=>r[1]!=null&&(!minPop||(r[2]!=null&&r[2]>=minPop)));
      rows.sort((a,b)=>asc?a[1]-b[1]:b[1]-a[1]);
      const out={metric:m,year:y,unit:METRICS[m].unit,order:asc?"asc":"desc",ranked_countries:rows.length,top:rows.slice(0,lim).map((r,k)=>({rank:k+1,entity:r[0],value:r[1]}))};
      if(i.entity){const E=ent(i.entity); if(!E||!ISO[E]){ev("err","rank_places()",`${i.entity}: not a ranked country`);throw new Error(`"${i.entity}" is not a country in the ranking.`);} const k=rows.findIndex(r=>r[0]===E); out.entity=E; out.entity_rank=k<0?null:k+1; out.entity_value=k<0?null:rows[k][1]; if(k<0) out.note=`${E} has no ${m} value for ${y}, so it is not ranked.`;}
      ev("read",`rank_places(${m}, ${y})`,(out.entity?`${out.entity}: ${out.entity_rank?"#"+out.entity_rank+" of "+rows.length:"not ranked"} · `:"")+out.top.slice(0,3).map(t=>`${short(t.entity)} ${r1(t.value)}`).join(", ")+(rows.length>3?"…":"")); return out;
    }
    if(name==="get_values"){
      const E=ent(i.entity), m=String(i.metric||""), ys=(Array.isArray(i.years)?i.years:[i.years]).map(Number).slice(0,40);
      if(!E){const sg=resolve(i.entity).suggest;ev("err","get_values()",`${i.entity}: not found`+(sg?` (did you mean ${sg.slice(0,3).join(", ")}?)`:""));throw new Error(`Entity "${i.entity}" was not found.`+(sg?` Did you mean: ${sg.join("; ")}?`:" It is not in the dataset."));}
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
    const regions=D.entities.filter(e=>!ISO[e]).join("; "), nC=Object.keys(ISO).length;
    const measures=Object.entries(METRICS).map(([k,m])=>`- ${k} (${m.unit}): ${m.desc}`).join("\n");
    return `You are Carbon Receipts, an agent that fact-checks claims about national CO₂ emissions using ONLY a snapshot of Our World in Data's CO₂ dataset (${Y0}–${Y1}), reached through your tools. You have no internet access and must not use numbers from memory.

VERDICTS
- SUPPORTED: the data shows the claim is true.
- REFUTED: the data shows the claim is false.
- NOT_IN_DATA: the claim needs a place, measure or year the snapshot does not cover (for example methane, or any year after ${Y1}). Do not guess.
If the input is not a factual claim about emissions, answer NOT_IN_DATA with no figures.

COVERAGE (you do not need list_coverage)
Places: ${nC} countries (names, nicknames and ISO codes are all understood, e.g. "UK", "Ivory Coast", "DRC") plus these regions: ${regions}. Region totals are not countries and are excluded from rankings.
Measures:
${measures}

PROCESS
1. Call get_values for every figure you need: one call per place and measure, ALL in the same round. Use compute_change for percentage changes. Use rank_places for "largest", "highest", "Nth" or "top N" claims (put the country in the entity field). For claims outside the coverage, skip straight to step 2 with no figures.
2. Call submit_verdict exactly once, listing every figure you relied on with the exact value the tool returned (you may round to 1 decimal). In "reason", write two plain sentences for a general reader: the ruling and the key numbers with units and years. No markdown.
3. After submit_verdict, stop. Write nothing more.

MISSING DATA
- If a value you need comes back null, or a country is not ranked, that part of the claim cannot be checked: rule NOT_IN_DATA and say which value is missing. Never estimate. consumption_co2 exists only for about 120 countries and ends in 2023.

DEFAULTS
- Unless the claim says otherwise, "emissions" means annual territorial fossil CO₂ (measure co2) in the latest year, ${Y1}.
- Vague time words: "recent years" or "the last few years" means the five years up to ${Y1}; "improved", "got better" or "cleaner" means emitted less CO₂ (a fall). Never silently pick a window: in "reason", say which years you compared and that the data ends in ${Y1}.
- If the claim clearly refers to a period after ${Y1} (for example "this year", 2025 or 2026), rule NOT_IN_DATA.

EXAMPLES
- "Germany emits more than in 1990" → get_values Germany co2 [1990, ${Y1}] → ${Y1} is lower → REFUTED.
- "The Netherlands improved in recent years" → get_values Netherlands co2 [${Y1-5}, ${Y1}] → it fell → SUPPORTED, with a reason like "Read 'recent years' as ${Y1-5}–${Y1}, the latest data available (it ends in ${Y1}). Netherlands emissions fell from X to Y Mt."
- "Global methane rose in 2022" → methane is not covered → submit_verdict NOT_IN_DATA with no figures.

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
  return {PROMPT_VERSION,DEFAULT_LESSONS,Y0,Y1,METRICS,ent,resolve,isCountry,short,val,r1,TOOLS,LABEL,newState,exec,instructions,verify,data:D};
}

export { createCore };
