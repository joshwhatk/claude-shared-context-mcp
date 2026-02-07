import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const STEPS = [
  {
    title: 'Save what matters',
    description:
      'When Claude produces something worth keeping, whether it\'s a decision record, a reusable template, a set of conventions, or a weekly plan, you tell it to save that to Shared Context. You choose the key, the structure, and the level of detail. Nothing is summarized or discarded unless you say so.',
    icon: (
      <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
  {
    title: 'Pick up anywhere',
    description:
      'Open a brand new conversation. Open five at once. Claude can read your saved context instantly in any of them. No copy-paste. No re-explaining. You can even approach the same material from completely different angles in parallel — one chat to generate, another to critique, another to refine.',
    icon: (
      <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
      </svg>
    ),
  },
  {
    title: 'Build over time',
    description:
      'Your context entries are living documents. Update them as your projects evolve, add new ones as you learn, deprecate what no longer applies. Over weeks and months, you\'re building a personal knowledge base that makes every future conversation smarter than the last.',
    icon: (
      <svg className="h-8 w-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    ),
  },
];

const DELAY_CLASSES = ['', 'delay-100', 'delay-200'] as const;

export function HowItWorksSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <h2 className={`text-3xl font-bold text-gray-900 tracking-tight transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          How it works
        </h2>
        <p className={`mt-4 text-lg text-gray-600 max-w-2xl transition-all duration-700 delay-75 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}>
          Shared Context uses the Model Context Protocol (MCP), an open standard
          that lets AI assistants connect to external tools and data sources.
          That means your knowledge base isn't locked inside one app — any AI
          that supports MCP can access what you've saved.
        </p>

        <div className="mt-12 grid md:grid-cols-3 gap-8">
          {STEPS.map((step, i) => (
            <div
              key={i}
              className={`flex flex-col transition-all duration-700 ${DELAY_CLASSES[i]} ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
              }`}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="flex-shrink-0 w-12 h-12 rounded-lg bg-blue-50 flex items-center justify-center">
                  {step.icon}
                </div>
                <span className="text-sm font-medium text-blue-600">Step {i + 1}</span>
              </div>
              <h3 className="text-lg font-semibold text-gray-900">{step.title}</h3>
              <p className="mt-2 text-gray-600 leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
