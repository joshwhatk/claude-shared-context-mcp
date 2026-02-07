import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarketingNav } from '../components/marketing/MarketingNav';
import { Footer } from '../components/marketing/Footer';
import { usePageTitle } from '../hooks/usePageTitle';

const TERMS_OF_USE = `# Terms of Use

**Effective Date:** February 7, 2026
**Last Updated:** February 7, 2026

These Terms of Use ("Terms") constitute a legally binding agreement between you ("you" or "User") and Illuminate LLC, a Tennessee limited liability company ("Illuminate," "we," "us," or "our"), governing your access to and use of the Shared Context application, website, API, and related services (collectively, the "Service").

By accessing or using the Service, you agree to be bound by these Terms. If you do not agree, do not use the Service.

---

## 1. Eligibility

You must be at least 16 years old to use the Service. By using the Service, you represent and warrant that you meet this age requirement. If we learn that a user is under 16, we will terminate their account and delete their data.

## 2. Account Registration and Security

To use the Service, you must create an account using a supported OAuth provider (such as Google, GitHub, Microsoft, or Apple). You are responsible for maintaining the security of your account credentials and API keys. You must notify us immediately if you become aware of any unauthorized access to your account.

You are responsible for all activity that occurs under your account, whether or not you authorized it. We reserve the right to suspend or terminate accounts that we reasonably believe have been compromised.

## 3. Description of the Service

Shared Context is a tool built on the Model Context Protocol (MCP) that provides persistent, read-write context storage across Claude AI conversations. The Service allows you to save, retrieve, update, and delete context entries that can be accessed by Claude during your conversations.

The Service is provided on an "as available" basis. We may modify, suspend, or discontinue any part of the Service at any time, with or without notice.

## 4. Acceptable Use

You agree not to use the Service to:

(a) Violate any applicable law, regulation, or third-party rights.

(b) Store or transmit any content that is unlawful, defamatory, obscene, harassing, threatening, or otherwise objectionable.

(c) Attempt to gain unauthorized access to any part of the Service, other users' accounts, or any systems or networks connected to the Service.

(d) Interfere with or disrupt the integrity or performance of the Service, including through automated scripts, bots, or excessive API calls beyond published rate limits.

(e) Reverse-engineer, decompile, disassemble, or otherwise attempt to derive the source code of the Service, except to the extent permitted by applicable law.

(f) Resell, sublicense, or redistribute access to the Service without our prior written consent.

(g) Use the Service to store credentials, passwords, social security numbers, payment card numbers, or other highly sensitive personal information for which the Service is not designed.

We reserve the right to investigate and take appropriate action against any violations, including removing content, suspending access, or terminating accounts.

## 5. User Content and Ownership

"User Content" means any data, text, templates, or other materials you store in the Service through context entries.

You retain all ownership rights in your User Content. By using the Service, you grant Illuminate a limited, non-exclusive, worldwide, royalty-free license to host, store, transmit, display, and reproduce your User Content solely as necessary to operate, maintain, and provide the Service to you. This license terminates when you delete your User Content or your account, except to the extent copies are retained in routine backups for a reasonable period.

You represent and warrant that you have all necessary rights to store your User Content in the Service and to grant us the license described above.

## 6. Intellectual Property

The Service, including its design, software, features, documentation, and branding, is owned by Illuminate and is protected by intellectual property laws. These Terms do not grant you any rights to use Illuminate's trademarks, logos, or branding without our prior written consent.

## 7. Fees and Payment

The Service offers both free and paid plans. If you subscribe to a paid plan:

(a) **Billing.** You agree to pay all fees associated with your selected plan. Fees are billed in advance on a recurring basis (monthly or annually, depending on your selection) through our third-party payment processor (currently Stripe). You authorize us to charge your payment method on file for all applicable fees.

(b) **Price Changes.** We may change our prices at any time. For existing subscribers, price changes will take effect at the start of your next billing cycle following at least 30 days' notice.

(c) **Refunds.** All fees are non-refundable except where required by applicable law.

(d) **Failure to Pay.** If payment fails, we may suspend or downgrade your account after providing reasonable notice and an opportunity to update your payment method.

## 8. Termination

**By You.** You may stop using the Service and delete your account at any time.

**By Us.** We may suspend or terminate your account at any time, for any reason or no reason, with or without notice. If we terminate your account without cause, we will make commercially reasonable efforts to provide you with an opportunity to export your User Content.

**Effect of Termination.** Upon termination, your right to access the Service ceases immediately. We may delete your User Content and account data within a reasonable period following termination, subject to any legal retention requirements.

## 9. Disclaimer of Warranties

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE" WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS, IMPLIED, OR STATUTORY. TO THE FULLEST EXTENT PERMITTED BY LAW, ILLUMINATE DISCLAIMS ALL WARRANTIES, INCLUDING WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.

We do not warrant that the Service will be uninterrupted, error-free, or secure, or that any defects will be corrected. We do not warrant that the Service will meet your requirements or expectations.

## 10. Limitation of Liability

TO THE FULLEST EXTENT PERMITTED BY LAW, IN NO EVENT SHALL ILLUMINATE, ITS OFFICERS, MEMBERS, EMPLOYEES, AGENTS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF PROFITS, DATA, USE, OR GOODWILL, ARISING OUT OF OR IN CONNECTION WITH THESE TERMS OR YOUR USE OF THE SERVICE, REGARDLESS OF THE THEORY OF LIABILITY.

OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS ARISING OUT OF OR RELATING TO THESE TERMS OR THE SERVICE SHALL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU HAVE PAID TO US IN THE TWELVE (12) MONTHS PRECEDING THE CLAIM, OR (B) ONE HUNDRED DOLLARS ($100).

## 11. Indemnification

You agree to indemnify, defend, and hold harmless Illuminate and its officers, members, employees, and agents from and against any claims, liabilities, damages, losses, and expenses (including reasonable attorneys' fees) arising out of or in connection with: (a) your use of the Service; (b) your User Content; (c) your violation of these Terms; or (d) your violation of any third-party rights.

## 12. Binding Arbitration and Class Action Waiver

**PLEASE READ THIS SECTION CAREFULLY. IT AFFECTS YOUR LEGAL RIGHTS, INCLUDING YOUR RIGHT TO FILE A LAWSUIT IN COURT.**

(a) **Agreement to Arbitrate.** You and Illuminate agree that any dispute, claim, or controversy arising out of or relating to these Terms or the Service (collectively, "Disputes") will be resolved exclusively through binding individual arbitration, rather than in court, except that either party may bring individual claims in small claims court if they qualify.

(b) **Arbitration Rules.** Arbitration will be conducted by the American Arbitration Association ("AAA") under its Consumer Arbitration Rules (or Commercial Arbitration Rules, if applicable). The arbitration will take place in Nashville, Tennessee, unless the parties agree otherwise or the AAA rules provide for a different location. The arbitrator's decision will be final and binding, and judgment on the award may be entered in any court of competent jurisdiction.

(c) **Class Action Waiver.** YOU AND ILLUMINATE AGREE THAT EACH MAY BRING DISPUTES AGAINST THE OTHER ONLY IN AN INDIVIDUAL CAPACITY AND NOT AS A PLAINTIFF OR CLASS MEMBER IN ANY PURPORTED CLASS, COLLECTIVE, OR REPRESENTATIVE ACTION. The arbitrator may not consolidate more than one person's claims and may not preside over any form of representative or class proceeding.

(d) **Opt-Out.** You may opt out of this arbitration agreement by sending written notice to legal@sharedcontext.com within 30 days of first accepting these Terms. Your notice must include your name, email address, and a clear statement that you wish to opt out of the arbitration provision.

(e) **Severability.** If the class action waiver in Section 12(c) is found to be unenforceable, the entire arbitration agreement in this Section 12 shall be void. If any other provision of this Section 12 is found to be unenforceable, that provision shall be severed and the remaining provisions shall remain in effect.

## 13. Governing Law

These Terms shall be governed by and construed in accordance with the laws of the State of Tennessee, without regard to its conflict of laws principles. To the extent that litigation is permitted under these Terms, the parties consent to the exclusive jurisdiction of the state and federal courts located in Tennessee.

## 14. Changes to These Terms

We may update these Terms from time to time. If we make material changes, we will notify you by posting the updated Terms on our website and updating the "Last Updated" date. Your continued use of the Service after changes take effect constitutes your acceptance of the revised Terms. If you do not agree to the updated Terms, you must stop using the Service.

## 15. Miscellaneous

(a) **Entire Agreement.** These Terms, together with our Privacy Policy, constitute the entire agreement between you and Illuminate regarding the Service.

(b) **Severability.** If any provision of these Terms is found to be unenforceable, the remaining provisions shall remain in full force and effect.

(c) **Waiver.** Our failure to enforce any right or provision of these Terms shall not constitute a waiver of that right or provision.

(d) **Assignment.** You may not assign or transfer these Terms or your rights under them without our prior written consent. We may assign these Terms without restriction.

(e) **Notices.** We may provide notices to you via email, through the Service, or by posting on our website. You may contact us at legal@sharedcontext.com.

---

**Illuminate LLC**
Tennessee, United States
Contact: legal@sharedcontext.com`;

export function TermsOfUsePage() {
  usePageTitle('Terms of Use');
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav minimal />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{TERMS_OF_USE}</ReactMarkdown>
        </article>
      </main>
      <Footer />
    </div>
  );
}
