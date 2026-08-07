import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion } from 'motion/react';

const styles = {
  wrapper: {
    display: 'inline-block',
    whiteSpace: 'pre-wrap',
  },
  srOnly: {
    position: 'absolute',
    width: '1px',
    height: '1px',
    padding: 0,
    margin: '-1px',
    overflow: 'hidden',
    clip: 'rect(0,0,0,0)',
    border: 0,
  },
};

export default function DecryptedText({
  text,
  speed = 50,
  maxIterations = 10,
  sequential = false,
  revealDirection = 'start',
  useOriginalCharsOnly = false,
  characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz!@#$%^&*()_+',
  className = '',
  parentClassName = '',
  encryptedClassName = '',
  animateOn = 'hover',
  clickMode = 'once',
  ...props
}) {
  const [displayText, setDisplayText] = useState(text);
  const [isAnimating, setIsAnimating] = useState(false);
  const [revealedIndices, setRevealedIndices] = useState(new Set());
  const [hasAnimated, setHasAnimated] = useState(false);
  const [isDecrypted, setIsDecrypted] = useState(animateOn !== 'click');
  const [direction, setDirection] = useState('forward');

  const containerRef = useRef(null);
  const orderRef = useRef([]);
  const pointerRef = useRef(0);
  const intervalRef = useRef(null);

  const availableChars = useMemo(() => {
    return useOriginalCharsOnly
      ? Array.from(new Set(text.split(''))).filter(char => char !== ' ')
      : characters.split('');
  }, [useOriginalCharsOnly, text, characters]);

  const shuffleText = useCallback(
    (originalText, currentRevealed) => {
      return originalText
        .split('')
        .map((char, index) => {
          if (char === ' ') return ' ';
          if (currentRevealed.has(index)) return originalText[index];
          return availableChars[Math.floor(Math.random() * availableChars.length)];
        })
        .join('');
    },
    [availableChars],
  );

  const computeOrder = useCallback(
    length => {
      const order = [];
      if (length <= 0) return order;
      if (revealDirection === 'start') {
        for (let index = 0; index < length; index += 1) order.push(index);
        return order;
      }
      if (revealDirection === 'end') {
        for (let index = length - 1; index >= 0; index -= 1) order.push(index);
        return order;
      }

      const middle = Math.floor(length / 2);
      let offset = 0;
      while (order.length < length) {
        if (offset % 2 === 0) {
          const index = middle + offset / 2;
          if (index >= 0 && index < length) order.push(index);
        } else {
          const index = middle - Math.ceil(offset / 2);
          if (index >= 0 && index < length) order.push(index);
        }
        offset += 1;
      }
      return order.slice(0, length);
    },
    [revealDirection],
  );

  const fillAllIndices = useCallback(() => {
    const indices = new Set();
    for (let index = 0; index < text.length; index += 1) indices.add(index);
    return indices;
  }, [text]);

  const removeRandomIndices = useCallback((set, count) => {
    const indices = Array.from(set);
    for (let index = 0; index < count && indices.length > 0; index += 1) {
      indices.splice(Math.floor(Math.random() * indices.length), 1);
    }
    return new Set(indices);
  }, []);

  const encryptInstantly = useCallback(() => {
    const emptySet = new Set();
    setRevealedIndices(emptySet);
    setDisplayText(shuffleText(text, emptySet));
    setIsDecrypted(false);
  }, [text, shuffleText]);

  const triggerDecrypt = useCallback(() => {
    if (sequential) {
      orderRef.current = computeOrder(text.length);
      pointerRef.current = 0;
    }
    setRevealedIndices(new Set());
    setDirection('forward');
    setIsAnimating(true);
  }, [sequential, computeOrder, text.length]);

  const triggerReverse = useCallback(() => {
    const allIndices = fillAllIndices();
    if (sequential) {
      orderRef.current = computeOrder(text.length).slice().reverse();
      pointerRef.current = 0;
    }
    setRevealedIndices(allIndices);
    setDisplayText(shuffleText(text, allIndices));
    setDirection('reverse');
    setIsAnimating(true);
  }, [sequential, computeOrder, fillAllIndices, shuffleText, text]);

  useEffect(() => {
    if (!isAnimating) return undefined;

    let currentIteration = 0;
    const getNextIndex = revealedSet => {
      if (revealDirection === 'end') return text.length - 1 - revealedSet.size;
      if (revealDirection === 'center') {
        const middle = Math.floor(text.length / 2);
        const offset = Math.floor(revealedSet.size / 2);
        const nextIndex = revealedSet.size % 2 === 0 ? middle + offset : middle - offset - 1;
        if (nextIndex >= 0 && nextIndex < text.length && !revealedSet.has(nextIndex)) return nextIndex;
        for (let index = 0; index < text.length; index += 1) {
          if (!revealedSet.has(index)) return index;
        }
      }
      return revealedSet.size;
    };

    intervalRef.current = setInterval(() => {
      setRevealedIndices(previousRevealed => {
        if (sequential && direction === 'forward') {
          if (previousRevealed.size < text.length) {
            const nextRevealed = new Set(previousRevealed);
            nextRevealed.add(getNextIndex(previousRevealed));
            setDisplayText(shuffleText(text, nextRevealed));
            return nextRevealed;
          }
          clearInterval(intervalRef.current);
          setIsAnimating(false);
          setIsDecrypted(true);
          return previousRevealed;
        }

        if (sequential && direction === 'reverse') {
          if (pointerRef.current < orderRef.current.length) {
            const nextRevealed = new Set(previousRevealed);
            nextRevealed.delete(orderRef.current[pointerRef.current]);
            pointerRef.current += 1;
            setDisplayText(shuffleText(text, nextRevealed));
            if (nextRevealed.size === 0) {
              clearInterval(intervalRef.current);
              setIsAnimating(false);
              setIsDecrypted(false);
            }
            return nextRevealed;
          }
          clearInterval(intervalRef.current);
          setIsAnimating(false);
          setIsDecrypted(false);
          return previousRevealed;
        }

        if (direction === 'forward') {
          setDisplayText(shuffleText(text, previousRevealed));
          currentIteration += 1;
          if (currentIteration >= maxIterations) {
            clearInterval(intervalRef.current);
            setIsAnimating(false);
            setDisplayText(text);
            setIsDecrypted(true);
          }
          return previousRevealed;
        }

        let currentSet = previousRevealed.size === 0 ? fillAllIndices() : previousRevealed;
        const removeCount = Math.max(1, Math.ceil(text.length / Math.max(1, maxIterations)));
        currentSet = removeRandomIndices(currentSet, removeCount);
        setDisplayText(shuffleText(text, currentSet));
        currentIteration += 1;
        if (currentSet.size === 0 || currentIteration >= maxIterations) {
          clearInterval(intervalRef.current);
          setIsAnimating(false);
          setIsDecrypted(false);
          setDisplayText(shuffleText(text, new Set()));
          return new Set();
        }
        return currentSet;
      });
    }, speed);

    return () => clearInterval(intervalRef.current);
  }, [
    direction,
    fillAllIndices,
    isAnimating,
    maxIterations,
    removeRandomIndices,
    revealDirection,
    sequential,
    shuffleText,
    speed,
    text,
  ]);

  const handleClick = () => {
    if (animateOn !== 'click') return;
    if (clickMode === 'once' && !isDecrypted) triggerDecrypt();
    if (clickMode === 'toggle') {
      if (isDecrypted) triggerReverse();
      else triggerDecrypt();
    }
  };

  const triggerHoverDecrypt = useCallback(() => {
    if (isAnimating) return;
    setRevealedIndices(new Set());
    setIsDecrypted(false);
    setDisplayText(text);
    setDirection('forward');
    setIsAnimating(true);
  }, [isAnimating, text]);

  const resetToPlainText = useCallback(() => {
    clearInterval(intervalRef.current);
    setIsAnimating(false);
    setRevealedIndices(new Set());
    setDisplayText(text);
    setIsDecrypted(true);
    setDirection('forward');
  }, [text]);

  useEffect(() => {
    if (animateOn !== 'view' && animateOn !== 'inViewHover') return undefined;

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting && !hasAnimated) {
          triggerDecrypt();
          setHasAnimated(true);
        }
      });
    }, { threshold: 0.1 });

    const currentElement = containerRef.current;
    if (currentElement) observer.observe(currentElement);
    return () => {
      if (currentElement) observer.unobserve(currentElement);
    };
  }, [animateOn, hasAnimated, triggerDecrypt]);

  useEffect(() => {
    if (animateOn === 'click') encryptInstantly();
    else {
      setDisplayText(text);
      setIsDecrypted(true);
    }
    setRevealedIndices(new Set());
    setDirection('forward');
  }, [animateOn, text, encryptInstantly]);

  const animateProps = animateOn === 'hover' || animateOn === 'inViewHover'
    ? { onMouseEnter: triggerHoverDecrypt, onMouseLeave: resetToPlainText }
    : animateOn === 'click'
      ? { onClick: handleClick }
      : {};

  return (
    <motion.span
      className={parentClassName}
      ref={containerRef}
      style={styles.wrapper}
      {...animateProps}
      {...props}
    >
      <span style={styles.srOnly}>{text}</span>
      <span aria-hidden="true">
        {displayText.split('').map((char, index) => {
          const isRevealedOrDone = revealedIndices.has(index) || (!isAnimating && isDecrypted);
          return (
            <span key={index} className={isRevealedOrDone ? className : encryptedClassName}>
              {char}
            </span>
          );
        })}
      </span>
    </motion.span>
  );
}
