import { useEffect, useRef, type ReactNode } from "react";
import { AccessibilityInfo, Animated, Easing, Pressable, type GestureResponderEvent, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

/** The mockups' curve: cubic-bezier(.2,.8,.2,1) — fast start, soft landing, like iOS. */
export const EASE = Easing.bezier(0.2, 0.8, 0.2, 1);
const native = true;

let reduceMotion = false;
AccessibilityInfo.isReduceMotionEnabled?.().then((v) => { reduceMotion = v; }).catch(() => {});

/**
 * "taRise": content rises 14 px while fading in (0.35 s). `index` staggers siblings by 40 ms so a
 * screen's sections arrive one after another.
 */
export function Rise({ children, index = 0, style, distance = 14 }: { children: ReactNode; index?: number; style?: StyleProp<ViewStyle>; distance?: number }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    Animated.timing(v, { toValue: 1, duration: 350, delay: Math.min(index, 10) * 40, easing: EASE, useNativeDriver: native }).start();
  }, [v, index]);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/** "taPop": scales from 0.94 and fades in — used for chips and the active tab pill. */
export function Pop({ children, style, deps = [] }: { children: ReactNode; style?: StyleProp<ViewStyle>; deps?: unknown[] }) {
  const v = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) return;
    v.setValue(0);
    Animated.timing(v, { toValue: 1, duration: 400, easing: EASE, useNativeDriver: native }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return (
    <Animated.View style={[style, { opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }) }] }]}>
      {children}
    </Animated.View>
  );
}

/**
 * Pressable that shrinks to 0.97 while pressed and springs back, like the mockups' `:active`.
 * Pass layout and look in `style` exactly as for a View.
 */
export function Tap({ children, style, onPressIn, onPressOut, scaleTo = 0.97, ...props }: Omit<PressableProps, "style" | "children"> & {
  children: ReactNode; style?: StyleProp<ViewStyle>; scaleTo?: number;
}) {
  const v = useRef(new Animated.Value(1)).current;
  const to = (toValue: number) => Animated.spring(v, { toValue, useNativeDriver: native, speed: 40, bounciness: toValue === 1 ? 6 : 0 }).start();
  return (
    <Pressable {...props}
      onPressIn={(e: GestureResponderEvent) => { to(scaleTo); onPressIn?.(e); }}
      onPressOut={(e: GestureResponderEvent) => { to(1); onPressOut?.(e); }}>
      <Animated.View style={[style, { transform: [{ scale: v }] }, props.disabled ? { opacity: 0.45 } : null]}>{children}</Animated.View>
    </Pressable>
  );
}
