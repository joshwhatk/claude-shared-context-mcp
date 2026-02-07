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
              Take control of what AI remembers.
            </h1>
            <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-lg">
              Stop re-explaining yourself every time you open a new chat. Shared
              Context is your personal knowledge base that Claude can read and
              write, so every conversation starts informed, not from scratch.
            </p>
            <div className="mt-8 flex flex-wrap gap-4">
              <button
                onClick={scrollToGetStarted}
                className="px-6 py-3 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 transition-colors cursor-pointer"
              >
                Get Early Access
              </button>
              <button
                onClick={() => {
                  const el = document.getElementById('how-its-different');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-6 py-3 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors cursor-pointer"
              >
                See how it's different
              </button>
            </div>
          </div>

          {/* Visual — animated chat nodes */}
          <div className="relative hidden lg:block" aria-hidden="true">
            <HeroVisual />
          </div>
        </div>

        {/* Mobile visual (simplified) */}
        <div className="mt-12 lg:hidden" aria-hidden="true">
          <HeroVisualMobile />
        </div>
      </div>
    </section>
  );
}

function HeroVisual() {
  return (
    <div className="relative w-full h-80">
      <svg
        viewBox="0 0 420 300"
        className="w-full h-full"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {/* Dashed connection lines */}
        <line
          x1="95" y1="60" x2="210" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line"
        />
        <line
          x1="95" y1="150" x2="210" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line [animation-delay:200ms]"
        />
        <line
          x1="95" y1="240" x2="210" y2="150"
          stroke="#93c5fd" strokeWidth="1.5" strokeDasharray="6 4"
          className="animate-draw-line [animation-delay:400ms]"
        />

        {/* Chat nodes (left) */}
        <g className="animate-fade-in-up">
          <rect x="20" y="38" width="150" height="44" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
          <text x="95" y="65" textAnchor="middle" className="fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 1</text>
        </g>
        <g className="animate-fade-in-up [animation-delay:150ms]">
          <rect x="20" y="128" width="150" height="44" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
          <text x="95" y="155" textAnchor="middle" className="fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 2</text>
        </g>
        <g className="animate-fade-in-up [animation-delay:300ms]">
          <rect x="20" y="218" width="150" height="44" rx="8" fill="#f9fafb" stroke="#e5e7eb" strokeWidth="1" />
          <text x="95" y="245" textAnchor="middle" className="fill-gray-500" fontSize="13" fontFamily="system-ui">Chat 3</text>
        </g>

        {/* Central node with pulse ring */}
        <g className="animate-fade-in-up [animation-delay:500ms]">
          <rect x="200" y="115" width="200" height="70" rx="12" fill="#eff6ff" stroke="#3b82f6" strokeWidth="1.5" />
          <rect x="200" y="115" width="200" height="70" rx="12" fill="none" stroke="#93c5fd" strokeWidth="1" className="animate-pulse opacity-50" />
          <text x="300" y="147" textAnchor="middle" className="fill-blue-700 font-medium" fontSize="14" fontFamily="system-ui">Shared Context</text>
          <text x="300" y="167" textAnchor="middle" className="fill-blue-400" fontSize="11" fontFamily="system-ui">always available</text>
        </g>
      </svg>
    </div>
  );
}

function HeroVisualMobile() {
  return (
    <div className="flex flex-col items-center gap-3">
      {/* Chat nodes */}
      {['Chat 1', 'Chat 2', 'Chat 3'].map((label, i) => (
        <div
          key={label}
          className={`animate-fade-in-up flex items-center gap-3`}
          style={{ animationDelay: `${i * 150}ms` }}
        >
          <div className="px-6 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
            {label}
          </div>
          <svg className="h-4 w-4 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      ))}
      {/* Central node */}
      <div className="animate-fade-in-up mt-2 px-8 py-3 bg-blue-50 border border-blue-300 rounded-xl text-sm font-medium text-blue-700" style={{ animationDelay: '500ms' }}>
        Shared Context
      </div>
    </div>
  );
}
