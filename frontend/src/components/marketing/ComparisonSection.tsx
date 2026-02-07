import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const COMPARISONS = [
  {
    title: 'Claude Memory',
    whatItDoes:
      'Claude automatically summarizes what it thinks is important from your conversations.',
    limitation:
      "You don't control what's saved, how it's worded, or what gets left out. It's the AI's notes about you, not yours.",
    limitationLabel: 'The limitation',
  },
  {
    title: 'Project Instructions',
    whatItDoes:
      'Static text that Claude reads at the start of every conversation in a Project.',
    limitation:
      "Read-only. Claude can't update them as decisions evolve. Hard to manage at scale and works best with small amounts of information.",
    limitationLabel: 'The limitation',
  },
  {
    title: 'CLAUDE.md',
    whatItDoes:
      "A file in your codebase that gives Claude context about your project's code and conventions.",
    limitation:
      "Tied to a specific codebase. Not designed for documents, decisions, or anything you'd want to discuss from different angles or in different tools.",
    limitationLabel: 'The limitation',
  },
  {
    title: 'Shared Context',
    whatItDoes:
      'A personal read-write knowledge base that Claude can read from and write to at your direction.',
    limitation:
      "You decide what's saved and how. Entries are living documents that update as your work evolves. Anything you create in one chat can live on in every future conversation, no matter the topic, the project, or even the AI tool.",
    limitationLabel: 'What makes it different',
    highlight: true,
  },
];

const DELAY_CLASSES = ['', 'delay-100', 'delay-200', 'delay-300'] as const;

export function ComparisonSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="how-its-different" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto" ref={ref}>
        <h2
          className={`text-3xl font-bold text-gray-900 tracking-tight transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          You've tried the workarounds.
        </h2>
        <p
          className={`mt-4 text-lg text-gray-600 max-w-2xl transition-all duration-700 delay-75 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          Here's how Shared Context compares to the tools you're already using.
        </p>

        <div className="mt-12 grid md:grid-cols-2 gap-6">
          {COMPARISONS.map((card, i) => (
            <div
              key={card.title}
              className={`rounded-lg border p-6 transition-all duration-700 ${DELAY_CLASSES[i]} ${
                isVisible
                  ? 'opacity-100 translate-y-0'
                  : 'opacity-0 translate-y-8'
              } ${
                card.highlight
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-white border-gray-200'
              }`}
            >
              <h3
                className={`text-lg font-semibold ${
                  card.highlight ? 'text-blue-900' : 'text-gray-900'
                }`}
              >
                {card.title}
              </h3>
              <p className="mt-3 text-sm text-gray-600">
                <span className="font-medium text-gray-700">
                  What it does:
                </span>{' '}
                {card.whatItDoes}
              </p>
              <p className="mt-2 text-sm text-gray-600">
                <span
                  className={`font-medium ${
                    card.highlight ? 'text-blue-700' : 'text-gray-700'
                  }`}
                >
                  {card.limitationLabel}:
                </span>{' '}
                {card.limitation}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
