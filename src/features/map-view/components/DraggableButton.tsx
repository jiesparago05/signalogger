import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, Animated, Dimensions } from 'react-native';

interface ButtonAction {
  icon: string;
  iconSize?: number;
  onPress: () => void;
}

interface DraggableButtonGroupProps {
  actions: ButtonAction[];
}

const SCREEN = Dimensions.get('window');
const BTN_SIZE = 44;
const GAP = 8;

export function DraggableButtonGroup({ actions }: DraggableButtonGroupProps) {
  const pan = useRef(new Animated.ValueXY({
    x: SCREEN.width - BTN_SIZE - 16,
    y: SCREEN.height * 0.45,
  })).current;
  const isDragging = useRef(false);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gesture) => {
        return Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5;
      },
      onPanResponderGrant: () => {
        isDragging.current = false;
        pan.setOffset({ x: (pan.x as any)._value, y: (pan.y as any)._value });
        pan.setValue({ x: 0, y: 0 });
      },
      onPanResponderMove: (_, gesture) => {
        if (Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5) {
          isDragging.current = true;
        }
        Animated.event([null, { dx: pan.x, dy: pan.y }], { useNativeDriver: false })(_, gesture);
      },
      onPanResponderRelease: () => {
        pan.flattenOffset();
        const x = Math.max(0, Math.min((pan.x as any)._value, SCREEN.width - BTN_SIZE));
        const totalHeight = actions.length * BTN_SIZE + (actions.length - 1) * GAP;
        // Top: below filter chips (~100px), Bottom: above bottom sheet (~45% of screen)
        const minY = 100;
        const maxY = SCREEN.height * 0.55 - totalHeight;
        const y = Math.max(minY, Math.min((pan.y as any)._value, maxY));

        // Snap to nearest edge (left or right)
        const snapX = x < SCREEN.width / 2 ? 8 : SCREEN.width - BTN_SIZE - 8;

        Animated.spring(pan, {
          toValue: { x: snapX, y },
          useNativeDriver: false,
          friction: 7,
        }).start();
      },
    }),
  ).current;

  return (
    <Animated.View
      style={[
        styles.group,
        { transform: [{ translateX: pan.x }, { translateY: pan.y }] },
      ]}
      {...panResponder.panHandlers}
    >
      {actions.map((action, i) => (
        <View
          key={i}
          style={styles.button}
          onTouchEnd={() => {
            if (!isDragging.current) {
              action.onPress();
            }
          }}
        >
          <Text style={[styles.icon, { fontSize: action.iconSize || 18 }]}>{action.icon}</Text>
        </View>
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: {
    position: 'absolute',
    top: 0,
    left: 0,
    zIndex: 50,
    gap: GAP,
  },
  button: {
    width: BTN_SIZE,
    height: BTN_SIZE,
    borderRadius: BTN_SIZE / 2,
    backgroundColor: 'rgba(17, 24, 39, 0.85)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
  },
  icon: {
    color: '#FFFFFF',
  },
});
