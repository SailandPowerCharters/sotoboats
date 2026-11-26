"use strict";
const express = require("express");
const crypto = require("node:crypto");

function signatureValid(body, signature, secret) {
  if (!secret || !Buffer.isBuffer(body) || !/^sha256=[a-f0-9]{64}$/.test(signature || "")) return false;
  const expected = crypto.createHmac("sha256", secret).update(body).digest();
  return crypto.timingSafeEqual(expected, Buffer.from(signature.slice(7), "hex"));
}

function webhookRouter({ onEvent, env = process.env } = {}) {
  const router = express.Router();
  router.get("/", (req, res) => {
    const token = env.WHATSAPP_VERIFY_TOKEN;
    if (!token) return res.sendStatus(503);
    if (req.query["hub.mode"] !== "subscribe" || req.query["hub.verify_token"] !== token ||
        typeof req.query["hub.challenge"] !== "string") return res.sendStatus(403);
    res.type("text/plain").send(req.query["hub.challenge"]);
  });
  router.post("/", express.raw({ type: "application/json", limit: "1mb" }), async (req, res) => {
    if (!signatureValid(req.body, req.get("X-Hub-Signature-256"), env.WHATSAPP_APP_SECRET)) return res.sendStatus(401);
    let payload;
    try { payload = JSON.parse(req.body.toString("utf8")); } catch { return res.sendStatus(400); }
    if (payload?.object !== "whatsapp_business_account") return res.sendStatus(400);
    if (!onEvent) return res.sendStatus(503);
    try {
      await onEvent(payload);
      return res.sendStatus(200);
    } catch {
      return res.sendStatus(503);
    }
  });
  return router;
}

async function sendMessage(message, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const { WHATSAPP_ACCESS_TOKEN: token, WHATSAPP_PHONE_NUMBER_ID: id, WHATSAPP_GRAPH_VERSION: version } = env;
  if (env.WHATSAPP_SEND_ENABLED !== "true") throw new Error("WhatsApp sending disabled");
  if (!token || !/^\d+$/.test(id || "") || !/^v\d+\.\d+$/.test(version || "")) throw new Error("WhatsApp configuration incomplete");
  if (!message || !/^\d{7,15}$/.test(message.to || "") || !["text","template"].includes(message.type)) throw new Error("Invalid WhatsApp message");
  const response = await fetchImpl("https://graph.facebook.com/" + version + "/" + id + "/messages", {
    method: "POST",
    headers: { Authorization: "Bearer " + token, "Content-Type": "application/json" },
    body: JSON.stringify({ ...message, messaging_product: "whatsapp" }),
    signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) throw new Error("WhatsApp API returned HTTP " + response.status);
  return response.json();
}
module.exports = { webhookRouter, signatureValid, sendMessage };
