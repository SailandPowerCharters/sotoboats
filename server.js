const express = require("express");
const path = require("path");
const session = require("express-session");
const pgSession = require("connect-pg-simple")(session);
const bcrypt = require("bcryptjs");
const { Pool } = require("pg");

const app = express();

// Render terminates HTTPS at its proxy.
// This is required for secure session cookies to work correctly.
app.set("trust proxy", 1);

const PORT = process.env.PORT || 3000;
const DATABASE_URL = process.env.DATABASE_URL || "";
const SESSION_SECRET = process.env.SESSION_SECRET || "change-this-in-render";

const dbEnabled = Boolean(DATABASE_URL);

const pool = dbEnabled
  ? new Pool({
      connectionString: DATABASE_URL,
      ssl:
        process.env.NODE_ENV === "production"
          ? { rejectUnauthorized: false }
          : false
    })
  : null;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  session({
    store: dbEnabled
      ? new pgSession({
          pool,
          tableName: "user_sessions",
          createTableIfMissing: true
        })
      : undefined,
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    proxy: true,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 1000 * 60 * 60 * 12
    }
  })
);

// Serve /public exactly as before.
app.use(express.static(path.join(__dirname, "public")));

function requireDb(req, res, next) {
  if (!dbEnabled) {
    return res.status(503).json({ error: "Database not connected" });
  }
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

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase();
}

function nullableNumber(value) {
  if (value === "" || value === undefined || value === null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

async function initDb() {
  if (!dbEnabled) {
    console.log("DATABASE_URL not set. Public site will still run, but portal APIs are disabled.");
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
      status VARCHAR(30) NOT NULL,
      notes TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (boat_id, week_start)
    );

    CREATE TABLE IF NOT EXISTS calendar_slots (
      id SERIAL PRIMARY KEY,
      boat_id INTEGER NOT NULL REFERENCES boats(id) ON DELETE CASCADE,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status VARCHAR(30) NOT NULL DEFAULT 'available',
      private_reason TEXT,
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
      client_name VARCHAR(180),
      client_phone VARCHAR(100),
      client_email VARCHAR(200),
      client_language VARCHAR(50),
      accommodation TEXT,
      enquiry_source VARCHAR(120),
      internal_notes TEXT,
      lost_reason VARCHAR(120),
      lost_notes TEXT,
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
      lost_reason VARCHAR(120),
      lost_notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      notification_type VARCHAR(80) NOT NULL,
      message TEXT NOT NULL,
      is_read BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_calendar_slots_boat_dates
      ON calendar_slots (boat_id, starts_at, ends_at);

    CREATE INDEX IF NOT EXISTS idx_recipients_owner
      ON opportunity_recipients (owner_user_id);

    CREATE INDEX IF NOT EXISTS idx_bids_owner
      ON bids (owner_user_id);

    CREATE INDEX IF NOT EXISTS idx_notifications_user
      ON notifications (user_id, is_read);
  `);

  // Safe migrations for databases created by earlier versions.
  const migrations = [
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_name VARCHAR(180)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_phone VARCHAR(100)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_email VARCHAR(200)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS client_language VARCHAR(50)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS accommodation TEXT`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS enquiry_source VARCHAR(120)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS internal_notes TEXT`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(120)`,
    `ALTER TABLE charter_opportunities ADD COLUMN IF NOT EXISTS lost_notes TEXT`,
    `ALTER TABLE bids ADD COLUMN IF NOT EXISTS lost_reason VARCHAR(120)`,
    `ALTER TABLE bids ADD COLUMN IF NOT EXISTS lost_notes TEXT`
  ];

  for (const sql of migrations) {
    await pool.query(sql);
  }

  // Demo users. With SEED_DEMO=true this also refreshes their passwords.
  if (process.env.SEED_DEMO === "true") {
    const ownerEmail = cleanEmail(
      process.env.DEMO_OWNER_EMAIL || "owner@sotoboats.demo"
    );
    const ownerPassword =
      process.env.DEMO_OWNER_PASSWORD || "Sotoboats123!";

    const adminEmail = cleanEmail(
      process.env.DEMO_ADMIN_EMAIL || "admin@sotoboats.demo"
    );
    const adminPassword =
      process.env.DEMO_ADMIN_PASSWORD || "SotoboatsAdmin123!";

    const ownerHash = await bcrypt.hash(ownerPassword, 10);
    const adminHash = await bcrypt.hash(adminPassword, 10);

    await pool.query(
      `INSERT INTO users
        (role, full_name, company_name, email, phone, password_hash, status)
       VALUES
        ('owner','Captain Alex','Alex Charters',$1,'+34 600 000 000',$2,'active')
       ON CONFLICT (email) DO UPDATE
       SET role='owner',
           full_name=EXCLUDED.full_name,
           company_name=EXCLUDED.company_name,
           phone=EXCLUDED.phone,
           password_hash=EXCLUDED.password_hash,
           status='active'`,
      [ownerEmail, ownerHash]
    );

    await pool.query(
      `INSERT INTO users
        (role, full_name, company_name, email, phone, password_hash, status)
       VALUES
        ('admin','Sotoboats Admin','Sotoboats',$1,'+34 600 000 001',$2,'active')
       ON CONFLICT (email) DO UPDATE
       SET role='admin',
           full_name=EXCLUDED.full_name,
           company_name=EXCLUDED.company_name,
           phone=EXCLUDED.phone,
           password_hash=EXCLUDED.password_hash,
           status='active'`,
      [adminEmail, adminHash]
    );

    const ownerResult = await pool.query(
      `SELECT id FROM users WHERE email=$1`,
      [ownerEmail]
    );

    if (ownerResult.rows[0]) {
      const ownerId = ownerResult.rows[0].id;

      await pool.query(
        `INSERT INTO boats
          (owner_user_id,name,boat_type,marina,capacity,cabins,half_day_price,full_day_price,image_url)
         SELECT
          $1,'Princess V50','Motor yacht','Estepona',12,2,1450,2600,
          'https://images.pexels.com/photos/8436330/pexels-photo-8436330.jpeg?auto=compress&cs=tinysrgb&w=1200'
         WHERE NOT EXISTS (
           SELECT 1 FROM boats WHERE owner_user_id=$1 AND name='Princess V50'
         )`,
        [ownerId]
      );

      await pool.query(
        `INSERT INTO charter_opportunities
          (public_ref,title,charter_date,start_time,end_time,guests,departure_area,
           preferred_boat_type,budget_min,budget_max,extras,notes,bid_deadline,status)
         SELECT
          'CR-DEMO-001','Family day charter',CURRENT_DATE + 5,'10:00','18:00',8,
          'Estepona','Motor yacht',2500,3200,'Skipper + drinks package',
          'Family group looking for a relaxed day with swim stops.',
          NOW() + INTERVAL '2 hours','open'
         WHERE NOT EXISTS (
           SELECT 1 FROM charter_opportunities WHERE public_ref='CR-DEMO-001'
         )`
      );

      const opp = await pool.query(
        `SELECT id FROM charter_opportunities WHERE public_ref='CR-DEMO-001'`
      );

      if (opp.rows[0]) {
        await pool.query(
          `INSERT INTO opportunity_recipients (opportunity_id,owner_user_id)
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [opp.rows[0].id, ownerId]
        );
      }
    }

    console.log("Demo users seeded/refreshed.");
  }

  console.log("Sotoboats database ready.");
}

/* =========================================================
   HEALTH
   ========================================================= */

app.get("/health", async (req, res) => {
  let database = "not configured";

  if (dbEnabled) {
    try {
      await pool.query("SELECT 1");
      database = "connected";
    } catch (err) {
      database = "error";
    }
  }

  res.json({
    ok: true,
    service: "sotoboats",
    database
  });
});

/* =========================================================
   AUTH
   ========================================================= */

app.post("/api/login", requireDb, async (req, res) => {
  try {
    const email = cleanEmail(req.body.email);
    const password = String(req.body.password || "");

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const result = await pool.query(
      `SELECT id,role,full_name,company_name,email,password_hash,status
       FROM users
       WHERE LOWER(email)=LOWER($1)
       LIMIT 1`,
      [email]
    );

    const user = result.rows[0];

    if (
      !user ||
      user.status !== "active" ||
      !(await bcrypt.compare(password, user.password_hash))
    ) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    req.session.user = {
      id: user.id,
      role: user.role,
      fullName: user.full_name,
      companyName: user.company_name,
      email: user.email
    };

    req.session.save((err) => {
      if (err) {
        console.error("Session save failed:", err);
        return res.status(500).json({ error: "Could not start login session" });
      }

      return res.json({
        ok: true,
        user: req.session.user
      });
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Login failed" });
  }
});

app.post("/api/logout", (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ ok: true });
  });
});

app.get("/api/me", (req, res) => {
  res.json({
    user: req.session.user || null
  });
});

/* =========================================================
   OWNER PORTAL
   ========================================================= */

app.get(
  "/api/owner/dashboard",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const ownerId = req.session.user.id;

      const [
        boatsResult,
        opportunitiesResult,
        bidsResult,
        notificationsResult,
        kpiResult
      ] = await Promise.all([
        pool.query(
          `SELECT *
           FROM boats
           WHERE owner_user_id=$1 AND status <> 'deleted'
           ORDER BY created_at DESC`,
          [ownerId]
        ),

        pool.query(
          `SELECT DISTINCT co.*
           FROM charter_opportunities co
           JOIN opportunity_recipients r
             ON r.opportunity_id=co.id
           WHERE r.owner_user_id=$1
             AND co.status IN ('open','broadcast','awarded','closed')
           ORDER BY co.charter_date ASC, co.created_at DESC`,
          [ownerId]
        ),

        pool.query(
          `SELECT
             b.*,
             co.public_ref,
             co.title,
             bt.name AS boat_name
           FROM bids b
           JOIN charter_opportunities co ON co.id=b.opportunity_id
           LEFT JOIN boats bt ON bt.id=b.boat_id
           WHERE b.owner_user_id=$1
           ORDER BY b.created_at DESC`,
          [ownerId]
        ),

        pool.query(
          `SELECT *
           FROM notifications
           WHERE user_id=$1
           ORDER BY created_at DESC
           LIMIT 25`,
          [ownerId]
        ),

        pool.query(
          `SELECT
             (SELECT COUNT(*)
              FROM opportunity_recipients
              WHERE owner_user_id=$1)::int AS opportunities_received,

             (SELECT COUNT(*)
              FROM bids
              WHERE owner_user_id=$1)::int AS bids_submitted,

             (SELECT COUNT(*)
              FROM bids
              WHERE owner_user_id=$1 AND status='won')::int AS bids_won,

             COALESCE(
               (SELECT SUM(bid_price)
                FROM bids
                WHERE owner_user_id=$1 AND status='won'),0
             ) AS confirmed_value,

             (SELECT COUNT(*)
              FROM calendar_slots cs
              JOIN boats bt ON bt.id=cs.boat_id
              WHERE bt.owner_user_id=$1
                AND cs.status='available'
                AND cs.starts_at >= NOW()
                AND cs.starts_at < NOW() + INTERVAL '30 days')::int
               AS available_slots_30d`,
          [ownerId]
        )
      ]);

      res.json({
        user: req.session.user,
        boats: boatsResult.rows,
        opportunities: opportunitiesResult.rows,
        bids: bidsResult.rows,
        notifications: notificationsResult.rows,
        kpis: kpiResult.rows[0] || {}
      });
    } catch (err) {
      console.error("Owner dashboard error:", err);
      res.status(500).json({ error: "Could not load owner dashboard" });
    }
  }
);

app.post(
  "/api/owner/boats",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const {
        name,
        boatType,
        marina,
        capacity,
        cabins,
        halfDayPrice,
        fullDayPrice,
        imageUrl
      } = req.body;

      if (!name) {
        return res.status(400).json({ error: "Boat name is required" });
      }

      const result = await pool.query(
        `INSERT INTO boats
          (owner_user_id,name,boat_type,marina,capacity,cabins,
           half_day_price,full_day_price,image_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
         RETURNING *`,
        [
          req.session.user.id,
          String(name).trim(),
          boatType || null,
          marina || null,
          nullableNumber(capacity),
          nullableNumber(cabins),
          nullableNumber(halfDayPrice),
          nullableNumber(fullDayPrice),
          imageUrl || null
        ]
      );

      res.status(201).json({ boat: result.rows[0] });
    } catch (err) {
      console.error("Add boat error:", err);
      res.status(500).json({ error: "Could not add boat" });
    }
  }
);

// Legacy weekly availability route retained for older portal builds.
app.post(
  "/api/owner/availability",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const { boatId, weekStart, status, notes } = req.body;

      const boatCheck = await pool.query(
        `SELECT id FROM boats WHERE id=$1 AND owner_user_id=$2`,
        [boatId, req.session.user.id]
      );

      if (!boatCheck.rows[0]) {
        return res.status(403).json({ error: "Boat not found" });
      }

      const result = await pool.query(
        `INSERT INTO availability
          (boat_id,week_start,status,notes,updated_at)
         VALUES ($1,$2,$3,$4,NOW())
         ON CONFLICT (boat_id,week_start)
         DO UPDATE SET
           status=EXCLUDED.status,
           notes=EXCLUDED.notes,
           updated_at=NOW()
         RETURNING *`,
        [boatId, weekStart, status, notes || null]
      );

      res.json({ availability: result.rows[0] });
    } catch (err) {
      console.error("Availability error:", err);
      res.status(500).json({ error: "Could not update availability" });
    }
  }
);

app.get(
  "/api/owner/calendar",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const ownerId = req.session.user.id;
      const from = req.query.from || new Date().toISOString();
      const to =
        req.query.to ||
        new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

      const result = await pool.query(
        `SELECT
           cs.id,
           cs.boat_id,
           bt.name AS boat_name,
           cs.starts_at,
           cs.ends_at,
           cs.status,
           cs.private_reason
         FROM calendar_slots cs
         JOIN boats bt ON bt.id=cs.boat_id
         WHERE bt.owner_user_id=$1
           AND cs.ends_at >= $2::timestamptz
           AND cs.starts_at <= $3::timestamptz
         ORDER BY cs.starts_at ASC`,
        [ownerId, from, to]
      );

      res.json({ slots: result.rows });
    } catch (err) {
      console.error("Calendar load error:", err);
      res.status(500).json({ error: "Could not load calendar" });
    }
  }
);

app.post(
  "/api/owner/calendar-slots",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const {
        boatId,
        startsAt,
        endsAt,
        status = "available",
        privateReason
      } = req.body;

      if (!boatId || !startsAt || !endsAt) {
        return res.status(400).json({
          error: "Boat, start time and end time are required"
        });
      }

      if (new Date(endsAt) <= new Date(startsAt)) {
        return res.status(400).json({
          error: "End time must be after start time"
        });
      }

      const allowed = ["available", "provisional", "booked", "unavailable"];
      if (!allowed.includes(status)) {
        return res.status(400).json({ error: "Invalid calendar status" });
      }

      const boatCheck = await pool.query(
        `SELECT id FROM boats WHERE id=$1 AND owner_user_id=$2`,
        [boatId, req.session.user.id]
      );

      if (!boatCheck.rows[0]) {
        return res.status(403).json({ error: "Boat not found" });
      }

      const result = await pool.query(
        `INSERT INTO calendar_slots
          (boat_id,starts_at,ends_at,status,private_reason)
         VALUES ($1,$2,$3,$4,$5)
         RETURNING *`,
        [
          boatId,
          startsAt,
          endsAt,
          status,
          privateReason || null
        ]
      );

      res.status(201).json({ slot: result.rows[0] });
    } catch (err) {
      console.error("Calendar add error:", err);
      res.status(500).json({ error: "Could not add calendar slot" });
    }
  }
);

app.delete(
  "/api/owner/calendar-slots/:id",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM calendar_slots cs
         USING boats bt
         WHERE cs.id=$1
           AND cs.boat_id=bt.id
           AND bt.owner_user_id=$2
         RETURNING cs.id`,
        [req.params.id, req.session.user.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ error: "Calendar slot not found" });
      }

      res.json({ ok: true });
    } catch (err) {
      console.error("Calendar delete error:", err);
      res.status(500).json({ error: "Could not delete calendar slot" });
    }
  }
);

app.post(
  "/api/owner/bids",
  requireDb,
  requireOwner,
  async (req, res) => {
    try {
      const {
        opportunityId,
        boatId,
        bidPrice,
        includes,
        departureMarina,
        availabilityConfirmed,
        notes,
        validUntil
      } = req.body;

      if (!opportunityId || !bidPrice) {
        return res.status(400).json({
          error: "Opportunity and bid price are required"
        });
      }

      const recipientCheck = await pool.query(
        `SELECT 1
         FROM opportunity_recipients
         WHERE opportunity_id=$1 AND owner_user_id=$2`,
        [opportunityId, req.session.user.id]
      );

      if (!recipientCheck.rows[0]) {
        return res.status(403).json({
          error: "This opportunity was not sent to your account"
        });
      }

      if (boatId) {
        const boatCheck = await pool.query(
          `SELECT id FROM boats WHERE id=$1 AND owner_user_id=$2`,
          [boatId, req.session.user.id]
        );

        if (!boatCheck.rows[0]) {
          return res.status(403).json({ error: "Boat not found" });
        }
      }

      const result = await pool.query(
        `INSERT INTO bids
          (opportunity_id,owner_user_id,boat_id,bid_price,includes,
           departure_marina,availability_confirmed,notes,valid_until,status)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'submitted')
         RETURNING *`,
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

      res.status(201).json({ bid: result.rows[0] });
    } catch (err) {
      console.error("Bid error:", err);
      res.status(500).json({ error: "Could not submit bid" });
    }
  }
);

/* =========================================================
   ADMIN
   ========================================================= */

app.get(
  "/api/admin/dashboard",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const [owners, boats, opportunities, bids] = await Promise.all([
        pool.query(
          `SELECT id,full_name,company_name,email,phone,status,created_at
           FROM users
           WHERE role='owner'
           ORDER BY created_at DESC`
        ),

        pool.query(
          `SELECT b.*,u.full_name AS owner_name,u.company_name
           FROM boats b
           JOIN users u ON u.id=b.owner_user_id
           WHERE b.status <> 'deleted'
           ORDER BY b.created_at DESC`
        ),

        pool.query(
          `SELECT co.*,
             (SELECT COUNT(*)
              FROM opportunity_recipients r
              WHERE r.opportunity_id=co.id)::int AS recipient_count,
             (SELECT COUNT(*)
              FROM bids b
              WHERE b.opportunity_id=co.id)::int AS bid_count
           FROM charter_opportunities co
           ORDER BY co.created_at DESC`
        ),

        pool.query(
          `SELECT
             b.*,
             co.public_ref,
             co.title,
             u.full_name AS owner_name,
             bt.name AS boat_name
           FROM bids b
           JOIN charter_opportunities co ON co.id=b.opportunity_id
           JOIN users u ON u.id=b.owner_user_id
           LEFT JOIN boats bt ON bt.id=b.boat_id
           ORDER BY b.created_at DESC`
        )
      ]);

      res.json({
        user: req.session.user,
        owners: owners.rows,
        boats: boats.rows,
        opportunities: opportunities.rows,
        bids: bids.rows
      });
    } catch (err) {
      console.error("Admin dashboard error:", err);
      res.status(500).json({ error: "Could not load admin dashboard" });
    }
  }
);

app.post(
  "/api/admin/opportunities",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const {
        publicRef,
        title,
        charterDate,
        startTime,
        endTime,
        guests,
        departureArea,
        preferredBoatType,
        budgetMin,
        budgetMax,
        extras,
        notes,
        bidDeadline,
        clientName,
        clientPhone,
        clientEmail,
        clientLanguage,
        accommodation,
        enquirySource,
        internalNotes
      } = req.body;

      if (!title || !charterDate) {
        return res.status(400).json({
          error: "Title and charter date are required"
        });
      }

      const ref =
        publicRef ||
        `CR-${new Date().getFullYear()}-${String(Date.now()).slice(-6)}`;

      const result = await pool.query(
        `INSERT INTO charter_opportunities
          (public_ref,title,charter_date,start_time,end_time,guests,
           departure_area,preferred_boat_type,budget_min,budget_max,
           extras,notes,bid_deadline,status,
           client_name,client_phone,client_email,client_language,
           accommodation,enquiry_source,internal_notes)
         VALUES
          ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'open',
           $14,$15,$16,$17,$18,$19,$20)
         RETURNING *`,
        [
          ref,
          title,
          charterDate,
          startTime || null,
          endTime || null,
          nullableNumber(guests),
          departureArea || null,
          preferredBoatType || null,
          nullableNumber(budgetMin),
          nullableNumber(budgetMax),
          extras || null,
          notes || null,
          bidDeadline || null,
          clientName || null,
          clientPhone || null,
          clientEmail || null,
          clientLanguage || null,
          accommodation || null,
          enquirySource || null,
          internalNotes || null
        ]
      );

      res.status(201).json({ opportunity: result.rows[0] });
    } catch (err) {
      console.error("Create opportunity error:", err);

      if (err.code === "23505") {
        return res.status(409).json({
          error: "That opportunity reference already exists"
        });
      }

      res.status(500).json({ error: "Could not create opportunity" });
    }
  }
);

app.post(
  "/api/admin/opportunities/:id/broadcast",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      const opportunityId = Number(req.params.id);
      let ownerIds = Array.isArray(req.body.ownerIds)
        ? req.body.ownerIds.map(Number).filter(Boolean)
        : [];

      if (!ownerIds.length) {
        const owners = await pool.query(
          `SELECT id FROM users
           WHERE role='owner' AND status='active'`
        );
        ownerIds = owners.rows.map((r) => r.id);
      }

      for (const ownerId of ownerIds) {
        await pool.query(
          `INSERT INTO opportunity_recipients
            (opportunity_id,owner_user_id)
           VALUES ($1,$2)
           ON CONFLICT DO NOTHING`,
          [opportunityId, ownerId]
        );
      }

      await pool.query(
        `UPDATE charter_opportunities
         SET status='broadcast'
         WHERE id=$1`,
        [opportunityId]
      );

      res.json({
        ok: true,
        sentTo: ownerIds.length
      });
    } catch (err) {
      console.error("Broadcast error:", err);
      res.status(500).json({ error: "Could not broadcast opportunity" });
    }
  }
);

// Admin can ask selected/all owners to refresh calendars.
app.post(
  "/api/admin/calendar-update-request",
  requireDb,
  requireAdmin,
  async (req, res) => {
    try {
      let ownerIds = Array.isArray(req.body.ownerIds)
        ? req.body.ownerIds.map(Number).filter(Boolean)
        : [];

      if (!ownerIds.length) {
        const owners = await pool.query(
          `SELECT id FROM users
           WHERE role='owner' AND status='active'`
        );
        ownerIds = owners.rows.map((r) => r.id);
      }

      const message =
        req.body.message ||
        "Please update your boat availability calendar.";

      for (const ownerId of ownerIds) {
        await pool.query(
          `INSERT INTO notifications
            (user_id,notification_type,message)
           VALUES ($1,'calendar_update',$2)`,
          [ownerId, message]
        );
      }

      res.json({ ok: true, sentTo: ownerIds.length });
    } catch (err) {
      console.error("Calendar notification error:", err);
      res.status(500).json({ error: "Could not send calendar request" });
    }
  }
);

/* =========================================================
   PORTAL / ADMIN FRIENDLY ROUTES
   ========================================================= */

app.get("/portal", (req, res) => res.redirect("/portal/"));
app.get("/admin", (req, res) => res.redirect("/admin/"));

// API routes should NEVER fall through to the website HTML.
app.use("/api", (req, res) => {
  res.status(404).json({ error: "API route not found" });
});

// Public-site fallback.
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

/* =========================================================
   STARTUP
   ========================================================= */

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Sotoboats running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("Database initialisation failed:", err);
    process.exit(1);
  });
