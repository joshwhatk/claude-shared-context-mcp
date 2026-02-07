import { useState } from 'react';
import { usePostHog } from 'posthog-js/react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const CONSENT_TEXT =
  'By signing up, I agree to be contacted via email with a confirmation and when a spot is available, and I agree to the Terms of Use and Privacy Policy.';

const LOGIN_OPTIONS = [
  { value: 'google', label: 'Google' },
  { value: 'github', label: 'GitHub' },
  { value: 'microsoft', label: 'Microsoft' },
  { value: 'apple', label: 'Apple' },
];

export function WaitlistSection() {
  const posthog = usePostHog();
  const { ref: sectionRef, isVisible } = useScrollAnimation();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [preferredLogin, setPreferredLogin] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!agreedToTerms) {
      setError('Please agree to the terms to continue.');
      return;
    }

    if (!preferredLogin) {
      setError('Please select your preferred sign-in method.');
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await fetch('/api/waitlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          email: email.trim(),
          preferred_login: preferredLogin,
          consent_text: CONSENT_TEXT,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          setError('This email is already on the waitlist. We\'ll be in touch!');
        } else {
          setError(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }

      posthog?.capture('waitlist_signup', {
        email: email.trim(),
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        preferred_login: preferredLogin,
      });

      setIsSuccess(true);
    } catch {
      setError('Network error. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isSuccess) {
    return (
      <section id="get-started" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
        <div className="max-w-md mx-auto text-center">
          <div className="animate-scale-in w-16 h-16 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
            <svg className="h-8 w-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">You're on the list!</h2>
          <p className="mt-3 text-gray-600">
            We'll send a confirmation to <strong>{email}</strong> and
            let you know when your spot is ready.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section id="get-started" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div
        ref={sectionRef}
        className={`max-w-md mx-auto transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight text-center">
          Get early access
        </h2>
        <p className="mt-3 text-gray-600 text-center">
          Join the waitlist and we'll let you know when your spot is ready.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="first-name" className="block text-sm font-medium text-gray-700 mb-1">
                First name
              </label>
              <input
                id="first-name"
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                         placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
            <div>
              <label htmlFor="last-name" className="block text-sm font-medium text-gray-700 mb-1">
                Last name
              </label>
              <input
                id="last-name"
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                         placeholder:text-gray-400
                         focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                disabled={isSubmitting}
              />
            </div>
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                       placeholder:text-gray-400
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label htmlFor="preferred-login" className="block text-sm font-medium text-gray-700 mb-1">
              Preferred sign-in method
            </label>
            <select
              id="preferred-login"
              required
              value={preferredLogin}
              onChange={(e) => setPreferredLogin(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md
                       text-gray-900
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isSubmitting}
            >
              <option value="">Select...</option>
              {LOGIN_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Consent checkbox */}
          <div className="flex items-start gap-3 pt-2">
            <input
              id="consent"
              type="checkbox"
              checked={agreedToTerms}
              onChange={(e) => setAgreedToTerms(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              disabled={isSubmitting}
            />
            <label htmlFor="consent" className="text-xs text-gray-500 leading-relaxed">
              By signing up, I agree to be contacted via email with a confirmation and when a spot is available, and I agree to the{' '}
              <a href="#" className="text-blue-600 hover:text-blue-800 underline">Terms of Use</a>{' '}
              and{' '}
              <a href="#" className="text-blue-600 hover:text-blue-800 underline">Privacy Policy</a>.
            </label>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-md px-4 py-3 text-sm">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full px-4 py-3 text-sm font-medium text-white bg-blue-600 rounded-md
                     hover:bg-blue-700 transition-colors cursor-pointer
                     disabled:opacity-50 disabled:cursor-not-allowed
                     focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            {isSubmitting ? 'Joining...' : 'Join the Waitlist'}
          </button>
        </form>
      </div>
    </section>
  );
}
