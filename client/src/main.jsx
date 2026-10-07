import React,{useEffect,useMemo,useRef,useState} from "react";
import {createRoot} from "react-dom/client";
import {LayoutDashboard,Package,ShoppingCart,CalendarClock,LogOut,Plus,Trash2,Save,Download,Search,Menu,X,Printer,AlertTriangle,Upload,FileSpreadsheet,KeyRound,ArrowRight} from "lucide-react";
import Papa from "papaparse";
import "./styles.css";

const API="/api";
async function api(path,options={}) {
  const token=localStorage.getItem("pods_token");
  const r=await fetch(API+path,{...options,headers:{"Content-Type":"application/json",...(token?{Authorization:`Bearer ${token}`}:{})}});
  if(!r.ok){const d=await r.json().catch(()=>({error:"Request failed"}));if(r.status===401&&path!=="/login"&&d.error==="Unauthorized"){localStorage.removeItem("pods_token");window.dispatchEvent(new Event("pods:unauthorized"))}throw new Error(d.error||"Request failed")}
  return r.json();
}

const empty={products:[],sales:[],purchases:[]};
const money=n=>"₱"+Number(n||0).toLocaleString("en-PH",{minimumFractionDigits:2});
const today=()=>new Date().toISOString().slice(0,10);

function Login({onLogin}){
 const [u,setU]=useState(""),[p,setP]=useState(""),[err,setErr]=useState("");
 async function go(e){e.preventDefault();try{const d=await api("/login",{method:"POST",body:JSON.stringify({username:u,password:p})});localStorage.setItem("pods_token",d.token);onLogin(d.user)}catch(e){setErr(e.message)}}
 return <div className="login"><div className="login-card"><div className="logo">P</div><h1>PODS TRACKER</h1><p>Inventory • Sales • Due Dates</p><form onSubmit={go}><input value={u} onChange={e=>setU(e.target.value)} placeholder="Username"/><input type="password" value={p} onChange={e=>setP(e.target.value)} placeholder="Password"/>{err&&<div className="error">{err}</div>}<button className="primary">Sign In</button></form></div></div>
}

const configs={
 Products:{key:"products",icon:Package,fields:[
  ["product","Product","text"],["flavor","Flavor","text"],["price","Price","number"],["quantity","Qty","number"],["stock","Stock","number"],["sold","Sold","number"],["dueDate","Due Date","date"],["status","Status","text"],["notes","Notes","text"]
 ]},
 Sales:{key:"sales",icon:ShoppingCart,fields:[
  ["productId","Product","product"],["quantity","Qty","number"],["price","Price","number"],["total","Total","number"],["saleDate","Sale Date","date"],["dueDate","Due Date","date"],["paid","Paid","checkbox"],["notes","Notes","text"],["transactionId","Txn","transaction"]
 ]}
};

function App(){
 const [user,setUser]=useState(()=>localStorage.getItem("pods_token")?{username:"admin"}:null);
 useEffect(()=>{const expired=()=>setUser(null);window.addEventListener("pods:unauthorized",expired);return()=>window.removeEventListener("pods:unauthorized",expired)},[]);
 if(!user) return <Login onLogin={setUser}/>;
 return <Tracker onLogout={()=>{localStorage.removeItem("pods_token");setUser(null)}}/>;
}

function Tracker({onLogout}){
 const [page,setPage]=useState("Dashboard"),[spreadsheetTable,setSpreadsheetTable]=useState("Products"),[data,setData]=useState(empty),[query,setQuery]=useState(""),[mobile,setMobile]=useState(false),[toast,setToast]=useState(""),[passwordOpen,setPasswordOpen]=useState(false),[saleOpen,setSaleOpen]=useState(false);
 async function load(){try{const [products,sales,purchases,dash]=await Promise.all([api("/products"),api("/sales"),api("/purchases"),api("/dashboard")]);setData({products,sales,purchases,dash})}catch(e){flash(e.message)}}
 useEffect(()=>{load()},[]);
 function flash(x){setToast(x);setTimeout(()=>setToast(""),2500)}
 const cfg=page==="Spreadsheet"?configs[spreadsheetTable]:configs[page];
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
 function add(){if(cfg?.key==="sales"){setSaleOpen(true);return}const r={};(cfg?.fields||[]).forEach(([k,,t])=>r[k]=t==="checkbox"?0:t==="number"?0:"");save(cfg.key,r)}
 async function exportCsv(){try{const response=await fetch(`${API}/export/${cfg.key}`,{headers:{Authorization:`Bearer ${localStorage.getItem("pods_token")}`}});if(response.status===401){localStorage.removeItem("pods_token");window.dispatchEvent(new Event("pods:unauthorized"))}if(!response.ok)throw new Error("Export failed");const url=URL.createObjectURL(await response.blob());const link=document.createElement("a");link.href=url;link.download=`${cfg.key}.csv`;link.click();URL.revokeObjectURL(url)}catch(e){flash(e.message)}}
 async function changePassword(currentPassword,newPassword){await api("/change-password",{method:"POST",body:JSON.stringify({currentPassword,newPassword})});flash("Password changed")}
 return <div className="app">
  <aside className={mobile?"open":""}><div className="brand"><div className="brand-mark">P</div><div><b>PODS TRACKER</b><span>Management System</span></div><button className="icon-btn mobile-close" onClick={()=>setMobile(false)}><X/></button></div>
   <nav>
    <button className={page==="Dashboard"?"active":""} onClick={()=>{setPage("Dashboard");setMobile(false)}}><LayoutDashboard/>Dashboard</button>
    {Object.entries(configs).map(([name,c])=><button key={name} className={page===name?"active":""} onClick={()=>{setPage(name);setMobile(false)}}><c.icon/>{name}</button>)}
    <button className={page==="Spreadsheet"?"active":""} onClick={()=>{setPage("Spreadsheet");setMobile(false)}}><FileSpreadsheet/>Spreadsheet</button>
    <button className={page==="Purchases"?"active":""} onClick={()=>{setPage("Purchases");setMobile(false)}}><Package/>Purchases</button>
    <button className={page==="Due Dates"?"active":""} onClick={()=>{setPage("Due Dates");setMobile(false)}}><CalendarClock/>Due Dates</button>
   </nav>
  <div className="side-bottom"><button onClick={()=>setPasswordOpen(true)}><KeyRound/>Change password</button><button onClick={onLogout}><LogOut/>Logout</button></div>
  </aside>
  <main><header><button className="icon-btn hamburger" onClick={()=>setMobile(true)}><Menu/></button><div><h2>{page}</h2><p>{page==="Dashboard"?"Welcome back. Here is your PODS overview.":page==="Spreadsheet"?"Browse and edit products or sales in a spreadsheet-style grid.":"Manage every field directly in the table."}</p></div><div className="header-actions"><button className="secondary" onClick={()=>setPasswordOpen(true)}><KeyRound/>Change password</button><button className="print" onClick={()=>window.print()}><Printer/>Print</button></div></header>
   {toast&&<div className="toast">{toast}</div>}
  {page==="Dashboard"?<Dashboard data={data} save={save} onViewProducts={()=>setPage("Products")}/>:page==="Due Dates"?<DueDates data={data}/>:page==="Purchases"?<Purchases data={data} onPurchase={async purchase=>{const saved=await api("/purchases",{method:"POST",body:JSON.stringify(purchase)});await load();flash(`${saved.quantity} unit(s) received`);return saved}} flash={flash}/>:page==="Spreadsheet"?<section className="content spreadsheet-page"><div className="spreadsheet-tabs" role="tablist" aria-label="Spreadsheet tables">{Object.keys(configs).map(name=><button key={name} role="tab" aria-selected={spreadsheetTable===name} className={spreadsheetTable===name?"active":""} onClick={()=>{setSpreadsheetTable(name);setQuery("")}}><FileSpreadsheet/>{name}</button>)}</div><DataTable cfg={cfg} rows={data[cfg.key]||[]} products={data.products||[]} query={query} setQuery={setQuery} save={save} remove={remove} add={add} importRows={importRows} exportCsv={exportCsv} flash={flash} spreadsheet/></section>:<DataTable cfg={cfg} rows={data[cfg.key]||[]} products={data.products||[]} query={query} setQuery={setQuery} save={save} remove={remove} add={add} importRows={importRows} exportCsv={exportCsv} flash={flash}/>}
  {passwordOpen&&<PasswordModal onClose={()=>setPasswordOpen(false)} onChange={changePassword}/>}
  {saleOpen&&<SaleModal products={data.products||[]} onClose={()=>setSaleOpen(false)} onSubmit={async sale=>{const saved=await api("/sales",{method:"POST",body:JSON.stringify(sale)});await load();flash(`Sale recorded (${saved.sales.length} product line${saved.sales.length===1?"":"s"})`);return saved}} flash={flash}/>}
  </main>
 </div>
}

function Dashboard({data,save,onViewProducts}){
 const d=data.dash||{};
 const cards=[["Products",d.products||0,Package],["Stock Units",d.stock||0,Package],["Sales",d.sales||0,ShoppingCart],["Revenue",money(d.revenue),ShoppingCart],["Unpaid",money(d.unpaid),CalendarClock]];
 return <section className="content"><div className="cards">{cards.map(([n,v,I])=><div className="card" key={n}><div className="card-icon"><I/></div><div><span>{n}</span><strong>{v}</strong></div></div>)}</div>
 <div className="grid2"><div className="panel"><h3>Inventory Alerts</h3><div className="alert-row"><AlertTriangle/><span>Low stock products</span><b>{d.lowStock||0}</b></div><div className="alert-row"><CalendarClock/><span>Due / overdue sales</span><b>{d.dueSoon||0}</b></div></div>
 <div className="panel"><h3>Stock Position</h3><div className="stock-summary"><strong>{(data.products||[]).filter(product=>Number(product.stock)>0).length}</strong><span>products currently in stock</span><button className="secondary" onClick={onViewProducts}>Manage products<ArrowRight/></button></div></div></div>
 <InventoryGrid products={(data.products||[]).filter(product=>Number(product.stock)>0)} save={save}/>
 </section>
}

function InventoryGrid({products,save}){
 const [query,setQuery]=useState(""),[drafts,setDrafts]=useState({});
 const fields=[["product","Product","text"],["flavor","Flavor","text"],["price","Price","number"],["stock","Stock","number"],["sold","Sold","number"],["status","Status","text"]];
 const filtered=products.filter(product=>JSON.stringify(product).toLowerCase().includes(query.toLowerCase()));
 function change(product,key,value){setDrafts(current=>({...current,[product.id]:{...(current[product.id]||product),[key]:value}}))}
 async function commit(id){const draft=drafts[id];if(!draft)return;const normalized={...draft,price:Number(draft.price||0),stock:Number(draft.stock||0),sold:Number(draft.sold||0)};if(await save("products",normalized))setDrafts(current=>{const next={...current};delete next[id];return next})}
 return <div className="inventory-sheet"><div className="sheet-heading"><div><h3>Products in stock</h3><span>{filtered.length} of {products.length} products</span></div><label className="search"><Search/><input value={query} onChange={event=>setQuery(event.target.value)} placeholder="Filter inventory..."/></label></div><div className="table-scroll"><table><thead><tr>{fields.map(([,label])=><th key={label}>{label}</th>)}</tr></thead><tbody>{filtered.map(product=><tr key={product.id}>{fields.map(([key,,type])=><td key={key}><input type={type} value={drafts[product.id]?.[key]??product[key]??""} onChange={event=>change(product,key,event.target.value)} onBlur={()=>commit(product.id)}/></td>)}</tr>)}{!filtered.length&&<tr><td colSpan={fields.length} className="empty">No in-stock products match this filter.</td></tr>}</tbody></table></div><div className="table-foot">Edit a cell and leave it to save.</div></div>
}

function DataTable({cfg,rows,products,query,setQuery,save,remove,add,importRows,exportCsv,flash,spreadsheet=false}){
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
 async function handleImport(event){
  const file=event.target.files?.[0];if(!file)return;
  try{
   const parsed=Papa.parse(await file.text(),{header:true,skipEmptyLines:"greedy",transformHeader:header=>header.replace(/^\uFEFF/,"").trim()});
   if(parsed.errors.length)throw new Error(parsed.errors[0].message);
   const fieldMap=new Map(cfg.fields.flatMap(([key,label])=>[[key.toLowerCase(),key],[label.toLowerCase(),key]]));
   const requiredField=cfg.key==="sales"?"productId":cfg.key==="products"?"product":null;
   const records=parsed.data.map((record,index)=>{
    const source={};Object.entries(record).forEach(([header,value])=>{const key=fieldMap.get(header.toLowerCase());if(key)source[key]=value});
    const row={};
    for(const [key,label,type] of cfg.fields){
     const raw=String(source[key]??"").trim();
     if(type==="number"){
      const value=raw===""?0:Number(raw);if(!Number.isFinite(value))throw new Error(`Row ${index+2}: ${label} must be a number`);row[key]=value;
     }else if(type==="checkbox")row[key]=["1","true","yes","y","paid","x"].includes(raw.toLowerCase())?1:0;
     else if(type==="product"){
      const product=products.find(item=>String(item.id)===raw||item.product===raw);
      if(raw&&!product)throw new Error(`Row ${index+2}: ${label} must match a catalog product`);
      row[key]=product?.id??"";
     }else row[key]=raw;
    }
    if(requiredField&&!String(row[requiredField]??"").trim())throw new Error(`Row ${index+2}: ${cfg.fields.find(([key])=>key===requiredField)?.[1]||requiredField} is required`);
    return row;
   });
   if(!records.length)throw new Error("The CSV has no data rows");
   await importRows(cfg.key,records);
  }catch(e){flash(e.message)}finally{event.target.value=""}
 }
 return <section className="content"><div className="toolbar"><div className="search"><Search/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search all columns..."/></div><button onClick={create} className="primary"><Plus/>{cfg.key==="sales"?"Record Sale":"Add Row"}</button><button onClick={downloadTemplate} className="secondary"><FileSpreadsheet/>CSV Template</button><button onClick={()=>importRef.current?.click()} className="secondary"><Upload/>Import CSV</button><button onClick={exportCsv} className="secondary"><Download/>Export CSV</button><input ref={importRef} type="file" accept=".csv,text/csv" hidden onChange={handleImport}/></div>
 <div className={`panel table-panel${spreadsheet?" spreadsheet-mode":""}`}><div className="table-scroll"><table><thead><tr>{spreadsheet&&<th className="sheet-row-number">#</th>}<th>✓</th>{cfg.fields.map(f=><th key={f[0]}>{f[1]}</th>)}<th>Actions</th></tr></thead><tbody>{filtered.map((r,index)=><tr key={r.id}>{spreadsheet&&<th className="sheet-row-number">{index+1}</th>}<td><input type="checkbox" checked={!!(drafts[r.id]?.checked??r.checked)} onChange={e=>{update(r.id,"checked",e.target.checked?1:0);commit(r.id)}}/></td>{cfg.fields.map(([key,label,type])=><td key={key}><Cell row={r} field={key} type={type} products={products} value={drafts[r.id]?.[key]??r[key]} change={value=>update(r.id,key,value)} commit={()=>commit(r.id)}/></td>)}<td className="actions"><button title="Save row" onClick={()=>commit(r.id)}><Save/></button><button className="danger" title="Delete" onClick={()=>remove(cfg.key,r.id)}><Trash2/></button></td></tr>)}{!filtered.length&&<tr><td colSpan={cfg.fields.length+(spreadsheet?3:2)} className="empty">No records found.</td></tr>}</tbody></table></div>{cfg.fields.some(([key])=>key==="quantity")&&<datalist id="quantity-options">{Array.from({length:101},(_,value)=><option key={value} value={value}/>)}</datalist>}<div className="table-foot">{filtered.length} record(s) • Changes save when a cell loses focus</div></div></section>
}
function Cell({row,field,type,value,products=[],change,commit}){
 if(type==="product") return <select value={value??""} onChange={event=>{change(event.target.value?Number(event.target.value):"");commit()}}><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.product}{product.flavor?` · ${product.flavor}`:""} (stock: {product.stock})</option>)}</select>;
 if(type==="transaction") return <span title={value||`Legacy sale ${row.id}`}>{value?`#${String(value).slice(0,8)}`:`#${row.id}`}</span>;
 if(type==="checkbox") return <input type="checkbox" checked={!!value} onChange={e=>{change(e.target.checked?1:0);commit()}}/>;
 return <input type={type} list={field==="quantity"?"quantity-options":undefined} value={value??""} onChange={e=>change(e.target.value)} onBlur={commit} className={field==="notes"?"wide":""}/>;
}

function Purchases({data,onPurchase,flash}){
 const [productId,setProductId]=useState(""),[quantity,setQuantity]=useState(1),[purchaseDate,setPurchaseDate]=useState(today()),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
 const products=data.products||[],purchases=data.purchases||[];
 async function submit(event){event.preventDefault();if(!productId){flash("Select a product to receive");return}setSaving(true);try{await onPurchase({productId:Number(productId),quantity:Number(quantity),purchaseDate,notes});setQuantity(1);setNotes("")}catch(error){flash(error.message)}finally{setSaving(false)}}
 return <section className="content"><form className="panel receive-form" onSubmit={submit}><div><h3>Receive stock</h3><p className="muted">Add purchased units to a product's available stock.</p></div><label>Product<select value={productId} onChange={event=>setProductId(event.target.value)} required><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.product}{product.flavor?` · ${product.flavor}`:""} (stock: {product.stock})</option>)}</select></label><label>Quantity<input type="number" min="1" step="1" value={quantity} onChange={event=>setQuantity(event.target.value)} required/></label><label>Purchase date<input type="date" value={purchaseDate} onChange={event=>setPurchaseDate(event.target.value)} required/></label><label className="receive-notes">Notes<input value={notes} onChange={event=>setNotes(event.target.value)} placeholder="Optional reference"/></label><button className="primary" type="submit" disabled={saving||!products.length}><Plus/>{saving?"Receiving...":"Receive stock"}</button></form>
 <div className="panel purchase-history"><h3>Purchase history</h3><div className="table-scroll"><table><thead><tr><th>Product</th><th>Quantity</th><th>Date</th><th>Notes</th></tr></thead><tbody>{purchases.map(purchase=><tr key={purchase.id}><td>{purchase.product}{purchase.flavor?` · ${purchase.flavor}`:""}</td><td>{purchase.quantity}</td><td>{purchase.purchaseDate}</td><td>{purchase.notes||"—"}</td></tr>)}{!purchases.length&&<tr><td colSpan="4" className="empty">No purchases recorded.</td></tr>}</tbody></table></div></div></section>
}

function SaleModal({products,onClose,onSubmit,flash}){
 const [items,setItems]=useState([{lineId:1,productId:"",quantity:"1",price:""}]);
 const [nextLineId,setNextLineId]=useState(2);
 const [saleDate,setSaleDate]=useState(today()),[dueDate,setDueDate]=useState(""),[paid,setPaid]=useState(false),[notes,setNotes]=useState(""),[saving,setSaving]=useState(false);
 const total=items.reduce((sum,item)=>sum+Number(item.quantity||0)*Number(item.price||0),0);
 function updateItem(lineId,changes){setItems(current=>current.map(item=>item.lineId===lineId?{...item,...changes}:item))}
 function addItem(){setItems(current=>[...current,{lineId:nextLineId,productId:"",quantity:"1",price:""}]);setNextLineId(id=>id+1)}
 async function submit(event){
  event.preventDefault();
  if(!items.length||items.some(item=>!item.productId)){flash("Select a product for every sale item");return}
  if(items.some(item=>!Number.isSafeInteger(Number(item.quantity))||Number(item.quantity)<=0)){flash("Each quantity must be a positive whole number");return}
  if(items.some(item=>!Number.isFinite(Number(item.price))||Number(item.price)<0)){flash("Enter a valid non-negative price for every item");return}
  setSaving(true);
  try{await onSubmit({items:items.map(({productId,quantity,price})=>({productId:Number(productId),quantity:Number(quantity),price:Number(price)})),saleDate,dueDate,paid:paid?1:0,notes});onClose()}
  catch(error){flash(error.message)}
  finally{setSaving(false)}
 }
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="password-modal transaction-modal" role="dialog" aria-modal="true" aria-labelledby="sale-title"><div className="modal-heading"><h3 id="sale-title">Record sale</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X/></button></div><form onSubmit={submit}>
  <div className="sale-items"><div className="sale-items-heading"><b>Products in this sale</b><button type="button" className="secondary" onClick={addItem}><Plus/>Add product</button></div>
   {items.map((item,index)=>{const selected=products.find(product=>String(product.id)===item.productId);return <div className="sale-line" key={item.lineId}>
    <label>Product<select value={item.productId} onChange={event=>{const product=products.find(option=>String(option.id)===event.target.value);updateItem(item.lineId,{productId:event.target.value,price:product?.price??""})}} required><option value="">Select product</option>{products.map(product=><option key={product.id} value={product.id}>{product.product}{product.flavor?` · ${product.flavor}`:""} (stock: {product.stock})</option>)}</select></label>
    <label>Quantity<input type="number" min="1" max={selected?.stock??undefined} step="1" value={item.quantity} onChange={event=>updateItem(item.lineId,{quantity:event.target.value})} required/></label>
    <label>Unit price<input type="number" min="0" step="0.01" value={item.price} onChange={event=>updateItem(item.lineId,{price:event.target.value})} required/></label>
    <button type="button" className="remove-sale-line" aria-label={`Remove product ${index+1}`} disabled={items.length===1} onClick={()=>setItems(current=>current.filter(line=>line.lineId!==item.lineId))}><Trash2/></button>
   </div>})}
   <div className="sale-total"><span>Transaction total</span><b>{money(total)}</b></div>
  </div>
  <label>Sale date<input type="date" value={saleDate} onChange={event=>setSaleDate(event.target.value)} required/></label><label>Due date<input type="date" value={dueDate} onChange={event=>setDueDate(event.target.value)}/></label><label className="check-label"><input type="checkbox" checked={paid} onChange={event=>setPaid(event.target.checked)}/>Paid</label><label>Notes<input value={notes} onChange={event=>setNotes(event.target.value)}/></label><div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving||!products.length}>{saving?"Recording...":"Record sale"}</button></div></form></section></div>
}

function DueDates({data}){
 const sales=(data.sales||[]).filter(s=>!s.paid&&s.dueDate).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
 const now=today();
 return <section className="content"><div className="panel"><h3>Outstanding Due Dates</h3><div className="due-list">{sales.map(s=><div className={"due "+(s.dueDate<now?"overdue":"")} key={s.id}><div><b>{s.product} {s.flavor?`• ${s.flavor}`:""}</b><span>{money(s.total)}</span></div><strong>{s.dueDate}{s.dueDate<now?" · OVERDUE":""}</strong></div>)}{!sales.length&&<div className="empty">No unpaid due dates.</div>}</div></div></section>
}

function PasswordModal({onClose,onChange}){
 const [currentPassword,setCurrentPassword]=useState(""),[newPassword,setNewPassword]=useState(""),[confirmPassword,setConfirmPassword]=useState(""),[error,setError]=useState(""),[saving,setSaving]=useState(false);
 async function submit(event){event.preventDefault();setError("");if(newPassword.length<8){setError("Use at least 8 characters for the new password.");return}if(newPassword!==confirmPassword){setError("The new passwords do not match.");return}setSaving(true);try{await onChange(currentPassword,newPassword);onClose()}catch(e){setError(e.message)}finally{setSaving(false)}}
 return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose()}}><section className="password-modal" role="dialog" aria-modal="true" aria-labelledby="password-title"><div className="modal-heading"><h3 id="password-title">Change password</h3><button type="button" className="icon-btn" aria-label="Close" onClick={onClose}><X/></button></div><form onSubmit={submit}><label>Current password<input type="password" autoComplete="current-password" value={currentPassword} onChange={event=>setCurrentPassword(event.target.value)} required/></label><label>New password<input type="password" autoComplete="new-password" minLength={8} value={newPassword} onChange={event=>setNewPassword(event.target.value)} required/></label><label>Confirm new password<input type="password" autoComplete="new-password" minLength={8} value={confirmPassword} onChange={event=>setConfirmPassword(event.target.value)} required/></label>{error&&<div className="error">{error}</div>}<div className="modal-actions"><button type="button" className="secondary" onClick={onClose}>Cancel</button><button type="submit" className="primary" disabled={saving}>{saving?"Saving...":"Update password"}</button></div></form></section></div>
}
createRoot(document.getElementById("root")).render(<App/>);