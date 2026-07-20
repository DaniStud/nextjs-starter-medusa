import Image from "next/image"

const HEADLINE = "LATEST CULTURE IS HERE"

/**
 * Veon-style full-viewport hero.
 *
 * Server component — all motion is pure CSS (staggered word reveal like the
 * Veon template's letter animation, bouncing scroll indicator), disabled
 * under `prefers-reduced-motion`.
 */
const Hero = () => {
  const words = HEADLINE.split(" ")

  return (
    <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden">
      {/* Background image + dark overlay */}
      <Image
        src="/images/veon-placeholder.jpg"
        alt=""
        fill
        priority
        sizes="100vw"
        className="object-cover object-center"
      />
      <div className="absolute inset-0 bg-black/50" aria-hidden="true" />

      {/* Content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6 text-center">
        <h1
          className="mb-6 font-heading font-bold uppercase leading-[1.05] tracking-tight text-white text-[13vw] xsmall:text-6xl small:text-7xl medium:text-[76px]"
          aria-label={HEADLINE}
        >
          {words.map((word, i) => (
            <span
              key={i}
              className="inline-block overflow-hidden pb-[0.08em] align-top"
              aria-hidden="true"
            >
              <span
                className="hero-word inline-block will-change-transform"
                style={{ animationDelay: `${150 + i * 110}ms` }}
              >
                {word}
              </span>
              {i < words.length - 1 && "\u00A0"}
            </span>
          ))}
        </h1>

        <p
          className="hero-fade mb-10 max-w-xl text-base small:text-lg text-white/85"
          style={{ animationDelay: "650ms" }}
        >
          Bold pieces designed to layer, mix and stand out — discover the
          newest drops from 10shirts, all season long.
        </p>

        <div
          className="hero-fade flex flex-col items-center gap-4 xsmall:flex-row"
          style={{ animationDelay: "800ms" }}
        >
          <a
            href="#shop"
            className="rounded-full bg-brand px-10 py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-brand-dark"
          >
            Shop Men
          </a>
          <a
            href="#shop"
            className="rounded-full border border-white px-10 py-3.5 text-sm font-medium uppercase tracking-widest text-white transition-colors hover:bg-white hover:text-gray-900"
          >
            Shop Women
          </a>
        </div>
      </div>

      {/* Scroll-down indicator */}
      <a
        href="#shop"
        aria-label="Scroll down to shop"
        className="hero-fade absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-white/80 transition-colors hover:text-white"
        style={{ animationDelay: "1100ms" }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="hero-bounce h-8 w-8"
          aria-hidden="true"
        >
          <path d="M12 5v14" />
          <path d="m19 12-7 7-7-7" />
        </svg>
      </a>

      <style>{`
        .hero-word {
          transform: translateY(110%);
          animation: hero-word-up 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .hero-fade {
          opacity: 0;
          animation: hero-fade-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .hero-bounce {
          animation: hero-bounce 2s ease-in-out infinite;
        }
        @keyframes hero-word-up {
          to { transform: translateY(0); }
        }
        @keyframes hero-fade-in {
          from { opacity: 0; transform: translateY(1rem); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes hero-bounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(8px); }
        }
        @media (prefers-reduced-motion: reduce) {
          .hero-word, .hero-fade { animation: none; transform: none; opacity: 1; }
          .hero-bounce { animation: none; }
        }
      `}</style>
    </section>
  )
}

export default Hero
