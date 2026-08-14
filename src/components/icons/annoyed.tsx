"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { HTMLAttributes } from "react";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";

export interface AnnoyedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

interface AnnoyedIconProps extends HTMLAttributes<HTMLDivElement> {
  size?: number;
}

type Mood =
  | "calm"
  | "happy"
  | "curious"
  | "sleepy"
  | "annoyed"
  | "surprised"
  | "love";

const moods: Mood[] = ["happy", "curious", "sleepy", "annoyed", "surprised", "love"];

const rest = (minimum: number, maximum: number) =>
  minimum + Math.random() * (maximum - minimum);

// Пружины разной "характерности" под разные части лица
const spring = { type: "spring", stiffness: 260, damping: 18 } as const;
const softSpring = { type: "spring", stiffness: 140, damping: 16 } as const;
const snappySpring = { type: "spring", stiffness: 420, damping: 22 } as const;

const AnnoyedIcon = forwardRef<AnnoyedIconHandle, AnnoyedIconProps>(
  ({ onMouseEnter, onMouseLeave, className, size = 28, ...props }, ref) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const reactionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const blinkTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const cursorRef = useRef({ x: 0, y: 0 });
    const pausedRef = useRef(false);

    const [mood, setMood] = useState<Mood>("calm");
    const [isFollowingCursor, setIsFollowingCursor] = useState(false);
    const [gaze, setGaze] = useState({ x: 0, y: 0 });
    const [isBlinking, setIsBlinking] = useState(false);
    const prefersReducedMotion = useReducedMotion();

    const returnToCalm = useCallback(() => {
      if (resetTimer.current) clearTimeout(resetTimer.current);
      resetTimer.current = setTimeout(() => {
        setMood("calm");
        setIsFollowingCursor(false);
      }, 2000);
    }, []);

    const playReaction = useCallback(
      (nextMood?: Mood) => {
        if (pausedRef.current || prefersReducedMotion) return;
        const selected =
          nextMood ?? moods[Math.floor(Math.random() * moods.length)];
        setMood(selected);
        setIsFollowingCursor(selected === "curious");
        returnToCalm();
      },
      [prefersReducedMotion, returnToCalm],
    );

    // Автоматические реакции по таймеру
    useEffect(() => {
      if (prefersReducedMotion) return;
      const schedule = () => {
        reactionTimer.current = setTimeout(() => {
          playReaction();
          schedule();
        }, rest(7000, 14000));
      };
      schedule();
      return () => {
        if (reactionTimer.current) clearTimeout(reactionTimer.current);
        if (resetTimer.current) clearTimeout(resetTimer.current);
      };
    }, [playReaction, prefersReducedMotion]);

    // Живое моргание в простое (с "двойным морганием" иногда)
    useEffect(() => {
      if (prefersReducedMotion) return;
      const scheduleBlink = () => {
        blinkTimer.current = setTimeout(
          () => {
            const doubleBlink = Math.random() > 0.7;
            setIsBlinking(true);
            setTimeout(() => setIsBlinking(false), 120);
            if (doubleBlink) {
              setTimeout(() => setIsBlinking(true), 260);
              setTimeout(() => setIsBlinking(false), 380);
            }
            scheduleBlink();
          },
          rest(2500, 6000),
        );
      };
      scheduleBlink();
      return () => {
        if (blinkTimer.current) clearTimeout(blinkTimer.current);
      };
    }, [prefersReducedMotion]);

    // Слежение за курсором в режиме curious
    useEffect(() => {
      if (!isFollowingCursor || prefersReducedMotion) return;
      const follow = (event: PointerEvent) => {
        cursorRef.current = { x: event.clientX, y: event.clientY };
        const bounds = rootRef.current?.getBoundingClientRect();
        if (!bounds) return;
        const cx = bounds.left + bounds.width / 2;
        const cy = bounds.top + bounds.height / 2;
        setGaze({
          x: Math.max(-1.4, Math.min(1.4, ((event.clientX - cx) / bounds.width) * 2.6)),
          y: Math.max(-1, Math.min(1, ((event.clientY - cy) / bounds.height) * 2)),
        });
      };
      window.addEventListener("pointermove", follow, { passive: true });
      follow(
        new PointerEvent("pointermove", {
          clientX: cursorRef.current.x,
          clientY: cursorRef.current.y,
        }),
      );
      return () => window.removeEventListener("pointermove", follow);
    }, [isFollowingCursor, prefersReducedMotion]);

    useImperativeHandle(
      ref,
      () => ({
        startAnimation: () => {
          pausedRef.current = false;
          playReaction("surprised");
        },
        stopAnimation: () => {
          pausedRef.current = true;
          setMood("calm");
          setIsFollowingCursor(false);
        },
      }),
      [playReaction],
    );

    const handleMouseEnter = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!pausedRef.current) playReaction("happy");
        onMouseEnter?.(event);
      },
      [onMouseEnter, playReaction],
    );

    const handleMouseLeave = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        if (!pausedRef.current) returnToCalm();
        onMouseLeave?.(event);
      },
      [onMouseLeave, returnToCalm],
    );

    const isHappy = mood === "happy";
    const isAnnoyed = mood === "annoyed";
    const isSleepy = mood === "sleepy";
    const isSurprised = mood === "surprised";
    const isLove = mood === "love";
    const isCurious = mood === "curious";

    // Раскрытие глаз по настроению
    const eyeOpen = isSleepy ? 0.35 : isSurprised ? 1.35 : isHappy || isLove ? 0.7 : 1;
    // Финальное значение с учётом моргания
    const eyeScaleY = isBlinking ? 0.1 : eyeOpen;

    // Форма рта: morph через pathLength/d
    const mouthPath = isHappy
      ? "M8 14.5c1.2 2.2 6.8 2.2 8 0"
      : isLove
        ? "M8.5 14.5c1 2 5 2 6 0"
        : isSurprised
          ? "M10.5 15a1.5 1.8 0 1 0 3 0a1.5 1.8 0 1 0 -3 0"
          : isSleepy
            ? "M9.5 15.2c1.2-.8 3.8-.8 5 0"
            : isAnnoyed
              ? "M8.5 16.2c2-2.4 5-2.4 7 0"
              : isCurious
                ? "M10.5 15.2h3"
                : "M9 15h6";

    const pupilX = isFollowingCursor ? gaze.x : 0;
    const pupilY = isFollowingCursor ? gaze.y : 0;

    return (
      <div
        ref={rootRef}
        className={className || ""}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        {...props}
      >
        <motion.svg
          animate={{
            scale: isSurprised ? 1.12 : isHappy || isLove ? 1.05 : 1,
            rotate: isAnnoyed ? -3 : isCurious ? 3 : 0,
            y: isHappy || isLove ? -1 : 0,
          }}
          fill="none"
          height={size}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="2"
          transition={spring}
          viewBox="0 0 24 24"
          width={size}
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Голова с лёгким "дыханием" в спокойствии */}
          <motion.circle
            cx="12"
            cy="12"
            r="10"
            animate={
              mood === "calm" && !prefersReducedMotion
                ? { scale: [1, 1.015, 1] }
                : { scale: 1 }
            }
            transition={
              mood === "calm"
                ? { duration: 4, repeat: Infinity, ease: "easeInOut" }
                : spring
            }
            style={{ transformOrigin: "12px 12px" }}
          />

          {/* Блок глаз + бровей со слежением/паралаксом */}
          <motion.g
            animate={{ x: pupilX * 0.6, y: pupilY * 0.5 }}
            transition={softSpring}
          >
            {/* Брови */}
            <motion.path
              d="M7.5 8.2h2.6"
              animate={{
                rotate: isAnnoyed ? 22 : isHappy ? -10 : isSurprised ? -4 : 0,
                y: isSleepy ? 0.6 : isSurprised ? -1.4 : 0,
                opacity: isSleepy ? 0.5 : 1,
              }}
              style={{ transformOrigin: "8.8px 8.2px" }}
              transition={snappySpring}
            />
            <motion.path
              d="M13.9 8.2h2.6"
              animate={{
                rotate: isAnnoyed ? -22 : isHappy ? 10 : isSurprised ? 4 : 0,
                y: isSleepy ? 0.6 : isSurprised ? -1.4 : 0,
                opacity: isSleepy ? 0.5 : 1,
              }}
              style={{ transformOrigin: "15.2px 8.2px" }}
              transition={snappySpring}
            />

            {/* Глаза-зрачки с морганием и слежением */}
            <motion.g
              animate={{ x: pupilX * 0.9, y: pupilY * 0.8 }}
              transition={softSpring}
            >
              {isLove ? (
                <>
                  <motion.path
                    d="M8.4 10.4a0.8 0.8 0 0 1 1.4-.4a0.8 0.8 0 0 1 1.4.4c0 .9-1.4 1.7-1.4 1.7s-1.4-.8-1.4-1.7z"
                    fill="currentColor"
                    stroke="none"
                    initial={{ scale: 0 }}
                    animate={{ scale: [0.9, 1.15, 0.9] }}
                    transition={{ duration: 0.7, repeat: Infinity }}
                    style={{ transformOrigin: "9.6px 11px" }}
                  />
                  <motion.path
                    d="M13.4 10.4a0.8 0.8 0 0 1 1.4-.4a0.8 0.8 0 0 1 1.4.4c0 .9-1.4 1.7-1.4 1.7s-1.4-.8-1.4-1.7z"
                    fill="currentColor"
                    stroke="none"
                    animate={{ scale: [0.9, 1.15, 0.9] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: 0.1 }}
                    style={{ transformOrigin: "14.6px 11px" }}
                  />
                </>
              ) : (
                <>
                  <motion.ellipse
                    cx="9.2"
                    cy="10.6"
                    rx="1.05"
                    ry="1.3"
                    fill="currentColor"
                    stroke="none"
                    animate={{ scaleY: eyeScaleY, scaleX: isSurprised ? 1.15 : 1 }}
                    transition={{ duration: 0.12 }}
                    style={{ transformOrigin: "9.2px 10.6px" }}
                  />
                  <motion.ellipse
                    cx="14.8"
                    cy="10.6"
                    rx="1.05"
                    ry="1.3"
                    fill="currentColor"
                    stroke="none"
                    animate={{ scaleY: eyeScaleY, scaleX: isSurprised ? 1.15 : 1 }}
                    transition={{ duration: 0.12 }}
                    style={{ transformOrigin: "14.8px 10.6px" }}
                  />
                </>
              )}
            </motion.g>

            {/* Веки для sleepy */}
            {isSleepy && (
              <>
                <motion.path
                  d="M7.9 10h2.6"
                  initial={{ y: -3, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={softSpring}
                />
                <motion.path
                  d="M13.5 10h2.6"
                  initial={{ y: -3, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={softSpring}
                />
              </>
            )}
          </motion.g>

          {/* Румянец для happy/love */}
          <AnimatePresence>
            {(isHappy || isLove) && (
              <motion.g
                key="blush"
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 0.55, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={spring}
              >
                <circle cx="7" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
                <circle cx="17" cy="13.5" r="1.1" fill="currentColor" stroke="none" />
              </motion.g>
            )}
          </AnimatePresence>

          {/* Рот c морфингом */}
          <AnimatePresence mode="wait" initial={false}>
            <motion.path
              key={mood + String(isBlinking && false)}
              d={mouthPath}
              fill={isSurprised ? "currentColor" : "none"}
              animate={{ opacity: 1, scaleX: 1, y: 0 }}
              exit={{ opacity: 0, scaleX: 0.55, y: 1 }}
              initial={{ opacity: 0, scaleX: 0.55, y: -1 }}
              style={{ transformOrigin: "12px 15px" }}
              transition={{ duration: 0.2, ease: "easeOut" }}
            />
          </AnimatePresence>

          {/* Эффекты под настроение */}
          <AnimatePresence>
            {isSurprised && (
              <motion.g key="fx-surprised" exit={{ opacity: 0 }}>
                {[0, 0.12, 0.24].map((delay, i) => (
                  <motion.circle
                    key={i}
                    cx={17 + i}
                    cy={6 - i}
                    r="0.7"
                    fill="currentColor"
                    stroke="none"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: [0, 1, 0], y: [2, -3, -6] }}
                    transition={{ duration: 0.7, delay }}
                  />
                ))}
              </motion.g>
            )}

            {isHappy && (
              <motion.g key="fx-happy" exit={{ opacity: 0 }}>
                <motion.path
                  d="M18 12.5h2M19 11.5v2"
                  animate={{ opacity: [0, 1, 0], scale: [0.5, 1.2, 0.5], rotate: [0, 90] }}
                  transition={{ duration: 0.9, repeat: Infinity }}
                  style={{ transformOrigin: "19px 12.5px" }}
                />
                <motion.path
                  d="M4.5 8h1.4M5.2 7.3v1.4"
                  animate={{ opacity: [0, 1, 0], scale: [0.4, 1, 0.4] }}
                  transition={{ duration: 0.9, repeat: Infinity, delay: 0.35 }}
                  style={{ transformOrigin: "5.2px 8px" }}
                />
              </motion.g>
            )}

            {isLove && (
              <motion.g key="fx-love" exit={{ opacity: 0 }}>
                {[0, 0.3, 0.6].map((delay, i) => (
                  <motion.path
                    key={i}
                    d="M18.5 8a0.6 0.6 0 0 1 1-.3a0.6 0.6 0 0 1 1 .3c0 .7-1 1.3-1 1.3s-1-.6-1-1.3z"
                    fill="currentColor"
                    stroke="none"
                    initial={{ opacity: 0, y: 0, scale: 0.6 }}
                    animate={{ opacity: [0, 1, 0], y: [0, -4, -8], scale: [0.6, 1, 0.7] }}
                    transition={{ duration: 1.4, repeat: Infinity, delay }}
                  />
                ))}
              </motion.g>
            )}

            {isAnnoyed && (
              <motion.g key="fx-annoyed" exit={{ opacity: 0 }}>
                {/* Капля пота */}
                <motion.path
                  d="M18.5 8c0 1-1 1.6-1 2.4a1 1 0 0 0 2 0c0-.8-1-1.4-1-2.4z"
                  fill="currentColor"
                  stroke="none"
                  initial={{ opacity: 0, y: -2 }}
                  animate={{ opacity: [0, 1, 1, 0], y: [-2, 0, 1, 3] }}
                  transition={{ duration: 1.1, ease: "easeIn" }}
                />
                {/* Знак раздражения */}
                <motion.g
                  animate={{ opacity: [0, 1, 1, 0], scale: [0.6, 1, 1, 0.9] }}
                  transition={{ duration: 1 }}
                  style={{ transformOrigin: "6px 7px" }}
                >
                  <path d="M5 6.5l2 1.5" />
                  <path d="M7 6.5l-2 1.5" />
                </motion.g>
              </motion.g>
            )}

            {isCurious && (
              <motion.text
                key="fx-curious"
                x="18"
                y="7.5"
                fontSize="6"
                fill="currentColor"
                stroke="none"
                textAnchor="middle"
                initial={{ opacity: 0, y: 2, rotate: -10 }}
                animate={{ opacity: 1, y: 0, rotate: [-10, 8, -6, 0] }}
                exit={{ opacity: 0, y: -2 }}
                transition={{ duration: 0.6 }}
              >
                ?
              </motion.text>
            )}

            {isSleepy && (
              <motion.g key="fx-sleepy" exit={{ opacity: 0 }}>
                {[
                  { x: 17, y: 7, s: 3.2, d: 0 },
                  { x: 18.6, y: 5.2, s: 2.4, d: 0.5 },
                  { x: 20, y: 3.8, s: 1.8, d: 1 },
                ].map((z, i) => (
                  <motion.text
                    key={i}
                    x={z.x}
                    y={z.y}
                    fontSize={z.s}
                    fill="currentColor"
                    stroke="none"
                    initial={{ opacity: 0, y: 2 }}
                    animate={{ opacity: [0, 1, 0], y: [2, -1, -3] }}
                    transition={{ duration: 2, repeat: Infinity, delay: z.d }}
                  >
                    z
                  </motion.text>
                ))}
              </motion.g>
            )}
          </AnimatePresence>
        </motion.svg>
      </div>
    );
  },
);

AnnoyedIcon.displayName = "AnnoyedIcon";

export { AnnoyedIcon };