import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';

interface ButtonAction {
  icon: string;
  iconSize?: number;
  onPress: () => void;
  active?: boolean;
}

interface DraggableButtonGroupProps {
  actions: ButtonAction[];
  sheetHeight?: number;
}

const BTN_SIZE = 44;
const GAP = 8;
const MARGIN_RIGHT = 12;
const MARGIN_BOTTOM = 12;

export function DraggableButtonGroup({ actions, sheetHeight }: DraggableButtonGroupProps) {
  const bottomOffset = (sheetHeight ?? Math.round(Dimensions.get('window').height * 0.42)) + MARGIN_BOTTOM;

  return (
    <View style={[styles.group, { bottom: bottomOffset, right: MARGIN_RIGHT }]}>
      {actions.map((action, i) => (
        <View
          key={i}
          style={[styles.button, action.active === false && styles.buttonInactive]}
          onTouchEnd={() => action.onPress()}
        >
          <Text style={[styles.icon, { fontSize: action.iconSize || 18 }, action.active === false && styles.iconInactive]}>{action.icon}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    position: 'absolute',
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
  buttonInactive: {
    opacity: 0.4,
  },
  icon: {
    color: '#FFFFFF',
  },
  iconInactive: {
    opacity: 0.5,
  },
});
