export function ProblemSection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
      <div className="max-w-6xl mx-auto">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-bold text-gray-900 tracking-tight">
            Every new conversation starts from zero
          </h2>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            You've spent hours refining the perfect prompt. You've explained your
            architecture, your coding style, your constraints. Then you open a new
            chat — and Claude has no idea who you are.
          </p>
          <p className="mt-4 text-lg text-gray-600 leading-relaxed">
            Project instructions help, but they're read-only. You can't have
            Claude update them as decisions evolve. Shared Context changes that.
            It's a read-write layer that persists across every conversation — a
            living memory that grows with your work.
          </p>
        </div>
      </div>
    </section>
  );
}
