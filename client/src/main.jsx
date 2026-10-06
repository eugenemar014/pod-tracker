import React,{useEffect,useMemo,useState} from "react";
import {createRoot} from "react-dom/client";
import {LayoutDashboard,Package,ShoppingCart,Users,CalendarClock,LogOut,Plus,Trash2,Save,Download,Search,Menu,X,Printer,AlertTriangle} from "lucide-react";
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
 const [u,setU]=useState("admin"),[p,setP]=useState("admin123"),[err,setErr]=useState("");
 async function go(e){e.preventDefault();try{const d=await api("/login",{method:"POST",body:JSON.stringify({username:u,password:p})});localStorage.setItem("pods_token",d.token);onLogin(d.user)}catch(e){setErr(e.message)}}
 return <div className="login"><div className="login-card"><div className="logo">P</div><h1>PODS TRACKER</h1><p>Inventory • Sales • Clients • Due Dates</p><form onSubmit={go}><input value={u} onChange={e=>setU(e.target.value)} placeholder="Username"/><input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Password"/>{err&&<div className="error">{err}</div>}<button className="primary">Sign In</button></form><small>Default: admin / admin123</small></div></div>
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
 const [page,setPage]=useState("Dashboard"),[data,setData]=useState(empty),[query,setQuery]=useState(""),[mobile,setMobile]=useState(false),[toast,setToast]=useState("");
 async function load(){try{const [products,clients,sales,dash]=await Promise.all([api("/products"),api("/clients"),api("/sales"),api("/dashboard")]);setData({products,clients,sales,dash})}catch(e){flash(e.message)}}
 useEffect(()=>{load()},[]);
 function flash(x){setToast(x);setTimeout(()=>setToast(""),2500)}
 const cfg=configs[page];
 async function save(table,row){
   try{const method=row.id?"PUT":"POST", path=row.id?`/${table}/${row.id}`:`/${table}`;
   await api(path,{method,body:JSON.stringify(row)});await load();flash("Saved");}catch(e){flash(e.message)}
 }
 async function remove(table,id){if(!confirm("Delete this row?"))return;await api(`/${table}/${id}`,{method:"DELETE"});await load();flash("Deleted")}
 function add(){const r={};(cfg?.fields||[]).forEach(([k,,t])=>r[k]=t==="checkbox"?0:t==="number"?0:"");if(page==="Sales"){r.quantity=1;r.price=0;r.saleDate=today()}save(cfg.key,r)}
 function exportCsv(){window.open(`${API}/export/${cfg.key}?token=${localStorage.getItem("pods_token")}`)}
 return <div className="app">
  <aside className={mobile?"open":""}><div className="brand"><div className="brand-mark">P</div><div><b>PODS TRACKER</b><span>Management System</span></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
   <nav>
    <button className={page==="Dashboard"?"active":""} onClick={()=>{setPage("Dashboard");setMobile(false)}}><LayoutDashboard/>Dashboard</button>
    {Object.entries(configs).map(([name,c])=><button key={name} className={page===name?"active":""} onClick={()=>{setPage(name);setMobile(false)}}><c.icon/>{name}</button>)}
    <button className={page==="Due Dates"?"active":""} onClick={()=>{setPage("Due Dates");setMobile(false)}}><CalendarClock/>Due Dates</button>
   </nav>
   <div className="side-bottom"><button onClick={onLogout}><LogOut/>Logout</button></div>
  </aside>
  <main><header><button className="icon-btn hamburger" onClick={()=>setMobile(true)}><Menu/></button><div><h2>{page}</h2><p>{page==="Dashboard"?"Welcome back. Here is your PODS overview.":"Manage every field directly in the table."}</p></div><div className="header-actions"><button className="print" onClick={()=>window.print()}><Printer/>Print</button></div></header>
   {toast&&<div className="toast">{toast}</div>}
   {page==="Dashboard"?<Dashboard data={data}/>:page==="Due Dates"?<DueDates data={data}/>:<DataTable cfg={cfg} rows={data[cfg.key]||[]} query={query} setQuery={setQuery} save={save} remove={remove} add={add} exportCsv={exportCsv} flash={flash}/>}
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

function DataTable({cfg,rows,query,setQuery,save,remove,add,exportCsv,flash}){
 const filtered=useMemo(()=>rows.filter(r=>JSON.stringify(r).toLowerCase().includes(query.toLowerCase())),[rows,query]);
 function update(id,key,value){const row=rows.find(x=>x.id===id);if(row) save(cfg.key,{...row,[key]:value})}
 function create(){add()}
 return <section className="content"><div className="toolbar"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all columns..."/></div><button onClick={create} className="primary"><Plus/>Add Row</button><button onClick={exportCsv} className="secondary"><Download/>Excel CSV</button></div>
 <div className="panel table-panel"><div className="table-scroll"><table><thead><tr><th>✓</th>{cfg.fields.map(f=><th key={f[0]}>{f[1]}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td><input type="checkbox" checked={!!r.checked} onChange={e=>update(r.id,"checked",e.target.checked?1:0)}/></td>{cfg.fields.map(([key,label,type])=><td key={key}><Cell row={r} field={key} type={type} update={update}/></td>)}<td className="actions"><button title="Save" onClick={()=>save(cfg.key,r)}><Save/></button><button className="danger" title="Delete" onClick={()=>remove(cfg.key,r.id)}><Trash2/></button></td></tr>)}{!filtered.length&&<tr><td colSpan={cfg.fields.length+2} className="empty">No records found.</td></tr>}</tbody></table></div><div className="table-foot">{filtered.length} record(s) • All columns are editable</div></div></section>
}
function Cell({row,field,type,update}){
 const val=row[field];
 if(type==="checkbox") return <input type="checkbox" checked={!!val} onChange={e=>update(row.id,field,e.target.checked?1:0)}/>;
 return <input type={type} value={val??""} onChange={e=>update(row.id,field,type==="number"?Number(e.target.value):e.target.value)} className={field==="notes"?"wide":""}/>;
}

function DueDates({data}){
 const sales=(data.sales||[]).filter(s=>!s.paid&&s.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const now=today();
 return <section className="content"><div className="panel"><h3>Outstanding Due Dates</h3><div className="due-list">{sales.map(s=><div className={"due "+(s.dueDate<now?"overdue":"")} key={s.id}><div><b>{s.client||"No client"}</b><span>{s.product} {s.flavor?`• ${s.flavor}`:""} · {money(s.total)}</span></div><strong>{s.dueDate}{s.dueDate<now?" · OVERDUE":""}</strong></div>)}{!sales.length&&<div className="empty">No unpaid due dates.</div>}</div></div></section>
}
createRoot(document.getElementById("root")).render(<App/>);