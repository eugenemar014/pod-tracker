import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import jwt from "jsonwebtoken";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "pods-tracker-change-this-secret";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "eugenemar014";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Namithan014";
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "pods-tracker.db");

if (process.env.APP_ENV === "production" && (!process.env.JWT_SECRET || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD)) {
  throw new Error("Production requires JWT_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD");
}

app.use(cors());
app.use(express.json());

const db = new Database(DB_PATH);
db.pragma("foreign_keys = ON");

db.exec(`
CREATE TABLE IF NOT EXISTS users (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 username TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 client TEXT DEFAULT '',
 price REAL DEFAULT 0,
 quantity INTEGER DEFAULT 0,
 stock INTEGER DEFAULT 0,
 sold INTEGER DEFAULT 0,
 dueDate TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0,
 createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS clients (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 contact TEXT DEFAULT '',
 email TEXT DEFAULT '',
 address TEXT DEFAULT '',
 balance REAL DEFAULT 0,
 dueDate TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sales (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 productId INTEGER,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 client TEXT DEFAULT '',
 quantity INTEGER DEFAULT 1,
 price REAL DEFAULT 0,
 total REAL DEFAULT 0,
 saleDate TEXT DEFAULT CURRENT_TIMESTAMP,
 dueDate TEXT DEFAULT '',
 paid INTEGER DEFAULT 0,
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0,
 FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS purchases (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 productId INTEGER,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 quantity INTEGER NOT NULL,
 purchaseDate TEXT DEFAULT CURRENT_TIMESTAMP,
 notes TEXT DEFAULT '',
 FOREIGN KEY(productId) REFERENCES products(id) ON DELETE SET NULL
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT
);
`);

const defaultAdmin = db.prepare("SELECT id FROM users WHERE username='admin'").get();
if (process.env.APP_ENV === "production" && defaultAdmin) {
  db.prepare("UPDATE users SET username=?, password=? WHERE id=?").run(ADMIN_USERNAME, ADMIN_PASSWORD, defaultAdmin.id);
} else if (!db.prepare("SELECT id FROM users LIMIT 1").get()) {
  db.prepare("INSERT INTO users (username,password) VALUES (?,?)").run(ADMIN_USERNAME, ADMIN_PASSWORD);
}

const productColumns = db.prepare("PRAGMA table_info(products)").all();
if (!productColumns.some(col => col.name === "quantity")) {
  db.exec("ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT 0");
}

const auth = (req,res,next) => {
  const token = (req.headers.authorization || "").replace("Bearer ","");
  try { req.user = jwt.verify(token, JWT_SECRET); next(); }
  catch { res.status(401).json({error:"Unauthorized"}); }
};

app.post("/api/change-password",auth,(req,res)=>{
  const {currentPassword,newPassword} = req.body;
  if(typeof newPassword!=="string"||newPassword.length<8) return res.status(400).json({error:"New password must be at least 8 characters"});
  const user=db.prepare("SELECT id,password FROM users WHERE id=?").get(req.user.id);
  if(!user||user.password!==currentPassword) return res.status(401).json({error:"Current password is incorrect"});
  if(newPassword===currentPassword) return res.status(400).json({error:"Choose a different password"});
  db.prepare("UPDATE users SET password=? WHERE id=?").run(newPassword,user.id);
  res.json({ok:true});
});

app.post("/api/login",(req,res)=>{
  const {username,password} = req.body;
  const user = db.prepare("SELECT * FROM users WHERE username=? AND password=?").get(username,password);
  if (!user) return res.status(401).json({error:"Invalid username or password"});
  res.json({token:jwt.sign({id:user.id,username:user.username},JWT_SECRET,{expiresIn:"8h"}), user:{username:user.username}});
});

const tables = ["products","clients","sales","purchases"];
for (const table of tables) {
  app.get(`/api/${table}`,auth,(req,res)=>{
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all());
  });
}

app.post("/api/products",auth,(req,res)=>{
  const p={product:"",flavor:"",client:"",price:0,quantity:0,stock:0,sold:0,dueDate:"",status:"Active",notes:"",checked:0,...req.body};
  const r=db.prepare(`INSERT INTO products (product,flavor,client,price,quantity,stock,sold,dueDate,status,notes,checked)
    VALUES (@product,@flavor,@client,@price,@quantity,@stock,@sold,@dueDate,@status,@notes,@checked)`).run(p);
  res.json(db.prepare("SELECT * FROM products WHERE id=?").get(r.lastInsertRowid));
});
app.put("/api/products/:id",auth,(req,res)=>{
  const p={id:req.params.id,product:"",flavor:"",client:"",price:0,quantity:0,stock:0,sold:0,dueDate:"",status:"Active",notes:"",checked:0,...req.body};
  db.prepare(`UPDATE products SET product=@product,flavor=@flavor,client=@client,price=@price,quantity=@quantity,stock=@stock,sold=@sold,
    dueDate=@dueDate,status=@status,notes=@notes,checked=@checked WHERE id=@id`).run(p);
  res.json(db.prepare("SELECT * FROM products WHERE id=?").get(p.id));
});
app.delete("/api/products/:id",auth,(req,res)=>{db.prepare("DELETE FROM products WHERE id=?").run(req.params.id);res.json({ok:true});});

app.post("/api/clients",auth,(req,res)=>{
  const p={name:"",contact:"",email:"",address:"",balance:0,dueDate:"",status:"Active",notes:"",checked:0,...req.body};
  const r=db.prepare(`INSERT INTO clients (name,contact,email,address,balance,dueDate,status,notes,checked)
    VALUES (@name,@contact,@email,@address,@balance,@dueDate,@status,@notes,@checked)`).run(p);
  res.json(db.prepare("SELECT * FROM clients WHERE id=?").get(r.lastInsertRowid));
});
app.put("/api/clients/:id",auth,(req,res)=>{
  const p={id:req.params.id,name:"",contact:"",email:"",address:"",balance:0,dueDate:"",status:"Active",notes:"",checked:0,...req.body};
  db.prepare(`UPDATE clients SET name=@name,contact=@contact,email=@email,address=@address,balance=@balance,
    dueDate=@dueDate,status=@status,notes=@notes,checked=@checked WHERE id=@id`).run(p);
  res.json(db.prepare("SELECT * FROM clients WHERE id=?").get(p.id));
});
app.delete("/api/clients/:id",auth,(req,res)=>{db.prepare("DELETE FROM clients WHERE id=?").run(req.params.id);res.json({ok:true});});

app.post("/api/sales",auth,(req,res)=>{
  const s={productId:null,product:"",flavor:"",client:"",quantity:1,price:0,total:0,saleDate:new Date().toISOString().slice(0,10),dueDate:"",paid:0,notes:"",checked:0,...req.body};
  const quantity=Number(s.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<=0) return res.status(400).json({error:"Sale quantity must be a positive whole number"});
  const requestedProduct=String(s.productId||"");
  const product=(s.productId&&db.prepare("SELECT * FROM products WHERE id=?").get(s.productId))||db.prepare("SELECT * FROM products WHERE product=? AND flavor=? ORDER BY id LIMIT 1").get(s.product||requestedProduct,s.flavor||"");
  if(!product) return res.status(400).json({error:"Select a valid product for this sale"});
  s.productId=product.id;s.product=product.product;s.flavor=product.flavor;
  s.total=Number(s.quantity)*Number(s.price);
  const tx=db.transaction(()=>{
    const current=db.prepare("SELECT stock FROM products WHERE id=?").get(s.productId);
    if(!current||Number(current.stock)<quantity) throw new Error("INSUFFICIENT_STOCK");
    const r=db.prepare(`INSERT INTO sales (productId,product,flavor,client,quantity,price,total,saleDate,dueDate,paid,notes,checked)
      VALUES (@productId,@product,@flavor,@client,@quantity,@price,@total,@saleDate,@dueDate,@paid,@notes,@checked)`).run(s);
    db.prepare("UPDATE products SET stock=stock-@q,sold=sold+@q WHERE id=@id").run({q:quantity,id:s.productId});
    return r.lastInsertRowid;
  });
  try { res.json(db.prepare("SELECT * FROM sales WHERE id=?").get(tx())); }
  catch(error) { if(error.message==="INSUFFICIENT_STOCK") return res.status(409).json({error:"Insufficient stock for this sale"}); throw error; }
});
app.put("/api/sales/:id",auth,(req,res)=>{
  const old=db.prepare("SELECT * FROM sales WHERE id=?").get(req.params.id);
  if(!old) return res.status(404).json({error:"Sale not found"});
  const s={...old,...req.body,id:req.params.id};
  const quantity=Number(s.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<=0) return res.status(400).json({error:"Sale quantity must be a positive whole number"});
  const requestedProduct=String(s.productId||"");
  const product=(s.productId&&db.prepare("SELECT * FROM products WHERE id=?").get(s.productId))||db.prepare("SELECT * FROM products WHERE product=? AND flavor=? ORDER BY id LIMIT 1").get(s.product||requestedProduct,s.flavor||"");
  if(!product) return res.status(400).json({error:"Select a valid product for this sale"});
  s.productId=product.id;s.product=product.product;s.flavor=product.flavor;
  s.total=Number(s.quantity)*Number(s.price);
  const tx=db.transaction(()=>{
    if(old.productId) db.prepare("UPDATE products SET stock=stock+@q,sold=MAX(sold-@q,0) WHERE id=@id").run({q:Number(old.quantity),id:old.productId});
    const current=db.prepare("SELECT stock FROM products WHERE id=?").get(s.productId);
    if(!current||Number(current.stock)<quantity) throw new Error("INSUFFICIENT_STOCK");
    db.prepare(`UPDATE sales SET productId=@productId,product=@product,flavor=@flavor,client=@client,quantity=@quantity,
      price=@price,total=@total,saleDate=@saleDate,dueDate=@dueDate,paid=@paid,notes=@notes,checked=@checked WHERE id=@id`).run(s);
    db.prepare("UPDATE products SET stock=stock-@q,sold=sold+@q WHERE id=@id").run({q:quantity,id:s.productId});
  });
  try { tx(); res.json(db.prepare("SELECT * FROM sales WHERE id=?").get(req.params.id)); }
  catch(error) { if(error.message==="INSUFFICIENT_STOCK") return res.status(409).json({error:"Insufficient stock for this sale"}); throw error; }
});
app.delete("/api/sales/:id",auth,(req,res)=>{
  const s=db.prepare("SELECT * FROM sales WHERE id=?").get(req.params.id);
  if(s?.productId) db.prepare("UPDATE products SET stock=stock+?,sold=MAX(sold-?,0) WHERE id=?").run(s.quantity,s.quantity,s.productId);
  db.prepare("DELETE FROM sales WHERE id=?").run(req.params.id);
  res.json({ok:true});
});

app.post("/api/purchases",auth,(req,res)=>{
  const p={productId:null,quantity:0,purchaseDate:new Date().toISOString().slice(0,10),notes:"",...req.body};
  const quantity=Number(p.quantity);
  if(!Number.isSafeInteger(quantity)||quantity<=0) return res.status(400).json({error:"Purchase quantity must be a positive whole number"});
  const product=db.prepare("SELECT * FROM products WHERE id=?").get(p.productId);
  if(!product) return res.status(400).json({error:"Select a valid product for this purchase"});
  const tx=db.transaction(()=>{
    const r=db.prepare(`INSERT INTO purchases (productId,product,flavor,quantity,purchaseDate,notes)
      VALUES (@productId,@product,@flavor,@quantity,@purchaseDate,@notes)`)
      .run({...p,product:product.product,flavor:product.flavor,quantity});
    db.prepare("UPDATE products SET stock=stock+@quantity WHERE id=@id").run({quantity,id:product.id});
    return r.lastInsertRowid;
  });
  res.json(db.prepare("SELECT * FROM purchases WHERE id=?").get(tx()));
});

app.get("/api/dashboard",auth,(req,res)=>{
  const products=db.prepare("SELECT * FROM products").all();
  const sales=db.prepare("SELECT * FROM sales").all();
  const clients=db.prepare("SELECT * FROM clients").all();
  const today=new Date().toISOString().slice(0,10);
  res.json({
    products:products.length,
    clients:clients.length,
    sales:sales.length,
    stock:products.reduce((a,p)=>a+Number(p.stock||0),0),
    revenue:sales.reduce((a,s)=>a+Number(s.total||0),0),
    unpaid:sales.filter(s=>!s.paid).reduce((a,s)=>a+Number(s.total||0),0),
    lowStock:products.filter(p=>Number(p.stock)<=10).length,
    dueSoon:sales.filter(s=>s.dueDate && s.dueDate<=today && !s.paid).length
  });
});

app.get("/api/export/:table",auth,(req,res)=>{
  if(!tables.includes(req.params.table)) return res.status(400).end();
  const rows=db.prepare(`SELECT * FROM ${req.params.table}`).all();
  const keys=db.prepare(`PRAGMA table_info(${req.params.table})`).all().map(column=>column.name);
  const esc=v=>`"${String(v??"").replaceAll('"','""')}"`;
  const csv=[keys.map(esc).join(","),...rows.map(r=>keys.map(k=>esc(r[k])).join(","))].join("\n");
  res.setHeader("Content-Type","text/csv");
  res.setHeader("Content-Disposition",`attachment; filename=${req.params.table}.csv`);
  res.send(csv);
});

app.get("/api/health",(req,res)=>res.json({ok:true,name:"PODS TRACKER"}));

const clientDist=path.join(__dirname,"../client/dist");
app.use(express.static(clientDist));
app.use((req,res)=>{
  if(req.path.startsWith("/api/")) return res.status(404).json({error:"Not found"});
  res.sendFile(path.join(clientDist,"index.html"));
});

app.listen(PORT,()=>console.log(`PODS TRACKER server running on http://localhost:${PORT}`));
