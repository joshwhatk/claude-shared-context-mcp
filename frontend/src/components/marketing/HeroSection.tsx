export function HeroSection() {
  const scrollToGetStarted = () => {
    const el = document.getElementById('get-started');
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Copy */}
          <div>
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 leading-tight tracking-tight">
              Persistent context across Claude conversations
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
              Save decisions, templates, and project knowledge once. Every new
              Claude chat picks up right where you left off — no more
              re-explaining your stack, your style, or your intent.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={scrollToGetStarted}
                className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Join the Waitlist
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('how-it-works');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                How it works
              </button>
            </div>
          </div>

          {/* Visual — animated chat nodes */}
          <div className="relative hidden lg:block" aria-hidden="true">
            <HeroVisual />
          </div>
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full h-80">
      <svg
        viewBox="0 0 400 300"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dashed connection lines */}
        <line
          x1="90" y1="60" x2="200" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line"
        />
        <line
          x1="90" y1="150" x2="200" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line [animation-delay:200ms]"
        />
        <line
          x1="90" y1="240" x2="200" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line [animation-delay:400ms]"
        />

        {/* Chat nodes (left) */}
        <g className="animate-fade-in-up">
          <rect x="20" y="38" width="140" height="44" rx="8" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
          <text x="90" y="65" textAnchor="middle" className="text-xs fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 1</text>
        </g>
        <g className="animate-fade-in-up [animation-delay:150ms]">
          <rect x="20" y="128" width="140" height="44" rx="8" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
          <text x="90" y="155" textAnchor="middle" className="text-xs fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 2</text>
        </g>
        <g className="animate-fade-in-up [animation-delay:300ms]">
          <rect x="20" y="218" width="140" height="44" rx="8" fill="#f3f4f6" stroke="#d1d5db" strokeWidth="1" />
          <text x="90" y="245" textAnchor="middle" className="text-xs fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 3</text>
        </g>

        {/* Central node */}
        <g className="animate-fade-in-up [animation-delay:500ms]">
          <rect x="190" y="115" width="190" height="70" rx="12" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
          <text x="285" y="147" textAnchor="middle" className="fill-blue-700 font-medium" fontSize="14" fontFamily="system-ui">Shared Context</text>
          <text x="285" y="167" textAnchor="middle" className="fill-blue-400" fontSize="11" fontFamily="system-ui">always available</text>
        </g>
      </svg>
    </div>
  );
}
