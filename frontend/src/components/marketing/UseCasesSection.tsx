import { useState } from 'react';
import { useScrollAnimation } from '../../hooks/useScrollAnimation';

const USE_CASES = [
  {
    tab: 'Repeatable Workflows',
    title: 'Turn one-off work into something you can reuse forever',
    description:
      'You write the perfect email template, a thorough code review checklist, or a weekly report format. Instead of losing it when the chat ends, you save it to Shared Context with instructions for how Claude should use it. Then you point a Project at that key, and every new chat in that Project produces consistent output, no setup required. Over time, you refine the template based on results. It gets better every week.',
    example:
      '"Save my client update email template with instructions" \u2192 Next week: "Write this week\'s client update" \u2192 Claude already knows the format, the tone, and your preferences.',
  },
  {
    tab: 'Multi-Angle Thinking',
    title: 'Spread your thinking across as many conversations as you need',
    description:
      'Big ideas don\'t fit in a single chat. You generate a document in one conversation, critique it from the perspective of an expert communicator in another, then produce the final deliverable in a third. Shared Context holds the source material steady while you approach it from every angle. You\'re no longer constrained by how much a single conversation can hold.',
    example:
      'Chat 1: "Generate my project proposal and save it." Chat 2: "Read my proposal and critique it as a skeptical investor." Chat 3: "Create the presentation deck based on the revised proposal."',
  },
  {
    tab: 'Living Knowledge Base',
    title: 'Build a personal reference library that grows with you',
    description:
      'You analyze your calendar and set goals for the week. You save that summary to Shared Context. Later, from any conversation, you can pull it up, ask about your priorities, adjust the plan, or use it as input for something else entirely. Over time, these entries accumulate — project decisions, workflow preferences, templates, conventions, reference material. A knowledge base that\'s always current because you keep it current.',
    example:
      'Monday: "Analyze my calendar and save my weekly plan." Wednesday: "What did I say my priorities were this week?" Friday: "Update the weekly plan with what actually happened."',
  },
  {
    tab: 'Developer Workflows',
    title: 'Persistent context for code decisions, conventions, and patterns',
    description:
      'Save your PR description template, your error handling conventions, or your architectural decisions. Every chat in every project can reference them. Unlike CLAUDE.md, these aren\'t tied to a single codebase. Unlike Project Instructions, Claude can update them as patterns evolve. It\'s the middle ground between a chat that forgets and a codebase that\'s too rigid.',
    example:
      '"Save our API design decisions" \u2192 New chats across any project reference them automatically. "Update the error handling conventions based on what we just learned" \u2192 Done.',
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
          Shared Context adapts to how you work. Here are some real examples.
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

        {/* Tab content with slide transition */}
        <div className="mt-8 relative overflow-hidden">
          {USE_CASES.map((uc, i) => (
            <div
              key={i}
              className={`transition-all duration-300 ease-out ${
                activeTab === i
                  ? 'opacity-100 translate-x-0'
                  : 'absolute inset-0 opacity-0 translate-x-4 pointer-events-none'
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
