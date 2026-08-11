import type { PropsWithChildren } from 'react';
import Svg, { Defs, G, LinearGradient, Path, Stop } from 'react-native-svg';

import { useTheme } from '@/hooks/use-theme';

export type MannequinView = 'front' | 'back';

interface MuscleBodyMapProps {
  view: MannequinView;
  selectedMuscle: string | null;
  onSelectMuscle: (muscle: string) => void;
}

/**
 * Anatomical figure on a 240x520 canvas following the eight-heads proportion
 * (head = 62 units, centre line at x = 120). Vertical landmarks: crown 14,
 * chin 76, shoulder 104, nipple 140, waist 195, crotch 250, fingertip 315,
 * knee 355, ankle 478, sole 502.
 *
 * Only the left half of each paired part is authored; `Mirrored` reflects it
 * across the centre line, which keeps the figure symmetric and halves the
 * path data.
 *
 * Every muscle path maps 1:1 to a `target` value in the exercises catalog (see
 * src/db/catalog-schema.ts), except `cardiovascular_system`, which has no body
 * location and is offered as a separate control by the screen rendering this.
 */

// ---------------------------------------------------------------- silhouette

const HEAD =
  'M120,12 C134,12 146,24 146,40 C146,52 143,63 138,71 C135,78 128,83 120,83 ' +
  'C112,83 105,78 102,71 C97,63 94,52 94,40 C94,24 106,12 120,12 Z';

const NECK =
  'M103,70 C103,82 102,92 96,99 C93,102 91,105 90,108 L150,108 ' +
  'C149,105 147,102 144,99 C138,92 137,82 137,70 Z';

const TORSO =
  'M120,94 C109,94 99,98 92,104 C86,110 83,120 82,134 C81,150 83,166 86,180 ' +
  'C88,190 89,194 90,200 C88,212 87,224 88,238 C89,246 92,251 96,255 ' +
  'C104,260 112,262 120,262 C128,262 136,260 144,255 C148,251 151,246 152,238 ' +
  'C153,224 152,212 150,200 C151,194 152,190 154,180 C157,166 159,150 158,134 ' +
  'C157,120 154,110 148,104 C141,98 131,94 120,94 Z';

const ARM =
  'M88,100 C78,104 70,112 67,125 C64,139 65,155 66,171 C66,185 67,193 67,203 ' +
  'C65,219 63,237 62,255 C61,269 61,281 62,293 C60,303 60,313 64,319 ' +
  'C69,323 75,321 78,315 C79,305 79,295 80,285 C81,269 83,251 85,233 ' +
  'C86,215 87,199 88,181 C89,161 90,137 90,117 C90,109 90,102 90,100 Z';

const LEG =
  'M90,244 C85,260 83,280 84,300 C85,322 88,340 92,356 C94,372 91,388 92,404 ' +
  'C93,424 95,442 97,458 C98,470 99,476 99,484 C98,492 97,498 100,503 ' +
  'C105,507 112,506 115,501 C116,493 114,486 114,478 C115,464 116,450 117,436 ' +
  'C118,416 119,400 119,384 C120,368 117,358 119,344 C122,328 124,310 124,290 ' +
  'C124,270 122,254 118,246 Z';

/** Non-tappable creases that give the figure its read as a real body. */
const CLAVICLE = 'M97,116 C106,122 113,124 119,124';
const STERNUM = 'M120,126 L120,154';
const ABS_MIDLINE = 'M120,158 L120,246';
const ABS_ROW_1 = 'M102,176 C110,179 130,179 138,176';
const ABS_ROW_2 = 'M101,198 C109,201 131,201 139,198';
const ABS_ROW_3 = 'M102,220 C110,223 130,223 138,220';
const KNEECAP = 'M97,350 C94,358 95,369 99,374 C105,376 111,371 112,362 C113,354 110,348 106,346';
const SPINE_LINE = 'M120,112 L120,250';

// ------------------------------------------------------------- front muscles

const DELTS =
  'M92,98 C81,101 72,109 68,121 C66,131 67,143 70,151 C78,148 85,140 89,129 ' +
  'C91,119 92,107 92,98 Z';

const PECTORALS =
  'M118,110 C105,109 95,113 89,122 C85,130 84,142 88,152 C95,162 108,166 115,160 ' +
  'C118,156 119,148 119,138 Z';

const SERRATUS =
  'M95,156 C88,160 84,168 83,177 C83,186 86,194 91,196 C95,190 97,178 97,167 Z';

const ABS =
  'M105,154 L135,154 C138,164 140,182 140,202 C140,220 137,236 131,248 L109,248 ' +
  'C103,236 100,220 100,202 C100,182 102,164 105,154 Z';

const BICEPS =
  'M88,122 C79,128 72,139 70,153 C68,167 69,183 72,195 C78,199 84,194 86,182 ' +
  'C88,167 88,144 88,131 Z';

const FOREARMS =
  'M84,210 C75,218 69,231 66,246 C62,262 61,279 61,294 C60,304 63,311 68,312 ' +
  'C73,310 76,302 78,291 C80,272 82,253 83,238 C84,226 85,216 85,212 Z';

const QUADS =
  'M92,260 C87,276 84,296 85,316 C86,334 90,348 96,356 C104,354 110,342 112,324 ' +
  'C114,302 111,276 106,262 Z';

const ADDUCTORS =
  'M117,254 C111,264 107,280 107,298 C107,314 110,326 115,332 C118,326 120,312 120,296 ' +
  'C120,278 119,262 118,254 Z';

const ABDUCTORS =
  'M91,240 C85,250 82,264 82,280 C82,292 85,300 89,304 C92,296 93,282 93,268 ' +
  'C93,256 92,246 92,240 Z';

// -------------------------------------------------------------- back muscles

const TRAPS =
  'M120,98 C109,98 99,104 93,112 C89,120 92,134 99,148 C106,163 113,173 120,178 ' +
  'C127,173 134,163 141,148 C148,134 151,120 147,112 C141,104 131,98 120,98 Z';

const LEVATOR_SCAPULAE =
  'M112,88 C107,94 104,103 105,112 C107,118 111,118 113,112 C114,103 113,94 113,88 Z';

const UPPER_BACK =
  'M120,142 C108,142 99,148 95,158 C92,168 96,182 105,190 L135,190 ' +
  'C144,182 148,168 145,158 C141,148 132,142 120,142 Z';

const LATS =
  'M101,140 C91,148 84,163 82,180 C80,197 83,214 90,226 C99,231 107,224 110,211 ' +
  'C113,192 112,167 107,151 Z';

const SPINE =
  'M115,156 C111,172 110,190 111,210 C112,226 115,240 119,248 L121,248 ' +
  'C125,240 128,226 129,210 C130,190 129,172 125,156 Z';

const TRICEPS =
  'M88,122 C78,129 72,141 70,156 C68,172 69,189 73,201 C79,205 85,199 87,187 ' +
  'C89,171 89,145 88,131 Z';

const GLUTES =
  'M92,234 C84,244 81,258 81,275 C81,292 88,306 99,311 C110,314 118,304 120,290 ' +
  'C121,273 118,252 113,240 Z';

const HAMSTRINGS =
  'M92,312 C87,327 84,347 85,366 C86,381 90,393 97,399 C105,397 110,384 112,368 ' +
  'C114,347 111,327 106,314 Z';

const CALVES =
  'M93,394 C88,407 85,421 86,436 C87,450 92,461 99,465 C107,463 112,452 113,438 ' +
  'C114,421 111,405 106,394 Z';

/** Reflects its children across the figure's centre line (x = 120). */
function Mirrored({ children }: PropsWithChildren) {
  return (
    <>
      {children}
      <G transform="translate(240,0) scale(-1,1)">{children}</G>
    </>
  );
}

export function MuscleBodyMap({ view, selectedMuscle, onSelectMuscle }: MuscleBodyMapProps) {
  const theme = useTheme();

  /**
   * Unselected muscles stay as faint shaded contours so the figure reads like
   * an anatomy plate; the selected one fills with the accent gradient.
   */
  function muscleProps(muscle: string) {
    const selected = selectedMuscle === muscle;
    return {
      fill: selected ? 'url(#muscleFill)' : theme.bodyShade,
      fillOpacity: selected ? 1 : 0.22,
      stroke: selected ? theme.accent : theme.bodyLine,
      strokeWidth: selected ? 1.8 : 0.7,
      strokeOpacity: selected ? 1 : 0.5,
      onPress: () => onSelectMuscle(muscle),
    };
  }

  const limbProps = {
    fill: 'url(#bodyFill)',
    stroke: theme.bodyLine,
    strokeWidth: 1,
    strokeOpacity: 0.75,
  };

  const creaseProps = {
    stroke: theme.bodyLine,
    strokeWidth: 0.9,
    strokeOpacity: 0.55,
    fill: 'none',
    strokeLinecap: 'round' as const,
  };

  return (
    <Svg viewBox="0 0 240 520" width="100%" height="100%">
      <Defs>
        <LinearGradient id="bodyFill" x1="0.15" y1="0" x2="0.95" y2="1">
          <Stop offset="0" stopColor={theme.bodyLit} />
          <Stop offset="1" stopColor={theme.bodyShade} />
        </LinearGradient>
        <LinearGradient id="muscleFill" x1="0" y1="0" x2="0.8" y2="1">
          <Stop offset="0" stopColor={theme.accentAlt} />
          <Stop offset="1" stopColor={theme.accent} />
        </LinearGradient>
      </Defs>

      {/* Silhouette — decorative, not tappable. */}
      <Path d={NECK} {...limbProps} />
      <Path d={HEAD} {...limbProps} />
      <Path d={TORSO} {...limbProps} />
      <Mirrored>
        <Path d={ARM} {...limbProps} />
        <Path d={LEG} {...limbProps} />
      </Mirrored>

      {view === 'front' ? (
        <>
          <Path d={ABS} {...muscleProps('abs')} />
          <Mirrored>
            <Path d={PECTORALS} {...muscleProps('pectorals')} />
            <Path d={DELTS} {...muscleProps('delts')} />
            <Path d={SERRATUS} {...muscleProps('serratus_anterior')} />
            <Path d={BICEPS} {...muscleProps('biceps')} />
            <Path d={FOREARMS} {...muscleProps('forearms')} />
            <Path d={ABDUCTORS} {...muscleProps('abductors')} />
            <Path d={QUADS} {...muscleProps('quads')} />
            <Path d={ADDUCTORS} {...muscleProps('adductors')} />
          </Mirrored>
          <G pointerEvents="none">
            <Mirrored>
              <Path d={CLAVICLE} {...creaseProps} />
              <Path d={KNEECAP} {...creaseProps} />
            </Mirrored>
            <Path d={STERNUM} {...creaseProps} />
            <Path d={ABS_MIDLINE} {...creaseProps} />
            <Path d={ABS_ROW_1} {...creaseProps} />
            <Path d={ABS_ROW_2} {...creaseProps} />
            <Path d={ABS_ROW_3} {...creaseProps} />
          </G>
        </>
      ) : (
        <>
          <Path d={TRAPS} {...muscleProps('traps')} />
          <Path d={UPPER_BACK} {...muscleProps('upper_back')} />
          <Path d={SPINE} {...muscleProps('spine')} />
          <Mirrored>
            <Path d={LEVATOR_SCAPULAE} {...muscleProps('levator_scapulae')} />
            <Path d={LATS} {...muscleProps('lats')} />
            <Path d={TRICEPS} {...muscleProps('triceps')} />
            <Path d={GLUTES} {...muscleProps('glutes')} />
            <Path d={HAMSTRINGS} {...muscleProps('hamstrings')} />
            <Path d={CALVES} {...muscleProps('calves')} />
          </Mirrored>
          <G pointerEvents="none">
            <Path d={SPINE_LINE} {...creaseProps} />
          </G>
        </>
      )}
    </Svg>
  );
}
