const express = require("express");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const Database = require("better-sqlite3");

const app = express();
const PORT = Number(process.env.PORT || 8080);
const JWT_SECRET = process.env.JWT_SECRET || "CHANGE_THIS_IN_PRODUCTION";
const DB_FILE = process.env.DB_FILE || "shivam.sqlite";
const corsOrigin = process.env.CORS_ORIGIN || "*";

if (process.env.NODE_ENV === "production" && JWT_SECRET === "CHANGE_THIS_IN_PRODUCTION") {
  console.warn("WARNING: Set a strong JWT_SECRET before production use.");
}

app.use(cors({ origin: corsOrigin === "*" ? true : corsOrigin.split(",").map(s => s.trim()) }));
app.use(express.json({ limit: "5mb" }));

const db = new Database(DB_FILE);
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS users(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL,
 username TEXT UNIQUE NOT NULL,
 password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'Staff',
 active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS customers(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 name TEXT NOT NULL, phone TEXT, email TEXT, address TEXT, notes TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS vehicles(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 reg TEXT NOT NULL UNIQUE, model TEXT, type TEXT, driver TEXT, notes TEXT,
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 customer_id INTEGER, vehicle_id INTEGER, date TEXT, time TEXT,
 pickup TEXT, drop_location TEXT, driver TEXT, total REAL DEFAULT 0,
 advance REAL DEFAULT 0, due REAL DEFAULT 0, status TEXT DEFAULT 'Booked',
 created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS invoices(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 invoice_no TEXT UNIQUE NOT NULL, customer_id INTEGER, booking_id INTEGER,
 date TEXT, description TEXT, taxable REAL DEFAULT 0,
 cgst REAL DEFAULT 0, sgst REAL DEFAULT 0, igst REAL DEFAULT 0,
 total REAL DEFAULT 0, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS payments(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 invoice_id INTEGER, customer_id INTEGER, date TEXT,
 amount REAL NOT NULL, mode TEXT, note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS expenses(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 vehicle_id INTEGER, date TEXT, category TEXT, amount REAL NOT NULL,
 note TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS sync_events(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 user_id INTEGER, action TEXT, payload TEXT, created_at TEXT NOT NULL
);
`);

function now(){ return new Date().toISOString(); }
function auth(req,res,next){
  const h=req.headers.authorization||"";
  if(!h.startsWith("Bearer ")) return res.status(401).json({error:"Authentication required"});
  try { req.user=jwt.verify(h.slice(7),JWT_SECRET); next(); }
  catch(e){ return res.status(401).json({error:"Invalid or expired token"}); }
}
function role(...roles){ return (req,res,next)=>roles.includes(req.user.role)?next():res.status(403).json({error:"Insufficient permission"}); }
function safeUser(u){ return {id:u.id,name:u.name,username:u.username,role:u.role,active:!!u.active}; }

const count=db.prepare("SELECT COUNT(*) c FROM users").get().c;
if(!count){
  const hash=bcrypt.hashSync(process.env.ADMIN_PASSWORD||"ChangeMe123!",10);
  db.prepare("INSERT INTO users(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)")
    .run("Administrator","admin",hash,"Owner",now());
  console.log("Created default admin user. Change ADMIN_PASSWORD before production use.");
}

app.get("/",(req,res)=>res.json({service:"SHIVAM TOUR & TRAVELS API",status:"online",health:"/api/health"}));
app.get("/api/health",(req,res)=>res.json({ok:true,service:"Shivam Travel API",time:now()}));

app.post("/api/auth/login",(req,res)=>{
  const {username,password}=req.body||{};
  const u=db.prepare("SELECT * FROM users WHERE username=? AND active=1").get(username||"");
  if(!u||!bcrypt.compareSync(password||"",u.password_hash)) return res.status(401).json({error:"Invalid username or password"});
  const token=jwt.sign({id:u.id,name:u.name,username:u.username,role:u.role},JWT_SECRET,{expiresIn:"12h"});
  res.json({token,user:safeUser(u)});
});
app.get("/api/me",auth,(req,res)=>res.json({user:req.user}));

app.get("/api/users",auth,role("Owner","Manager"),(req,res)=>{
  res.json(db.prepare("SELECT id,name,username,role,active,created_at FROM users ORDER BY id DESC").all().map(safeUser));
});
app.post("/api/users",auth,role("Owner"),(req,res)=>{
  const {name,username,password,role:rl="Staff"}=req.body||{};
  if(!name||!username||!password)return res.status(400).json({error:"name, username and password required"});
  try{
    const hash=bcrypt.hashSync(password,10);
    const info=db.prepare("INSERT INTO users(name,username,password_hash,role,active,created_at) VALUES(?,?,?,?,1,?)")
      .run(name,username,hash,rl,now());
    res.json({id:info.lastInsertRowid});
  }catch(e){res.status(400).json({error:"Username already exists"});}
});

const resources={
 customers:["customers",["name","phone","email","address","notes"]],
 vehicles:["vehicles",["reg","model","type","driver","notes"]],
 bookings:["bookings",["customer_id","vehicle_id","date","time","pickup","drop_location","driver","total","advance","due","status"]],
 invoices:["invoices",["invoice_no","customer_id","booking_id","date","description","taxable","cgst","sgst","igst","total"]],
 payments:["payments",["invoice_id","customer_id","date","amount","mode","note"]],
 expenses:["expenses",["vehicle_id","date","category","amount","note"]]
};

for(const [route,[table,fields]] of Object.entries(resources)){
  app.get("/api/"+route,auth,(req,res)=>{
    res.json(db.prepare(`SELECT * FROM ${table} ORDER BY id DESC`).all());
  });
  app.post("/api/"+route,auth,(req,res)=>{
    const b=req.body||{};
    const vals=fields.map(f=>b[f]??null);
    const t=now();
    try{
      const marks=fields.map(()=>"?").join(",");
      const cols=fields.join(",");
      const extra = ["customers","vehicles","bookings","invoices","payments","expenses"].includes(table)
        ? ",updated_at" : "";
      const values = extra ? [...vals,t,t] : [...vals,t];
      const sql=`INSERT INTO ${table}(${cols},created_at${extra}) VALUES(${marks},?${extra?",?":""})`;
      const info=db.prepare(sql).run(...values);
      res.json({id:info.lastInsertRowid});
    }catch(e){res.status(400).json({error:e.message});}
  });
}

app.post("/api/sync",auth,(req,res)=>{
  const incoming=req.body||{};
  const events=Array.isArray(incoming.queue)?incoming.queue:[];
  const tx=db.transaction(()=>{
    for(const ev of events){
      db.prepare("INSERT INTO sync_events(user_id,action,payload,created_at) VALUES(?,?,?,?)")
        .run(req.user.id,ev.action||"sync",JSON.stringify(ev.payload||{}),now());
    }
  });
  tx();
  res.json({ok:true,accepted:events.length,serverTime:now()});
});

app.get("/api/dashboard",auth,(req,res)=>{
  const sales=db.prepare("SELECT COALESCE(SUM(total),0) n FROM invoices").get().n;
  const paid=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM payments").get().n;
  const expense=db.prepare("SELECT COALESCE(SUM(amount),0) n FROM expenses").get().n;
  res.json({sales,paid,outstanding:Math.max(0,sales-paid),expense,profit:sales-expense});
});

const server=app.listen(PORT,()=>console.log(`Shivam Travel API running on :${PORT}`));
function shutdown(signal){
  console.log(`${signal} received; shutting down...`);
  server.close(()=>{ db.close(); process.exit(0); });
  setTimeout(()=>process.exit(1),10000).unref();
}
process.on("SIGTERM",()=>shutdown("SIGTERM"));
process.on("SIGINT",()=>shutdown("SIGINT"));
