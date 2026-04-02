/**
 * Gateway API proxy endpoints.
 * 
 * These use the gateway WebSocket RPC to fetch cron, session, and health data.
 * Site health is checked directly via HTTP fetch to the production URLs.
 */

import type { Express } from 'express';
import type { GatewayClient } from './gateway-client.js';

export function registerGatewayApiRoutes(
  app: Express,
  getGateway: () => GatewayClient | null,
) {

  // ─── Cron Jobs (via gateway RPC) ──────────────────────────
  app.get('/api/cron/jobs', async (_req, res) => {
    try {
      const gw = getGateway();
      if (!gw?.isConnected()) {
        res.status(503).json({ error: 'Gateway not connected' });
        return;
      }
      const data = await gw.request('cron.list', { includeDisabled: true });
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: String(e) });
    }
  });

  // ─── Sessions (via gateway RPC) ───────────────────────────
  app.get('/api/sessions', async (req, res) => {
    try {
      const gw = getGateway();
      if (!gw?.isConnected()) {
        res.status(503).json({ error: 'Gateway not connected' });
        return;
      }
      const params: Record<string, unknown> = {};
      if (req.query.activeMinutes) params.activeMinutes = Number(req.query.activeMinutes);
      if (req.query.messageLimit) params.messageLimit = Number(req.query.messageLimit);
      if (req.query.limit) params.limit = Number(req.query.limit);
      const data = await gw.request('sessions.list', params);
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: String(e) });
    }
  });

  // ─── Site Health (direct HTTP checks) ─────────────────────
  app.get('/api/health/sites', async (_req, res) => {
    const sites = [
      { name: 'Company Theatre', url: 'https://companytheatre.ca' },
      { name: 'Jackpot Twins', url: 'https://jackpottwins.ca' },
      { name: 'Self-e-Tape', url: 'https://selfetape.com' },
      { name: 'CT CRM', url: 'https://crm.companytheatre.ca' },
      { name: 'Hawco CRM', url: 'https://hawco.companytheatre.ca' },
      { name: 'CoverageIQ', url: 'https://coverageiq.companytheatre.ca' },
    ];

    const results = await Promise.all(sites.map(async (site) => {
      const start = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000);
        const r = await fetch(site.url, {
          method: 'GET',
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeout);
        const elapsed = Date.now() - start;
        const isOk = r.status < 500;
        return {
          url: site.url,
          name: site.name,
          status: r.status,
          responseTimeMs: elapsed,
          error: null,
          ok: isOk,
        };
      } catch (e) {
        return {
          url: site.url,
          name: site.name,
          status: null,
          responseTimeMs: Date.now() - start,
          error: String(e),
          ok: false,
        };
      }
    }));

    res.json({ sites: results, checkedAt: Date.now() });
  });
}
