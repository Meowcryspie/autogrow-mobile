import React from 'react';
import Svg, { Path, Polygon, Ellipse, Line, G, Text as SvgText } from 'react-native-svg';

const U = 22;
const ORIGIN_X = 159;
const ORIGIN_Y = 48;

function project(a: number, b: number, z: number): [number, number] {
  const x = ORIGIN_X + (a - b) * U;
  const y = ORIGIN_Y + ((a + b) * U) / 2 - z;
  return [Math.round(x * 10) / 10, Math.round(y * 10) / 10];
}

function ptStr(p: [number, number]): string {
  return `${p[0]},${p[1]}`;
}

export const FarmOneSvg: React.FC = () => {
  const gTop0 = project(0, 0, 7);
  const gTop1 = project(6, 0, 7);
  const gTop2 = project(6, 5, 7);
  const gTop3 = project(0, 5, 7);

  const gBot1 = project(6, 0, 0);
  const gBot2 = project(6, 5, 0);
  const gBot3 = project(0, 5, 0);

  const renderGreenhouse = (a0: number, b0: number, a1: number, b1: number, key: string) => {
    const bMid = (b0 + b1) / 2;
    const wallH = 21;
    const ridgeH = 33;
    const baseZ = 7;

    const w1Bot = project(a1, b0, baseZ);
    const w2Bot = project(a1, b1, baseZ);
    const w3Bot = project(a0, b1, baseZ);

    const w0Top = project(a0, b0, wallH);
    const w1Top = project(a1, b0, wallH);
    const w2Top = project(a1, b1, wallH);
    const w3Top = project(a0, b1, wallH);

    const rStart = project(a0, bMid, ridgeH);
    const rEnd = project(a1, bMid, ridgeH);

    return (
      <G key={key}>
        <Polygon points={`${ptStr(w1Bot)} ${ptStr(w2Bot)} ${ptStr(w2Top)} ${ptStr(w1Top)}`} fill="#8CBFA0" stroke="#2A5640" strokeWidth={0.8} />
        <Polygon points={`${ptStr(w1Top)} ${ptStr(rEnd)} ${ptStr(w2Top)}`} fill="#8CBFA0" stroke="#2A5640" strokeWidth={0.8} />
        <Polygon points={`${ptStr(w3Bot)} ${ptStr(w2Bot)} ${ptStr(w2Top)} ${ptStr(w3Top)}`} fill="#5E9477" stroke="#2A5640" strokeWidth={0.8} />
        <Polygon points={`${ptStr(rStart)} ${ptStr(rEnd)} ${ptStr(w2Top)} ${ptStr(w3Top)}`} fill="#BFE3CC" stroke="#2A5640" strokeWidth={0.8} />
        <Polygon points={`${ptStr(rStart)} ${ptStr(rEnd)} ${ptStr(w1Top)} ${ptStr(w0Top)}`} fill="#CFEFE0" stroke="#2A5640" strokeWidth={0.8} />
      </G>
    );
  };

  const renderTank = (a: number, b: number, key: string) => {
    const baseZ = 7;
    const height = 20;
    const r = 10;
    const ry = r / 2;
    const [cx, cyBase] = project(a, b, baseZ);
    const cyTop = cyBase - height;

    return (
      <G key={key}>
        <Path
          d={`M ${cx - r} ${cyTop} L ${cx - r} ${cyBase} A ${r} ${ry} 0 0 0 ${cx + r} ${cyBase} L ${cx + r} ${cyTop} Z`}
          fill="#4E8DB5"
          stroke="#33698A"
          strokeWidth={0.8}
        />
        <Ellipse cx={cx} cy={cyTop} rx={r} ry={ry} fill="#A9D4F0" stroke="#33698A" strokeWidth={0.8} />
        <Ellipse cx={cx} cy={cyTop + 2.5} rx={r - 1.8} ry={ry - 0.9} fill="#6FB0DA" />
      </G>
    );
  };

  return (
    <Svg viewBox="0 0 340 180" width="100%" height={140}>
      <Polygon points={`${ptStr(gTop1)} ${ptStr(gTop2)} ${ptStr(gBot2)} ${ptStr(gBot1)}`} fill="#234632" />
      <Polygon points={`${ptStr(gTop2)} ${ptStr(gTop3)} ${ptStr(gBot3)} ${ptStr(gBot2)}`} fill="#1B3827" />
      <Polygon points={`${ptStr(gTop0)} ${ptStr(gTop1)} ${ptStr(gTop2)} ${ptStr(gTop3)}`} fill="#2E5A3F" />
      {renderGreenhouse(0.5, 0.5, 2.3, 2.1, 'gh-1')}
      {renderGreenhouse(3.0, 0.5, 4.8, 2.1, 'gh-2')}
      {renderGreenhouse(0.5, 2.9, 2.3, 4.5, 'gh-3')}
      {renderTank(4.1, 3.3, 'tank-1')}
      {renderTank(4.1, 4.3, 'tank-2')}
    </Svg>
  );
};

export const FarmTwoSvg: React.FC = () => {
  const gTop0 = project(0, 0, 7);
  const gTop1 = project(6, 0, 7);
  const gTop2 = project(6, 5, 7);
  const gTop3 = project(0, 5, 7);

  const gBot1 = project(6, 0, 0);
  const gBot2 = project(6, 5, 0);
  const gBot3 = project(0, 5, 0);

  const renderBox = (
    a0: number,
    b0: number,
    a1: number,
    b1: number,
    h: number,
    frontColor: string,
    sideColor: string,
    topColor: string,
    key: string
  ) => {
    const baseZ = 7;
    const topZ = baseZ + h;

    const p1Bot = project(a1, b0, baseZ);
    const p2Bot = project(a1, b1, baseZ);
    const p3Bot = project(a0, b1, baseZ);

    const p0Top = project(a0, b0, topZ);
    const p1Top = project(a1, b0, topZ);
    const p2Top = project(a1, b1, topZ);
    const p3Top = project(a0, b1, topZ);

    return (
      <G key={key}>
        <Polygon points={`${ptStr(p1Bot)} ${ptStr(p2Bot)} ${ptStr(p2Top)} ${ptStr(p1Top)}`} fill={frontColor} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
        <Polygon points={`${ptStr(p3Bot)} ${ptStr(p2Bot)} ${ptStr(p2Top)} ${ptStr(p3Top)}`} fill={sideColor} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
        <Polygon points={`${ptStr(p0Top)} ${ptStr(p1Top)} ${ptStr(p2Top)} ${ptStr(p3Top)}`} fill={topColor} stroke="rgba(0,0,0,0.15)" strokeWidth={0.6} />
      </G>
    );
  };

  const renderTank = (a: number, b: number, key: string) => {
    const baseZ = 7;
    const height = 16;
    const r = 9;
    const ry = r / 2;
    const [cx, cyBase] = project(a, b, baseZ);
    const cyTop = cyBase - height;

    return (
      <G key={key}>
        <Path
          d={`M ${cx - r} ${cyTop} L ${cx - r} ${cyBase} A ${r} ${ry} 0 0 0 ${cx + r} ${cyBase} L ${cx + r} ${cyTop} Z`}
          fill="#3F9C9A"
          stroke="#2C7574"
          strokeWidth={0.8}
        />
        <Ellipse cx={cx} cy={cyTop} rx={r} ry={ry} fill="#9ADAD6" stroke="#2C7574" strokeWidth={0.8} />
        <Ellipse cx={cx} cy={cyTop + 2.2} rx={r - 1.5} ry={ry - 0.75} fill="#58BDB8" />
      </G>
    );
  };

  return (
    <Svg viewBox="0 0 340 180" width="100%" height={140}>
      <Polygon points={`${ptStr(gTop1)} ${ptStr(gTop2)} ${ptStr(gBot2)} ${ptStr(gBot1)}`} fill="#3A4A29" />
      <Polygon points={`${ptStr(gTop2)} ${ptStr(gTop3)} ${ptStr(gBot3)} ${ptStr(gBot2)}`} fill="#2E3B20" />
      <Polygon points={`${ptStr(gTop0)} ${ptStr(gTop1)} ${ptStr(gTop2)} ${ptStr(gTop3)}`} fill="#4A5C34" />
      {renderBox(0.6, 0.5, 4.2, 1.0, 6, '#7A5A3A', '#5E4329', '#5FB36A', 'bed-1')}
      {renderBox(0.6, 1.4, 4.2, 1.9, 6, '#7A5A3A', '#5E4329', '#5FB36A', 'bed-2')}
      {renderBox(4.5, 0.5, 5.6, 2.0, 24, '#DAD5C7', '#B7B1A1', '#EFECE2', 'shed')}
      {renderBox(0.6, 2.3, 4.2, 2.8, 6, '#7A5A3A', '#5E4329', '#5FB36A', 'bed-3')}
      {renderBox(0.6, 3.2, 4.2, 3.7, 6, '#7A5A3A', '#5E4329', '#5FB36A', 'bed-4')}
      {renderTank(1, 4.4, 'tank-1')}
      {renderTank(2, 4.4, 'tank-2')}
      {renderTank(3, 4.4, 'tank-3')}
      {renderTank(4, 4.4, 'tank-4')}
    </Svg>
  );
};

interface EcGaugeSvgProps {
  ec: number;
  target: number;
  lowLimit: number;
  highLimit: number;
}

export const EcGaugeSvg: React.FC<EcGaugeSvgProps> = ({ ec, target, lowLimit, highLimit }) => {
  const cx = 150;
  const cy = 150;
  const r = 118;
  const minVal = 1.0;
  const maxVal = 2.6;
  const range = maxVal - minVal;

  const getAngle = (val: number) => {
    const clamped = Math.max(minVal, Math.min(maxVal, val));
    return Math.PI * (1 - (clamped - minVal) / range);
  };

  const getPoint = (angle: number, radius: number) => ({
    x: cx + radius * Math.cos(angle),
    y: cy - radius * Math.sin(angle),
  });

  const startBg = getPoint(Math.PI, r);
  const endBg = getPoint(0, r);
  const bgPath = `M ${startBg.x} ${startBg.y} A ${r} ${r} 0 0 1 ${endBg.x} ${endBg.y}`;

  const pSafeStart = getPoint(getAngle(lowLimit), r);
  const pSafeEnd = getPoint(getAngle(highLimit), r);
  const safeArc = `M ${pSafeStart.x} ${pSafeStart.y} A ${r} ${r} 0 0 1 ${pSafeEnd.x} ${pSafeEnd.y}`;

  const endVal = getPoint(getAngle(ec), r);
  const valPath = `M ${startBg.x} ${startBg.y} A ${r} ${r} 0 0 1 ${endVal.x} ${endVal.y}`;

  const renderTick = (val: number, stroke: string, strokeWidth = 3, length = 14) => {
    const angle = getAngle(val);
    const pOuter = getPoint(angle, r + 5);
    const pInner = getPoint(angle, r - length);
    return (
      <Line
        key={String(val)}
        x1={pInner.x}
        y1={pInner.y}
        x2={pOuter.x}
        y2={pOuter.y}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
    );
  };

  return (
    <Svg viewBox="0 0 300 178" width="100%" height={170}>
      <Path d={bgPath} fill="none" stroke="#E5E7EB" strokeWidth={14} strokeLinecap="round" />
      <Path d={safeArc} fill="none" stroke="#76b82a" strokeWidth={14} opacity={0.3} />
      <Path d={valPath} fill="none" stroke="#15803D" strokeWidth={14} strokeLinecap="round" />
      {renderTick(lowLimit, '#D97706', 3, 12)}
      {renderTick(highLimit, '#D97706', 3, 12)}
      {renderTick(target, '#111827', 4, 16)}
      <SvgText x={24} y={165} fill="#9CA3AF" fontSize={11} fontWeight="600">
        1.0
      </SvgText>
      <SvgText x={264} y={165} fill="#9CA3AF" fontSize={11} fontWeight="600">
        2.6
      </SvgText>
      <SvgText x={cx} y={cy - 12} textAnchor="middle" fill="#111827" fontSize={40} fontWeight="800">
        {ec.toFixed(2)}
      </SvgText>
      <SvgText x={cx} y={cy + 10} textAnchor="middle" fill="#6B7280" fontSize={12} fontWeight="700">
        mS/cm
      </SvgText>
    </Svg>
  );
};
