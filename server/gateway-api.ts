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

  // ─── Sessions Usage (via gateway RPC) ──────────────────────
  app.get('/api/sessions/usage', async (_req, res) => {
    try {
      const gw = getGateway();
      if (!gw?.isConnected()) {
        res.status(503).json({ error: 'Gateway not connected' });
        return;
      }
      // Get recent sessions with usage data
      const data = await gw.request('sessions.list', {
        activeMinutes: 1440, // last 24 hours
        limit: 100,
        messageLimit: 0,
      }) as { sessions?: Array<Record<string, unknown>> };

      // Extract usage info from sessions
      const sessions = (data.sessions || []).map((s: Record<string, unknown>) => ({
        sessionKey: s.key || s.sessionKey || '',
        agentId: s.agentId || '',
        model: s.model || '',
        inputTokens: (s.usage as Record<string, number> | undefined)?.inputTokens || (s as Record<string, number>).inputTokens || 0,
        outputTokens: (s.usage as Record<string, number> | undefined)?.outputTokens || (s as Record<string, number>).outputTokens || 0,
        totalTokens: (s.usage as Record<string, number> | undefined)?.totalTokens || (s as Record<string, number>).totalTokens || 0,
        cost: (s.usage as Record<string, number> | undefined)?.cost || (s as Record<string, number>).cost || 0,
        lastActiveAt: s.lastActiveAt || s.updatedAt || 0,
      }));

      res.json({ sessions });
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

  // ─── Send Message to Agent (via gateway RPC) ──────────────
  app.post('/api/gateway/send', async (req, res) => {
    try {
      const gw = getGateway();
      if (!gw?.isConnected()) {
        res.status(503).json({ ok: false, error: 'Gateway not connected' });
        return;
      }
      const { agentId, message } = req.body as { agentId?: string; message?: string };
      if (!agentId || !message) {
        res.status(400).json({ ok: false, error: 'agentId and message required' });
        return;
      }

      // Use sessions.send RPC to send a message to the agent's session
      const sessionKey = `agent:${agentId}:telegram:direct:8241414199`;
      const data = await gw.request('sessions.send', {
        sessionKey,
        message,
        timeoutSeconds: 0, // fire and forget
      });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });

  // ─── Run Cron Job (via gateway RPC) ───────────────────────
  app.post('/api/cron/run/:jobId', async (req, res) => {
    try {
      const gw = getGateway();
      if (!gw?.isConnected()) {
        res.status(503).json({ ok: false, error: 'Gateway not connected' });
        return;
      }
      const data = await gw.request('cron.run', { jobId: req.params.jobId });
      res.json({ ok: true, data });
    } catch (e) {
      res.status(502).json({ ok: false, error: String(e) });
    }
  });
}
