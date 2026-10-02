import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import type { Pool } from 'pg';
import { asyncHandler, HttpError } from '../../http/errors.js';
import { logger } from '../../logger.js';
import { createLeadSchema, listLeadsQuerySchema, updateLeadSchema } from './leadSchemas.js';
import { createLead, getLead, listLeads, updateLead, type LeadView } from './leadService.js';
import { verifyTelegramInitData } from './telegramAuth.js';

export interface LeadRoutesDeps {
  pool: Pool;
  botToken: string;
  initDataMaxAgeSeconds: number;
  /** Called after the lead is committed. Failures are logged and never affect the response. */
  notifyLeadCreated?: (lead: LeadView) => Promise<void>;
  rateLimit: { windowMs: number; max: number };
}

/** What the shopper gets back: no internal ids, staff notes or Telegram identifiers. */
function publicView(lead: LeadView, replayed: boolean) {
  return {
    leadNumber: lead.leadNumber,
    status: lead.status,
    createdAt: lead.createdAt,
    itemsTotal: lead.itemsTotal,
    items: lead.items.map(({ productName, brand, volume, unitPrice, quantity }) => ({ productName, brand, volume, unitPrice, quantity })),
    replayed
  };
}

export function createLeadRouters(deps: LeadRoutesDeps) {
  const limiter = rateLimit({
    windowMs: deps.rateLimit.windowMs,
    limit: deps.rateLimit.max,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    handler: (_req, res) =>
      res.status(429).json({ error: 'Слишком много заявок с этого адреса. Попробуйте позже.', code: 'rate_limited' })
  });

  const publicRouter = Router();

  publicRouter.post('/', limiter, asyncHandler(async (req, res) => {
    // Honeypot: the field is hidden in the form, so only bots fill it. Pretend success, store nothing.
    if (typeof req.body?.website === 'string' && req.body.website.trim()) {
      logger.warn('Lead honeypot triggered');
      return res.status(201).json({
        leadNumber: `FL-${randomBytes(4).toString('hex').toUpperCase()}`,
        status: 'new', createdAt: new Date().toISOString(), itemsTotal: 0, items: [], replayed: false
      });
    }

    const input = createLeadSchema.parse(req.body);

    // Telegram identity is accepted only from a correctly signed initData. Anything else is a guest.
    let telegram = null;
    if (input.initData) {
      telegram = verifyTelegramInitData(input.initData, deps.botToken, deps.initDataMaxAgeSeconds);
      if (!telegram) logger.warn('Lead submitted with invalid or expired Telegram initData; treated as guest');
    }

    const { lead, created } = await createLead(deps.pool, input, telegram);
    if (created && deps.notifyLeadCreated) {
      deps.notifyLeadCreated(lead).catch((error: unknown) => logger.error('Lead notification failed', error, { leadNumber: lead.leadNumber }));
    }
    res.status(created ? 201 : 200).json(publicView(lead, !created));
  }));

  // Mounted behind requireAdmin by the caller.
  const adminRouter = Router();

  adminRouter.get('/', asyncHandler(async (req, res) => {
    res.json(await listLeads(deps.pool, listLeadsQuerySchema.parse(req.query)));
  }));

  adminRouter.get('/:id', asyncHandler(async (req, res) => {
    const lead = await getLead(deps.pool, String(req.params.id));
    if (!lead) throw new HttpError(404, 'lead_not_found', 'Заявка не найдена');
    res.json(lead);
  }));

  adminRouter.patch('/:id', asyncHandler(async (req, res) => {
    const patch = updateLeadSchema.parse(req.body);
    const actor = typeof res.locals.admin?.email === 'string' ? res.locals.admin.email : 'admin';
    res.json(await updateLead(deps.pool, String(req.params.id), patch, actor));
  }));

  return { publicRouter, adminRouter };
}

