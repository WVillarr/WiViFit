import Svg, { Ellipse, Polygon, Rect } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type MannequinView = 'front' | 'back';

interface MuscleBodyMapProps {
  view: MannequinView;
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
}

// Muscle groups drawn on each view. Every entry maps 1:1 to a `target` value
// in the exercises catalog (see src/db/catalog-schema.ts), except
// `cardiovascular_system`, which has no body location and is offered as a
// separate control in the screen that renders this map.
const FRONT_MUSCLES = [
  'delts',
  'pectorals',
  'serratus_anterior',
  'abs',
  'biceps',
  'forearms',
  'quads',
  'adductors',
  'abductors',
] as const;

const BACK_MUSCLES = [
  'traps',
  'levator_scapulae',
  'upper_back',
  'lats',
  'spine',
  'triceps',
  'glutes',
  'hamstrings',
  'calves',
] as const;

export function isMannequinMuscle(muscle: string): boolean {
  return (
    (FRONT_MUSCLES as readonly string[]).includes(muscle) ||
    (BACK_MUSCLES as readonly string[]).includes(muscle)
  );
}

export function MuscleBodyMap({ view, selectedMuscle, onSelectMuscle }: MuscleBodyMapProps) {
  const theme = useTheme();

  const regionFill = (muscle: string) => (selectedMuscle === muscle ? theme.text : 'transparent');
  const regionOpacity = (muscle: string) => (selectedMuscle === muscle ? 0.3 : 0);
  const regionStroke = (muscle: string) =>
    selectedMuscle === muscle ? theme.text : theme.textSecondary;
  const regionStrokeWidth = (muscle: string) => (selectedMuscle === muscle ? 2 : 1);

  const regionProps = (muscle: string) => ({
    fill: regionFill(muscle),
    fillOpacity: regionOpacity(muscle),
    stroke: regionStroke(muscle),
    strokeWidth: regionStrokeWidth(muscle),
    strokeDasharray: selectedMuscle === muscle ? undefined : '3,3',
    onPress: () => onSelectMuscle(muscle),
  });

  return (
    <Svg viewBox="0 0 220 440" width="100%" height="100%">
      {/* Base silhouette (decorative, not tappable) */}
      <Ellipse cx={110} cy={28} rx={20} ry={24} fill={theme.backgroundElement} />
      <Rect x={100} y={48} width={20} height={16} fill={theme.backgroundElement} />
      <Rect
        x={72}
        y={62}
        width={76}
        height={130}
        rx={30}
        ry={30}
        fill={theme.backgroundElement}
        stroke={theme.textSecondary}
        strokeWidth={1}
      />
      <Rect x={40} y={68} width={24} height={68} rx={12} fill={theme.backgroundElement} />
      <Rect x={156} y={68} width={24} height={68} rx={12} fill={theme.backgroundElement} />
      <Rect x={38} y={134} width={22} height={62} rx={11} fill={theme.backgroundElement} />
      <Rect x={160} y={134} width={22} height={62} rx={11} fill={theme.backgroundElement} />
      <Rect
        x={78}
        y={192}
        width={30}
        height={170}
        rx={15}
        fill={theme.backgroundElement}
        stroke={theme.textSecondary}
        strokeWidth={1}
      />
      <Rect
        x={112}
        y={192}
        width={30}
        height={170}
        rx={15}
        fill={theme.backgroundElement}
        stroke={theme.textSecondary}
        strokeWidth={1}
      />

      {view === 'front' ? (
        <>
          <Ellipse cx={52} cy={76} rx={15} ry={15} {...regionProps('delts')} />
          <Ellipse cx={168} cy={76} rx={15} ry={15} {...regionProps('delts')} />
          <Rect x={80} y={68} width={60} height={42} rx={14} {...regionProps('pectorals')} />
          <Rect x={72} y={108} width={12} height={26} rx={4} {...regionProps('serratus_anterior')} />
          <Rect x={136} y={108} width={12} height={26} rx={4} {...regionProps('serratus_anterior')} />
          <Rect x={88} y={112} width={44} height={76} rx={10} {...regionProps('abs')} />
          <Rect x={42} y={78} width={20} height={52} rx={10} {...regionProps('biceps')} />
          <Rect x={158} y={78} width={20} height={52} rx={10} {...regionProps('biceps')} />
          <Rect x={39} y={136} width={20} height={56} rx={10} {...regionProps('forearms')} />
          <Rect x={161} y={136} width={20} height={56} rx={10} {...regionProps('forearms')} />
          <Rect x={80} y={196} width={26} height={90} rx={12} {...regionProps('quads')} />
          <Rect x={114} y={196} width={26} height={90} rx={12} {...regionProps('quads')} />
          <Rect x={104} y={210} width={12} height={70} rx={6} {...regionProps('adductors')} />
          <Rect x={74} y={196} width={10} height={60} rx={5} {...regionProps('abductors')} />
          <Rect x={136} y={196} width={10} height={60} rx={5} {...regionProps('abductors')} />
        </>
      ) : (
        <>
          <Polygon points="110,58 84,74 96,102 124,102 136,74" {...regionProps('traps')} />
          <Polygon points="92,50 100,50 96,66" {...regionProps('levator_scapulae')} />
          <Polygon points="120,50 128,50 124,66" {...regionProps('levator_scapulae')} />
          <Rect x={82} y={100} width={56} height={32} rx={10} {...regionProps('upper_back')} />
          <Polygon points="72,104 88,104 96,150 76,158" {...regionProps('lats')} />
          <Polygon points="148,104 132,104 124,150 144,158" {...regionProps('lats')} />
          <Rect x={98} y={128} width={24} height={62} rx={10} {...regionProps('spine')} />
          <Rect x={42} y={78} width={20} height={54} rx={10} {...regionProps('triceps')} />
          <Rect x={158} y={78} width={20} height={54} rx={10} {...regionProps('triceps')} />
          <Rect x={78} y={192} width={64} height={34} rx={16} {...regionProps('glutes')} />
          <Rect x={80} y={226} width={26} height={80} rx={12} {...regionProps('hamstrings')} />
          <Rect x={114} y={226} width={26} height={80} rx={12} {...regionProps('hamstrings')} />
          <Rect x={82} y={310} width={22} height={50} rx={10} {...regionProps('calves')} />
          <Rect x={116} y={310} width={22} height={50} rx={10} {...regionProps('calves')} />
        </>
      )}
    </Svg>
  );
}
