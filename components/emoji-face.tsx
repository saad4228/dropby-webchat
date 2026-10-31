import { useId } from "react";
import type { EmojiExpression } from "../lib/emoji-expressions";

// Original vector faces animate their eyes, mouth and tears; the stored message stays Unicode.
export function EmojiFace({
  expression,
  emoji,
}: {
  expression: EmojiExpression;
  emoji: string;
}) {
  const id = "face-" + useId().replace(/[^a-z0-9]/gi, ""),
    cry = ["cry", "sob", "tear-smile"].includes(expression),
    laugh = ["laugh", "laugh-tears", "party"].includes(expression),
    love = expression === "love",
    angry = expression === "angry",
    sad = cry || expression === "sad",
    sleep = expression === "sleep",
    surprise = expression === "surprise",
    sick = expression === "sick",
    cold = expression === "cold",
    hot = expression === "hot",
    tongue = expression === "tongue",
    kiss = expression === "kiss";
  const start = angry
      ? "#ffbb61"
      : sick
        ? "#d8e97b"
        : cold
          ? "#b2eeff"
          : hot
            ? "#ffd36a"
            : "#ffe58b",
    end = angry
      ? "#ee6b39"
      : sick
        ? "#a1c353"
        : cold
          ? "#68b8ee"
          : hot
            ? "#f3873d"
            : "#ffc243";
  const heart = (x: number, y: number) => (
    <path
      d="M0 3C-6-4-12 4-7 9L0 15 7 9C12 4 6-4 0 3Z"
      transform={`translate(${x} ${y}) scale(.65)`}
      fill="#ee4567"
    />
  );
  return (
    <svg
      className={
        "sent-emoji-art expression-" +
        expression +
        (emoji === "🤣" ? " rolling-laugh" : "")
      }
      data-expression={expression}
      viewBox="0 0 72 72"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={id} cx="36%" cy="25%" r="82%">
          <stop stopColor={start} />
          <stop offset="1" stopColor={end} />
        </radialGradient>
      </defs>
      <g className="face-body">
        <circle
          cx="36"
          cy="36"
          r="28"
          fill={`url(#${id})`}
          stroke={cold ? "#69b1d8" : sick ? "#a7bd4b" : "#e9ac32"}
          strokeWidth=".8"
        />
        <ellipse
          cx="24"
          cy="17"
          rx="10"
          ry="4"
          fill="#fff"
          opacity=".18"
          transform="rotate(-25 24 17)"
        />
        {(expression === "smile" ||
          expression === "shy" ||
          love ||
          kiss ||
          expression === "tear-smile") && (
          <g fill="#f3917e" opacity=".6">
            <ellipse cx="19" cy="41" rx="5.5" ry="3" />
            <ellipse cx="53" cy="41" rx="5.5" ry="3" />
          </g>
        )}
        <g
          className="face-eyes"
          fill="#624025"
          stroke="#624025"
          strokeWidth="3.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {love ? (
            <g className="face-love-eyes" stroke="none">
              {heart(25, 24)}
              {heart(47, 24)}
            </g>
          ) : expression === "cool" ? (
            <g className="face-shades" strokeWidth="2">
              <path d="M12 26H60M32 30Q36 27 40 30" fill="none" />
              <path
                d="M16 26H32V33Q31 40 25 40Q18 40 17 34ZM40 26H56L55 34Q54 40 47 40Q41 40 40 33Z"
                fill="#303340"
              />
              <path
                className="shade-glint"
                d="M19 29L24 35M44 29L49 35"
                stroke="#91c5d7"
                strokeWidth="1.8"
              />
            </g>
          ) : laugh ||
            sleep ||
            sad ||
            expression === "smile" ||
            expression === "shy" ? (
            <g
              fill="none"
              className={
                sad
                  ? "face-sad-eyes"
                  : sleep
                    ? "face-sleep-eyes"
                    : "face-happy-eyes"
              }
            >
              {sad ? (
                <>
                  <path d="M19 31Q25 36 30 30" />
                  <path d="M42 30Q47 36 53 31" />
                </>
              ) : sleep ? (
                <>
                  <path d="M20 31Q25 34 30 31" />
                  <path d="M42 31Q47 34 52 31" />
                </>
              ) : (
                <>
                  <path d="M19 32Q25 24 31 32" />
                  <path d="M41 32Q47 24 53 32" />
                </>
              )}
            </g>
          ) : surprise ? (
            <g className="face-wide-eyes" stroke="none">
              <ellipse cx="25" cy="31" rx="6" ry="8" fill="#fff9e5" />
              <ellipse cx="47" cy="31" rx="6" ry="8" fill="#fff9e5" />
              <ellipse cx="25" cy="32" rx="3" ry="5" />
              <ellipse cx="47" cy="32" rx="3" ry="5" />
            </g>
          ) : (
            <g className="face-blinking-eyes" stroke="none">
              {expression === "wink" || emoji === "😜" ? (
                <path d="M18 31Q24 27 30 32" fill="none" stroke="#624025" />
              ) : (
                <ellipse cx="25" cy="31" rx="3" ry={angry ? 3 : 4} />
              )}
              <ellipse cx="47" cy="31" rx="3" ry="4" />
            </g>
          )}
          {(sad ||
            angry ||
            expression === "worry" ||
            surprise ||
            expression === "think") && (
            <g className="face-brows" fill="none" strokeWidth="2.4">
              {angry ? (
                <>
                  <path d="M18 22L30 27" />
                  <path d="M42 27L54 22" />
                </>
              ) : sad || expression === "worry" ? (
                <>
                  <path d="M19 23Q25 24 30 20" />
                  <path d="M42 20Q47 24 53 23" />
                </>
              ) : (
                <>
                  <path d="M19 22Q25 17 30 21" />
                  <path d="M42 21Q47 17 53 22" />
                </>
              )}
            </g>
          )}
        </g>
        <g
          className="face-mouth"
          fill="#64372e"
          strokeLinejoin="round"
          strokeLinecap="round"
        >
          {laugh ? (
            <g className="face-laughing-mouth">
              <path d="M19 39Q36 45 53 39Q52 61 36 61Q20 61 19 39Z" />
              <path d="M22 42Q36 46 50 42L48 47Q36 50 24 47Z" fill="#fff9e8" />
              <path d="M26 57Q36 50 46 57Q36 63 26 57Z" fill="#f78388" />
            </g>
          ) : expression === "sob" ? (
            <ellipse
              className="face-sobbing-mouth"
              cx="36"
              cy="49"
              rx="8"
              ry="11"
            />
          ) : surprise || sleep || hot ? (
            <ellipse
              className="face-o-mouth"
              cx="36"
              cy="48"
              rx={sleep ? 4 : 7}
              ry={sleep ? 5 : 10}
            />
          ) : kiss ? (
            <path
              className="face-kissing-mouth"
              d="M33 41Q43 41 36 46Q44 50 34 52"
              fill="none"
              stroke="#78412e"
              strokeWidth="3"
            />
          ) : tongue ? (
            <g>
              <path d="M22 42Q36 56 50 42Q48 56 36 57Q24 55 22 42Z" />
              <path
                className="face-tongue"
                d="M30 48H43V56Q36 68 30 56Z"
                fill="#ed7883"
              />
              <path d="M36 51V59" stroke="#c65f71" strokeWidth="1.3" />
            </g>
          ) : expression === "zip" ? (
            <g stroke="#795342" strokeWidth="2">
              <path d="M23 47H49" />
              <path
                className="face-zip"
                d="M26 44V50M31 44V50M36 44V50M41 44V50M46 44V50"
              />
            </g>
          ) : expression === "neutral" ||
            expression === "think" ||
            sick ||
            cold ||
            angry ? (
            <g>
              <path
                d={
                  angry
                    ? "M24 48Q36 41 48 48"
                    : sick
                      ? "M24 49Q30 43 36 48Q42 53 48 47"
                      : "M25 47H47"
                }
                fill="none"
                stroke="#68412c"
                strokeWidth="3"
              />
              {cold && (
                <path
                  d="M25 44H47V51H25Z M29 44V51M34 44V51M39 44V51M44 44V51"
                  fill="#fff"
                  stroke="#65809a"
                  strokeWidth="1.3"
                />
              )}
            </g>
          ) : (sad && expression !== "tear-smile") || expression === "worry" ? (
            <path
              d="M25 49Q36 40 47 49"
              fill="none"
              stroke="#75462e"
              strokeWidth="3"
            />
          ) : (
            <g className="face-smiling-mouth">
              <path d="M23 42Q36 58 49 42Q36 49 23 42Z" />
              <path
                d="M26 44Q36 48 46 44"
                fill="none"
                stroke="#fff9e7"
                strokeWidth="2"
              />
            </g>
          )}
        </g>
        {(cry || expression === "laugh-tears") && (
          <g
            className="face-tears"
            fill="#67c9fa"
            stroke="#3badee"
            strokeWidth=".6"
          >
            {expression === "sob" ? (
              <>
                <path
                  className="tear-stream"
                  d="M22 34Q24 36 27 34L28 55Q25 60 22 55Z"
                />
                <path
                  className="tear-stream"
                  d="M45 34Q48 36 50 34L50 55Q47 60 44 55Z"
                />
                <path
                  className="tear-ripple"
                  d="M24 37V53M47 37V53"
                  fill="none"
                  stroke="#d8f6ff"
                  strokeWidth="1.5"
                  strokeDasharray="4 5"
                />
              </>
            ) : null}
            {(expression === "tear-smile" ? [47] : [22, 50]).map((x, i) => (
              <path
                className={"tear-drop tear-drop-" + i}
                key={x}
                d={`M${x} 33Q${x - 6} 42 ${x} 45Q${x + 6} 42 ${x} 33Z`}
              />
            ))}
          </g>
        )}
        {(expression === "worry" || hot) && (
          <path
            className="face-sweat"
            d="M55 19Q46 30 54 33Q62 31 55 19Z"
            fill="#74cffa"
            stroke="#3badee"
            strokeWidth=".6"
          />
        )}
        {kiss && <g className="face-kiss-heart">{heart(57, 37)}</g>}
        {sleep && (
          <g
            className="face-sleep-z"
            stroke="#739ab9"
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
          >
            <path d="M53 16H61L53 23H61M60 7H66L60 12H66" />
          </g>
        )}
        {expression === "party" && (
          <g className="face-confetti">
            <path d="M9 18L17 5L24 23Z" fill="#a68ae4" />
            <path d="M13 13L20 16" stroke="#e8c8fa" strokeWidth="2" />
            <path
              d="M49 9L53 13M62 21L67 18M7 42L3 46M61 48L65 52"
              stroke="#e47c9b"
              strokeWidth="2.8"
            />
            <path
              d="M38 5L37 10M3 29L8 27"
              stroke="#68b6d8"
              strokeWidth="2.8"
            />
          </g>
        )}
        {(expression === "shy" ||
          expression === "think" ||
          expression === "shush") && (
          <g
            className="face-hand"
            fill="#ffd771"
            stroke="#e5aa3e"
            strokeWidth="1.2"
          >
            {expression === "shush" ? (
              <path d="M36 59V39Q39 34 42 39V48Q48 44 51 50L48 63H37Z" />
            ) : expression === "think" ? (
              <path d="M33 58Q31 54 36 52L46 50L46 42Q50 38 52 44L51 57Q47 66 36 63Z" />
            ) : (
              <path d="M26 46Q27 42 31 44L43 47Q51 49 48 56L40 62L28 56Z" />
            )}
          </g>
        )}
        {angry && (
          <g
            className="face-anger-mark"
            fill="none"
            stroke="#ba542f"
            strokeWidth="2"
          >
            <path d="M53 12V17H58M61 20H56V25" />
          </g>
        )}
      </g>
    </svg>
  );
}
