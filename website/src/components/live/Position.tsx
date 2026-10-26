import './live.css';
import { GlassButton } from '../glassyui/glass-button';
import { GlassSwitch } from '../glassyui/glass-switch';
import { LiveCode } from './code';
import { useLiveConfig } from './use-live';
import { configure, withToast } from '../../lib/live';
import type { LiveConfig } from '../../lib/live';

type Position = NonNullable<LiveConfig['position']>;

const positions: Position[] = ['top-left', 'top-center', 'top-right', 'bottom-left', 'bottom-center', 'bottom-right'];

export default function PositionPicker() {
  const { position = 'top-center', reverseOrder = false } = useLiveConfig();

  const move = (next: Position) => {
    configure({ position: next });
    withToast((toast) => toast.success(`Now at ${next.replace('-', ' ')}`, { id: 'position' }));
  };

  const code = `<Toaster
  position="${position}"
  reverseOrder={${reverseOrder}}
/>`;

  return (
    <div className="position">
      <LiveCode code={code} file="App.tsx" />
      <div className="position-controls">
        <div className="position-grid" role="group" aria-label="Toaster position">
          {positions.map((p) => (
            <GlassButton
              key={p}
              // A set of toggle buttons: a radio group would promise arrow-key
              // movement these buttons do not have.
              aria-pressed={p === position}
              lens={false}
              variant={p === position ? 'prominent' : 'soft'}
              size="md"
              onClick={() => move(p)}
            >
              {p}
            </GlassButton>
          ))}
        </div>
        <label className="switch-row">
          <GlassSwitch
            checked={reverseOrder}
            onCheckedChange={(checked) => {
              configure({ reverseOrder: checked });
              withToast((toast) => {
                toast('First');
                setTimeout(() => toast('Second'), 250);
                setTimeout(() => toast('Third'), 500);
              });
            }}
          />
          <span>
            Newest last <code>reverseOrder</code>
          </span>
        </label>
      </div>
    </div>
  );
}
