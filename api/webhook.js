/**
 * ═══════════════════════════════════════════════════════
 *  /api/webhook.js — Vercel Serverless Entry Point
 *  Delegates to bot/webhook.js
 *
 *  This file is the public-facing Vercel route:
 *  https://cithipathao.vercel.app/api/webhook
 *
 *  HOW TO SET TELEGRAM WEBHOOK:
 *  Open in browser after deploying:
 *  https://cithipathao.vercel.app/api/webhook?action=set
 * ═══════════════════════════════════════════════════════
 */

export { default } from '../bot/webhook.js';
