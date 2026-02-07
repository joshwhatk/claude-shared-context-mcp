import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { MarketingNav } from '../components/marketing/MarketingNav';
import { Footer } from '../components/marketing/Footer';
import { usePageTitle } from '../hooks/usePageTitle';

const PRIVACY_POLICY = `# Privacy Policy

**Effective Date:** February 7, 2026
**Last Updated:** February 7, 2026

Illuminate LLC ("Illuminate," "we," "us," or "our") operates the Shared Context application, website, API, and related services (collectively, the "Service"). This Privacy Policy explains how we collect, use, disclose, and protect your personal information when you use the Service.

By using the Service, you agree to the collection and use of information as described in this Privacy Policy. If you do not agree, please do not use the Service.

---

## 1. Information We Collect

### Information You Provide Directly

- **Account Information.** When you sign up, we collect your name and email address through your chosen OAuth provider (Google, GitHub, Microsoft, or Apple). We do not collect or store your OAuth passwords.

- **Waitlist Information.** If you join our waitlist, we collect your first name, last name, email address, preferred sign-in method, and your consent acknowledgment (stored as an immutable record).

- **User Content.** We store the context entries you create, update, and manage within the Service. This includes the keys, content, and associated metadata (such as timestamps) of your context entries.

- **Payment Information.** If you subscribe to a paid plan, your payment details are collected and processed by our third-party payment processor, Stripe. We do not directly store your full credit card number or payment credentials. We may receive limited billing information from Stripe, such as the last four digits of your card, card type, and billing address.

- **Communications.** If you contact us for support or other inquiries, we collect the information you include in those communications.

### Information Collected Automatically

- **Usage and Analytics Data.** We use PostHog to collect information about how you interact with the Service, including pages viewed, features used, button clicks, session duration, and related usage patterns.

- **Device and Browser Information.** We collect information such as your IP address, browser type and version, operating system, device type, and screen resolution.

- **Cookies and Similar Technologies.** We use cookies and similar tracking technologies to operate the Service, maintain your session, and collect analytics data. See Section 6 ("Cookies") for more details.

- **Log Data.** Our servers automatically record information when you access the Service, including your IP address, request timestamps, API endpoints accessed, and error logs.

---

## 2. How We Use Your Information

We use the information we collect for the following purposes:

- **Providing the Service.** To operate, maintain, and deliver the features of the Service, including storing and serving your context entries across Claude conversations.

- **Account Management.** To create and manage your account, authenticate your identity, and process payments.

- **Communications.** To send you transactional emails (such as account confirmations, security alerts, and billing receipts) and, where you have not opted out, marketing and product update emails.

- **Analytics and Improvement.** To understand how users interact with the Service, identify usage trends, diagnose technical issues, and improve the Service.

- **Security.** To detect, prevent, and respond to fraud, abuse, security incidents, and other harmful activity.

- **Legal Compliance.** To comply with applicable laws, regulations, legal processes, or enforceable governmental requests.

---

## 3. How We Share Your Information

We do not sell your personal information. We may share your information in the following circumstances:

- **Service Providers.** We share information with third-party service providers who perform services on our behalf, including:
  - **PostHog** for analytics and event tracking
  - **Stripe** for payment processing
  - These providers are contractually obligated to use your information only to provide their services to us and in accordance with this Privacy Policy.

- **Legal Requirements.** We may disclose your information if required to do so by law, or if we believe in good faith that disclosure is necessary to comply with a legal obligation, protect our rights or safety, protect the rights or safety of others, or investigate fraud.

- **Business Transfers.** If Illuminate is involved in a merger, acquisition, reorganization, or sale of assets, your information may be transferred as part of that transaction. We will notify you of any such change by posting a notice on our website or sending you an email.

- **With Your Consent.** We may share your information for other purposes with your explicit consent.

---

## 4. Data Retention

- **Active Accounts.** We retain your account information and User Content for as long as your account is active and as needed to provide the Service.

- **After Account Deletion.** When you delete your account, we will delete your personal information and User Content within 30 days. Some information may be retained in encrypted backups for a limited period beyond that, after which it will be permanently deleted.

- **Waitlist Data.** If you joined the waitlist but did not create an account, we retain your waitlist information until it is no longer needed for its intended purpose or until you request its deletion.

- **Legal Obligations.** We may retain certain information for longer periods as required by applicable law (for example, for tax, legal, or audit purposes).

---

## 5. Data Security

We implement commercially reasonable technical and organizational measures to protect your information against unauthorized access, alteration, disclosure, or destruction. These measures include encryption in transit (TLS), access controls, and secure infrastructure practices.

However, no method of transmission over the internet or method of electronic storage is 100% secure. We cannot guarantee absolute security, and you use the Service at your own risk.

---

## 6. Cookies

We use the following types of cookies and similar technologies:

- **Essential Cookies.** Required for the Service to function, including authentication session cookies. These cannot be disabled without breaking core functionality.

- **Analytics Cookies.** Used by PostHog to collect usage data and help us understand how users interact with the Service. These cookies track page views, feature usage, and session behavior.

You can manage cookie preferences through your browser settings. Disabling non-essential cookies may limit certain features of the Service. Most browsers allow you to block or delete cookies through their settings menus.

---

## 7. Marketing Communications

We may send you emails about new features, product updates, and other information we think may be of interest to you. You can opt out of marketing emails at any time by clicking the "unsubscribe" link in any marketing email or by contacting us at privacy@sharedcontext.com. Please note that even if you opt out of marketing emails, we will still send you transactional emails related to your account (such as security alerts and billing receipts).

---

## 8. Third-Party Links and Services

The Service may contain links to third-party websites or services, such as the Model Context Protocol documentation. We are not responsible for the privacy practices or content of those third parties. We encourage you to review the privacy policies of any third-party services you access.

The Service is designed to work with Anthropic's Claude AI. When you use Shared Context through Claude, your interactions with Claude are governed by Anthropic's own terms and privacy policy. We do not control how Anthropic processes your conversations with Claude.

---

## 9. Children's Privacy

The Service is not directed to individuals under the age of 16. We do not knowingly collect personal information from anyone under 16. If we learn that we have collected personal information from a user under 16, we will take steps to delete that information and terminate the associated account as soon as reasonably possible. If you believe a child under 16 has provided us with personal information, please contact us at privacy@sharedcontext.com.

---

## 10. Your Privacy Rights

Depending on your location, you may have certain rights regarding your personal information:

- **Access.** You may request a copy of the personal information we hold about you.

- **Correction.** You may request that we correct inaccurate personal information.

- **Deletion.** You may request that we delete your personal information. You can also delete your account directly through the Service.

- **Data Export.** You may request an export of your User Content and personal information in a portable format.

To exercise any of these rights, contact us at privacy@sharedcontext.com. We will respond to your request within 30 days.

---

## 11. California Privacy Rights (CCPA/CPRA)

If you are a California resident, you have additional rights under the California Consumer Privacy Act ("CCPA") and the California Privacy Rights Act ("CPRA"):

- **Right to Know.** You have the right to request that we disclose the categories and specific pieces of personal information we have collected about you, the categories of sources from which the information was collected, the business purpose for collecting the information, and the categories of third parties with whom we share the information.

- **Right to Delete.** You have the right to request that we delete the personal information we have collected about you, subject to certain exceptions.

- **Right to Correct.** You have the right to request that we correct inaccurate personal information we maintain about you.

- **Right to Opt Out of Sale or Sharing.** We do not sell your personal information and do not share it for cross-context behavioral advertising purposes.

- **Right to Non-Discrimination.** We will not discriminate against you for exercising any of your CCPA/CPRA rights.

**Categories of Personal Information Collected (preceding 12 months):**

| Category | Examples | Collected |
|---|---|---|
| Identifiers | Name, email address, IP address | Yes |
| Commercial information | Subscription plan, payment history | Yes |
| Internet/electronic activity | Usage data, browser info, cookies | Yes |
| Geolocation data | Approximate location from IP address | Yes |
| Professional information | N/A | No |
| Biometric information | N/A | No |
| Sensitive personal information | N/A | No |

To submit a CCPA/CPRA request, contact us at privacy@sharedcontext.com. We will verify your identity before processing your request. You may also designate an authorized agent to make a request on your behalf.

---

## 12. Changes to This Privacy Policy

We may update this Privacy Policy from time to time. If we make material changes, we will notify you by posting the updated policy on our website and updating the "Last Updated" date. For significant changes, we may also notify you via email. Your continued use of the Service after the updated policy takes effect constitutes your acceptance of the changes.

---

## 13. Contact Us

If you have questions, concerns, or requests related to this Privacy Policy or our data practices, please contact us:

**Illuminate LLC**
Email: privacy@sharedcontext.com

---

For questions about the Terms of Use, contact legal@sharedcontext.com.`;

export function PrivacyPolicyPage() {
  usePageTitle('Privacy Policy');
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-white">
      <MarketingNav minimal />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="prose prose-gray max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{PRIVACY_POLICY}</ReactMarkdown>
        </article>
      </main>
      <Footer />
    </div>
  );
}
