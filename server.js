const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-render";
const dbEnabled = Boolean(DATABASE_URL);

const pool = dbEnabled ? new Pool({
  connectionString: DATABASE_URL,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized:false } : false
}) : null;

app.use(express.json({limit:"1mb"}));
app.use(express.urlencoded({extended:true}));
app.use(session({
  store: dbEnabled ? new pgSession({pool,tableName:"user_sessions",createTableIfMissing:true}) : undefined,
  secret: SESSION_SECRET,
  resave:false,
  saveUninitialized:false,
  cookie:{
    secure:process.env.NODE_ENV==="production",
    httpOnly:true,
    sameSite:"lax",
    maxAge:1000*60*60*12
  }
}));
app.use(express.static(path.join(__dirname,"public")));

function requireDb(req,res,next){ if(!dbEnabled) return res.status(503).json({error:"Database not connected"}); next(); }
function requireOwner(req,res,next){ if(!req.session.user || req.session.user.role!=="owner") return res.status(401).json({error:"Owner login required"}); next(); }
function requireAdmin(req,res,next){ if(!req.session.user || req.session.user.role!=="admin") return res.status(401).json({error:"Admin login required"}); next(); }

async function safeAlter(sql){ try{ await pool.query(sql); }catch(e){ console.log("Migration note:",e.message); } }

async function initDb(){
  if(!dbEnabled){ console.log("DATABASE_URL not set."); return; }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      role VARCHAR(20) NOT NULL CHECK (role IN ('owner','admin')),
      full_name VARCHAR(140) NOT NULL,
      company_name VARCHAR(180),
      email VARCHAR(200) UNIQUE NOT NULL,
      phone VARCHAR(80),
      password_hash TEXT NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS boats (
      id SERIAL PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name VARCHAR(180) NOT NULL,
      boat_type VARCHAR(80),
      marina VARCHAR(120),
      capacity INTEGER,
      cabins INTEGER,
      half_day_price NUMERIC(10,2),
      full_day_price NUMERIC(10,2),
      image_url TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS charter_opportunities (
      id SERIAL PRIMARY KEY,
      public_ref VARCHAR(40) UNIQUE NOT NULL,
      title VARCHAR(220) NOT NULL,
      charter_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      guests INTEGER,
      departure_area VARCHAR(120),
      preferred_boat_type VARCHAR(120),
      budget_min NUMERIC(10,2),
      budget_max NUMERIC(10,2),
      extras TEXT,
      notes TEXT,
      status VARCHAR(30) NOT NULL DEFAULT 'open',
      bid_deadline TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS opportunity_recipients (
      id SERIAL PRIMARY KEY,
      opportunity_id INTEGER NOT NULL REFERENCES charter_opportunities(id) ON DELETE CASCADE,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(opportunity_id,owner_user_id)
    );

    CREATE TABLE IF NOT EXISTS bids (
      id SERIAL PRIMARY KEY,
      opportunity_id INTEGER NOT NULL REFERENCES charter_opportunities(id) ON DELETE CASCADE,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      boat_id INTEGER REFERENCES boats(id) ON DELETE SET NULL,
      bid_price NUMERIC(10,2) NOT NULL,
      includes TEXT,
      departure_marina VARCHAR(120),
      availability_confirmed BOOLEAN NOT NULL DEFAULT false,
      notes TEXT,
      valid_until TIMESTAMPTZ,
      status VARCHAR(30) NOT NULL DEFAULT 'submitted',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS availability_slots (
      id SERIAL PRIMARY KEY,
      boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('available','provisional','booked','unavailable')),
      private_reason TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS owner_notifications (
      id SERIAL PRIMARY KEY,
      owner_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type VARCHAR(50) NOT NULL DEFAULT 'general',
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_name VARCHAR(160)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_phone VARCHAR(100)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_email VARCHAR(200)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_language VARCHAR(50)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS accommodation VARCHAR(200)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS enquiry_source VARCHAR(100)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS internal_notes TEXT`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(120)`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS lost_notes TEXT`);
  await safeAlter(`ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS closed_at TIMESTAMPTZ`);
  await safeAlter(`ALTER TABLE bids ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(120)`);
  await safeAlter(`ALTER TABLE bids ADD COLUMN IF NOT EXISTS lost_notes TEXT`);
  await safeAlter(`ALTER TABLE bids ADD COLUMN IF NOT EXISTS decided_at TIMESTAMPTZ`);

  if(process.env.SEED_DEMO==="true"){
    const ownerEmail=process.env.DEMO_OWNER_EMAIL||"owner@sotoboats.demo";
    const ownerPassword=process.env.DEMO_OWNER_PASSWORD||"Sotoboats123!";
    const adminEmail=process.env.DEMO_ADMIN_EMAIL||"admin@sotoboats.demo";
    const adminPassword=process.env.DEMO_ADMIN_PASSWORD||"SotoboatsAdmin123!";
    const ownerHash=await bcrypt.hash(ownerPassword,10);
    const adminHash=await bcrypt.hash(adminPassword,10);

    await pool.query(`
      INSERT INTO users(role,full_name,company_name,email,phone,password_hash)
      VALUES('owner','Captain Alex','Alex Charters',$1,'+34 600 000 000',$2)
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active'
    `,[ownerEmail,ownerHash]);

    await pool.query(`
      INSERT INTO users(role,full_name,company_name,email,phone,password_hash)
      VALUES('admin','Sotoboats Admin','Sotoboats',$1,'+34 600 000 001',$2)
      ON CONFLICT(email) DO UPDATE SET password_hash=EXCLUDED.password_hash,status='active'
    `,[adminEmail,adminHash]);

    const owner=(await pool.query(`SELECT id FROM users WHERE email=$1`,[ownerEmail])).rows[0];
    if(owner){
      await pool.query(`
        INSERT INTO boats(owner_user_id,name,boat_type,marina,capacity,cabins,half_day_price,full_day_price,image_url)
        SELECT $1,'Princess V50','Motor yacht','Estepona',12,2,1450,2600,
        'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=1200'
        WHERE NOT EXISTS(SELECT 1 FROM boats WHERE owner_user_id=$1 AND name='Princess V50')
      `,[owner.id]);
    }
  }
}

app.get("/health",async(req,res)=>{
  let database="not configured";
  if(dbEnabled){ try{ await pool.query("SELECT 1"); database="connected"; }catch{ database="error"; } }
  res.json({ok:true,service:"sotoboats",database});
});

app.post("/api/login",requireDb,async(req,res)=>{
  const {email,password}=req.body;
  const result=await pool.query(`
    SELECT id,role,full_name,company_name,email,password_hash,status
    FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1
  `,[email]);
  const user=result.rows[0];
  if(!user || user.status!=="active" || !(await bcrypt.compare(password,user.password_hash))){
    return res.status(401).json({error:"Invalid login"});
  }
  req.session.user={id:user.id,role:user.role,fullName:user.full_name,companyName:user.company_name,email:user.email};
  res.json({ok:true,user:req.session.user});
});
app.post("/api/logout",(req,res)=>req.session.destroy(()=>res.json({ok:true})));
app.get("/api/me",(req,res)=>res.json({user:req.session.user||null,databaseConnected:dbEnabled}));

// OWNER
app.get("/api/owner/dashboard",requireDb,requireOwner,async(req,res)=>{
  const ownerId=req.session.user.id;
  const [boats,opps,bids,notifications,kpis]=await Promise.all([
    pool.query(`SELECT * FROM boats WHERE owner_user_id=$1 ORDER BY name`,[ownerId]),
    pool.query(`
      SELECT o.* FROM charter_opportunities o
      JOIN opportunity_recipients r ON r.opportunity_id=o.id
      WHERE r.owner_user_id=$1 AND o.status='open'
      ORDER BY o.charter_date ASC
    `,[ownerId]),
    pool.query(`
      SELECT b.*,o.public_ref,o.title,o.charter_date,bt.name boat_name
      FROM bids b JOIN charter_opportunities o ON o.id=b.opportunity_id
      LEFT JOIN boats bt ON bt.id=b.boat_id
      WHERE b.owner_user_id=$1 ORDER BY b.created_at DESC
    `,[ownerId]),
    pool.query(`
      SELECT * FROM owner_notifications WHERE owner_user_id=$1
      ORDER BY created_at DESC LIMIT 20
    `,[ownerId]),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM opportunity_recipients WHERE owner_user_id=$1) AS opportunities_received,
        (SELECT COUNT(*) FROM bids WHERE owner_user_id=$1) AS bids_submitted,
        (SELECT COUNT(*) FROM bids WHERE owner_user_id=$1 AND status='won') AS bids_won,
        (SELECT COALESCE(SUM(bid_price),0) FROM bids WHERE owner_user_id=$1 AND status='won') AS confirmed_value,
        (SELECT COUNT(*) FROM availability_slots s JOIN boats b ON b.id=s.boat_id
          WHERE b.owner_user_id=$1 AND s.status='available' AND s.starts_at >= NOW()
          AND s.starts_at < NOW()+INTERVAL '30 days') AS available_slots_30d
    `,[ownerId])
  ]);
  res.json({user:req.session.user,boats:boats.rows,opportunities:opps.rows,bids:bids.rows,notifications:notifications.rows,kpis:kpis.rows[0]});
});

app.post("/api/owner/boats",requireDb,requireOwner,async(req,res)=>{
  const {name,boatType,marina,capacity,cabins,halfDayPrice,fullDayPrice,imageUrl}=req.body;
  if(!name) return res.status(400).json({error:"Boat name is required"});
  const r=await pool.query(`
    INSERT INTO boats(owner_user_id,name,boat_type,marina,capacity,cabins,half_day_price,full_day_price,image_url)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `,[req.session.user.id,name,boatType||null,marina||null,capacity||null,cabins||null,halfDayPrice||null,fullDayPrice||null,imageUrl||null]);
  res.json({boat:r.rows[0]});
});

app.get("/api/owner/calendar",requireDb,requireOwner,async(req,res)=>{
  const {from,to,boatId}=req.query;
  const params=[req.session.user.id];
  let where=`b.owner_user_id=$1`;
  if(from){ params.push(from); where+=` AND s.ends_at >= $${params.length}`; }
  if(to){ params.push(to); where+=` AND s.starts_at <= $${params.length}`; }
  if(boatId){ params.push(Number(boatId)); where+=` AND b.id=$${params.length}`; }
  const r=await pool.query(`
    SELECT s.*,b.name boat_name,b.marina
    FROM availability_slots s JOIN boats b ON b.id=s.boat_id
    WHERE ${where} ORDER BY s.starts_at ASC
  `,params);
  res.json({slots:r.rows});
});

app.post("/api/owner/calendar-slots",requireDb,requireOwner,async(req,res)=>{
  const {boatId,startsAt,endsAt,status,privateReason}=req.body;
  const valid=["available","provisional","booked","unavailable"];
  if(!valid.includes(status)) return res.status(400).json({error:"Invalid calendar status"});
  const boat=(await pool.query(`SELECT id FROM boats WHERE id=$1 AND owner_user_id=$2`,[boatId,req.session.user.id])).rows[0];
  if(!boat) return res.status(403).json({error:"Boat not found"});
  if(!startsAt || !endsAt || new Date(endsAt)<=new Date(startsAt)) return res.status(400).json({error:"Please choose a valid start and end time"});
  const r=await pool.query(`
    INSERT INTO availability_slots(boat_id,starts_at,ends_at,status,private_reason)
    VALUES($1,$2,$3,$4,$5) RETURNING *
  `,[boatId,startsAt,endsAt,status,privateReason||null]);
  res.json({slot:r.rows[0]});
});

app.delete("/api/owner/calendar-slots/:id",requireDb,requireOwner,async(req,res)=>{
  await pool.query(`
    DELETE FROM availability_slots s USING boats b
    WHERE s.id=$1 AND s.boat_id=b.id AND b.owner_user_id=$2
  `,[req.params.id,req.session.user.id]);
  res.json({ok:true});
});

app.patch("/api/owner/notifications/:id/read",requireDb,requireOwner,async(req,res)=>{
  await pool.query(`UPDATE owner_notifications SET is_read=true WHERE id=$1 AND owner_user_id=$2`,[req.params.id,req.session.user.id]);
  res.json({ok:true});
});

app.post("/api/owner/bids",requireDb,requireOwner,async(req,res)=>{
  const {opportunityId,boatId,bidPrice,includes,departureMarina,availabilityConfirmed,notes,validUntil}=req.body;
  const recipient=(await pool.query(`
    SELECT id FROM opportunity_recipients WHERE opportunity_id=$1 AND owner_user_id=$2
  `,[opportunityId,req.session.user.id])).rows[0];
  if(!recipient) return res.status(403).json({error:"Opportunity not assigned to this owner"});
  const r=await pool.query(`
    INSERT INTO bids(opportunity_id,owner_user_id,boat_id,bid_price,includes,departure_marina,availability_confirmed,notes,valid_until)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *
  `,[opportunityId,req.session.user.id,boatId||null,bidPrice,includes||null,departureMarina||null,Boolean(availabilityConfirmed),notes||null,validUntil||null]);
  res.json({bid:r.rows[0]});
});

// ADMIN
app.get("/api/admin/dashboard",requireDb,requireAdmin,async(req,res)=>{
  const [owners,boats,opps,bids,slots,kpis,lostBids]=await Promise.all([
    pool.query(`SELECT id,full_name,company_name,email,phone,status,created_at FROM users WHERE role='owner' ORDER BY created_at DESC`),
    pool.query(`SELECT b.*,u.full_name owner_name,u.company_name FROM boats b JOIN users u ON u.id=b.owner_user_id ORDER BY b.name`),
    pool.query(`SELECT * FROM charter_opportunities ORDER BY created_at DESC`),
    pool.query(`
      SELECT b.*,o.public_ref,o.title,u.full_name owner_name,bt.name boat_name
      FROM bids b JOIN charter_opportunities o ON o.id=b.opportunity_id
      JOIN users u ON u.id=b.owner_user_id
      LEFT JOIN boats bt ON bt.id=b.boat_id
      ORDER BY b.created_at DESC
    `),
    pool.query(`
      SELECT s.*,b.name boat_name,u.full_name owner_name
      FROM availability_slots s JOIN boats b ON b.id=s.boat_id
      JOIN users u ON u.id=b.owner_user_id
      WHERE s.ends_at >= NOW()-INTERVAL '1 day'
      ORDER BY s.starts_at ASC LIMIT 500
    `),
    pool.query(`
      SELECT
        (SELECT COUNT(*) FROM charter_opportunities WHERE created_at>=date_trunc('month',NOW())) AS enquiries_month,
        (SELECT COUNT(*) FROM charter_opportunities WHERE status='open') AS open_requests,
        (SELECT COUNT(*) FROM bids WHERE created_at>=date_trunc('month',NOW())) AS bids_month,
        (SELECT COUNT(*) FROM bids WHERE status='won' AND decided_at>=date_trunc('month',NOW())) AS wins_month,
        (SELECT COALESCE(SUM(bid_price),0) FROM bids WHERE status='won' AND decided_at>=date_trunc('month',NOW())) AS booking_value_month,
        (SELECT COUNT(*) FROM users WHERE role='owner' AND status='active') AS active_owners,
        (SELECT COUNT(*) FROM boats WHERE status='active') AS active_boats,
        (SELECT COUNT(*) FROM charter_opportunities o WHERE o.status='open' AND NOT EXISTS(SELECT 1 FROM bids b WHERE b.opportunity_id=o.id)) AS requests_no_bids
    `),
    pool.query(`
      SELECT b.*,o.public_ref,o.title,u.full_name owner_name,bt.name boat_name
      FROM bids b JOIN charter_opportunities o ON o.id=b.opportunity_id
      JOIN users u ON u.id=b.owner_user_id
      LEFT JOIN boats bt ON bt.id=b.boat_id
      WHERE b.status='lost' ORDER BY b.decided_at DESC NULLS LAST,b.created_at DESC
    `)
  ]);
  res.json({
    owners:owners.rows,boats:boats.rows,opportunities:opps.rows,bids:bids.rows,
    slots:slots.rows,kpis:kpis.rows[0],lostBids:lostBids.rows
  });
});

app.post("/api/admin/opportunities",requireDb,requireAdmin,async(req,res)=>{
  const {
    title,charterDate,startTime,endTime,guests,departureArea,preferredBoatType,budgetMin,budgetMax,
    extras,notes,bidDeadline,clientName,clientPhone,clientEmail,clientLanguage,accommodation,enquirySource,internalNotes
  }=req.body;
  if(!title || !charterDate) return res.status(400).json({error:"Title and date are required"});
  const ref=`CR-${Date.now().toString().slice(-8)}`;
  const r=await pool.query(`
    INSERT INTO charter_opportunities(
      public_ref,title,charter_date,start_time,end_time,guests,departure_area,preferred_boat_type,
      budget_min,budget_max,extras,notes,bid_deadline,
      client_name,client_phone,client_email,client_language,accommodation,enquiry_source,internal_notes
    )
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
    RETURNING *
  `,[ref,title,charterDate,startTime||null,endTime||null,guests||null,departureArea||null,preferredBoatType||null,
    budgetMin||null,budgetMax||null,extras||null,notes||null,bidDeadline||null,
    clientName||null,clientPhone||null,clientEmail||null,clientLanguage||null,accommodation||null,enquirySource||null,internalNotes||null]);
  res.json({opportunity:r.rows[0]});
});

app.patch("/api/admin/opportunities/:id",requireDb,requireAdmin,async(req,res)=>{
  const {status,lostReason,lostNotes}=req.body;
  const allowed=["open","confirmed","lost","cancelled"];
  if(status && !allowed.includes(status)) return res.status(400).json({error:"Invalid status"});
  const r=await pool.query(`
    UPDATE charter_opportunities
    SET status=COALESCE($2,status),
        lost_reason=CASE WHEN $2='lost' THEN $3 ELSE lost_reason END,
        lost_notes=CASE WHEN $2='lost' THEN $4 ELSE lost_notes END,
        closed_at=CASE WHEN $2 IN ('confirmed','lost','cancelled') THEN NOW() ELSE closed_at END
    WHERE id=$1 RETURNING *
  `,[req.params.id,status||null,lostReason||null,lostNotes||null]);
  res.json({opportunity:r.rows[0]});
});

app.post("/api/admin/opportunities/:id/broadcast",requireDb,requireAdmin,async(req,res)=>{
  const opportunityId=Number(req.params.id);
  let ids=Array.isArray(req.body.ownerIds)?req.body.ownerIds.map(Number).filter(Boolean):[];
  if(ids.length===0){
    ids=(await pool.query(`SELECT id FROM users WHERE role='owner' AND status='active'`)).rows.map(r=>r.id);
  }
  for(const ownerId of ids){
    await pool.query(`
      INSERT INTO opportunity_recipients(opportunity_id,owner_user_id)
      VALUES($1,$2) ON CONFLICT DO NOTHING
    `,[opportunityId,ownerId]);
  }
  res.json({ok:true,sentTo:ids.length});
});

app.post("/api/admin/calendar-update-request",requireDb,requireAdmin,async(req,res)=>{
  let ids=Array.isArray(req.body.ownerIds)?req.body.ownerIds.map(Number).filter(Boolean):[];
  const message=req.body.message||"Please update your Sotoboats availability calendar for the next 4 weeks.";
  if(ids.length===0){
    ids=(await pool.query(`SELECT id FROM users WHERE role='owner' AND status='active'`)).rows.map(r=>r.id);
  }
  for(const ownerId of ids){
    await pool.query(`
      INSERT INTO owner_notifications(owner_user_id,notification_type,message)
      VALUES($1,'calendar_update',$2)
    `,[ownerId,message]);
  }
  res.json({ok:true,sentTo:ids.length});
});

app.patch("/api/admin/bids/:id",requireDb,requireAdmin,async(req,res)=>{
  const {status,lostReason,lostNotes}=req.body;
  const allowed=["submitted","awaiting_review","won","lost"];
  if(!allowed.includes(status)) return res.status(400).json({error:"Invalid bid status"});
  const r=await pool.query(`
    UPDATE bids SET status=$2,lost_reason=$3,lost_notes=$4,
      decided_at=CASE WHEN $2 IN ('won','lost') THEN NOW() ELSE decided_at END
    WHERE id=$1 RETURNING *
  `,[req.params.id,status,lostReason||null,lostNotes||null]);
  res.json({bid:r.rows[0]});
});

app.get("/owner",(req,res)=>res.sendFile(path.join(__dirname,"public","portal","index.html")));
app.get("/admin",(req,res)=>res.sendFile(path.join(__dirname,"public","admin","index.html")));
app.get("*",(req,res)=>res.sendFile(path.join(__dirname,"public","index.html")));

initDb().then(()=>app.listen(PORT,()=>console.log(`Sotoboats running on port ${PORT}`)))
.catch(err=>{console.error("Database initialisation failed:",err);process.exit(1);});
