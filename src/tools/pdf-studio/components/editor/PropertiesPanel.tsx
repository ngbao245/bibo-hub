// ============================================================
// PDF Studio Edit PDF - Properties panel (right sidebar)
// ============================================================
// Type-specific fields cho từng loại object:
// - Text: content, font family/size/weight/style, color, align
// - Shape: strokeColor, fillColor, strokeWidth, shapeKind
// - Symbol: color, strokeWidth
// - Path/Highlight: color, strokeWidth
// - Text-replacement: content, fontSize, color, backgroundColor
// - Common: X/Y/W/H, rotation, opacity, layer
//
// Gesture: startGesture on focus, commitGesture on blur → property edit
// vào history 1 entry cho mỗi input session (không spam mỗi keystroke).
// ============================================================

import { useEditorStore } from '../../lib/useEditorStore';
import type {
  EditorObject,
  TextObject,
  ShapeObject,
  SymbolObject,
  PathObject,
  TextReplacementObject,
} from '../../lib/editor-objects';

const FONT_FAMILIES = ['Helvetica', 'Times-Roman', 'Courier', 'Arial', 'Georgia'] as const;

export function PropertiesPanel() {
  const { objects, selectedIds, updateObject, startGesture, commitGesture } = useEditorStore();
  const selected = objects.filter((o) => selectedIds.includes(o.id));

  if (selected.length === 0) {
    return (
      <aside className="hidden lg:flex w-64 flex-col border-l border-border bg-background overflow-y-auto">
        <div className="border-b border-border px-3 py-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Thuoc tinh
          </h2>
        </div>
        <p className="p-3 text-[11px] text-muted-foreground">Chon 1 object de xem thuoc tinh.</p>
      </aside>
    );
  }

  const obj = selected[0];

  const set = <K extends keyof EditorObject>(key: K, value: EditorObject[K]) => {
    updateObject(obj.id, { [key]: value } as Partial<EditorObject>);
  };

  // Type-specific set (bypass TS generic constraints)
  const setTyped = (key: string, value: unknown) => {
    updateObject(obj.id, { [key]: value } as unknown as Partial<EditorObject>);
  };

  // Gesture wrappers cho input focus/blur → property edits vào history
  const onGestureStart = () => startGesture();
  const onGestureEnd = (description: string) => () => commitGesture(description);

  return (
    <aside className="hidden lg:flex w-64 flex-col border-l border-border bg-background overflow-y-auto">
      <div className="border-b border-border px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Thuoc tinh
        </h2>
        <p className="mt-0.5 text-[10px] text-muted-foreground capitalize">
          {obj.type}
          {selected.length > 1 && ` (+${selected.length - 1} obj)`}
        </p>
      </div>

      <div className="flex flex-col gap-4 p-3">
        {/* ─── Type-specific fields ─── */}
        {obj.type === 'text' && <TextFields obj={obj as TextObject} setTyped={setTyped} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />}
        {obj.type === 'shape' && <ShapeFields obj={obj as ShapeObject} setTyped={setTyped} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />}
        {obj.type === 'symbol' && <SymbolFields obj={obj as SymbolObject} setTyped={setTyped} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />}
        {(obj.type === 'path' || obj.type === 'highlight') && <PathFields obj={obj as PathObject} setTyped={setTyped} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />}
        {obj.type === 'text-replacement' && <TextReplacementFields obj={obj as TextReplacementObject} setTyped={setTyped} onGestureStart={onGestureStart} onGestureEnd={onGestureEnd} />}

        {/* ─── Common transform fields ─── */}
        <Section title="Vi tri & kich thuoc">
          <div className="grid grid-cols-2 gap-2">
            <Field label="X">
              <NumberInput
                value={Math.round(obj.x)}
                onChange={(v) => set('x', v)}
                onFocus={onGestureStart}
                onBlur={onGestureEnd('Move X')}
              />
            </Field>
            <Field label="Y">
              <NumberInput
                value={Math.round(obj.y)}
                onChange={(v) => set('y', v)}
                onFocus={onGestureStart}
                onBlur={onGestureEnd('Move Y')}
              />
            </Field>
            <Field label="W">
              <NumberInput
                value={Math.round(obj.width)}
                onChange={(v) => set('width', v)}
                onFocus={onGestureStart}
                onBlur={onGestureEnd('Resize W')}
              />
            </Field>
            <Field label="H">
              <NumberInput
                value={Math.round(obj.height)}
                onChange={(v) => set('height', v)}
                onFocus={onGestureStart}
                onBlur={onGestureEnd('Resize H')}
              />
            </Field>
          </div>
        </Section>

        <Section title="Rotation & Opacity">
          <Field label={`Rotation: ${obj.rotation}°`}>
            <input
              type="range"
              min={0}
              max={359}
              value={obj.rotation}
              onChange={(e) => set('rotation', +e.target.value)}
              onMouseDown={onGestureStart}
              onMouseUp={onGestureEnd('Rotate')}
              className="w-full"
            />
          </Field>
          <Field label={`Opacity: ${obj.opacity}%`}>
            <input
              type="range"
              min={0}
              max={100}
              value={obj.opacity}
              onChange={(e) => set('opacity', +e.target.value)}
              onMouseDown={onGestureStart}
              onMouseUp={onGestureEnd('Opacity')}
              className="w-full"
            />
          </Field>
        </Section>

        <Section title="Layer">
          <NumberInput
            value={obj.layerOrder}
            onChange={(v) => set('layerOrder', v)}
            onFocus={onGestureStart}
            onBlur={onGestureEnd('Layer')}
          />
        </Section>
      </div>
    </aside>
  );
}

// ─── Type-specific field groups ─────────────────────────────

interface TypedFieldsProps<T> {
  obj: T;
  setTyped: (key: string, value: unknown) => void;
  onGestureStart: () => void;
  onGestureEnd: (description: string) => () => void;
}

function TextFields({ obj, setTyped, onGestureStart, onGestureEnd }: TypedFieldsProps<TextObject>) {
  return (
    <Section title="Text">
      <Field label="Noi dung">
        <textarea
          value={obj.content}
          onChange={(e) => setTyped('content', e.target.value)}
          onFocus={onGestureStart}
          onBlur={onGestureEnd('Edit text')}
          rows={3}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          placeholder="Nhap noi dung..."
        />
      </Field>
      <Field label="Font">
        <select
          value={obj.fontFamily}
          onChange={(e) => setTyped('fontFamily', e.target.value)}
          onFocus={onGestureStart}
          onBlur={onGestureEnd('Font family')}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground"
        >
          {FONT_FAMILIES.map((f) => (
            <option key={f} value={f}>
              {f}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
          <NumberInput
            value={obj.fontSize}
            onChange={(v) => setTyped('fontSize', v)}
            onFocus={onGestureStart}
            onBlur={onGestureEnd('Font size')}
            min={6}
            max={144}
          />
        </Field>
        <Field label="Mau">
          <ColorInput
            value={obj.color}
            onChange={(v) => setTyped('color', v)}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd('Text color')}
          />
        </Field>
      </div>
      <div className="flex gap-1">
        <ToggleButton
          active={obj.fontWeight === 'bold'}
          onClick={() => {
            onGestureStart();
            setTyped('fontWeight', obj.fontWeight === 'bold' ? 'normal' : 'bold');
            onGestureEnd('Bold')();
          }}
        >
          <strong>B</strong>
        </ToggleButton>
        <ToggleButton
          active={obj.fontStyle === 'italic'}
          onClick={() => {
            onGestureStart();
            setTyped('fontStyle', obj.fontStyle === 'italic' ? 'normal' : 'italic');
            onGestureEnd('Italic')();
          }}
        >
          <em>I</em>
        </ToggleButton>
      </div>
      <Field label="Can le">
        <div className="flex gap-1">
          {(['left', 'center', 'right'] as const).map((a) => (
            <button
              key={a}
              type="button"
              onClick={() => {
                onGestureStart();
                setTyped('align', a);
                onGestureEnd('Align')();
              }}
              className={`flex-1 rounded border px-2 py-1 text-[10px] transition-colors ${
                obj.align === a
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-input text-muted-foreground hover:bg-muted'
              }`}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
    </Section>
  );
}

function ShapeFields({ obj, setTyped, onGestureStart, onGestureEnd }: TypedFieldsProps<ShapeObject>) {
  return (
    <Section title="Shape">
      <div className="grid grid-cols-2 gap-2">
        <Field label="Vien">
          <ColorInput
            value={obj.strokeColor}
            onChange={(v) => setTyped('strokeColor', v)}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd('Stroke color')}
          />
        </Field>
        <Field label="Nen">
          <ColorInput
            value={obj.fillColor === 'transparent' ? '#ffffff' : obj.fillColor}
            onChange={(v) => setTyped('fillColor', v)}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd('Fill color')}
            allowTransparent
            isTransparent={obj.fillColor === 'transparent'}
            onTransparent={() => {
              onGestureStart();
              setTyped('fillColor', 'transparent');
              onGestureEnd('Fill transparent')();
            }}
          />
        </Field>
      </div>
      <Field label={`Do day vien: ${obj.strokeWidth}px`}>
        <input
          type="range"
          min={1}
          max={20}
          value={obj.strokeWidth}
          onChange={(e) => setTyped('strokeWidth', +e.target.value)}
          onMouseDown={onGestureStart}
          onMouseUp={onGestureEnd('Stroke width')}
          className="w-full"
        />
      </Field>
    </Section>
  );
}

function SymbolFields({ obj, setTyped, onGestureStart, onGestureEnd }: TypedFieldsProps<SymbolObject>) {
  return (
    <Section title="Symbol">
      <Field label="Mau">
        <ColorInput
          value={obj.color}
          onChange={(v) => setTyped('color', v)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd('Color')}
        />
      </Field>
      <Field label={`Do day: ${obj.strokeWidth}px`}>
        <input
          type="range"
          min={1}
          max={10}
          value={obj.strokeWidth}
          onChange={(e) => setTyped('strokeWidth', +e.target.value)}
          onMouseDown={onGestureStart}
          onMouseUp={onGestureEnd('Stroke width')}
          className="w-full"
        />
      </Field>
    </Section>
  );
}

function PathFields({ obj, setTyped, onGestureStart, onGestureEnd }: TypedFieldsProps<PathObject>) {
  return (
    <Section title={obj.type === 'highlight' ? 'Highlight' : 'Path'}>
      <Field label="Mau">
        <ColorInput
          value={obj.color}
          onChange={(v) => setTyped('color', v)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd('Color')}
        />
      </Field>
      {obj.type === 'path' && (
        <Field label={`Do day: ${obj.strokeWidth}px`}>
          <input
            type="range"
            min={1}
            max={20}
            value={obj.strokeWidth}
            onChange={(e) => setTyped('strokeWidth', +e.target.value)}
            onMouseDown={onGestureStart}
            onMouseUp={onGestureEnd('Stroke width')}
            className="w-full"
          />
        </Field>
      )}
    </Section>
  );
}

function TextReplacementFields({
  obj,
  setTyped,
  onGestureStart,
  onGestureEnd,
}: TypedFieldsProps<TextReplacementObject>) {
  return (
    <Section title="Text replacement">
      <Field label="Noi dung">
        <textarea
          value={obj.content}
          onChange={(e) => setTyped('content', e.target.value)}
          onFocus={onGestureStart}
          onBlur={onGestureEnd('Edit content')}
          rows={2}
          className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Size">
          <NumberInput
            value={obj.fontSize}
            onChange={(v) => setTyped('fontSize', v)}
            onFocus={onGestureStart}
            onBlur={onGestureEnd('Font size')}
            min={6}
            max={72}
          />
        </Field>
        <Field label="Mau chu">
          <ColorInput
            value={obj.color}
            onChange={(v) => setTyped('color', v)}
            onGestureStart={onGestureStart}
            onGestureEnd={onGestureEnd('Text color')}
          />
        </Field>
      </div>
      <Field label="Nen (whiteout)">
        <ColorInput
          value={obj.backgroundColor}
          onChange={(v) => setTyped('backgroundColor', v)}
          onGestureStart={onGestureStart}
          onGestureEnd={onGestureEnd('BG color')}
        />
      </Field>
    </Section>
  );
}

// ─── Primitives ─────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-border/60 bg-muted/20 p-2">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-0.5 text-[10px] text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  onFocus,
  onBlur,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  onFocus?: () => void;
  onBlur?: () => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      onChange={(e) => onChange(+e.target.value)}
      onFocus={onFocus}
      onBlur={onBlur}
      className="w-full rounded border border-input bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

function ColorInput({
  value,
  onChange,
  onGestureStart,
  onGestureEnd,
  allowTransparent,
  isTransparent,
  onTransparent,
}: {
  value: string;
  onChange: (v: string) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
  allowTransparent?: boolean;
  isTransparent?: boolean;
  onTransparent?: () => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        // key={value} forces remount → controlled color picker sync với selection change
        key={value}
        type="color"
        value={isTransparent ? '#ffffff' : value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onGestureStart}
        onBlur={onGestureEnd}
        className="h-7 w-10 shrink-0 cursor-pointer rounded border border-input bg-background p-0.5"
      />
      <input
        type="text"
        value={isTransparent ? 'transparent' : value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onGestureStart}
        onBlur={onGestureEnd}
        readOnly={isTransparent}
        className="w-full rounded border border-input bg-background px-1.5 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
      />
      {allowTransparent && (
        <button
          type="button"
          onClick={onTransparent}
          className={`shrink-0 rounded border px-1.5 py-1 text-[9px] transition-colors ${
            isTransparent
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-input text-muted-foreground hover:bg-muted'
          }`}
          title="Trong suot"
        >
          ○
        </button>
      )}
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-7 w-7 rounded border text-xs transition-colors ${
        active
          ? 'border-primary bg-primary/10 text-primary'
          : 'border-input text-muted-foreground hover:bg-muted'
      }`}
    >
      {children}
    </button>
  );
}
