const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();
const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-render";

const dbEnabled = Boolean(DATABASE_URL);
const pool = dbEnabled
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    })
  : null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: dbEnabled
      ? new pgSession({ pool, tableName: "user_sessions", createTableIfMissing: true })
      : undefined,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireDb(req, res, next) {
  if (!dbEnabled) return res.status(503).json({ error: "Database not connected" });
  next();
}
function requireOwner(req, res, next) {
  if (!req.session.user || req.session.user.role !== "owner") {
    return res.status(401).json({ error: "Owner login required" });
  }
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || req.session.user.role !== "admin") {
    return res.status(401).json({ error: "Admin login required" });
  }
  next();
}

async function initDb() {
  if (!dbEnabled) {
    console.log("DATABASE_URL not set. Public site will still run.");
    return;
  }

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

    CREATE TABLE IF NOT EXISTS availability (
      id SERIAL PRIMARY KEY,
      boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      week_start DATE NOT NULL,
      status VARCHAR(30) NOT NULL CHECK (status IN ('confirmed','to_be_advised','unavailable')),
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (boat_id, week_start)
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
      UNIQUE (opportunity_id, owner_user_id)
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
  `);

  if (process.env.SEED_DEMO === "true") {
    const ownerEmail = process.env.DEMO_OWNER_EMAIL || "owner@sotoboats.demo";
    const ownerPassword = process.env.DEMO_OWNER_PASSWORD || "Sotoboats123!";
    const adminEmail = process.env.DEMO_ADMIN_EMAIL || "admin@sotoboats.demo";
    const adminPassword = process.env.DEMO_ADMIN_PASSWORD || "SotoboatsAdmin123!";

    const ownerHash = await bcrypt.hash(ownerPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users (role,full_name,company_name,email,phone,password_hash)
       VALUES ('owner','Captain Alex','Alex Charters',$1,'+34 600 000 000',$2)
       ON CONFLICT (email) DO NOTHING`,
      [ownerEmail, ownerHash]
    );

    await pool.query(
      `INSERT INTO users (role,full_name,company_name,email,phone,password_hash)
       VALUES ('admin','Sotoboats Admin','Sotoboats',$1,'+34 600 000 001',$2)
       ON CONFLICT (email) DO NOTHING`,
      [adminEmail, adminHash]
    );

    const owner = await pool.query(`SELECT id FROM users WHERE email=$1`, [ownerEmail]);
    if (owner.rows[0]) {
      const ownerId = owner.rows[0].id;

      await pool.query(
        `INSERT INTO boats (owner_user_id,name,boat_type,marina,capacity,cabins,half_day_price,full_day_price,image_url)
         SELECT $1,'Princess V50','Motor yacht','Estepona',12,2,1450,2600,
         'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=1200'
         WHERE NOT EXISTS (SELECT 1 FROM boats WHERE owner_user_id=$1 AND name='Princess V50')`,
        [ownerId]
      );

      await pool.query(
        `INSERT INTO charter_opportunities
          (public_ref,title,charter_date,start_time,end_time,guests,departure_area,preferred_boat_type,budget_min,budget_max,extras,notes,bid_deadline)
         SELECT 'CR-DEMO-001','Family day charter',CURRENT_DATE + 5,'10:00','18:00',8,'Estepona','Motor yacht',2500,3200,
         'Skipper + drinks package','Family group looking for a relaxed day with swim stops.',NOW() + INTERVAL '2 hours'
         WHERE NOT EXISTS (SELECT 1 FROM charter_opportunities WHERE public_ref='CR-DEMO-001')`
      );

      const opp = await pool.query(`SELECT id FROM charter_opportunities WHERE public_ref='CR-DEMO-001'`);
      if (opp.rows[0]) {
        await pool.query(
          `INSERT INTO opportunity_recipients (opportunity_id,owner_user_id)
           VALUES ($1,$2) ON CONFLICT DO NOTHING`,
          [opp.rows[0].id, ownerId]
        );
      }
    }
  }
}

app.get("/health", async (req, res) => {
  let database = "not configured";
  if (dbEnabled) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch {
      database = "error";
    }
  }
  res.json({ ok: true, service: "sotoboats", database });
});

app.post("/api/login", requireDb, async (req, res) => {
  const { email, password } = req.body;
  const result = await pool.query(
    `SELECT id,role,full_name,company_name,email,password_hash,status
     FROM users WHERE LOWER(email)=LOWER($1) LIMIT 1`,
    [email]
  );
  const user = result.rows[0];
  if (!user || user.status !== "active" || !(await bcrypt.compare(password, user.password_hash))) {
    return res.status(401).json({ error: "Invalid login" });
  }
  req.session.user = {
    id: user.id,
    role: user.role,
    fullName: user.full_name,
    companyName: user.company_name,
    email: user.email
  };
  res.json({ ok: true, user: req.session.user });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get("/api/me", (req, res) => {
  res.json({ user: req.session.user || null, databaseConnected: dbEnabled });
});

app.get("/api/owner/dashboard", requireDb, requireOwner, async (req, res) => {
  const ownerId = req.session.user.id;
  const [boats, opportunities, bids, availability] = await Promise.all([
    pool.query(`SELECT * FROM boats WHERE owner_user_id=$1 ORDER BY created_at DESC`, [ownerId]),
    pool.query(
      `SELECT o.* FROM charter_opportunities o
       JOIN opportunity_recipients r ON r.opportunity_id=o.id
       WHERE r.owner_user_id=$1 ORDER BY o.charter_date ASC`,
      [ownerId]
    ),
    pool.query(
      `SELECT b.*,o.public_ref,o.title,o.charter_date,bt.name AS boat_name
       FROM bids b
       JOIN charter_opportunities o ON o.id=b.opportunity_id
       LEFT JOIN boats bt ON bt.id=b.boat_id
       WHERE b.owner_user_id=$1 ORDER BY b.created_at DESC LIMIT 8`,
      [ownerId]
    ),
    pool.query(
      `SELECT a.*,b.name AS boat_name FROM availability a
       JOIN boats b ON b.id=a.boat_id
       WHERE b.owner_user_id=$1 ORDER BY a.week_start ASC`,
      [ownerId]
    )
  ]);

  res.json({
    user: req.session.user,
    boats: boats.rows,
    opportunities: opportunities.rows,
    bids: bids.rows,
    availability: availability.rows
  });
});

app.post("/api/owner/boats", requireDb, requireOwner, async (req, res) => {
  const { name, boatType, marina, capacity, cabins, halfDayPrice, fullDayPrice, imageUrl } = req.body;
  const result = await pool.query(
    `INSERT INTO boats (owner_user_id,name,boat_type,marina,capacity,cabins,half_day_price,full_day_price,image_url)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [req.session.user.id,name,boatType||null,marina||null,capacity||null,cabins||null,halfDayPrice||null,fullDayPrice||null,imageUrl||null]
  );
  res.json({ boat: result.rows[0] });
});

app.post("/api/owner/availability", requireDb, requireOwner, async (req, res) => {
  const { boatId, weekStart, status, notes } = req.body;
  const owns = await pool.query(`SELECT id FROM boats WHERE id=$1 AND owner_user_id=$2`, [boatId, req.session.user.id]);
  if (!owns.rows[0]) return res.status(403).json({ error: "Boat not found" });

  const result = await pool.query(
    `INSERT INTO availability (boat_id,week_start,status,notes)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (boat_id,week_start)
     DO UPDATE SET status=EXCLUDED.status,notes=EXCLUDED.notes,updated_at=NOW()
     RETURNING *`,
    [boatId,weekStart,status,notes||null]
  );
  res.json({ availability: result.rows[0] });
});

app.post("/api/owner/bids", requireDb, requireOwner, async (req, res) => {
  const { opportunityId, boatId, bidPrice, includes, departureMarina, availabilityConfirmed, notes, validUntil } = req.body;

  const recipient = await pool.query(
    `SELECT id FROM opportunity_recipients WHERE opportunity_id=$1 AND owner_user_id=$2`,
    [opportunityId, req.session.user.id]
  );
  if (!recipient.rows[0]) return res.status(403).json({ error: "Opportunity not assigned to this owner" });

  const result = await pool.query(
    `INSERT INTO bids
      (opportunity_id,owner_user_id,boat_id,bid_price,includes,departure_marina,availability_confirmed,notes,valid_until)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
    [
      opportunityId,
      req.session.user.id,
      boatId || null,
      bidPrice,
      includes || null,
      departureMarina || null,
      Boolean(availabilityConfirmed),
      notes || null,
      validUntil || null
    ]
  );
  res.json({ bid: result.rows[0] });
});

app.get("/api/admin/dashboard", requireDb, requireAdmin, async (req, res) => {
  const [owners, boats, opportunities, bids] = await Promise.all([
    pool.query(`SELECT id,full_name,company_name,email,phone,status,created_at FROM users WHERE role='owner' ORDER BY created_at DESC`),
    pool.query(`SELECT b.*,u.full_name AS owner_name,u.company_name FROM boats b JOIN users u ON u.id=b.owner_user_id ORDER BY b.created_at DESC`),
    pool.query(`SELECT * FROM charter_opportunities ORDER BY created_at DESC`),
    pool.query(
      `SELECT b.*,o.public_ref,o.title,u.full_name AS owner_name,bt.name AS boat_name
       FROM bids b
       JOIN charter_opportunities o ON o.id=b.opportunity_id
       JOIN users u ON u.id=b.owner_user_id
       LEFT JOIN boats bt ON bt.id=b.boat_id
       ORDER BY b.created_at DESC`
    )
  ]);
  res.json({ owners: owners.rows, boats: boats.rows, opportunities: opportunities.rows, bids: bids.rows });
});

app.post("/api/admin/opportunities", requireDb, requireAdmin, async (req, res) => {
  const { title, charterDate, startTime, endTime, guests, departureArea, preferredBoatType, budgetMin, budgetMax, extras, notes, bidDeadline } = req.body;
  const ref = `CR-${Date.now().toString().slice(-8)}`;

  const result = await pool.query(
    `INSERT INTO charter_opportunities
      (public_ref,title,charter_date,start_time,end_time,guests,departure_area,preferred_boat_type,budget_min,budget_max,extras,notes,bid_deadline)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13) RETURNING *`,
    [ref,title,charterDate,startTime||null,endTime||null,guests||null,departureArea||null,preferredBoatType||null,budgetMin||null,budgetMax||null,extras||null,notes||null,bidDeadline||null]
  );
  res.json({ opportunity: result.rows[0] });
});

app.post("/api/admin/opportunities/:id/broadcast", requireDb, requireAdmin, async (req, res) => {
  const opportunityId = Number(req.params.id);
  let ids = Array.isArray(req.body.ownerIds) ? req.body.ownerIds.map(Number).filter(Boolean) : [];

  if (ids.length === 0) {
    const owners = await pool.query(`SELECT id FROM users WHERE role='owner' AND status='active'`);
    ids = owners.rows.map(r => r.id);
  }

  for (const ownerId of ids) {
    await pool.query(
      `INSERT INTO opportunity_recipients (opportunity_id,owner_user_id)
       VALUES ($1,$2) ON CONFLICT DO NOTHING`,
      [opportunityId,ownerId]
    );
  }

  res.json({ ok: true, sentTo: ids.length });
});

app.get("/owner", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "portal", "index.html"));
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin", "index.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => app.listen(PORT, () => console.log(`Sotoboats running on port ${PORT}`)))
  .catch((err) => {
    console.error("Database initialisation failed:", err);
    process.exit(1);
  });
