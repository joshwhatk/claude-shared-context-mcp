import { useScrollAnimation } from '../../hooks/useScrollAnimation';

export function ProblemSection() {
  const { ref, isVisible } = useScrollAnimation();

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div
          ref={ref}
          className={`max-w-2xl transition-all duration-700 ${
            isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'
          }`}
        >
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Every new conversation starts from zero. And right now, you can't fix that.
          </h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            You've spent hours refining the perfect prompt. You've explained your
            architecture, your workflow, your preferences. Then you open a new
            chat and Claude has no idea who you are. All that context, gone.
          </p>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Right now, you don't have a good way to fix this. Claude's built-in
            Memory decides on its own what's worth remembering, then summarizes
            it however it sees fit. Project Instructions are static and
            read-only, so Claude can't update them as your decisions evolve.
            CLAUDE.md files are locked to a single codebase. Every option
            available to you today either takes the control out of your hands or
            limits where your context can go.
          </p>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            <strong>Shared Context MCP changes that.</strong> It's a read-write knowledge base that
            you control. You decide what gets saved. You decide how it's
            structured. You decide when it gets updated. And every conversation,
            whether it's your first or your fiftieth, has access to all of it.
          </p>
        </div>
      </div>
    </section>
  );
}
