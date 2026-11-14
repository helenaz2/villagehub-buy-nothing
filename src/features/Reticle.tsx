import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type WithSpringConfig,
} from 'react-native-reanimated';

import { T } from '@/components/T';
import { motion, palette, radius, space } from '@/theme';

export type Box = { x: number; y: number; w: number; h: number };
export type ReticlePhase = 'idle' | 'scanning' | 'found';

const IDLE: Box = { x: 0.1, y: 0.2, w: 0.8, h: 0.5 };
const ARM = 34;
const WEIGHT = 3.5;

type Props = {
  phase: ReticlePhase;
  frame: { width: number; height: number };
  /** Where the model found the item, as fractions of the frame. */
  target?: Box | null;
  label?: string | null;
};

/**
 * The scan reticle. Four hand-set corners that breathe while idle, tighten and
 * sweep while the model looks, then snap onto the item and name it.
 */
export function Reticle({ phase, frame, target, label }: Props) {
  const reduced = useReducedMotion();
  const x = useSharedValue(IDLE.x);
  const y = useSharedValue(IDLE.y);
  const w = useSharedValue(IDLE.w);
  const h = useSharedValue(IDLE.h);
  const breathe = useSharedValue(0);
  const sweep = useSharedValue(0);
  const tag = useSharedValue(0);

  useEffect(() => {
    const to = (b: Box, spring: WithSpringConfig = motion.spring) => {
      x.value = withSpring(b.x, spring);
      y.value = withSpring(b.y, spring);
      w.value = withSpring(b.w, spring);
      h.value = withSpring(b.h, spring);
    };
    cancelAnimation(breathe);
    cancelAnimation(sweep);

    if (phase === 'idle') {
      tag.value = withTiming(0, { duration: motion.quick });
      sweep.value = 0;
      to(IDLE, motion.springSoft);
      breathe.value = reduced
        ? 0
        : withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.quad) }), -1, true);
    } else if (phase === 'scanning') {
      breathe.value = withTiming(0, { duration: motion.quick });
      // Pull in a little, as if focusing.
      to({ x: IDLE.x + 0.03, y: IDLE.y + 0.02, w: IDLE.w - 0.06, h: IDLE.h - 0.04 });
      sweep.value = reduced
        ? 0.5
        : withRepeat(
            withSequence(
              withTiming(1, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
              withTiming(0, { duration: 900, easing: Easing.inOut(Easing.cubic) }),
            ),
            -1,
          );
    } else {
      breathe.value = 0;
      sweep.value = withTiming(0, { duration: motion.quick });
      to(target ?? IDLE, { damping: 14, stiffness: 260, mass: 0.8 });
      tag.value = withDelay(140, withSpring(1, motion.spring));
    }
  }, [phase, target, reduced, x, y, w, h, breathe, sweep, tag]);

  const boxStyle = useAnimatedStyle(() => {
    const grow = breathe.value * 0.012;
    return {
      left: (x.value - grow) * frame.width,
      top: (y.value - grow) * frame.height,
      width: (w.value + grow * 2) * frame.width,
      height: (h.value + grow * 2) * frame.height,
    };
  });

  const sweepStyle = useAnimatedStyle(() => ({
    opacity: phase === 'scanning' ? 0.9 : 0,
    top: `${6 + sweep.value * 88}%`,
  }));

  const tagStyle = useAnimatedStyle(() => ({
    opacity: tag.value,
    transform: [{ translateY: (1 - tag.value) * 10 }, { scale: 0.94 + tag.value * 0.06 }],
  }));

  const color = phase === 'found' ? palette.terracotta : palette.paper;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Animated.View style={[styles.box, boxStyle]}>
        <View style={[styles.corner, styles.tl, { borderColor: color }]} />
        <View style={[styles.corner, styles.tr, { borderColor: color }]} />
        <View style={[styles.corner, styles.bl, { borderColor: color }]} />
        <View style={[styles.corner, styles.br, { borderColor: color }]} />
        <Animated.View style={[styles.sweep, sweepStyle]} />
        {label ? (
          <Animated.View style={[styles.tag, tagStyle]}>
            <View style={styles.hole} />
            <T variant="labelStrong" style={{ color: palette.forest }} numberOfLines={1}>
              {label}
            </T>
          </Animated.View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { position: 'absolute' },
  corner: { position: 'absolute', width: ARM, height: ARM },
  tl: { top: 0, left: 0, borderTopWidth: WEIGHT, borderLeftWidth: WEIGHT, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: WEIGHT, borderRightWidth: WEIGHT, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: WEIGHT, borderLeftWidth: WEIGHT, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: WEIGHT, borderRightWidth: WEIGHT, borderBottomRightRadius: 10 },
  sweep: {
    position: 'absolute',
    left: 10,
    right: 10,
    height: 2,
    borderRadius: 1,
    backgroundColor: palette.paper,
  },
  // A paper hang tag, the kind you would tie to something left on the curb.
  tag: {
    position: 'absolute',
    left: 0,
    bottom: -52,
    maxWidth: 280,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    backgroundColor: palette.paper,
    paddingVertical: 10,
    paddingLeft: 12,
    paddingRight: space.md,
    borderRadius: radius.photo,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  hole: { width: 10, height: 10, borderRadius: 5, borderWidth: 2, borderColor: palette.forestFaint },
});
