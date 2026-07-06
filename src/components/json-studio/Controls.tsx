import styles from './Controls.module.css';

// ============================================================
// Controls cho graph view (zoom in/out, fit, root)
// Extract từ jsoncrack-react. Apache 2.0 license.
// ============================================================

interface ControlsProps {
  onFocusRoot: () => void;
  onCenterView: () => void;
  onZoomOut: () => void;
  onZoomIn: () => void;
}

export const Controls = ({ onFocusRoot, onCenterView, onZoomOut, onZoomIn }: ControlsProps) => {
  return (
    <div className={styles.controls}>
      <button
        className={styles.button}
        type="button"
        onClick={onFocusRoot}
        title="Center first node"
      >
        Root
      </button>
      <button className={styles.button} type="button" onClick={onCenterView} title="Fit view">
        Fit
      </button>
      <button className={styles.button} type="button" onClick={onZoomOut} title="Zoom out">
        -
      </button>
      <button className={styles.button} type="button" onClick={onZoomIn} title="Zoom in">
        +
      </button>
    </div>
  );
};