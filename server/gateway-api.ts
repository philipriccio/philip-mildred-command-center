/**
 * Gateway REST API proxy endpoints.
 * 
 * These forward requests to the local OpenClaw gateway HTTP API
 * to provide cron, session, and health data to the Command Center frontend.
 */

import type { Express } from 'express';

const GATEWAY_API = process.env.GATEWAY_API_URL ?? 'http://127.0.0.1:18789';

async function gatewayFetch(path: string, token: string, options: RequestInit = {}) {
  const url = `${GATEWAY_API}${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`Gateway ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export function registerGatewayApiRoutes(app: Express, getToken: () => string) {

  // ─── Cron Jobs ─────────────────────────────────────────────
  app.get('/api/cron/jobs', async (_req, res) => {
    try {
      const token = getToken();
      if (!token) {
        res.status(503).json({ error: 'No gateway token' });
        return;
      }
      const data = await gatewayFetch('/api/cron/jobs?includeDisabled=true', token);
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: String(e) });
    }
  });

  app.get('/api/cron/status', async (_req, res) => {
    try {
      const token = getToken();
      if (!token) {
        res.status(503).json({ error: 'No gateway token' });
        return;
      }
      const data = await gatewayFetch('/api/cron/status', token);
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: String(e) });
    }
  });

  // ─── Sessions ──────────────────────────────────────────────
  app.get('/api/sessions', async (req, res) => {
    try {
      const token = getToken();
      if (!token) {
        res.status(503).json({ error: 'No gateway token' });
        return;
      }
      const params = new URLSearchParams();
      if (req.query.activeMinutes) params.set('activeMinutes', String(req.query.activeMinutes));
      if (req.query.messageLimit) params.set('messageLimit', String(req.query.messageLimit));
      if (req.query.limit) params.set('limit', String(req.query.limit));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const data = await gatewayFetch(`/api/sessions${qs}`, token);
      res.json(data);
    } catch (e) {
      res.status(502).json({ error: String(e) });
    }
  });

  // ─── Site Health ───────────────────────────────────────────
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
        // 2xx and 3xx are OK. 401 for CRM is expected (auth wall).
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
