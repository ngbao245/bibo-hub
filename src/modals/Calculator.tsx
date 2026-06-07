import { useState, useCallback } from 'react';
import { useShortcut } from '@/hooks/useShortcut';
import { useModalStore } from '@/stores/modalStore';
import ToolModal from '@/components/ToolModal';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/cn';

// ============================================================
// Calculator Modal - máy tính cơ bản
// ============================================================
//
// Logic giữ nguyên v1: cộng/trừ/nhân/chia, dấu thập phân, clear.
// Đăng ký shortcut Alt+C để toggle (mở/đóng).
// ============================================================

export default function Calculator() {
  // Toggle modal qua store khi bấm Alt+C
  const toggle = useModalStore((s) => s.toggle);

  // useCallback giữ reference ổn định để useShortcut không re-register liên tục
  const handleShortcut = useCallback(() => toggle('calculator'), [toggle]);

  useShortcut({
    key: 'alt+c',
    label: 'Calculator',
    group: 'Tools',
    handler: handleShortcut,
  });

  return (
    <ToolModal id="calculator" title="Máy tính" className="max-w-xs">
      <CalculatorContent />
    </ToolModal>
  );
}

// ============================================================
// Phần tính toán tách ra component riêng
// ============================================================
function CalculatorContent() {
  const [display, setDisplay] = useState('0');
  // Operand đầu tiên đã chốt (chờ tính)
  const [previous, setPrevious] = useState<number | null>(null);
  // Operator đang chờ (+, -, ×, ÷)
  const [operator, setOperator] = useState<string | null>(null);
  // Sau khi bấm operator, lần gõ số tiếp theo phải reset display
  const [waitingForOperand, setWaitingForOperand] = useState(false);

  const inputDigit = (digit: string) => {
    if (waitingForOperand) {
      setDisplay(digit);
      setWaitingForOperand(false);
    } else {
      setDisplay(display === '0' ? digit : display + digit);
    }
  };

  const inputDot = () => {
    if (waitingForOperand) {
      setDisplay('0.');
      setWaitingForOperand(false);
      return;
    }
    if (!display.includes('.')) {
      setDisplay(display + '.');
    }
  };

  const clear = () => {
    setDisplay('0');
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(false);
  };

  const performCalculation = (op: string, a: number, b: number): number => {
    switch (op) {
      case '+': return a + b;
      case '-': return a - b;
      case '×': return a * b;
      case '÷': return b === 0 ? NaN : a / b;
      default: return b;
    }
  };

  const handleOperator = (nextOp: string) => {
    const value = parseFloat(display);

    if (previous === null) {
      setPrevious(value);
    } else if (operator) {
      const result = performCalculation(operator, previous, value);
      setDisplay(String(result));
      setPrevious(result);
    }

    setWaitingForOperand(true);
    setOperator(nextOp);
  };

  const handleEquals = () => {
    if (previous === null || operator === null) return;
    const value = parseFloat(display);
    const result = performCalculation(operator, previous, value);
    setDisplay(String(result));
    setPrevious(null);
    setOperator(null);
    setWaitingForOperand(true);
  };

  // Layout phím: AC, ÷, ×, -, +, =, 0-9, .
  const buttons: Array<{
    label: string;
    onClick: () => void;
    variant?: 'default' | 'secondary' | 'destructive' | 'outline';
    span?: 'col-span-2';
  }> = [
    { label: 'AC', onClick: clear, variant: 'destructive' },
    { label: '÷', onClick: () => handleOperator('÷'), variant: 'secondary' },
    { label: '×', onClick: () => handleOperator('×'), variant: 'secondary' },
    { label: '−', onClick: () => handleOperator('-'), variant: 'secondary' },

    { label: '7', onClick: () => inputDigit('7'), variant: 'outline' },
    { label: '8', onClick: () => inputDigit('8'), variant: 'outline' },
    { label: '9', onClick: () => inputDigit('9'), variant: 'outline' },
    { label: '+', onClick: () => handleOperator('+'), variant: 'secondary' },

    { label: '4', onClick: () => inputDigit('4'), variant: 'outline' },
    { label: '5', onClick: () => inputDigit('5'), variant: 'outline' },
    { label: '6', onClick: () => inputDigit('6'), variant: 'outline' },
    { label: '=', onClick: handleEquals, variant: 'default' },

    { label: '1', onClick: () => inputDigit('1'), variant: 'outline' },
    { label: '2', onClick: () => inputDigit('2'), variant: 'outline' },
    { label: '3', onClick: () => inputDigit('3'), variant: 'outline' },
    { label: '0', onClick: () => inputDigit('0'), variant: 'outline', span: 'col-span-2' },
    { label: '.', onClick: inputDot, variant: 'outline' },
  ];

  return (
    <div className="space-y-3">
      {/* Display */}
      <div className="border border-border bg-background px-4 py-4 text-right">
        <div className="truncate font-mono text-3xl text-foreground">
          {display === 'NaN' ? 'Lỗi' : display}
        </div>
      </div>

      {/* Buttons grid 4 cột */}
      <div className="grid grid-cols-4 gap-2">
        {buttons.map((btn, i) => (
          <Button
            key={i}
            variant={btn.variant ?? 'outline'}
            onClick={btn.onClick}
            className={cn('h-12 text-base font-medium', btn.span)}
          >
            {btn.label}
          </Button>
        ))}
      </div>
    </div>
  );
}
