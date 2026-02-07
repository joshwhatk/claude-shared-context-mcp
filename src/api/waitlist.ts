/**
 * Public waitlist API endpoint (no auth required)
 */

import { Router, Request, Response } from 'express';
import { createWaitlistEntry } from '../db/queries.js';
import { validateEmail, validateName, validatePreferredLogin } from '../tools/validators.js';

const router = Router();

/**
 * POST /api/waitlist
 * Add a user to the waitlist
 * Body: { first_name, last_name, email, preferred_login, consent_text }
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
  try {
    const { first_name, last_name, email, preferred_login, consent_text } = req.body;

    // Validate first name
    const firstNameValidation = validateName(first_name);
    if (!firstNameValidation.valid) {
      res.status(400).json({
        success: false,
        error: `First name: ${firstNameValidation.error}`,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate last name
    const lastNameValidation = validateName(last_name);
    if (!lastNameValidation.valid) {
      res.status(400).json({
        success: false,
        error: `Last name: ${lastNameValidation.error}`,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate email
    const emailValidation = validateEmail(email);
    if (!emailValidation.valid) {
      res.status(400).json({
        success: false,
        error: emailValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate preferred login
    const loginValidation = validatePreferredLogin(preferred_login);
    if (!loginValidation.valid) {
      res.status(400).json({
        success: false,
        error: loginValidation.error,
        code: 'INVALID_INPUT',
      });
      return;
    }

    // Validate consent text
    if (!consent_text || typeof consent_text !== 'string' || consent_text.trim().length === 0) {
      res.status(400).json({
        success: false,
        error: 'Consent text is required',
        code: 'INVALID_INPUT',
      });
      return;
    }

    const entry = await createWaitlistEntry(
      first_name.trim(),
      last_name.trim(),
      email.trim().toLowerCase(),
      preferred_login,
      consent_text
    );

    if (!entry) {
      res.status(409).json({
        success: false,
        error: 'This email is already on the waitlist',
        code: 'DUPLICATE_EMAIL',
      });
      return;
    }

    res.status(201).json({
      success: true,
      data: {
        email: entry.email,
        first_name: entry.first_name,
        last_name: entry.last_name,
        consent_recorded: true,
        created_at: entry.created_at.toISOString(),
      },
    });
  } catch (error) {
    console.error('[api] Waitlist error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to join waitlist',
      code: 'INTERNAL_ERROR',
    });
  }
});

export default router;
