import { useState } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const USE_CASES = [
  {
    tab: 'Repeatable Templates',
    title: 'Turn one-off work into repeatable assets',
    description:
      'You write a perfect PR description template, a thorough code review checklist, or a commit message format. Instead of losing it when the chat ends, save it to Shared Context. Next time you need it, Claude already knows the format — just ask.',
    example:
      '"Save my PR template to shared context" → Claude writes it once, uses it every time.',
  },
  {
    tab: 'Multi-Phase Projects',
    title: 'Keep project momentum across conversations',
    description:
      'Big projects span many conversations. You make architectural decisions in one chat, implement in another, debug in a third. Shared Context lets you save decisions and progress notes so every new chat starts with full project awareness.',
    example:
      '"Save our API design decisions" → New chats reference them automatically.',
  },
  {
    tab: 'Bridge to Code',
    title: 'A staging area between chat and codebase',
    description:
      'Not every insight belongs in a code comment or CLAUDE.md. Shared Context is the middle ground — more structured than a chat, more flexible than code. Store coding conventions, API patterns, or team agreements that Claude should always follow.',
    example:
      '"Save our error handling conventions" → Claude applies them in every chat.',
  },
  {
    tab: 'Living Knowledge Base',
    title: 'Build institutional knowledge that grows',
    description:
      'Over time, your Shared Context becomes a living reference. Update entries as patterns evolve, add new ones as you learn, and deprecate what no longer applies. It\'s version-controlled and auditable — a knowledge base that keeps up with your work.',
    example:
      '"Update the deployment checklist with the new monitoring step" → Done.',
  },
];

export function UseCasesSection() {
  const [activeTab, setActiveTab] = useState(0);
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section id="use-cases" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div
        ref={ref}
        className={`max-w-6xl mx-auto transition-all duration-700 ${
          isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
        }`}
      >
        <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
          Use cases
        </h2>
        <p className="mt-4 text-lg text-gray-600 max-w-2xl">
          Shared Context adapts to how you work. Here are a few ways people use it.
        </p>

        {/* Tabs */}
        <div className="mt-10 border-b border-gray-200">
          <div className="flex gap-0 overflow-x-auto -mb-px">
            {USE_CASES.map((uc, i) => (
              <button
                key={i}
                onClick={() => setActiveTab(i)}
                className={`whitespace-nowrap px-5 py-3 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
                  activeTab === i
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {uc.tab}
              </button>
            ))}
          </div>
        </div>

        {/* Tab content */}
        <div className="mt-8">
          {USE_CASES.map((uc, i) => (
            <div
              key={i}
              className={`transition-opacity duration-200 ${
                activeTab === i ? 'opacity-100' : 'hidden opacity-0'
              }`}
            >
              <div className="max-w-2xl">
                <h3 className="text-xl font-semibold text-gray-900">
                  {uc.title}
                </h3>
                <p className="mt-4 text-gray-600 leading-relaxed">
                  {uc.description}
                </p>
                <div className="mt-6 bg-white rounded-lg border border-gray-200 px-5 py-4">
                  <p className="text-sm text-gray-700 italic">{uc.example}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
