import express from "express";
import cors from "cors";
import pg from "pg";
import jwt from "jsonwebtoken";
import { randomUUID } from "crypto";
import path from "path";
import { fileURLToPath } from "url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || "pods-tracker-change-this-secret";
const ADMIN_USERNAME = process.env.ADMIN_USERNAME || "eugenemar014";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Namithan014";
const DATABASE_URL = process.env.DATABASE_URL;
const DB_PATH = process.env.DB_PATH || path.join(__dirname, "pods-tracker.db");
const usePostgres = Boolean(DATABASE_URL);
const Database = usePostgres ? null : (await import("better-sqlite3")).default;
const db = usePostgres ? null : new Database(DB_PATH);
const pool = usePostgres ? new Pool({ connectionString: DATABASE_URL }) : null;

if (process.env.APP_ENV === "production" && (!process.env.JWT_SECRET || !process.env.ADMIN_USERNAME || !process.env.ADMIN_PASSWORD || !DATABASE_URL)) {
  throw new Error("Production requires DATABASE_URL, JWT_SECRET, ADMIN_USERNAME, and ADMIN_PASSWORD");
}

app.use(cors());
app.use(express.json());

const sqliteSchema = `
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
 "dueDate" TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0,
 "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS clients (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 contact TEXT DEFAULT '',
 email TEXT DEFAULT '',
 address TEXT DEFAULT '',
 balance REAL DEFAULT 0,
 "dueDate" TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sales (
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 "transactionId" TEXT,
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
`;

const postgresSchema = `
CREATE TABLE IF NOT EXISTS users (
 id SERIAL PRIMARY KEY,
 username TEXT UNIQUE NOT NULL,
 password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS products (
 id SERIAL PRIMARY KEY,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 client TEXT DEFAULT '',
 price REAL DEFAULT 0,
 quantity INTEGER DEFAULT 0,
 stock INTEGER DEFAULT 0,
 sold INTEGER DEFAULT 0,
 "dueDate" TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0,
 "createdAt" TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS clients (
 id SERIAL PRIMARY KEY,
 name TEXT NOT NULL,
 contact TEXT DEFAULT '',
 email TEXT DEFAULT '',
 address TEXT DEFAULT '',
 balance REAL DEFAULT 0,
 "dueDate" TEXT DEFAULT '',
 status TEXT DEFAULT 'Active',
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS sales (
 id SERIAL PRIMARY KEY,
 "transactionId" TEXT,
 "productId" INTEGER REFERENCES products(id) ON DELETE SET NULL,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 client TEXT DEFAULT '',
 quantity INTEGER DEFAULT 1,
 price REAL DEFAULT 0,
 total REAL DEFAULT 0,
 "saleDate" TEXT DEFAULT CURRENT_TIMESTAMP,
 "dueDate" TEXT DEFAULT '',
 paid INTEGER DEFAULT 0,
 notes TEXT DEFAULT '',
 checked INTEGER DEFAULT 0
);
CREATE TABLE IF NOT EXISTS purchases (
 id SERIAL PRIMARY KEY,
 "productId" INTEGER REFERENCES products(id) ON DELETE SET NULL,
 product TEXT NOT NULL,
 flavor TEXT DEFAULT '',
 quantity INTEGER NOT NULL,
 "purchaseDate" TEXT DEFAULT CURRENT_TIMESTAMP,
 notes TEXT DEFAULT ''
);
CREATE TABLE IF NOT EXISTS settings (
 key TEXT PRIMARY KEY,
 value TEXT
);
`;

function postgresStatement(sql, params) {
  const values = [];
  const named = new Map();
  const text = sql.replace(/@([A-Za-z_]\w*)|\?/g, (match, name) => {
    if (name) {
      if (named.has(name)) return named.get(name);
      values.push(params?.[name]);
      const placeholder = `$${values.length}`;
      named.set(name, placeholder);
      return placeholder;
    }
    values.push(params.shift());
    return `$${values.length}`;
  }).replace(/MAX\(([^,()]+),\s*0\)/g, "GREATEST($1, 0)");
  return { text, values };
}

function sqliteParams(params) {
  if (params === undefined) return [];
  return Array.isArray(params) ? params : [params];
}

async function get(sql, params, connection = pool) {
  if (!usePostgres) {
    const statement = db.prepare(sql);
    return params === undefined ? statement.get() : statement.get(...sqliteParams(params));
  }
  const result = await connection.query(postgresStatement(sql, Array.isArray(params) ? [...params] : params));
  return result.rows[0];
}

async function all(sql, params, connection = pool) {
  if (!usePostgres) {
    const statement = db.prepare(sql);
    return params === undefined ? statement.all() : statement.all(...sqliteParams(params));
  }
  const result = await connection.query(postgresStatement(sql, Array.isArray(params) ? [...params] : params));
  return result.rows;
}

async function run(sql, params, connection = pool) {
  if (!usePostgres) {
    const statement = db.prepare(sql);
    return params === undefined ? statement.run() : statement.run(...sqliteParams(params));
  }
  const insert = /^\s*INSERT\b/i.test(sql) && !/\bRETURNING\b/i.test(sql);
  const query = insert ? `${sql.trim().replace(/;$/, "")} RETURNING id` : sql;
  const result = await connection.query(postgresStatement(query, Array.isArray(params) ? [...params] : params));
  return { lastInsertRowid: result.rows[0]?.id, changes: result.rowCount };
}

async function inTransaction(callback) {
  if (!usePostgres) {
    db.exec("BEGIN");
    try {
      const result = await callback(db);
      db.exec("COMMIT");
      return result;
    } catch (error) {
      db.exec("ROLLBACK");
      throw error;
    }
  }

  const connection = await pool.connect();
  try {
    await connection.query("BEGIN");
    const result = await callback(connection);
    await connection.query("COMMIT");
    return result;
  } catch (error) {
    await connection.query("ROLLBACK");
    throw error;
  } finally {
    connection.release();
  }
}

async function migrateSqliteToPostgres() {
  if (!usePostgres || process.env.MIGRATE_SQLITE_TO_POSTGRES !== "true") return;
  if (await get("SELECT key FROM settings WHERE key='sqlite_to_postgres_migrated'")) return;
  const sourcePath = process.env.SQLITE_MIGRATION_PATH || DB_PATH;
  const SQLiteDatabase = (await import("better-sqlite3")).default;
  const source = new SQLiteDatabase(sourcePath, { readonly: true, fileMustExist: true });
  const tables = ["users", "products", "clients", "sales", "purchases", "settings"];

  try {
    for (const table of tables) {
      const rows = source.prepare(`SELECT * FROM ${table}`).all();
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(",");
        const conflict = table === "settings" ? "key" : "id";
        await pool.query(
          `INSERT INTO ${table} (${columns.map(column => `"${column}"`).join(",")}) VALUES (${placeholders}) ON CONFLICT ("${conflict}") DO NOTHING`,
          columns.map(column => row[column])
        );
      }
      if (table !== "settings") {
        await pool.query(
          `SELECT setval(pg_get_serial_sequence('${table}', 'id'), COALESCE((SELECT MAX(id) FROM ${table}), 1), EXISTS (SELECT 1 FROM ${table}))`
        );
      }
    }
    await pool.query("INSERT INTO settings (key,value) VALUES ('sqlite_to_postgres_migrated',CURRENT_TIMESTAMP) ON CONFLICT (key) DO NOTHING");
  } finally {
    source.close();
  }
}

async function initializeDatabase() {
  if (usePostgres) {
    await pool.query(postgresSchema);
    await pool.query("ALTER TABLE products ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 0");
    await pool.query('ALTER TABLE sales ADD COLUMN IF NOT EXISTS "transactionId" TEXT');
    await migrateSqliteToPostgres();
  } else {
    db.pragma("foreign_keys = ON");
    db.exec(sqliteSchema);
    const productColumns = db.prepare("PRAGMA table_info(products)").all();
    if (!productColumns.some(column => column.name === "quantity")) {
      db.exec("ALTER TABLE products ADD COLUMN quantity INTEGER DEFAULT 0");
    }
    const saleColumns = db.prepare("PRAGMA table_info(sales)").all();
    if (!saleColumns.some(column => column.name === "transactionId")) {
      db.exec('ALTER TABLE sales ADD COLUMN "transactionId" TEXT');
    }
  }

  if (!await get("SELECT id FROM users LIMIT 1")) {
    await run("INSERT INTO users (username,password) VALUES (?,?)", [ADMIN_USERNAME, ADMIN_PASSWORD]);
  }
}

const auth = (req, res, next) => {
  const token = (req.headers.authorization || "").replace("Bearer ", "");
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

app.post("/api/change-password", auth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (typeof newPassword !== "string" || newPassword.length < 8) return res.status(400).json({ error: "New password must be at least 8 characters" });
  const user = await get("SELECT id,password FROM users WHERE id=?", [req.user.id]);
  if (!user || user.password !== currentPassword) return res.status(401).json({ error: "Current password is incorrect" });
  if (newPassword === currentPassword) return res.status(400).json({ error: "Choose a different password" });
  await run("UPDATE users SET password=? WHERE id=?", [newPassword, user.id]);
  res.json({ ok: true });
});

app.post("/api/login", async (req, res) => {
  const { username, password } = req.body;
  const user = await get("SELECT * FROM users WHERE username=? AND password=?", [username, password]);
  if (!user) return res.status(401).json({ error: "Invalid username or password" });
  res.json({ token: jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, { expiresIn: "8h" }), user: { username: user.username } });
});

app.get("/api/me", auth, (req, res) => res.json({ username: req.user.username }));

const tables = ["products", "clients", "sales", "purchases"];
const exportColumns = {
  products: ["id", "product", "flavor", "client", "price", "quantity", "stock", "sold", "dueDate", "status", "notes", "checked", "createdAt"],
  clients: ["id", "name", "contact", "email", "address", "balance", "dueDate", "status", "notes", "checked"],
  sales: ["id", "transactionId", "productId", "product", "flavor", "client", "quantity", "price", "total", "saleDate", "dueDate", "paid", "notes", "checked"],
  purchases: ["id", "productId", "product", "flavor", "quantity", "purchaseDate", "notes"]
};

for (const table of tables) {
  app.get(`/api/${table}`, auth, async (req, res) => {
    res.json(await all(`SELECT * FROM ${table} ORDER BY id DESC`));
  });
}

app.post("/api/products", auth, async (req, res) => {
  const p = { product: "", flavor: "", client: "", price: 0, quantity: 0, stock: 0, sold: 0, dueDate: "", status: "Active", notes: "", checked: 0, ...req.body };
  const result = await run(`INSERT INTO products (product,flavor,client,price,quantity,stock,sold,"dueDate",status,notes,checked)
    VALUES (@product,@flavor,@client,@price,@quantity,@stock,@sold,@dueDate,@status,@notes,@checked)`, p);
  res.json(await get("SELECT * FROM products WHERE id=?", [result.lastInsertRowid]));
});
app.put("/api/products/:id", auth, async (req, res) => {
  const p = { id: req.params.id, product: "", flavor: "", client: "", price: 0, quantity: 0, stock: 0, sold: 0, dueDate: "", status: "Active", notes: "", checked: 0, ...req.body };
  await run(`UPDATE products SET product=@product,flavor=@flavor,client=@client,price=@price,quantity=@quantity,stock=@stock,sold=@sold,
    "dueDate"=@dueDate,status=@status,notes=@notes,checked=@checked WHERE id=@id`, p);
  res.json(await get("SELECT * FROM products WHERE id=?", [p.id]));
});
app.delete("/api/products/:id", auth, async (req, res) => {
  await run("DELETE FROM products WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/clients", auth, async (req, res) => {
  const p = { name: "", contact: "", email: "", address: "", balance: 0, dueDate: "", status: "Active", notes: "", checked: 0, ...req.body };
  const result = await run(`INSERT INTO clients (name,contact,email,address,balance,"dueDate",status,notes,checked)
    VALUES (@name,@contact,@email,@address,@balance,@dueDate,@status,@notes,@checked)`, p);
  res.json(await get("SELECT * FROM clients WHERE id=?", [result.lastInsertRowid]));
});
app.put("/api/clients/:id", auth, async (req, res) => {
  const p = { id: req.params.id, name: "", contact: "", email: "", address: "", balance: 0, dueDate: "", status: "Active", notes: "", checked: 0, ...req.body };
  await run(`UPDATE clients SET name=@name,contact=@contact,email=@email,address=@address,balance=@balance,
    "dueDate"=@dueDate,status=@status,notes=@notes,checked=@checked WHERE id=@id`, p);
  res.json(await get("SELECT * FROM clients WHERE id=?", [p.id]));
});
app.delete("/api/clients/:id", auth, async (req, res) => {
  await run("DELETE FROM clients WHERE id=?", [req.params.id]);
  res.json({ ok: true });
});

app.post("/api/sales", auth, async (req, res) => {
  if (!req.body || typeof req.body !== "object" || Array.isArray(req.body)) {
    return res.status(400).json({ error: "Sale details must be an object" });
  }
  const items = Array.isArray(req.body.items) ? req.body.items : [req.body];
  if (!items.length) return res.status(400).json({ error: "Add at least one product to this sale" });
  if (items.some(item => !item || typeof item !== "object" || Array.isArray(item))) {
    return res.status(400).json({ error: "Each sale item must be an object" });
  }
  const sale = {
    client: "",
    saleDate: new Date().toISOString().slice(0, 10),
    dueDate: "",
    paid: 0,
    notes: "",
    checked: 0,
    ...req.body
  };
  const lines = [];
  const quantities = new Map();
  for (const item of items) {
    const quantity = Number(item.quantity);
    if (!Number.isSafeInteger(quantity) || quantity <= 0) {
      return res.status(400).json({ error: "Each sale quantity must be a positive whole number" });
    }
    const requestedProduct = String(item.productId || "");
    const product = (item.productId && await get("SELECT * FROM products WHERE id=?", [item.productId])) ||
      await get("SELECT * FROM products WHERE product=? AND flavor=? ORDER BY id LIMIT 1", [item.product || requestedProduct, item.flavor || ""]);
    if (!product) return res.status(400).json({ error: "Select a valid product for every sale item" });
    const price = Number(item.price === undefined ? product.price : item.price);
    if (!Number.isFinite(price) || price < 0) return res.status(400).json({ error: "Each unit price must be a non-negative number" });
    if (!Number.isFinite(quantity * price)) return res.status(400).json({ error: "Sale line total is too large" });
    const combinedQuantity = (quantities.get(product.id) || 0) + quantity;
    if (!Number.isSafeInteger(combinedQuantity)) return res.status(400).json({ error: "Combined product quantity is too large" });
    quantities.set(product.id, combinedQuantity);
    lines.push({ product, quantity, price });
  }

  const transactionId = randomUUID();
  try {
    const ids = await inTransaction(async connection => {
      for (const [productId, quantity] of quantities) {
        const result = await run(
          "UPDATE products SET stock=stock-@q,sold=sold+@q WHERE id=@id AND stock>=@q",
          { q: quantity, id: productId },
          connection
        );
        if (result.changes !== 1) throw new Error("INSUFFICIENT_STOCK");
      }

      const saleIds = [];
      for (const { product, quantity, price } of lines) {
        const result = await run(`INSERT INTO sales ("transactionId","productId",product,flavor,client,quantity,price,total,"saleDate","dueDate",paid,notes,checked)
          VALUES (@transactionId,@productId,@product,@flavor,@client,@quantity,@price,@total,@saleDate,@dueDate,@paid,@notes,@checked)`,
        {
          transactionId,
          productId: product.id,
          product: product.product,
          flavor: product.flavor,
          client: sale.client,
          quantity,
          price,
          total: quantity * price,
          saleDate: sale.saleDate,
          dueDate: sale.dueDate,
          paid: sale.paid,
          notes: sale.notes,
          checked: sale.checked
        }, connection);
        saleIds.push(result.lastInsertRowid);
      }
      return saleIds;
    });
    const savedSales = [];
    for (const id of ids) savedSales.push(await get("SELECT * FROM sales WHERE id=?", [id]));
    res.json({ transactionId, sales: savedSales });
  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") return res.status(409).json({ error: "Insufficient stock for this sale" });
    throw error;
  }
});
app.put("/api/sales/:id", auth, async (req, res) => {
  const old = await get("SELECT * FROM sales WHERE id=?", [req.params.id]);
  if (!old) return res.status(404).json({ error: "Sale not found" });
  const s = { ...old, ...req.body, id: req.params.id };
  const quantity = Number(s.quantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ error: "Sale quantity must be a positive whole number" });
  const requestedProduct = String(s.productId || "");
  const product = (s.productId && await get("SELECT * FROM products WHERE id=?", [s.productId])) || await get("SELECT * FROM products WHERE product=? AND flavor=? ORDER BY id LIMIT 1", [s.product || requestedProduct, s.flavor || ""]);
  if (!product) return res.status(400).json({ error: "Select a valid product for this sale" });
  s.productId = product.id;
  s.product = product.product;
  s.flavor = product.flavor;
  s.total = Number(s.quantity) * Number(s.price);
  try {
    await inTransaction(async connection => {
      if (old.productId) await run("UPDATE products SET stock=stock+@q,sold=MAX(sold-@q,0) WHERE id=@id", { q: Number(old.quantity), id: old.productId }, connection);
      const current = await get("SELECT stock FROM products WHERE id=?", [s.productId], connection);
      if (!current || Number(current.stock) < quantity) throw new Error("INSUFFICIENT_STOCK");
      await run(`UPDATE sales SET "productId"=@productId,product=@product,flavor=@flavor,client=@client,quantity=@quantity,
        price=@price,total=@total,"saleDate"=@saleDate,"dueDate"=@dueDate,paid=@paid,notes=@notes,checked=@checked WHERE id=@id`, s, connection);
      await run("UPDATE products SET stock=stock-@q,sold=sold+@q WHERE id=@id", { q: quantity, id: s.productId }, connection);
    });
    res.json(await get("SELECT * FROM sales WHERE id=?", [req.params.id]));
  } catch (error) {
    if (error.message === "INSUFFICIENT_STOCK") return res.status(409).json({ error: "Insufficient stock for this sale" });
    throw error;
  }
});
app.delete("/api/sales/:id", auth, async (req, res) => {
  await inTransaction(async connection => {
    const sale = await get("SELECT * FROM sales WHERE id=?", [req.params.id], connection);
    if (sale?.productId) await run("UPDATE products SET stock=stock+?,sold=MAX(sold-?,0) WHERE id=?", [sale.quantity, sale.quantity, sale.productId], connection);
    await run("DELETE FROM sales WHERE id=?", [req.params.id], connection);
  });
  res.json({ ok: true });
});

app.post("/api/purchases", auth, async (req, res) => {
  const p = { productId: null, quantity: 0, purchaseDate: new Date().toISOString().slice(0, 10), notes: "", ...req.body };
  const quantity = Number(p.quantity);
  if (!Number.isSafeInteger(quantity) || quantity <= 0) return res.status(400).json({ error: "Purchase quantity must be a positive whole number" });
  const product = await get("SELECT * FROM products WHERE id=?", [p.productId]);
  if (!product) return res.status(400).json({ error: "Select a valid product for this purchase" });
  const id = await inTransaction(async connection => {
    const result = await run(`INSERT INTO purchases ("productId",product,flavor,quantity,"purchaseDate",notes)
      VALUES (@productId,@product,@flavor,@quantity,@purchaseDate,@notes)`,
    { ...p, product: product.product, flavor: product.flavor, quantity }, connection);
    await run("UPDATE products SET stock=stock+@quantity WHERE id=@id", { quantity, id: product.id }, connection);
    return result.lastInsertRowid;
  });
  res.json(await get("SELECT * FROM purchases WHERE id=?", [id]));
});

app.get("/api/dashboard", auth, async (req, res) => {
  const [products, sales, clients] = await Promise.all([
    all("SELECT * FROM products"),
    all("SELECT * FROM sales"),
    all("SELECT * FROM clients")
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const transactionKey = sale => sale.transactionId || `legacy-${sale.id}`;
  res.json({
    products: products.length,
    clients: clients.length,
    sales: new Set(sales.map(transactionKey)).size,
    stock: products.reduce((total, product) => total + Number(product.stock || 0), 0),
    revenue: sales.reduce((total, sale) => total + Number(sale.total || 0), 0),
    unpaid: sales.filter(sale => !sale.paid).reduce((total, sale) => total + Number(sale.total || 0), 0),
    lowStock: products.filter(product => Number(product.stock) <= 10).length,
    dueSoon: new Set(sales.filter(sale => sale.dueDate && sale.dueDate <= today && !sale.paid).map(transactionKey)).size
  });
});

app.get("/api/export/:table", auth, async (req, res) => {
  const table = req.params.table;
  if (!tables.includes(table)) return res.status(400).end();
  const rows = await all(`SELECT * FROM ${table}`);
  const columns = exportColumns[table];
  const escapeCsv = value => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const csv = [columns.map(escapeCsv).join(","), ...rows.map(row => columns.map(column => escapeCsv(row[column])).join(","))].join("\n");
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename=${table}.csv`);
  res.send(csv);
});

app.get("/api/health", (req, res) => res.json({ ok: true, name: "PODS TRACKER" }));

const clientDist = path.join(__dirname, "../client/dist");
app.use(express.static(clientDist));
app.use((req, res) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "Not found" });
  res.sendFile(path.join(clientDist, "index.html"));
});

initializeDatabase()
  .then(() => app.listen(PORT, () => console.log(`PODS TRACKER server running on http://localhost:${PORT}`)))
  .catch(error => {
    console.error("Database initialization failed:", error);
    process.exit(1);
  });
