import { useState, useRef, useEffect } from "react";

/* ── DATA ─────────────────────────────────────────────── */
const LOCATIONS = [
  { id: "upstairs-fridge",    label: "Upstairs Fridge",    icon: "🧊", accent: "#6EE7F7" },
  { id: "upstairs-freezer",   label: "Upstairs Freezer",   icon: "❄️", accent: "#A5B4FC" },
  { id: "downstairs-fridge",  label: "Downstairs Fridge",  icon: "🧊", accent: "#6EE7B7" },
  { id: "downstairs-freezer", label: "Downstairs Freezer", icon: "❄️", accent: "#FCA5A5" },
];
const CATEGORIES = [
  { id: "meat",       label: "Meat",          icon: "🥩" },
  { id: "dairy",      label: "Dairy",         icon: "🥛" },
  { id: "pareve",     label: "Pareve",        icon: "🥦" },
  { id: "frozen",     label: "Frozen",        icon: "🧊" },
  { id: "beverages",  label: "Beverages",     icon: "🥤" },
  { id: "condiments", label: "Condiments",    icon: "🫙" },
  { id: "bread",      label: "Bread & Baked", icon: "🍞" },
  { id: "other",      label: "Other",         icon: "📦" },
];
const UNITS = ["units","kg","g","lbs","oz","liters","ml","bottles","cans","bags","boxes","packs","slices"];
const SAMPLE = [
  { id:1, name:"Whole Milk",      qty:2,   unit:"bottles", cat:"dairy",     loc:"upstairs-fridge",    bought:"2026-05-15", expires:"2026-06-10", notes:"" },
  { id:2, name:"Chicken Breasts", qty:1.5, unit:"kg",      cat:"meat",      loc:"downstairs-freezer", bought:"2026-05-10", expires:"2026-08-10", notes:"Vacuum sealed" },
  { id:3, name:"Greek Yogurt",    qty:3,   unit:"units",   cat:"dairy",     loc:"upstairs-fridge",    bought:"2026-05-18", expires:"2026-06-05", notes:"" },
  { id:4, name:"Frozen Peas",     qty:2,   unit:"bags",    cat:"frozen",    loc:"upstairs-freezer",   bought:"2026-04-20", expires:"2027-04-20", notes:"" },
  { id:5, name:"Brisket",         qty:2,   unit:"kg",      cat:"meat",      loc:"downstairs-freezer", bought:"2026-05-01", expires:"2026-08-01", notes:"For Shabbat" },
  { id:6, name:"Orange Juice",    qty:1,   unit:"bottles", cat:"beverages", loc:"downstairs-fridge",  bought:"2026-05-19", expires:"2026-06-02", notes:"" },
  { id:7, name:"Challah",         qty:1,   unit:"units",   cat:"bread",     loc:"upstairs-fridge",    bought:"2026-05-20", expires:"2026-05-27", notes:"Homemade" },
];
const KEY = "fridgeTracker_v2";
const load = () => { try { const s = localStorage.getItem(KEY); if (s) return JSON.parse(s); } catch {} return SAMPLE; };
const save = (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)); } catch {} };
const today = new Date();
const daysLeft = (d) => { if (!d) return 9999; return Math.ceil((new Date(d) - today) / 86400000); };
const status = (d) => {
  if (!d) return null;
  const n = daysLeft(d);
  if (n < 0)  return { text:"Expired",    chip:"#FF4D4D", dark:true };
  if (n <= 3) return { text:`${n}d left`, chip:"#FF8C42", dark:true };
  if (n <= 7) return { text:`${n}d left`, chip:"#FFD166", dark:false };
  return null;
};
const fmtDate = (s) => s ? new Date(s).toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}) : "—";
const BLANK = { name:"", qty:1, unit:"units", cat:"meat", loc:"upstairs-fridge", bought:new Date().toISOString().split("T")[0], expires:"", notes:"" };

export default function App() {
  const [items, setItemsRaw] = useState(load);
  const [tab, setTab]        = useState("home");
  const [fLoc, setFLoc]      = useState("all");
  const [fCat, setFCat]      = useState("all");
  const [q, setQ]            = useState("");
  const [editing, setEditing]= useState(null);
  const [form, setForm]      = useState(BLANK);
  const [mic, setMic]        = useState(false);
  const [said, setSaid]      = useState("");
  const [reply, setReply]    = useState("");
  const [aiOn, setAiOn]      = useState(false);
  const [toast, setToast]    = useState(null);
  const [confirmDel, setConfirmDel] = useState(null);
  const recRef = useRef(null);

  const setItems = fn => setItemsRaw(p => { const n = typeof fn==="function"?fn(p):fn; save(n); return n; });
  const pop = (msg, err=false) => { setToast({msg,err}); setTimeout(()=>setToast(null),3000); };

  const alerts  = items.filter(i=>i.expires&&daysLeft(i.expires)<=7).sort((a,b)=>daysLeft(a.expires)-daysLeft(b.expires));
  const expired = items.filter(i=>i.expires&&daysLeft(i.expires)<0);
  const soon    = items.filter(i=>{ const d=daysLeft(i.expires); return d>=0&&d<=7; });

  const visible = items.filter(i=>{
    if (fLoc!=="all"&&i.loc!==fLoc) return false;
    if (fCat!=="all"&&i.cat!==fCat) return false;
    if (q&&!i.name.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  }).sort((a,b)=>daysLeft(a.expires)-daysLeft(b.expires));

  const submit = () => {
    if (!form.name.trim()) { pop("Please enter an item name",true); return; }
    if (editing) {
      setItems(p=>p.map(i=>i.id===editing.id?{...form,id:editing.id}:i));
      pop(`"${form.name}" updated`);
    } else {
      setItems(p=>[...p,{...form,id:Date.now()}]);
      pop(`"${form.name}" added!`);
    }
    setForm(BLANK); setEditing(null); setTab("inventory");
  };
  const remove = id => { const i=items.find(x=>x.id===id); setItems(p=>p.filter(x=>x.id!==id)); setConfirmDel(null); pop(`"${i?.name}" removed`); };
  const use1   = id => {
    const i=items.find(x=>x.id===id);
    if (i.qty<=1) { setItems(p=>p.filter(x=>x.id!==id)); pop(`"${i.name}" finished`); }
    else { setItems(p=>p.map(x=>x.id===id?{...x,qty:Math.round((x.qty-1)*10)/10}:x)); pop(`"${i.name}" −1`); }
  };
  const edit = i => { setForm({...i}); setEditing(i); setTab("add"); };

  const startMic = () => {
    const SR = window.SpeechRecognition||window.webkitSpeechRecognition;
    if (!SR) { pop("Voice not supported here",true); return; }
    const r = new SR(); r.lang="en-US"; r.continuous=false; r.interimResults=false;
    r.onresult = e => { const t=e.results[0][0].transcript; setSaid(t); runVoice(t); };
    r.onerror  = ()=>{ setMic(false); pop("Mic error, try again",true); };
    r.onend    = ()=>setMic(false);
    r.start(); recRef.current=r; setMic(true);
  };

  const runVoice = async (text) => {
    setAiOn(true); setReply("");
    try {
      const inv = items.map(i=>`${i.name}(qty:${i.qty}${i.unit},loc:${LOCATIONS.find(l=>l.id===i.loc)?.label},cat:${i.cat},exp:${fmtDate(i.expires)})`).join(", ");
      const res = await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST", headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514", max_tokens:800,
          system:`Kitchen assistant for a fully kosher home. Two fridges + two freezers. Never ask about kosher status.
Inventory: ${inv}
Today: ${new Date().toLocaleDateString("en-GB")}
Locations: upstairs-fridge, upstairs-freezer, downstairs-fridge, downstairs-freezer
Categories: meat,dairy,pareve,frozen,beverages,condiments,bread,other
Respond ONLY as JSON (no markdown): {"action":"add"|"query","message":"short friendly reply","item":{"name":"","qty":1,"unit":"units","cat":"meat","loc":"upstairs-fridge","expires":"YYYY-MM-DD or null","notes":""}}
Only include item for add action.`,
          messages:[{role:"user",content:text}]
        })
      });
      const data = await res.json();
      const raw = data.content?.find(b=>b.type==="text")?.text||"{}";
      let p; try { p=JSON.parse(raw.replace(/```json|```/g,"").trim()); } catch { p={action:"query",message:raw}; }
      setReply(p.message||"Got it!");
      if (p.action==="add"&&p.item) {
        const ni={id:Date.now(),bought:new Date().toISOString().split("T")[0],notes:"",...p.item};
        setItems(prev=>[...prev,ni]); pop(`Added "${ni.name}" via voice!`);
      }
    } catch { setReply("Sorry, something went wrong."); }
    setAiOn(false);
  };

  const getCat = id => CATEGORIES.find(c=>c.id===id)||CATEGORIES[7];
  const getLoc = id => LOCATIONS.find(l=>l.id===id)||LOCATIONS[0];

  /* ── STYLES ─────────────────────────────────────────── */
  return (
    <div style={{fontFamily:"'DM Sans','Outfit',system-ui,sans-serif",minHeight:"100vh",background:"#0A0A0F",color:"#F0F0FF"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-thumb{background:#2a2a3a;border-radius:2px}
        .btn{cursor:pointer;border:none;font-family:'DM Sans',sans-serif;transition:all .15s ease;outline:none}
        .btn:active{transform:scale(.97)}
        .card{background:#13131F;border:1px solid #1E1E30;border-radius:20px}
        .pill{border-radius:100px}
        input,select,textarea{font-family:'DM Sans',sans-serif;background:#0E0E1A;border:1px solid #1E1E30;color:#F0F0FF;border-radius:12px;outline:none;transition:border .15s}
        input:focus,select:focus{border-color:#7C6AF7}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .22s ease forwards}
        @keyframes pulse{0%,100%{opacity:1}50%{opacity:.4}}
        .pulse{animation:pulse 1.2s infinite}
        @keyframes toastIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
        .toast{animation:toastIn .2s ease}
        .hov:hover{background:#1A1A2E !important}
        .tag{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:100px;font-size:11px;font-weight:600;letter-spacing:.3px}
        .nav-btn{background:transparent;border:none;cursor:pointer;font-family:'DM Sans',sans-serif;padding:10px 16px;font-size:13px;font-weight:500;color:#555570;transition:all .15s;border-bottom:2px solid transparent;white-space:nowrap}
        .nav-btn.active{color:#7C6AF7;border-bottom-color:#7C6AF7}
        select option{background:#13131F}
      `}</style>

      {/* TOAST */}
      {toast && (
        <div className="toast" style={{position:"fixed",top:20,right:20,zIndex:9999,background:toast.err?"#FF4D4D":"#7C6AF7",color:"white",padding:"10px 18px",borderRadius:12,fontSize:13,fontWeight:500,boxShadow:"0 8px 30px rgba(0,0,0,.4)"}}>
          {toast.err?"⚠️":"✓"} {toast.msg}
        </div>
      )}

      {/* DELETE MODAL */}
      {confirmDel && (
        <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.7)",zIndex:999,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 20px"}}>
          <div className="card fu" style={{padding:28,maxWidth:320,width:"100%",textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:10}}>🗑️</div>
            <div style={{fontSize:16,fontWeight:600,marginBottom:6}}>Remove item?</div>
            <div style={{color:"#6060A0",fontSize:13,marginBottom:20}}>"{items.find(i=>i.id===confirmDel)?.name}"</div>
            <div style={{display:"flex",gap:10}}>
              <button className="btn pill" onClick={()=>setConfirmDel(null)} style={{flex:1,padding:"10px",background:"#1A1A2E",color:"#8080B0",fontSize:13}}>Cancel</button>
              <button className="btn pill" onClick={()=>remove(confirmDel)} style={{flex:1,padding:"10px",background:"#FF4D4D22",color:"#FF4D4D",border:"1px solid #FF4D4D44",fontSize:13,fontWeight:600}}>Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:"#0A0A0F",borderBottom:"1px solid #1A1A2E",padding:"16px 24px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:100,backdropFilter:"blur(20px)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{width:36,height:36,borderRadius:10,background:"linear-gradient(135deg,#7C6AF7,#5BB8FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:18}}>🏠</div>
          <div>
            <div style={{fontSize:16,fontWeight:700,letterSpacing:"-.3px",color:"#F0F0FF"}}>FridgeTrack</div>
            <div style={{fontSize:11,color:"#404060",fontFamily:"'DM Mono',monospace"}}>{items.length} items · all kosher</div>
          </div>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          {alerts.length>0&&(
            <button className="btn pill" onClick={()=>setTab("alerts")} style={{padding:"6px 12px",background:"#FF4D4D18",color:"#FF4D4D",border:"1px solid #FF4D4D33",fontSize:12,fontWeight:600}}>
              ⚠ {alerts.length}
            </button>
          )}
          <button className="btn pill" onClick={()=>{setEditing(null);setForm(BLANK);setTab("add");}} style={{padding:"8px 16px",background:"linear-gradient(135deg,#7C6AF7,#5BB8FF)",color:"white",fontSize:13,fontWeight:600,boxShadow:"0 4px 20px #7C6AF740"}}>
            + Add
          </button>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:"#0A0A0F",borderBottom:"1px solid #1A1A2E",padding:"0 24px",display:"flex",gap:4,overflowX:"auto"}}>
        {[{id:"home",l:"Home"},{id:"inventory",l:"Inventory"},{id:"alerts",l:`Alerts${alerts.length>0?` · ${alerts.length}`:""}`}].map(t=>(
          <button key={t.id} className={`nav-btn${tab===t.id?" active":""}`} onClick={()=>setTab(t.id)}>{t.l}</button>
        ))}
      </div>

      <div style={{padding:"24px",maxWidth:880,margin:"0 auto"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div className="fu">
            {/* Voice */}
            <div style={{background:"linear-gradient(135deg,#13131F,#1A1030)",border:"1px solid #2A1A4A",borderRadius:24,padding:24,marginBottom:20}}>
              <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:16}}>
                <div style={{width:44,height:44,borderRadius:14,background:"linear-gradient(135deg,#7C6AF7,#5BB8FF)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🎙</div>
                <div>
                  <div style={{fontSize:16,fontWeight:700}}>Voice Assistant</div>
                  <div style={{fontSize:12,color:"#4040A0"}}>Speak to add or check items</div>
                </div>
              </div>
              <button className="btn" onClick={startMic} disabled={mic||aiOn} style={{width:"100%",padding:"14px",borderRadius:16,background:mic?"#FF4D4D22":aiOn?"#1A1A2E":"linear-gradient(135deg,#7C6AF7,#5BB8FF)",color:mic?"#FF4D4D":aiOn?"#4040A0":"white",fontSize:14,fontWeight:600,border:mic?"1px solid #FF4D4D44":"none",boxShadow:(!mic&&!aiOn)?"0 4px 20px #7C6AF750":"none",transition:"all .2s"}}>
                <span className={mic?"pulse":""}>{mic?"● Listening…":aiOn?"Processing…":"Tap to Speak"}</span>
              </button>
              {said&&<div style={{marginTop:12,padding:"10px 14px",background:"#FFFFFF08",borderRadius:12,fontSize:13,color:"#8080C0",fontStyle:"italic"}}>"{said}"</div>}
              {reply&&<div style={{marginTop:8,padding:"10px 14px",background:"#7C6AF710",borderRadius:12,fontSize:13,color:"#A090FF",borderLeft:"2px solid #7C6AF7"}}>🤖 {reply}</div>}
              <div style={{marginTop:10,fontSize:11,color:"#2A2A50",textAlign:"center"}}>Try: "Add 2 bottles of milk to upstairs fridge, expires June 10"</div>
            </div>

            {/* Stats row */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12,marginBottom:20}}>
              {[{l:"Total",v:items.length,c:"#7C6AF7",ic:"📦"},{l:"Expiring",v:soon.length,c:"#FFD166",ic:"⏰"},{l:"Expired",v:expired.length,c:"#FF4D4D",ic:"🚨"}].map(s=>(
                <div key={s.l} className="card" style={{padding:"16px 12px",textAlign:"center"}}>
                  <div style={{fontSize:22,marginBottom:4}}>{s.ic}</div>
                  <div style={{fontSize:28,fontWeight:700,color:s.c,fontFamily:"'DM Mono',monospace"}}>{s.v}</div>
                  <div style={{fontSize:11,color:"#4040A0",fontWeight:500,marginTop:2}}>{s.l}</div>
                </div>
              ))}
            </div>

            {/* Locations */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",color:"#3A3A60",textTransform:"uppercase",marginBottom:10}}>Locations</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:10,marginBottom:24}}>
              {LOCATIONS.map(loc=>{
                const cnt=items.filter(i=>i.loc===loc.id).length;
                const warn=items.filter(i=>i.loc===loc.id&&i.expires&&daysLeft(i.expires)<=7).length;
                return(
                  <div key={loc.id} className="card hov" onClick={()=>{setFLoc(loc.id);setTab("inventory");}} style={{padding:18,cursor:"pointer",display:"flex",alignItems:"center",gap:12,position:"relative",overflow:"hidden"}}>
                    <div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:loc.accent,borderRadius:"20px 0 0 20px"}}/>
                    <div style={{fontSize:28,marginLeft:6}}>{loc.icon}</div>
                    <div style={{flex:1}}>
                      <div style={{fontWeight:600,fontSize:14,color:"#E0E0FF"}}>{loc.label}</div>
                      <div style={{color:"#3A3A70",fontSize:12,marginTop:2,fontFamily:"'DM Mono',monospace"}}>{cnt} item{cnt!==1?"s":""}</div>
                    </div>
                    {warn>0&&<span className="tag" style={{background:"#FF4D4D18",color:"#FF4D4D"}}>⚠ {warn}</span>}
                    <span style={{color:"#2A2A50",fontSize:18}}>›</span>
                  </div>
                );
              })}
            </div>

            {/* Categories */}
            <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",color:"#3A3A60",textTransform:"uppercase",marginBottom:10}}>Categories</div>
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
              {CATEGORIES.map(cat=>{
                const cnt=items.filter(i=>i.cat===cat.id).length;
                return(
                  <div key={cat.id} className="card hov" onClick={()=>{setFCat(cat.id);setTab("inventory");}} style={{padding:"14px 8px",cursor:"pointer",textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{cat.icon}</div>
                    <div style={{fontSize:11,fontWeight:600,color:"#8080C0"}}>{cat.label}</div>
                    <div style={{fontSize:18,fontWeight:700,color:"#E0E0FF",fontFamily:"'DM Mono',monospace",marginTop:2}}>{cnt}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── INVENTORY ── */}
        {tab==="inventory"&&(
          <div className="fu">
            <div className="card" style={{padding:14,marginBottom:14,display:"flex",flexWrap:"wrap",gap:8}}>
              <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search items…" style={{padding:"9px 14px",flex:1,minWidth:120,fontSize:13}} />
              <select value={fLoc} onChange={e=>setFLoc(e.target.value)} style={{padding:"9px 12px",fontSize:13}}>
                <option value="all">All Locations</option>
                {LOCATIONS.map(l=><option key={l.id} value={l.id}>{l.icon} {l.label}</option>)}
              </select>
              <select value={fCat} onChange={e=>setFCat(e.target.value)} style={{padding:"9px 12px",fontSize:13}}>
                <option value="all">All Categories</option>
                {CATEGORIES.map(c=><option key={c.id} value={c.id}>{c.icon} {c.label}</option>)}
              </select>
              {(fLoc!=="all"||fCat!=="all"||q)&&(
                <button className="btn pill" onClick={()=>{setFLoc("all");setFCat("all");setQ("");}} style={{padding:"9px 14px",background:"#1A1A2E",color:"#6060A0",fontSize:12}}>✕ Clear</button>
              )}
            </div>
            <div style={{fontSize:11,color:"#3A3A60",marginBottom:10,fontFamily:"'DM Mono',monospace"}}>{visible.length} items</div>

            {visible.length===0?(
              <div className="card" style={{padding:40,textAlign:"center",color:"#3A3A60"}}>
                <div style={{fontSize:36,marginBottom:8}}>🔍</div>
                <div style={{fontWeight:600}}>No items found</div>
                <div style={{fontSize:13,marginTop:4}}>Adjust filters or add a new item</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {visible.map(item=>{
                  const st=item.expires?status(item.expires):null;
                  const cat=getCat(item.cat);
                  const loc=getLoc(item.loc);
                  return(
                    <div key={item.id} className="card" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,position:"relative",overflow:"hidden"}}>
                      {st&&<div style={{position:"absolute",top:0,left:0,width:3,height:"100%",background:st.chip}}/>}
                      <span style={{fontSize:24,flexShrink:0,marginLeft:st?6:0}}>{cat.icon}</span>
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontWeight:600,fontSize:15,color:"#E8E8FF"}}>{item.name}</div>
                        <div style={{display:"flex",gap:8,flexWrap:"wrap",marginTop:4,alignItems:"center"}}>
                          <span style={{fontSize:12,color:"#4040A0",fontFamily:"'DM Mono',monospace"}}>{item.qty} {item.unit}</span>
                          <span style={{fontSize:11,color:loc.accent}}>📍 {loc.label}</span>
                          {st&&<span className="tag" style={{background:st.chip+"22",color:st.chip}}>{st.text}</span>}
                          {item.notes&&<span style={{fontSize:11,color:"#3A3A60",fontStyle:"italic"}}>{item.notes}</span>}
                        </div>
                      </div>
                      <div style={{display:"flex",gap:6,flexShrink:0}}>
                        <button className="btn pill" onClick={()=>use1(item.id)} style={{padding:"6px 10px",background:"#0D2A1A",color:"#4ADE80",border:"1px solid #1A4A2A",fontSize:12,fontWeight:600}}>−1</button>
                        <button className="btn pill" onClick={()=>edit(item)} style={{padding:"6px 10px",background:"#1A1A3A",color:"#7C6AF7",border:"1px solid #2A2A5A",fontSize:12,fontWeight:600}}>Edit</button>
                        <button className="btn pill" onClick={()=>setConfirmDel(item.id)} style={{padding:"6px 10px",background:"#2A0A0A",color:"#FF4D4D",border:"1px solid #4A1A1A",fontSize:12,fontWeight:600}}>✕</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── ALERTS ── */}
        {tab==="alerts"&&(
          <div className="fu">
            {alerts.length===0?(
              <div className="card" style={{padding:48,textAlign:"center"}}>
                <div style={{fontSize:44,marginBottom:12}}>✨</div>
                <div style={{fontSize:18,fontWeight:700,color:"#7C6AF7"}}>All clear!</div>
                <div style={{color:"#4040A0",marginTop:6,fontSize:14}}>Nothing expiring in the next 7 days.</div>
              </div>
            ):(
              <>
                {expired.length>0&&(
                  <div style={{marginBottom:20}}>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",color:"#FF4D4D",textTransform:"uppercase",marginBottom:10}}>🚨 Expired · {expired.length}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {expired.map(item=>{
                        const cat=getCat(item.cat); const loc=getLoc(item.loc);
                        return(
                          <div key={item.id} className="card" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12,borderColor:"#FF4D4D33"}}>
                            <span style={{fontSize:22}}>{cat.icon}</span>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600,color:"#FF4D4D"}}>{item.name}</div>
                              <div style={{fontSize:12,color:"#4040A0"}}>📍 {loc.label} · Expired {fmtDate(item.expires)}</div>
                            </div>
                            <button className="btn pill" onClick={()=>setConfirmDel(item.id)} style={{padding:"6px 12px",background:"#FF4D4D22",color:"#FF4D4D",border:"1px solid #FF4D4D44",fontSize:12,fontWeight:600}}>Remove</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {soon.length>0&&(
                  <div>
                    <div style={{fontSize:11,fontWeight:700,letterSpacing:"1.5px",color:"#FFD166",textTransform:"uppercase",marginBottom:10}}>⏰ Expiring Soon · {soon.length}</div>
                    <div style={{display:"flex",flexDirection:"column",gap:8}}>
                      {soon.map(item=>{
                        const st=status(item.expires); const cat=getCat(item.cat); const loc=getLoc(item.loc);
                        return(
                          <div key={item.id} className="card" style={{padding:"14px 16px",display:"flex",alignItems:"center",gap:12}}>
                            <span style={{fontSize:22}}>{cat.icon}</span>
                            <div style={{flex:1}}>
                              <div style={{fontWeight:600}}>{item.name}</div>
                              <div style={{fontSize:12,color:"#4040A0"}}>📍 {loc.label} · {item.qty} {item.unit} · Expires {fmtDate(item.expires)}</div>
                            </div>
                            <span className="tag" style={{background:st.chip+"22",color:st.chip}}>{st.text}</span>
                            <button className="btn pill" onClick={()=>use1(item.id)} style={{padding:"6px 10px",background:"#0D2A1A",color:"#4ADE80",border:"1px solid #1A4A2A",fontSize:12,fontWeight:600}}>−1</button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ── ADD / EDIT ── */}
        {tab==="add"&&(
          <div className="fu">
            <div className="card" style={{padding:24}}>
              <div style={{fontSize:18,fontWeight:700,marginBottom:20,color:"#E0E0FF"}}>{editing?"✏️ Edit Item":"＋ Add New Item"}</div>
              <div style={{display:"grid",gap:14}}>
                <div>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Item Name *</label>
                  <input value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="e.g. Whole Milk, Brisket, Challah…" style={{width:"100%",padding:"11px 14px",fontSize:14}} />
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Quantity</label>
                    <input type="number" min="0" step="0.1" value={form.qty} onChange={e=>setForm(p=>({...p,qty:parseFloat(e.target.value)||1}))} style={{width:"100%",padding:"11px 14px",fontSize:14}} />
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Unit</label>
                    <select value={form.unit} onChange={e=>setForm(p=>({...p,unit:e.target.value}))} style={{width:"100%",padding:"11px 14px",fontSize:14}}>
                      {UNITS.map(u=><option key={u}>{u}</option>)}
                    </select>
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:8}}>Location</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(2,1fr)",gap:8}}>
                    {LOCATIONS.map(loc=>(
                      <button key={loc.id} className="btn" onClick={()=>setForm(p=>({...p,loc:loc.id}))} style={{padding:"11px 10px",borderRadius:12,border:`1.5px solid ${form.loc===loc.id?loc.accent:"#1E1E30"}`,background:form.loc===loc.id?"#1A1A2E":"transparent",fontSize:13,color:form.loc===loc.id?"#E0E0FF":"#4040A0",textAlign:"left",display:"flex",alignItems:"center",gap:8}}>
                        <span>{loc.icon}</span>{loc.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:8}}>Category</label>
                  <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:7}}>
                    {CATEGORIES.map(cat=>(
                      <button key={cat.id} className="btn" onClick={()=>setForm(p=>({...p,cat:cat.id}))} style={{padding:"10px 6px",borderRadius:12,border:`1.5px solid ${form.cat===cat.id?"#7C6AF7":"#1E1E30"}`,background:form.cat===cat.id?"#1A1030":"transparent",fontSize:11,color:form.cat===cat.id?"#A090FF":"#4040A0",textAlign:"center"}}>
                        <div style={{fontSize:18,marginBottom:3}}>{cat.icon}</div>
                        <div style={{lineHeight:1.2,fontWeight:form.cat===cat.id?600:400}}>{cat.label}</div>
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Purchase Date</label>
                    <input type="date" value={form.bought} onChange={e=>setForm(p=>({...p,bought:e.target.value}))} style={{width:"100%",padding:"11px 14px",fontSize:14,colorScheme:"dark"}} />
                  </div>
                  <div>
                    <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Expiry Date</label>
                    <input type="date" value={form.expires} onChange={e=>setForm(p=>({...p,expires:e.target.value}))} style={{width:"100%",padding:"11px 14px",fontSize:14,colorScheme:"dark"}} />
                  </div>
                </div>
                <div>
                  <label style={{fontSize:11,fontWeight:700,letterSpacing:"1px",color:"#3A3A70",textTransform:"uppercase",display:"block",marginBottom:6}}>Notes</label>
                  <input value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} placeholder="e.g. For Shabbat, vacuum sealed, opened…" style={{width:"100%",padding:"11px 14px",fontSize:14}} />
                </div>
                <div style={{display:"flex",gap:10,marginTop:4}}>
                  <button className="btn pill" onClick={()=>{setTab("inventory");setEditing(null);}} style={{flex:1,padding:"13px",background:"#1A1A2E",color:"#4040A0",fontSize:14,fontWeight:600}}>Cancel</button>
                  <button className="btn pill" onClick={submit} style={{flex:2,padding:"13px",background:"linear-gradient(135deg,#7C6AF7,#5BB8FF)",color:"white",fontSize:14,fontWeight:700,boxShadow:"0 4px 20px #7C6AF740"}}>
                    {editing?"Save Changes":"Add to Inventory"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
