import React, { useRef } from 'react';
import { View, StyleSheet, PanResponder, Animated } from 'react-native';

interface SwipeableSheetProps {
  collapsedHeight: number;
  expandedHeight: number;
  children: React.ReactNode;
  onHeightChange?: (height: number) => void;
}

export function SwipeableSheet({ collapsedHeight, expandedHeight, children, onHeightChange }: SwipeableSheetProps) {
  // Start expanded (default)
  const height = useRef(new Animated.Value(expandedHeight)).current;
  const currentHeight = useRef(expandedHeight);

  // Notify parent of initial height
  React.useEffect(() => {
    onHeightChange?.(expandedHeight);
  }, []);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dy) > 8;
      },
      onPanResponderMove: (_, gesture) => {
        const newHeight = currentHeight.current - gesture.dy;
        const clamped = Math.max(collapsedHeight, Math.min(newHeight, expandedHeight));
        height.setValue(clamped);
      },
      onPanResponderRelease: (_, gesture) => {
        const newHeight = currentHeight.current - gesture.dy;
        const mid = (collapsedHeight + expandedHeight) / 2;
        // Snap based on position
        const target = newHeight > mid ? expandedHeight : collapsedHeight;

        currentHeight.current = target;
        onHeightChange?.(target);
        Animated.spring(height, {
          toValue: target,
          useNativeDriver: false,
          friction: 8,
          tension: 60,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View style={[styles.container, { height }]}>
      <View style={styles.handleArea} {...panResponder.panHandlers}>
        <View style={styles.handle} />
      </View>
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(17, 24, 39, 0.95)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: 'hidden',
  },
  handleArea: {
    paddingTop: 10,
    paddingBottom: 6,
    alignItems: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 2,
  },
  content: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 28,
  },
});
