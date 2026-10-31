export function ThemeScene({ theme }: { theme: string }) {
  const newTheme = ["love", "football", "cosmic", "arcade"].includes(theme);
  if (!newTheme) return null;
  return (
    <div
      className={"theme-scene scene-" + theme}
      aria-hidden="true"
      data-scene={theme}
    >
      {theme === "love" && (
        <>
          {Array.from({ length: 12 }, (_, i) => (
            <svg
              className="ambient-heart"
              key={i}
              viewBox="0 0 40 40"
              style={
                {
                  left: (i % 2 ? 82 + (i % 5) : 3 + (i % 5) * 4) + "%",
                  top: ((8 + i * 13) % 92) + "%",
                  "--delay": -i * 1.7 + "s",
                  "--duration": 15 + (i % 4) * 3 + "s",
                  width: 20 + (i % 4) * 13,
                } as React.CSSProperties
              }
            >
              <path d="M20 34 5 19C-5 7 13-1 20 10 27-1 45 7 35 19Z" />
            </svg>
          ))}
          <span className="love-ribbon ribbon-one" />
          <span className="love-ribbon ribbon-two" />
        </>
      )}
      {theme === "football" && (
        <>
          <div className="stadium-light light-left" />
          <div className="stadium-light light-right" />
          <svg
            className="pitch-lines"
            viewBox="0 0 1000 650"
            preserveAspectRatio="xMidYMid meet"
          >
            <rect x="40" y="35" width="920" height="580" rx="4" />
            <path d="M500 35V615" />
            <circle cx="500" cy="325" r="85" />
            <circle cx="500" cy="325" r="3" />
            <path d="M40 175H180V475H40M960 175H820V475H960M40 245H95V405H40M960 245H905V405H960" />
          </svg>
          <span className="ambient-football">⚽</span>
          <span className="pitch-caption">GOOD COMPANY. GREAT GAME.</span>
        </>
      )}
      {theme === "cosmic" && (
        <>
          <div className="cosmic-orbit">
            <span />
            <i />
          </div>
          <div className="cosmic-haze" />
          {Array.from({ length: 28 }, (_, i) => (
            <i
              className="cosmic-star"
              key={i}
              style={
                {
                  left: ((i * 37 + 5) % 100) + "%",
                  top: ((i * 23 + 7) % 94) + "%",
                  width: i % 3 === 0 ? 3 : 2,
                  height: i % 3 === 0 ? 3 : 2,
                  "--delay": -i * 0.7 + "s",
                } as React.CSSProperties
              }
            />
          ))}
        </>
      )}
      {theme === "arcade" && (
        <>
          <div className="arcade-grid" />
          <div className="arcade-sun" />
          <span className="arcade-pixel pixel-one">✦</span>
          <span className="arcade-pixel pixel-two">✦</span>
          <span className="arcade-corner">INSERT GOOD VIBES</span>
        </>
      )}
    </div>
  );
}
