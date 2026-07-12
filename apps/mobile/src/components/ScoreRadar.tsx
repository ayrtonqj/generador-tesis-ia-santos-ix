import React from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polygon, Circle, Line, Text as SvgText } from 'react-native-svg';
import { Colors } from '@/constants/colors';

interface ScoreRadarProps {
  scores: {
    estructura: number;
    contenido: number;
    forma: number;
    originalidad: number;
  };
  size?: number;
}

export function ScoreRadar({ scores, size = 180 }: ScoreRadarProps) {
  const center = size / 2;
  const radius = size * 0.38;
  const axes = [
    { key: 'estructura', label: 'Estructura', value: scores.estructura },
    { key: 'contenido', label: 'Contenido', value: scores.contenido },
    { key: 'forma', label: 'Forma', value: scores.forma },
    { key: 'originalidad', label: 'Originalidad', value: scores.originalidad },
  ];
  const count = axes.length;

  // Calcular puntos del polígono
  const getPoint = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = (value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const getLabelPoint = (index: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    const r = radius + 18;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
    };
  };

  const dataPoints = axes.map((ax, i) => getPoint(i, ax.value));
  const polygonPoints = dataPoints.map((p) => `${p.x},${p.y}`).join(' ');

  // Fondo (100%)
  const bgPoints = axes.map((_, i) => getPoint(i, 100));
  const bgPolygon = bgPoints.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <View style={styles.container}>
      <Svg width={size} height={size}>
        {/* Fondo de referencia */}
        <Polygon
          points={bgPolygon}
          fill="rgba(108,99,255,0.06)"
          stroke={Colors.border}
          strokeWidth={1}
        />

        {/* Líneas de ejes */}
        {axes.map((_, i) => {
          const p = getPoint(i, 100);
          return (
            <Line
              key={i}
              x1={center}
              y1={center}
              x2={p.x}
              y2={p.y}
              stroke={Colors.border}
              strokeWidth={1}
            />
          );
        })}

        {/* Datos */}
        <Polygon
          points={polygonPoints}
          fill="rgba(108,99,255,0.25)"
          stroke={Colors.primary}
          strokeWidth={2}
        />

        {/* Puntos en vértices */}
        {dataPoints.map((p, i) => (
          <Circle key={i} cx={p.x} cy={p.y} r={4} fill={Colors.primary} />
        ))}

        {/* Etiquetas */}
        {axes.map((ax, i) => {
          const lp = getLabelPoint(i);
          return (
            <SvgText
              key={i}
              x={lp.x}
              y={lp.y}
              textAnchor="middle"
              alignmentBaseline="middle"
              fontSize={9}
              fill={Colors.textSecondary}
            >
              {ax.label}
            </SvgText>
          );
        })}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
