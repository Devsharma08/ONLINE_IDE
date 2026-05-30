import React from 'react';

type BentoPixelArtProps = {
  slug: string;
};

// 14x14 Binary Matrices representing key data structures/algorithms in clean retro pixel style

const TREE_MATRIX = [
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,0,0,1,0,0,0],
  [0,0,1,1,1,0,0,0,0,1,1,1,0,0],
  [0,0,1,1,1,0,0,0,0,1,1,1,0,0],
  [0,1,0,0,0,1,0,0,1,0,0,0,1,0],
  [1,1,1,0,1,1,1,1,1,1,0,1,1,1],
  [1,1,1,0,1,1,1,1,1,1,0,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,1,1,0,0,0,1,1,0,0,0,0],
  [0,0,1,1,0,0,0,0,0,1,1,0,0,0],
  [0,0,1,1,1,1,1,1,1,1,1,0,0,0]
];

const DP_MATRIX = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,0,0,0,0,0,0,0,0,1],
  [1,0,1,1,1,1,1,0,0,0,0,0,0,1],
  [1,0,0,0,1,1,1,1,1,0,0,0,0,1],
  [1,0,0,0,0,0,1,1,1,1,1,0,0,1],
  [1,0,0,0,0,0,0,0,1,1,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,1,0,1],
  [1,0,0,0,0,0,0,0,0,0,1,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,0,0,0,0,0,0,0,0,0,0,0,1,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const ARRAY_MATRIX = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,0,1,1,1,1,0,1,1,1],
  [0,1,0,0,1,0,1,0,0,1,0,1,0,0],
  [0,1,0,1,1,0,1,0,1,1,0,1,0,1],
  [0,1,1,1,1,0,1,1,1,1,0,1,1,1],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,1,1,1,1,1,1,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,1,0,0,0,0,0,0,0,0,0,0,1,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,0,1,1,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const LINKED_LIST_MATRIX = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [1,1,1,1,0,0,0,0,1,1,1,1,0,0],
  [1,0,0,1,0,0,0,0,1,0,0,1,0,0],
  [1,1,1,1,1,1,1,0,1,1,1,1,1,1],
  [1,0,0,1,0,0,1,0,1,0,0,1,0,1],
  [1,1,1,1,0,0,0,0,1,1,1,1,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,1,0,0,1,0,0,1,0,0,0,0,0],
  [0,0,1,1,1,1,0,1,0,1,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const SEARCHING_MATRIX = [
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,0,0,0],
  [0,0,0,1,0,0,0,0,1,0,0,1,0,0],
  [0,0,0,0,1,1,1,1,0,0,0,1,0,0],
  [0,0,0,0,0,0,0,0,1,0,0,1,0,0],
  [0,0,0,1,0,0,0,0,0,1,0,1,0,0],
  [0,0,1,1,0,0,0,0,0,0,1,1,0,0],
  [0,1,1,1,0,1,0,0,0,0,1,1,0,0],
  [1,1,1,1,0,1,0,1,0,0,1,1,0,0],
  [1,1,1,1,0,1,0,1,0,1,1,1,0,0],
  [1,1,1,1,0,1,0,1,0,1,1,1,0,0],
  [1,1,1,1,0,1,0,1,0,1,1,1,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1]
];

const MATH_MATRIX = [
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,1,0,1,0,1,0,0,0,0,0,0],
  [0,0,1,0,0,1,0,0,1,0,0,0,0,0],
  [0,1,0,0,0,1,0,0,0,1,0,0,0,0],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [0,1,0,0,0,1,0,0,0,1,0,0,0,0],
  [0,0,1,0,0,1,0,0,1,0,0,0,0,0],
  [0,0,0,1,0,1,0,1,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0]
];

const STACK_MATRIX = [
  [1,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [1,0,0,0,0,1,0,0,1,1,1,1,1,0],
  [1,0,1,1,0,1,0,0,1,0,0,0,1,0],
  [1,0,1,1,0,1,0,0,0,0,1,0,0,0],
  [1,0,0,0,0,1,0,0,1,0,0,0,1,0],
  [1,0,1,1,0,1,0,0,1,1,1,1,1,0],
  [1,0,1,1,0,1,0,0,0,0,0,0,0,0],
  [1,1,1,1,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,1,1,1,0,0,0,0,0,0,0,0,0,0],
  [0,0,1,0,0,0,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,0,0,0,0,0,0,0,0,0]
];

const GREEDY_MATRIX = [
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,1,1,1,1,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,1,1,1,1,1,1,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,1,1,1,1,1,1,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,1,1,1,1,1,1,1,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0],
  [0,0,0,0,0,1,0,0,0,0,0,0,0,0]
];

const MATRIX_MAP: Record<string, number[][]> = {
  'tree': TREE_MATRIX,
  'dynamic-programming': DP_MATRIX,
  'array': ARRAY_MATRIX,
  'linked-list': LINKED_LIST_MATRIX,
  'searching': SEARCHING_MATRIX,
  'math': MATH_MATRIX,
  'stack': STACK_MATRIX,
  'greedy': GREEDY_MATRIX,
};

type ThemeColors = {
  start: { r: number, g: number, b: number },
  end: { r: number, g: number, b: number },
};

// Distinct glowing neon gradient configurations for each category
const THEME_MAP: Record<string, ThemeColors> = {
  'tree': { // Cyan -> Emerald
    start: { r: 34, g: 211, b: 238 },
    end: { r: 16, g: 185, b: 129 }
  },
  'dynamic-programming': { // Cyan -> Purple
    start: { r: 34, g: 211, b: 238 },
    end: { r: 147, g: 51, b: 234 }
  },
  'array': { // Cyan -> Amber
    start: { r: 34, g: 211, b: 238 },
    end: { r: 245, g: 158, b: 11 }
  },
  'linked-list': { // Cyan -> Emerald
    start: { r: 34, g: 211, b: 238 },
    end: { r: 52, g: 211, b: 153 }
  },
  'searching': { // Cyan -> Amber
    start: { r: 34, g: 211, b: 238 },
    end: { r: 217, g: 119, b: 6 }
  },
  'math': { // Emerald -> Amber
    start: { r: 16, g: 185, b: 129 },
    end: { r: 245, g: 158, b: 11 }
  },
  'stack': { // Cyan -> Purple
    start: { r: 34, g: 211, b: 238 },
    end: { r: 139, g: 92, b: 246 }
  },
  'greedy': { // Amber -> Coral Orange
    start: { r: 245, g: 158, b: 11 },
    end: { r: 239, g: 68, b: 68 }
  }
};

export const BentoPixelArt: React.FC<BentoPixelArtProps> = ({ slug }) => {
  const matrix = MATRIX_MAP[slug] || ARRAY_MATRIX;
  const theme = THEME_MAP[slug] || THEME_MAP['array'];

  // Calculate unique float offsets based on the slug string to create natural offset spacing
  const floatDelayOffset = React.useMemo(() => {
    return (slug.charCodeAt(0) % 5) * -0.8;
  }, [slug]);

  // Precompute grid delays and gradients for runtime stability and hydration match
  const pixelMetadata = React.useMemo(() => {
    return matrix.map((row, rowIndex) => {
      return row.map((pixel, colIndex) => {
        if (!pixel) return null;

        // Linear interpolation across columns
        const ratio = colIndex / 13;
        const r = Math.round(theme.start.r + (theme.end.r - theme.start.r) * ratio);
        const g = Math.round(theme.start.g + (theme.end.g - theme.start.g) * ratio);
        const b = Math.round(theme.start.b + (theme.end.b - theme.start.b) * ratio);

        const targetColor = `rgb(${r}, ${g}, ${b})`;
        const targetShadow = `0 0 8px rgba(${r}, ${g}, ${b}, 0.45)`;
        
        const shiverDelay = Math.floor(Math.random() * 2000);

        return {
          targetColor,
          targetShadow,
          shiverDelay
        };
      });
    });
  }, [matrix, theme]);

  return (
    <div 
      className="bento-icon-container relative flex items-center justify-center rounded-xl border border-white/5 bg-[#03060f]/20 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)] backdrop-blur-sm p-3 w-[90px] h-[90px] sm:w-[96px] sm:h-[96px] overflow-hidden select-none transition-all duration-500 group-hover:border-cyan-500/25 group-hover:bg-[#03060f]/60"
      style={{
        backgroundImage: `
          radial-gradient(rgba(255, 255, 255, 0.005) 1px, transparent 1px)
        `,
        backgroundSize: '10px 10px',
        animationDelay: `${floatDelayOffset}s`
      }}
    >
      {/* Dynamic Keyframes that ONLY trigger float and shimmer loops when their parent card (.group) is hovered */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes bentoPixelShimmer {
          0%, 100% {
            opacity: 0.55;
            filter: brightness(0.95);
          }
          50% {
            opacity: 0.95;
            filter: brightness(1.3);
            box-shadow: 0 0 10px var(--color);
          }
        }
        @keyframes bentoIconFloat {
          0%, 100% {
            transform: translateY(0px) scale(1);
            filter: drop-shadow(0 4px 6px rgba(0,0,0,0.3));
          }
          50% {
            transform: translateY(-5px) scale(1.02);
            filter: drop-shadow(0 10px 12px rgba(6,182,212,0.08));
          }
        }
        .bento-icon-container {
          transform: translateY(0px);
          transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.3s, background-color 0.3s;
        }
        .group:hover .bento-icon-container {
          animation: bentoIconFloat 4s ease-in-out infinite;
        }
        .bento-pixel-active {
          background-color: var(--color);
          box-shadow: var(--shadow);
          opacity: 0.55;
          transition: opacity 0.4s ease;
        }
        .group:hover .bento-pixel-active {
          animation: bentoPixelShimmer 3.5s ease-in-out infinite;
        }
      `}} />

      {/* Grid container with custom micro layout spacing */}
      <div className="flex flex-col gap-[1.5px] transition-transform duration-500 ease-in-out group-hover:scale-[1.05]">
        {matrix.map((row, rowIndex) => (
          <div key={`bento-row-${rowIndex}`} className="flex gap-[1.5px]">
            {row.map((pixel, colIndex) => {
              const meta = pixelMetadata[rowIndex][colIndex];

              return (
                <div
                  key={`bento-pixel-${rowIndex}-${colIndex}`}
                  style={
                    pixel && meta
                      ? ({
                          '--color': meta.targetColor,
                          '--shadow': meta.targetShadow,
                          animationDelay: `${meta.shiverDelay}ms`,
                        } as React.CSSProperties)
                      : undefined
                  }
                  className={`h-[4px] w-[4px] sm:h-[4.5px] sm:w-[4.5px] rounded-[0.5px] border-[0.5px] border-transparent ${
                    pixel
                      ? "bento-pixel-active"
                      : "bg-transparent"
                  }`}
                />
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BentoPixelArt;


