import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {LayoutDashboard,Package,ShoppingCart,Users,CalendarClock,LogOut,Plus,Trash2,Save,Download,Search,Menu,X,Printer,AlertTriangle,Upload,FileSpreadsheet,KeyRound} from "lucide-react";
import Papa from "papaparse";
import "./styles.css";

const API="/api";
async function api(path,options={}) {
  const token=localStorage.getItem("pods_token");
  const r=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})}});
  if(!r.ok) throw new Error((await r.json().catch(()=>({error:"Request failed"}))).error||"Request failed");
  return r.json();
}

const empty={products:[],clients:[],sales:[]};
const money=n=>"₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);

function Login({onLogin}){
 const [u,setU]=useState(""),[p,setP]=useState(""),[err,setErr]=useState("");
 async function go(e){e.preventDefault();try{const d=await api("/login",{method:"POST",body:JSON.stringify({username:u,password:p})});localStorage.setItem("pods_token",d.token);onLogin(d.user)}catch(e){setErr(e.message)}}
 return <div className="login"><div className="login-card"><div className="logo">P</div><h1>PODS TRACKER</h1><p>Inventory • Sales • Clients • Due Dates</p><form onSubmit={go}><input value={u} onChange={e=>setU(e.target.value)} placeholder="Username"/><input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Password"/>{err&&<div className="error">{err}</div>}<button className="primary">Sign In</button></form></div></div>
}

const configs={
 Products:{key:"products",icon:Package,fields:[
  ["product","Product","text"],["flavor","Flavor","text"],["client","Client","text"],["price","Price","number"],["quantity","Qty","number"],["stock","Stock","number"],["sold","Sold","number"],["dueDate","Due Date","date"],["status","Status","text"],["notes","Notes","text"]
 ]},
 Clients:{key:"clients",icon:Users,fields:[
  ["name","Client","text"],["contact","Contact","text"],["email","Email","text"],["address","Address","text"],["balance","Balance","number"],["dueDate","Due Date","date"],["status","Status","text"],["notes","Notes","text"]
 ]},
 Sales:{key:"sales",icon:ShoppingCart,fields:[
  ["product","Product","text"],["flavor","Flavor","text"],["client","Client","text"],["quantity","Qty","number"],["price","Price","number"],["total","Total","number"],["saleDate","Sale Date","date"],["dueDate","Due Date","date"],["paid","Paid","checkbox"],["notes","Notes","text"]
 ]}
};

function App(){
 const [user,setUser]=useState(()=>localStorage.getItem("pods_token")?{username:"admin"}:null);
 if(!user) return <Login onLogin={setUser}/>;
 return <Tracker onLogout={()=>{localStorage.removeItem("pods_token");setUser(null)}}/>;
}

function Tracker({onLogout}){
 const [page,setPage]=useState("Dashboard"),[data,setData]=useState(empty),[query,setQuery]=useState(""),[mobile,setMobile]=useState(false),[toast,setToast]=useState(""),[passwordOpen,setPasswordOpen]=useState(false);
 async function load(){try{const [products,clients,sales,dash]=await Promise.all([api("/products"),api("/clients"),api("/sales"),api("/dashboard")]);setData({products,clients,sales,dash})}catch(e){flash(e.message)}}
 useEffect(()=>{load()},[]);
 function flash(x){setToast(x);setTimeout(()=>setToast(""),2500)}
 const cfg=configs[page];
 async function save(table,row){
   try{const method=row.id?"PUT":"POST", path=row.id?`/${table}/${row.id}`:`/${table}`;
   const saved=await api(path,{method,body:JSON.stringify(row)});await load();flash("Saved");return saved;}catch(e){flash(e.message);return null}
 }
 async function remove(table,id){if(!confirm("Delete this row?"))return;await api(`/${table}/${id}`,{method:"DELETE"});await load();flash("Deleted")}
 async function importRows(table,records){
  let imported=0;
  try{for(const row of records){await api(`/${table}`,{method:"POST",body:JSON.stringify(row)});imported++}await load();flash(`${imported} row(s) imported`)}
  catch(e){await load();flash(`Imported ${imported}; stopped at row ${imported+1}: ${e.message}`)}
 }
 function add(){const r={};(cfg?.fields||[]).forEach(([k,,t])=>r[k]=t==="checkbox"?0:t==="number"?0:"");if(page==="Sales"){r.quantity=1;r.price=0;r.saleDate=today()}save(cfg.key,r)}
 async function exportCsv(){try{const response=await fetch(`${API}/export/${cfg.key}`,{headers:{Authorization:`Bearer ${localStorage.getItem("pods_token")}`}});if(!response.ok)throw new Error("Export failed");const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=`${cfg.key}.csv`;link.click();URL.revokeObjectURL(url)}catch(e){flash(e.message)}}
 async function changePassword(currentPassword,newPassword){await api("/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});flash("Password changed")}
 return <div className="app">
  <aside className={mobile?"open":""}><div className="brand"><div className="brand-mark">P</div><div><b>PODS TRACKER</b><span>Management System</span></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
   <nav>
    <button className={page==="Dashboard"?"active":""} onClick={()=>{setPage("Dashboard");setMobile(false)}}><LayoutDashboard/>Dashboard</button>
    {Object.entries(configs).map(([name,c])=><button key={name} className={page===name?"active":""} onClick={()=>{setPage(name);setMobile(false)}}><c.icon/>{name}</button>)}
    <button className={page==="Due Dates"?"active":""} onClick={()=>{setPage("Due Dates");setMobile(false)}}><CalendarClock/>Due Dates</button>
   </nav>
  <div className="side-bottom"><button onClick={()=>setPasswordOpen(true)}><KeyRound/>Change password</button><button onClick={onLogout}><LogOut/>Logout</button></div>
  </aside>
  <main><header><button className="icon-btn hamburger" onClick={()=>setMobile(true)}><Menu/></button><div><h2>{page}</h2><p>{page==="Dashboard"?"Welcome back. Here is your PODS overview.":"Manage every field directly in the table."}</p></div><div className="header-actions"><button className="secondary" onClick={()=>setPasswordOpen(true)}><KeyRound/>Change password</button><button className="print" onClick={()=>window.print()}><Printer/>Print</button></div></header>
   {toast&&<div className="toast">{toast}</div>}
  {page==="Dashboard"?<Dashboard data={data}/>:page==="Due Dates"?<DueDates data={data}/>:<DataTable cfg={cfg} rows={data[cfg.key]||[]} query={query} setQuery={setQuery} save={save} remove={remove} add={add} importRows={importRows} exportCsv={exportCsv} flash={flash}/>}
  {passwordOpen&&<PasswordModal onClose={()=>setPasswordOpen(false)} onChange={changePassword}/>}
  </main>
 </div>
}

function Dashboard({data}){
 const d=data.dash||{};
 const cards=[["Products",d.products||0,Package],["Clients",d.clients||0,Users],["Stock Units",d.stock||0,Package],["Sales",d.sales||0,ShoppingCart],["Revenue",money(d.revenue),ShoppingCart],["Unpaid",money(d.unpaid),CalendarClock]];
 return <section className="content"><div className="cards">{cards.map(([n,v,I])=><div className="card" key={n}><div className="card-icon"><I/></div><div><span>{n}</span><strong>{v}</strong></div></div>)}</div>
 <div className="grid2"><div className="panel"><h3>Inventory Alerts</h3><div className="alert-row"><AlertTriangle/><span>Low stock products</span><b>{d.lowStock||0}</b></div><div className="alert-row"><CalendarClock/><span>Due / overdue sales</span><b>{d.dueSoon||0}</b></div></div>
 <div className="panel"><h3>Quick Guide</h3><p className="muted">Use the Products page for your inventory. Record transactions under Sales; stock is automatically reduced. Every cell is editable and every row has a checkbox.</p></div></div>
 </section>
}

function DataTable({cfg,rows,query,setQuery,save,remove,add,importRows,exportCsv,flash}){
 const filtered=useMemo(()=>rows.filter(r=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),[rows,query]);
 const [drafts,setDrafts]=useState({});
 const draftsRef=useRef({});
 const savingRef=useRef({});
 const importRef=useRef(null);
 function update(id,key,value){const row=rows.find(x=>x.id===id);if(!row)return;const next={...draftsRef.current,[id]:{...(draftsRef.current[id]||row),[key]:value}};draftsRef.current=next;setDrafts(next)}
 async function commit(id){
  if(savingRef.current[id])return savingRef.current[id];
  const row=draftsRef.current[id];if(!row)return;
  const normalized={...row};cfg.fields.forEach(([key,,type])=>{if(type==="number")normalized[key]=Number(normalized[key]||0)});
  const pending=(async()=>{const result=await save(cfg.key,normalized);if(result){const next={...draftsRef.current};delete next[id];draftsRef.current=next;setDrafts(next)}})();
  savingRef.current[id]=pending;
  try{await pending}finally{delete savingRef.current[id]}
 }
 function create(){add()}
 function downloadTemplate(){const csv=Papa.unparse({fields:cfg.fields.map(([,label])=>label),data:[]});const blob=new Blob(["\uFEFF",csv],{type:"text/csv;charset=utf-8"});const url=URL.createObjectURL(blob);const link=document.createElement("a");link.href=url;link.download=`${cfg.key}-template.csv`;link.click();URL.revokeObjectURL(url)}
 async function handleImport(event){const file=event.target.files?.[0];if(!file)return;try{const parsed=Papa.parse(await file.text(),{header:true,skipEmptyLines:"greedy",transformHeader:header=>header.replace(/^\uFEFF/,"").trim()});if(parsed.errors.length)throw new Error(parsed.errors[0].message);const fieldMap=new Map(cfg.fields.flatMap(([key,label])=>[[key.toLowerCase(),key],[label.toLowerCase(),key]]));const requiredField={products:"product",clients:"name",sales:"product"}[cfg.key];const records=parsed.data.map((record,index)=>{const source={};Object.entries(record).forEach(([header,value])=>{const key=fieldMap.get(header.toLowerCase());if(key)source[key]=value});const row={};for(const [key,label,type] of cfg.fields){const raw=String(source[key]??"").trim();if(type==="number"){const value=raw===""?0:Number(raw);if(!Number.isFinite(value))throw new Error(`Row ${index+2}: ${label} must be a number`);row[key]=value}else if(type==="checkbox"){row[key]=["1","true","yes","y","paid","x"].includes(raw.toLowerCase())?1:0}else row[key]=raw}if(!String(row[requiredField]??"").trim())throw new Error(`Row ${index+2}: ${cfg.fields.find(([key])=>key===requiredField)?.[1]||requiredField} is required`);return row});if(!records.length)throw new Error("The CSV has no data rows");await importRows(cfg.key,records)}catch(e){flash(e.message)}finally{event.target.value=""}}
 return <section className="content"><div className="toolbar"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all columns..."/></div><button onClick={create} className="primary"><Plus/>Add Row</button><button onClick={downloadTemplate} className="secondary"><FileSpreadsheet/>CSV Template</button><button onClick={()=>importRef.current?.click()} className="secondary"><Upload/>Import CSV</button><button onClick={exportCsv} className="secondary"><Download/>Export CSV</button><input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport}/></div>
 <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>✓</th>{cfg.fields.map(f=><th key={f[0]}>{f[1]}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><input type="checkbox" checked={!!(drafts[r.id]?.checked??r.checked)} onChange={e=>{update(r.id,"checked",e.target.checked?1:0);commit(r.id)}}/></td>{cfg.fields.map(([key,label,type])=><td key={key}><Cell row={r} field={key} type={type} value={drafts[r.id]?.[key]??r[key]} change={value=>update(r.id,key,value)} commit={()=>commit(r.id)}/></td>)}<td className="actions"><button title="Save row" onClick={()=>commit(r.id)}><Save/></button><button className="danger" title="Delete" onClick={()=>remove(cfg.key,r.id)}><Trash2/></button></td></tr>)}{!filtered.length&&<tr><td colSpan={cfg.fields.length+2} className="empty">No records found.</td></tr>}</tbody></table></div>{cfg.fields.some(([key])=>key==="quantity")&&<datalist id="quantity-options">{Array.from({length:101},(_,value)=><option key={value} value={value}/>)}</datalist>}<div className="table-foot">{filtered.length} record(s) • Changes save when a cell loses focus</div></div></section>
}
function Cell({row,field,type,value,change,commit}){
 if(type==="checkbox") return <input type="checkbox" checked={!!value} onChange={e=>{change(e.target.checked?1:0);commit()}}/>;
 return <input type={type} list={field==="quantity"?"quantity-options":undefined} value={value??""} onChange={e=>change(e.target.value)} onBlur={commit} className={field==="notes"?"wide":""}/>;
}

function DueDates({data}){
 const sales=(data.sales||[]).filter(s=>!s.paid&&s.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const now=today();
 return <section className="content"><div className="panel"><h3>Outstanding Due Dates</h3><div className="due-list">{sales.map(s=><div className={"due "+(s.dueDate<now?"overdue":"")} key={s.id}><div><b>{s.client||"No client"}</b><span>{s.product} {s.flavor?`• ${s.flavor}`:""} · {money(s.total)}</span></div><strong>{s.dueDate}{s.dueDate<now?" · OVERDUE":""}</strong></div>)}{!sales.length&&<div className="empty">No unpaid due dates.</div>}</div></div></section>
}

function PasswordModal({onClose,onChange}){
 const [currentPassword,setCurrentPassword]=useState(""),[newPassword,setNewPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 async function submit(event){event.preventDefault();setError("");if(newPassword.length<8){setError("Use at least 8 characters for the new password.");return}if(newPassword!==confirmPassword){setError("The new passwords do not match.");return}setSaving(true);try{await onChange(currentPassword,newPassword);onClose()}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title"><div className="modal-heading"><h3 id="password-title">Change password</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X/></button></div><form onSubmit={submit}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required/></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/></label>{error&&<div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?"Saving...":"Update password"}</button></div></form></section></div>
}
createRoot(document.getElementById("root")).render(<App/>);